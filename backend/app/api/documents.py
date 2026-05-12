import magic
from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.document import Document, Tag, DocumentTag, Person, DocumentPerson, Organization, DocumentOrganization
from app.schemas.document import (
    DocumentResponse, DocumentUpdate, DocumentList,
    SearchRequest, SearchResponse, StatsResponse,
)
from app.services.storage import storage_service
from app.services.ocr import extract_text
from app.services.classifier import classifier_service
from app.services.search import search_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    auto_classify: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Upload a document, extract text, classify with AI, and index for search."""
    file_data = await file.read()
    if not file_data:
        raise HTTPException(400, "Empty file")

    mime_type = magic.from_buffer(file_data, mime=True)
    file_hash = storage_service.compute_hash(file_data)

    existing = db.query(Document).filter(Document.file_hash == file_hash, Document.is_deleted == False).first()
    if existing:
        raise HTTPException(409, detail={"message": "Duplicate file", "existing_id": existing.id, "title": existing.title})

    storage_path = storage_service.build_storage_path(file_hash, file.filename)
    storage_service.upload_file(file_data, storage_path, mime_type)

    full_text = extract_text(file_data, mime_type, file.filename)

    classification = {}
    if auto_classify:
        classification = classifier_service.classify(full_text, file.filename, mime_type)

    doc = Document(
        title=classification.get("title", file.filename),
        original_filename=file.filename,
        category=classification.get("category"),
        subcategory=classification.get("subcategory"),
        file_hash=file_hash,
        mime_type=mime_type,
        file_size=len(file_data),
        language=classification.get("language", "en"),
        summary=classification.get("summary"),
        full_text=full_text,
        ai_confidence=classification.get("confidence"),
        storage_path=storage_path,
        source="upload",
        ai_metadata=classification,
    )

    if classification.get("date"):
        try:
            doc.document_date = date.fromisoformat(classification["date"])
        except (ValueError, TypeError):
            pass

    db.add(doc)
    db.flush()

    tags = _sync_tags(db, doc.id, classification.get("tags", []))
    _sync_people(db, doc.id, classification.get("people", []))
    _sync_organizations(db, doc.id, classification.get("organizations", []))

    db.commit()
    db.refresh(doc)

    search_service.index_document({
        "id": doc.id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "category": doc.category,
        "subcategory": doc.subcategory,
        "summary": doc.summary,
        "full_text": doc.full_text,
        "tags": [t.name for t in doc.tags],
        "people": [p.name for p in doc.people],
        "organizations": [o.name for o in doc.organizations],
        "language": doc.language,
        "source": doc.source,
        "is_archived": doc.is_archived,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "document_date": str(doc.document_date) if doc.document_date else None,
        "created_at": doc.created_at.isoformat(),
    })

    return _to_response(doc)


@router.get("", response_model=DocumentList)
def list_documents(
    category: str | None = None,
    subcategory: str | None = None,
    is_archived: bool = False,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List documents with optional filters."""
    query = db.query(Document).filter(Document.is_deleted == False, Document.is_archived == is_archived)
    if category:
        query = query.filter(Document.category == category)
    if subcategory:
        query = query.filter(Document.subcategory == subcategory)

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()

    return DocumentList(
        documents=[_to_response(d) for d in docs],
        total=total, offset=offset, limit=limit,
    )


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Get document statistics."""
    total = db.query(Document).filter(Document.is_deleted == False).count()
    total_size = db.query(func.sum(Document.file_size)).filter(Document.is_deleted == False).scalar() or 0

    cats = db.query(Document.category, func.count()).filter(
        Document.is_deleted == False
    ).group_by(Document.category).all()

    return StatsResponse(
        total_documents=total,
        total_size_bytes=total_size,
        categories={c or "Uncategorized": n for c, n in cats},
        recent_uploads=db.query(Document).filter(Document.is_deleted == False).order_by(Document.created_at.desc()).limit(10).count(),
        pending_review=db.query(Document).filter(Document.is_deleted == False, Document.ai_confidence < 0.5).count(),
    )


@router.get("/search", response_model=SearchResponse)
def search_documents(
    q: str = "",
    category: str | None = None,
    tags: str | None = None,
    offset: int = 0,
    limit: int = 20,
):
    """Full-text search with Meilisearch."""
    filters = []
    if category:
        filters.append(f'category = "{category}"')
    if tags:
        for tag in tags.split(","):
            filters.append(f'tags = "{tag.strip()}"')

    filter_str = " AND ".join(filters) if filters else None
    result = search_service.search(q, filters=filter_str, offset=offset, limit=limit)

    return SearchResponse(
        hits=result.get("hits", []),
        total=result.get("estimatedTotalHits", 0),
        query=q,
        processing_time_ms=result.get("processingTimeMs", 0),
        facets=result.get("facetDistribution"),
    )


@router.get("/facets")
def get_facets():
    """Get category/tag/language counts for filters."""
    return search_service.get_facets()


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Get a single document by ID."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return _to_response(doc)


@router.get("/{doc_id}/download")
def download_document(doc_id: str, db: Session = Depends(get_db)):
    """Download the original file."""
    from fastapi.responses import Response
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    file_data = storage_service.download_file(doc.storage_path)
    return Response(
        content=file_data,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.title}"'},
    )


@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: str, update: DocumentUpdate, db: Session = Depends(get_db)):
    """Update document metadata."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    if update.title is not None:
        doc.title = update.title
    if update.category is not None:
        doc.category = update.category
    if update.subcategory is not None:
        doc.subcategory = update.subcategory
    if update.is_archived is not None:
        doc.is_archived = update.is_archived
    if update.folder_id is not None:
        doc.folder_id = update.folder_id
    if update.tags is not None:
        _sync_tags(db, doc.id, update.tags)

    db.commit()
    db.refresh(doc)

    search_service.index_document({
        "id": doc.id, "title": doc.title, "category": doc.category,
        "subcategory": doc.subcategory, "summary": doc.summary,
        "full_text": doc.full_text, "tags": [t.name for t in doc.tags],
        "people": [p.name for p in doc.people],
        "organizations": [o.name for o in doc.organizations],
        "language": doc.language, "source": doc.source,
        "is_archived": doc.is_archived, "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "document_date": str(doc.document_date) if doc.document_date else None,
        "created_at": doc.created_at.isoformat(),
    })

    return _to_response(doc)


@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Soft-delete a document."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.is_deleted = True
    db.commit()
    search_service.delete_document(doc_id)
    return {"status": "deleted", "id": doc_id}


@router.post("/{doc_id}/reclassify", response_model=DocumentResponse)
def reclassify_document(doc_id: str, db: Session = Depends(get_db)):
    """Re-run AI classification on a document."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    classification = classifier_service.classify(doc.full_text or "", doc.original_filename or "", doc.mime_type or "")

    doc.title = classification.get("title", doc.title)
    doc.category = classification.get("category")
    doc.subcategory = classification.get("subcategory")
    doc.summary = classification.get("summary")
    doc.ai_confidence = classification.get("confidence")
    doc.ai_metadata = classification

    if classification.get("date"):
        try:
            doc.document_date = date.fromisoformat(classification["date"])
        except (ValueError, TypeError):
            pass

    _sync_tags(db, doc.id, classification.get("tags", []))
    _sync_people(db, doc.id, classification.get("people", []))
    _sync_organizations(db, doc.id, classification.get("organizations", []))

    db.commit()
    db.refresh(doc)
    return _to_response(doc)


def _sync_tags(db: Session, doc_id: str, tag_names: list[str]):
    db.query(DocumentTag).filter(DocumentTag.document_id == doc_id).delete()
    for name in tag_names:
        name = name.strip().lower()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        db.add(DocumentTag(document_id=doc_id, tag_id=tag.id))


def _sync_people(db: Session, doc_id: str, names: list[str]):
    db.query(DocumentPerson).filter(DocumentPerson.document_id == doc_id).delete()
    for name in names:
        name = name.strip()
        if not name:
            continue
        person = db.query(Person).filter(Person.name == name).first()
        if not person:
            person = Person(name=name)
            db.add(person)
            db.flush()
        db.add(DocumentPerson(document_id=doc_id, person_id=person.id))


def _sync_organizations(db: Session, doc_id: str, names: list[str]):
    db.query(DocumentOrganization).filter(DocumentOrganization.document_id == doc_id).delete()
    for name in names:
        name = name.strip()
        if not name:
            continue
        org = db.query(Organization).filter(Organization.name == name).first()
        if not org:
            org = Organization(name=name)
            db.add(org)
            db.flush()
        db.add(DocumentOrganization(document_id=doc_id, organization_id=org.id))


def _to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        category=doc.category,
        subcategory=doc.subcategory,
        file_hash=doc.file_hash,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        page_count=doc.page_count,
        language=doc.language,
        summary=doc.summary,
        ai_confidence=doc.ai_confidence,
        storage_path=doc.storage_path,
        thumbnail_path=doc.thumbnail_path,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        document_date=doc.document_date,
        is_archived=doc.is_archived,
        source=doc.source,
        folder_id=doc.folder_id,
        tags=[t.name for t in doc.tags],
        people=[p.name for p in doc.people],
        organizations=[o.name for o in doc.organizations],
    )
