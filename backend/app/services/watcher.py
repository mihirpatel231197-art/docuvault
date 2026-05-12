import os
import time
import logging
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp",
    ".docx", ".xlsx", ".doc", ".xls", ".txt", ".csv", ".md",
}


class DocumentHandler(FileSystemEventHandler):
    def __init__(self, process_fn):
        self.process_fn = process_fn
        self._debounce = {}

    def on_created(self, event: FileCreatedEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.name.startswith(".") or path.name.startswith("~$"):
            return
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return

        self._debounce[str(path)] = time.time()
        time.sleep(2)
        if self._debounce.get(str(path), 0) > time.time() - 1.5:
            return
        self._debounce.pop(str(path), None)

        if not path.exists() or path.stat().st_size == 0:
            return

        logger.info(f"New file detected: {path.name}")
        try:
            self.process_fn(str(path))
        except Exception as e:
            logger.error(f"Failed to process {path.name}: {e}")


def ingest_file(file_path: str):
    import magic
    from datetime import date
    from app.core.database import SessionLocal
    from app.models.document import Document, Tag, DocumentTag
    from app.services.storage import storage_service
    from app.services.ocr import extract_text
    from app.services.classifier import classifier_service
    from app.services.search import search_service

    path = Path(file_path)
    file_data = path.read_bytes()
    if not file_data:
        return

    mime_type = magic.from_buffer(file_data, mime=True)
    file_hash = storage_service.compute_hash(file_data)

    db = SessionLocal()
    try:
        existing = db.query(Document).filter(
            Document.file_hash == file_hash, Document.is_deleted == False
        ).first()
        if existing:
            logger.info(f"Duplicate skipped: {path.name} (matches {existing.title})")
            path.unlink()
            return

        storage_path = storage_service.build_storage_path(file_hash, path.name)
        storage_service.upload_file(file_data, storage_path, mime_type)
        full_text = extract_text(file_data, mime_type, path.name)
        classification = classifier_service.classify(full_text, path.name, mime_type)

        doc = Document(
            title=classification.get("title", path.stem),
            original_filename=path.name,
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
            source="watch",
            ai_metadata=classification,
        )
        if classification.get("date"):
            try:
                doc.document_date = date.fromisoformat(classification["date"])
            except (ValueError, TypeError):
                pass

        db.add(doc)
        db.flush()

        for tag_name in classification.get("tags", []):
            tag_name = tag_name.strip().lower()
            if not tag_name:
                continue
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(DocumentTag(document_id=doc.id, tag_id=tag.id))

        db.commit()

        search_service.index_document({
            "id": doc.id, "title": doc.title, "original_filename": doc.original_filename,
            "category": doc.category, "subcategory": doc.subcategory,
            "summary": doc.summary, "full_text": doc.full_text,
            "tags": classification.get("tags", []),
            "people": classification.get("people", []),
            "organizations": classification.get("organizations", []),
            "language": doc.language, "source": doc.source,
            "is_archived": False, "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "document_date": str(doc.document_date) if doc.document_date else None,
            "created_at": doc.created_at.isoformat(),
        })

        logger.info(f"Ingested: {path.name} -> {doc.title} [{doc.category}/{doc.subcategory}]")
        path.unlink()

    except Exception as e:
        db.rollback()
        logger.error(f"Ingest failed for {path.name}: {e}")
        raise
    finally:
        db.close()


def start_watcher():
    watch_dir = settings.watch_dir
    os.makedirs(watch_dir, exist_ok=True)
    logger.info(f"Watching directory: {watch_dir}")

    handler = DocumentHandler(ingest_file)
    observer = Observer()
    observer.schedule(handler, watch_dir, recursive=True)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_watcher()
