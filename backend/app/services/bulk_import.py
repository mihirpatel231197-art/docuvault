import os
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.services.watcher import ingest_file, SUPPORTED_EXTENSIONS

logger = logging.getLogger(__name__)


def bulk_import(directory: str, max_workers: int = 2, dry_run: bool = False) -> dict:
    """Import all supported files from a directory tree."""
    root = Path(directory)
    if not root.exists():
        raise ValueError(f"Directory not found: {directory}")

    files = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            if not path.name.startswith(".") and not path.name.startswith("~$"):
                files.append(str(path))

    total = len(files)
    logger.info(f"Found {total} files to import from {directory}")

    if dry_run:
        return {
            "total": total,
            "files": [os.path.basename(f) for f in files[:50]],
            "dry_run": True,
        }

    results = {"total": total, "success": 0, "failed": 0, "skipped": 0, "errors": []}

    for i, file_path in enumerate(files):
        try:
            logger.info(f"[{i+1}/{total}] Importing: {os.path.basename(file_path)}")
            ingest_file(file_path)
            results["success"] += 1
        except Exception as e:
            error_msg = str(e)
            if "Duplicate" in error_msg or "duplicate" in error_msg:
                results["skipped"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "file": os.path.basename(file_path),
                    "error": error_msg,
                })
                logger.error(f"Failed: {file_path} - {e}")

        if (i + 1) % 10 == 0:
            logger.info(f"Progress: {i+1}/{total} ({results['success']} ok, {results['skipped']} dupes, {results['failed']} failed)")

    logger.info(f"Bulk import complete: {results}")
    return results
