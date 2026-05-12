from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.dedup import find_duplicates, find_similar_titles, merge_duplicates
from app.services.workflows import get_expiring_documents
from app.services.bulk_import import bulk_import

router = APIRouter(prefix="/api", tags=["automation"])


@router.get("/duplicates")
def get_duplicates(
    include_similar: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Find duplicate documents by file hash and optionally by similar titles."""
    result = {"hash_duplicates": find_duplicates(db)}
    if include_similar:
        result["similar_titles"] = find_similar_titles(db)
    return result


@router.post("/duplicates/merge")
def merge_dupes(
    keep_id: str,
    delete_ids: list[str],
    db: Session = Depends(get_db),
):
    """Keep one document and soft-delete the rest."""
    return merge_duplicates(db, keep_id, delete_ids)


@router.get("/expiring")
def get_expiring(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Get documents with dates expiring within N days."""
    return get_expiring_documents(db, days)


@router.post("/bulk-import")
def start_bulk_import(
    directory: str,
    dry_run: bool = Query(True),
    background_tasks: BackgroundTasks = None,
):
    """Import all documents from a directory. Use dry_run=true to preview."""
    if dry_run:
        return bulk_import(directory, dry_run=True)

    background_tasks.add_task(bulk_import, directory, dry_run=False)
    return {"status": "started", "directory": directory}
