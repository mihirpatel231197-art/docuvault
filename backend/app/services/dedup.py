import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.document import Document

logger = logging.getLogger(__name__)


def find_duplicates(db: Session) -> list[dict]:
    """Find documents with identical file hashes."""
    dupes = (
        db.query(Document.file_hash, func.count(Document.id).label("count"))
        .filter(Document.is_deleted == False, Document.file_hash.isnot(None))
        .group_by(Document.file_hash)
        .having(func.count(Document.id) > 1)
        .all()
    )

    results = []
    for file_hash, count in dupes:
        docs = (
            db.query(Document)
            .filter(Document.file_hash == file_hash, Document.is_deleted == False)
            .order_by(Document.created_at)
            .all()
        )
        results.append({
            "file_hash": file_hash,
            "count": count,
            "documents": [
                {
                    "id": d.id,
                    "title": d.title,
                    "original_filename": d.original_filename,
                    "file_size": d.file_size,
                    "created_at": d.created_at.isoformat(),
                    "source": d.source,
                    "category": d.category,
                }
                for d in docs
            ],
        })

    return results


def find_similar_titles(db: Session, threshold: float = 0.8) -> list[dict]:
    """Find documents with very similar titles (potential dupes with different content)."""
    docs = (
        db.query(Document)
        .filter(Document.is_deleted == False)
        .order_by(Document.title)
        .all()
    )

    similar_groups = []
    seen = set()

    for i, doc_a in enumerate(docs):
        if doc_a.id in seen:
            continue
        group = [doc_a]

        for doc_b in docs[i + 1:]:
            if doc_b.id in seen:
                continue
            if doc_a.file_hash == doc_b.file_hash:
                continue  # already caught by hash dedup

            sim = _title_similarity(doc_a.title, doc_b.title)
            if sim >= threshold:
                group.append(doc_b)
                seen.add(doc_b.id)

        if len(group) > 1:
            seen.add(doc_a.id)
            similar_groups.append({
                "reason": "similar_title",
                "documents": [
                    {
                        "id": d.id,
                        "title": d.title,
                        "original_filename": d.original_filename,
                        "file_size": d.file_size,
                        "file_hash": d.file_hash,
                        "created_at": d.created_at.isoformat(),
                    }
                    for d in group
                ],
            })

    return similar_groups


def merge_duplicates(db: Session, keep_id: str, delete_ids: list[str]) -> dict:
    """Keep one document, soft-delete the rest."""
    keep = db.query(Document).filter(Document.id == keep_id).first()
    if not keep:
        raise ValueError(f"Document {keep_id} not found")

    deleted = 0
    for doc_id in delete_ids:
        if doc_id == keep_id:
            continue
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.is_deleted = True
            deleted += 1

    db.commit()
    logger.info(f"Merged duplicates: kept {keep.title}, deleted {deleted}")

    return {"kept": keep_id, "deleted_count": deleted}


def _title_similarity(a: str, b: str) -> float:
    """Simple Jaccard similarity on word sets."""
    if not a or not b:
        return 0.0
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)
