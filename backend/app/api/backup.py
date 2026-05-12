import io
import json
import tarfile
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import Document, Tag, DocumentTag
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.get("/export")
def export_metadata(db: Session = Depends(get_db)):
    """Export all document metadata as JSON (no files, just the database)."""
    docs = db.query(Document).filter(Document.is_deleted == False).all()

    export_data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total_documents": len(docs),
        "documents": [],
    }

    for doc in docs:
        export_data["documents"].append({
            "id": doc.id,
            "title": doc.title,
            "original_filename": doc.original_filename,
            "category": doc.category,
            "subcategory": doc.subcategory,
            "file_hash": doc.file_hash,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "language": doc.language,
            "summary": doc.summary,
            "ai_confidence": doc.ai_confidence,
            "storage_path": doc.storage_path,
            "document_date": str(doc.document_date) if doc.document_date else None,
            "created_at": doc.created_at.isoformat(),
            "source": doc.source,
            "tags": [t.name for t in doc.tags],
            "people": [p.name for p in doc.people],
            "organizations": [o.name for o in doc.organizations],
            "ai_metadata": doc.ai_metadata,
        })

    content = json.dumps(export_data, indent=2)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="docuvault-export-{datetime.now().strftime("%Y%m%d")}.json"'},
    )


@router.get("/export/full")
def export_full(db: Session = Depends(get_db)):
    """Export metadata + all files as a tar.gz archive."""
    docs = db.query(Document).filter(Document.is_deleted == False).all()

    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        # Add metadata
        metadata = json.dumps({
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "documents": [{
                "id": d.id, "title": d.title, "category": d.category,
                "subcategory": d.subcategory, "storage_path": d.storage_path,
                "file_hash": d.file_hash, "original_filename": d.original_filename,
                "tags": [t.name for t in d.tags],
            } for d in docs],
        }, indent=2).encode()
        meta_info = tarfile.TarInfo(name="metadata.json")
        meta_info.size = len(metadata)
        tar.addfile(meta_info, io.BytesIO(metadata))

        # Add files
        for doc in docs:
            if not doc.storage_path:
                continue
            try:
                file_data = storage_service.download_file(doc.storage_path)
                ext = doc.original_filename.rsplit(".", 1)[-1] if doc.original_filename and "." in doc.original_filename else "bin"
                safe_title = "".join(c if c.isalnum() or c in " -_." else "_" for c in doc.title)
                filename = f"files/{doc.category or 'Other'}/{safe_title}.{ext}"

                file_info = tarfile.TarInfo(name=filename)
                file_info.size = len(file_data)
                tar.addfile(file_info, io.BytesIO(file_data))
            except Exception as e:
                logger.error(f"Failed to export {doc.title}: {e}")

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="docuvault-backup-{datetime.now().strftime("%Y%m%d")}.tar.gz"'},
    )


@router.post("/import")
async def import_metadata(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import document metadata from a JSON export."""
    content = await file.read()
    data = json.loads(content)

    imported = 0
    skipped = 0

    for doc_data in data.get("documents", []):
        existing = db.query(Document).filter(Document.id == doc_data["id"]).first()
        if existing:
            skipped += 1
            continue

        doc = Document(
            id=doc_data["id"],
            title=doc_data["title"],
            original_filename=doc_data.get("original_filename"),
            category=doc_data.get("category"),
            subcategory=doc_data.get("subcategory"),
            file_hash=doc_data.get("file_hash"),
            mime_type=doc_data.get("mime_type"),
            file_size=doc_data.get("file_size"),
            language=doc_data.get("language"),
            summary=doc_data.get("summary"),
            ai_confidence=doc_data.get("ai_confidence"),
            storage_path=doc_data.get("storage_path"),
            source=doc_data.get("source"),
            ai_metadata=doc_data.get("ai_metadata"),
        )

        if doc_data.get("document_date"):
            try:
                doc.document_date = datetime.fromisoformat(doc_data["document_date"]).date()
            except (ValueError, TypeError):
                pass

        db.add(doc)
        db.flush()

        for tag_name in doc_data.get("tags", []):
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(DocumentTag(document_id=doc.id, tag_id=tag.id))

        imported += 1

    db.commit()
    return {"imported": imported, "skipped": skipped}
