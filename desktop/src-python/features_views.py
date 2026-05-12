"""DocuVault — Views & UI Backend (Roadmap items 7-14).

7. File preview panel (serve preview data)
8. Split-pane view (frontend-only, data served via existing endpoints)
9. Timeline view (documents grouped by date)
10. Smart folders (saved searches that auto-update)
11. Document relationships graph (visual connections)
12. Batch operations (select multiple, retag, move, delete)
13. Activity feed ("5 docs indexed today")
14. Analytics dashboard (views, searches, classifications over time)
"""

import json
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from server import get_db

router = APIRouter()


# ============================================================
# 7. FILE PREVIEW (enhanced metadata for preview panel)
# ============================================================

@router.get("/api/documents/{doc_id}/preview")
def preview_document(doc_id: str):
    """Get all preview data for split-pane view."""
    conn = get_db()
    doc = conn.execute("SELECT * FROM documents WHERE id = ? AND is_deleted = 0", (doc_id,)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(404)

    d = dict(doc)
    for field in ("tags", "people", "organizations"):
        if isinstance(d.get(field), str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = []

    # Get linked docs
    links = conn.execute("""
        SELECT dl.link_type, d.id, d.title, d.category FROM document_links dl
        JOIN documents d ON (d.id = dl.target_id OR d.id = dl.source_id)
        WHERE (dl.source_id = ? OR dl.target_id = ?) AND d.id != ? AND dl.link_type != 'annotation'
    """, (doc_id, doc_id, doc_id)).fetchall()

    # Get versions
    versions = conn.execute(
        "SELECT id, version_number, change_summary, created_at FROM document_versions WHERE document_id = ? ORDER BY version_number DESC",
        (doc_id,)
    ).fetchall()

    # Get comments count
    comment_count = conn.execute("SELECT COUNT(*) FROM comments WHERE document_id = ?", (doc_id,)).fetchone()[0]

    # File exists check
    file_exists = Path(d.get("file_path", "")).exists() if d.get("file_path") else False

    # Thumbnail/view URLs
    mime = d.get("mime_type", "") or ""
    file_path = d.get("file_path", "") or ""
    ext = Path(file_path).suffix.lower() if file_path else ""

    AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".wma", ".opus"}
    VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp", ".mts", ".m2ts"}
    ARCHIVE_EXTS = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"}
    CODE_MIMES = {"text/x-python", "text/javascript", "text/typescript", "text/x-java", "text/x-c", "text/x-cpp",
                  "application/x-python", "text/x-script", "text/x-sh", "application/json", "text/x-yaml",
                  "application/xml", "text/xml", "text/x-rust", "text/x-go", "text/x-ruby", "text/x-php",
                  "text/x-swift", "text/x-kotlin", "text/x-scala", "text/x-haskell", "text/x-lua",
                  "text/x-sql", "application/x-sh", "text/x-markdown", "text/markdown"}
    CODE_EXTS = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", ".hpp", ".cs",
                 ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala", ".hs", ".lua", ".r",
                 ".sql", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".yaml", ".yml", ".toml", ".ini",
                 ".md", ".mdx", ".json", ".xml", ".html", ".css", ".scss", ".sass"}

    preview_type = "none"
    if mime.startswith("image/"):
        preview_type = "image"
    elif mime == "application/pdf":
        preview_type = "pdf"
    elif mime.startswith("audio/") or ext in AUDIO_EXTS:
        preview_type = "audio"
    elif mime.startswith("video/") or ext in VIDEO_EXTS:
        preview_type = "video"
    elif ext in ARCHIVE_EXTS or "zip" in mime or "archive" in mime or "compressed" in mime:
        preview_type = "archive"
    elif mime in CODE_MIMES or ext in CODE_EXTS:
        preview_type = "code"
    elif mime and ("text/" in mime or "json" in mime or "xml" in mime or "yaml" in mime):
        preview_type = "text"
    elif mime and ("word" in mime or "document" in mime or "spreadsheet" in mime or "presentation" in mime):
        preview_type = "document"

    # Structured media metadata for audio/video
    media_metadata: dict = {}
    if preview_type in ("audio", "video") and file_exists:
        try:
            import subprocess, json as _json
            r = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json",
                 "-show_format", "-show_streams", file_path],
                capture_output=True, text=True, timeout=10
            )
            if r.returncode == 0:
                data = _json.loads(r.stdout)
                fmt = data.get("format", {})
                tags = fmt.get("tags", {})
                # normalise tag keys to lowercase
                tags = {k.lower(): v for k, v in tags.items()}
                streams = data.get("streams", [])
                video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
                audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
                duration = float(fmt.get("duration") or 0)
                bitrate = int(fmt.get("bit_rate") or 0)
                media_metadata = {
                    "title": tags.get("title"),
                    "artist": tags.get("artist"),
                    "album": tags.get("album"),
                    "album_artist": tags.get("album_artist"),
                    "genre": tags.get("genre"),
                    "year": tags.get("date") or tags.get("year"),
                    "track": tags.get("track"),
                    "comment": tags.get("comment"),
                    "duration": duration,
                    "duration_str": _fmt_duration(duration),
                    "bitrate_kbps": round(bitrate / 1000) if bitrate else None,
                    "size_bytes": int(fmt.get("size") or d.get("file_size") or 0),
                    # Video-specific
                    "width": video_stream.get("width") if video_stream else None,
                    "height": video_stream.get("height") if video_stream else None,
                    "video_codec": video_stream.get("codec_name") if video_stream else None,
                    "fps": _parse_fps(video_stream.get("r_frame_rate", "")) if video_stream else None,
                    # Audio-specific
                    "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
                    "channels": audio_stream.get("channels") if audio_stream else None,
                    "sample_rate": int(audio_stream.get("sample_rate") or 0) if audio_stream else None,
                }
        except Exception:
            pass

    # Archive contents
    archive_contents: list = []
    if preview_type == "archive" and file_exists:
        try:
            import zipfile
            if zipfile.is_zipfile(file_path):
                with zipfile.ZipFile(file_path) as zf:
                    infos = zf.infolist()[:500]
                    archive_contents = [
                        {"name": i.filename, "size": i.file_size, "compressed": i.compress_size,
                         "is_dir": i.filename.endswith("/")}
                        for i in infos
                    ]
        except Exception:
            pass

    # EXIF metadata for images
    image_metadata: dict = {}
    if preview_type == "image" and file_exists:
        try:
            from PIL import Image as _Img
            from PIL.ExifTags import TAGS as _TAGS
            with _Img.open(file_path) as img:
                image_metadata["width"] = img.width
                image_metadata["height"] = img.height
                image_metadata["mode"] = img.mode
                exif_data = img._getexif() if hasattr(img, "_getexif") else None
                if exif_data:
                    for tag_id, val in exif_data.items():
                        tag = _TAGS.get(tag_id, str(tag_id))
                        if tag in ("Make", "Model", "DateTime", "DateTimeOriginal",
                                   "ExposureTime", "FNumber", "ISOSpeedRatings",
                                   "Flash", "FocalLength", "GPSInfo"):
                            image_metadata[tag] = str(val)
        except Exception:
            pass

    conn.close()
    return {
        **d,
        "file_exists": file_exists,
        "preview_type": preview_type,
        "view_url": f"/api/documents/{doc_id}/view" if file_exists else None,
        "thumbnail_url": f"/api/documents/{doc_id}/thumbnail" if preview_type in ("image", "pdf", "video") else None,
        "linked_documents": [dict(l) for l in links],
        "versions": [dict(v) for v in versions],
        "comment_count": comment_count,
        "text_preview": (d.get("full_text") or "")[:2000],
        "media_metadata": media_metadata or None,
        "archive_contents": archive_contents or None,
        "image_metadata": image_metadata or None,
    }


def _fmt_duration(seconds: float) -> str:
    if not seconds:
        return "0:00"
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def _parse_fps(rate_str: str) -> float | None:
    try:
        if "/" in rate_str:
            a, b = rate_str.split("/")
            return round(int(a) / int(b), 2)
        return float(rate_str)
    except Exception:
        return None


# ============================================================
# 9. TIMELINE VIEW
# ============================================================

@router.get("/api/timeline")
def timeline(year: int = None, month: int = None):
    """Get documents organized by date for timeline view."""
    conn = get_db()

    if year and month:
        prefix = f"{year:04d}-{month:02d}"
        rows = conn.execute("""
            SELECT id, title, category, subcategory, document_date, file_size, mime_type, summary, indexed_at
            FROM documents WHERE is_deleted = 0
            AND (document_date LIKE ? OR indexed_at LIKE ?)
            ORDER BY COALESCE(document_date, indexed_at) DESC
        """, (f"{prefix}%", f"{prefix}%")).fetchall()
        conn.close()
        return {"documents": [dict(r) for r in rows], "year": year, "month": month}

    # Get year-month summary
    rows = conn.execute("""
        SELECT
            COALESCE(SUBSTR(document_date, 1, 7), SUBSTR(indexed_at, 1, 7)) as month,
            COUNT(*) as count,
            GROUP_CONCAT(DISTINCT category) as categories
        FROM documents WHERE is_deleted = 0
        GROUP BY month
        ORDER BY month DESC
    """).fetchall()
    conn.close()

    months = []
    for r in rows:
        if r["month"]:
            months.append({
                "month": r["month"],
                "count": r["count"],
                "categories": (r["categories"] or "").split(",")[:5],
            })
    return {"months": months}


# ============================================================
# 10. SMART FOLDERS
# ============================================================

@router.get("/api/smart-folders")
def list_smart_folders():
    conn = get_db()
    rows = conn.execute("SELECT * FROM smart_folders ORDER BY name").fetchall()
    conn.close()

    folders = [dict(r) for r in rows]
    # Parse filters JSON
    for f in folders:
        try:
            f["filters"] = json.loads(f["filters"])
        except Exception:
            f["filters"] = {}

    # Add built-in smart folders
    builtins = [
        {"id": "builtin-recent", "name": "Recent (7 days)", "icon": "clock",
         "filters": {"days": 7}, "sort_by": "indexed_at", "builtin": True},
        {"id": "builtin-large", "name": "Large Files (>10MB)", "icon": "hard-drive",
         "filters": {"min_size": 10485760}, "sort_by": "file_size", "builtin": True},
        {"id": "builtin-unclassified", "name": "Needs Review", "icon": "alert-circle",
         "filters": {"max_confidence": 0.5}, "sort_by": "ai_confidence", "builtin": True},
        {"id": "builtin-images", "name": "Images", "icon": "image",
         "filters": {"mime_prefix": "image/"}, "sort_by": "indexed_at", "builtin": True},
        {"id": "builtin-pdfs", "name": "PDFs", "icon": "file-text",
         "filters": {"mime_type": "application/pdf"}, "sort_by": "indexed_at", "builtin": True},
    ]
    return builtins + folders


@router.post("/api/smart-folders")
def create_smart_folder(data: dict):
    conn = get_db()
    folder_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO smart_folders (id, name, icon, filters, sort_by, sort_order) VALUES (?,?,?,?,?,?)",
        (folder_id, data["name"], data.get("icon", "folder-search"),
         json.dumps(data.get("filters", {})),
         data.get("sort_by", "indexed_at"), data.get("sort_order", "desc"))
    )
    conn.commit()
    conn.close()
    _log_activity("smart_folder_created", f"Created smart folder: {data['name']}")
    return {"id": folder_id}


@router.put("/api/smart-folders/{folder_id}")
def update_smart_folder(folder_id: str, data: dict):
    conn = get_db()
    fields, params = [], []
    for key in ("name", "icon", "sort_by", "sort_order"):
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])
    if "filters" in data:
        fields.append("filters = ?")
        params.append(json.dumps(data["filters"]))
    if fields:
        params.append(folder_id)
        conn.execute(f"UPDATE smart_folders SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/api/smart-folders/{folder_id}")
def delete_smart_folder(folder_id: str):
    conn = get_db()
    conn.execute("DELETE FROM smart_folders WHERE id = ?", (folder_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.get("/api/smart-folders/{folder_id}/documents")
def smart_folder_documents(folder_id: str, offset: int = 0, limit: int = 50):
    """Execute a smart folder's saved search."""
    conn = get_db()

    # Handle built-in folders
    if folder_id.startswith("builtin-"):
        filters = _builtin_filters(folder_id)
    else:
        row = conn.execute("SELECT filters, sort_by, sort_order FROM smart_folders WHERE id = ?", (folder_id,)).fetchone()
        if not row:
            conn.close()
            raise HTTPException(404)
        filters = json.loads(row["filters"])

    query = "SELECT * FROM documents WHERE is_deleted = 0"
    params = []

    if filters.get("category"):
        query += " AND category = ?"
        params.append(filters["category"])
    if filters.get("subcategory"):
        query += " AND subcategory = ?"
        params.append(filters["subcategory"])
    if filters.get("days"):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=filters["days"])).isoformat()
        query += " AND indexed_at >= ?"
        params.append(cutoff)
    if filters.get("min_size"):
        query += " AND file_size >= ?"
        params.append(filters["min_size"])
    if filters.get("max_confidence"):
        query += " AND (ai_confidence IS NULL OR ai_confidence < ?)"
        params.append(filters["max_confidence"])
    if filters.get("mime_prefix"):
        query += " AND mime_type LIKE ?"
        params.append(f"{filters['mime_prefix']}%")
    if filters.get("mime_type"):
        query += " AND mime_type = ?"
        params.append(filters["mime_type"])
    if filters.get("tags"):
        for tag in filters["tags"]:
            query += " AND tags LIKE ?"
            params.append(f"%{tag}%")
    if filters.get("query"):
        like = f"%{filters['query']}%"
        query += " AND (title LIKE ? OR summary LIKE ?)"
        params.extend([like, like])

    # Count total
    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    total = conn.execute(count_query, params).fetchone()[0]

    sort_col = filters.get("sort_by", "indexed_at")
    sort_dir = filters.get("sort_order", "DESC")
    if sort_col not in ("indexed_at", "file_size", "title", "ai_confidence", "document_date"):
        sort_col = "indexed_at"
    query += f" ORDER BY {sort_col} {sort_dir} LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()

    docs = []
    for r in rows:
        d = dict(r)
        for field in ("tags", "people", "organizations"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    d[field] = []
        docs.append(d)

    return {"documents": docs, "total": total, "offset": offset, "limit": limit}


def _builtin_filters(folder_id: str) -> dict:
    mapping = {
        "builtin-recent": {"days": 7, "sort_by": "indexed_at"},
        "builtin-large": {"min_size": 10485760, "sort_by": "file_size"},
        "builtin-unclassified": {"max_confidence": 0.5, "sort_by": "ai_confidence", "sort_order": "ASC"},
        "builtin-images": {"mime_prefix": "image/", "sort_by": "indexed_at"},
        "builtin-pdfs": {"mime_type": "application/pdf", "sort_by": "indexed_at"},
    }
    return mapping.get(folder_id, {})


# ============================================================
# 11. DOCUMENT RELATIONSHIPS GRAPH
# ============================================================

@router.get("/api/graph")
def document_graph(limit: int = 100):
    """Get document relationships as a graph (nodes + edges)."""
    conn = get_db()

    # Get all links
    links = conn.execute("""
        SELECT dl.source_id, dl.target_id, dl.link_type,
               s.title as source_title, s.category as source_category,
               t.title as target_title, t.category as target_category
        FROM document_links dl
        JOIN documents s ON s.id = dl.source_id
        JOIN documents t ON t.id = dl.target_id
        WHERE dl.link_type != 'annotation' AND s.is_deleted = 0 AND t.is_deleted = 0
        LIMIT ?
    """, (limit * 2,)).fetchall()

    # Build unique nodes
    nodes = {}
    edges = []
    for link in links:
        if link["source_id"] not in nodes:
            nodes[link["source_id"]] = {
                "id": link["source_id"],
                "title": link["source_title"],
                "category": link["source_category"],
            }
        if link["target_id"] not in nodes:
            nodes[link["target_id"]] = {
                "id": link["target_id"],
                "title": link["target_title"],
                "category": link["target_category"],
            }
        edges.append({
            "source": link["source_id"],
            "target": link["target_id"],
            "type": link["link_type"],
        })

    # Also add category-based connections (docs in same category)
    if len(nodes) < 20:
        cats = conn.execute("""
            SELECT id, title, category FROM documents
            WHERE is_deleted = 0 AND category IS NOT NULL
            ORDER BY indexed_at DESC LIMIT ?
        """, (limit,)).fetchall()

        by_cat = defaultdict(list)
        for row in cats:
            by_cat[row["category"]].append(dict(row))

        for cat, docs in by_cat.items():
            if len(docs) > 1:
                for doc in docs[:10]:
                    if doc["id"] not in nodes:
                        nodes[doc["id"]] = {"id": doc["id"], "title": doc["title"], "category": cat}

    conn.close()
    return {"nodes": list(nodes.values()), "edges": edges}


# ============================================================
# 12. BATCH OPERATIONS
# ============================================================

@router.post("/api/batch/retag")
def batch_retag(data: dict):
    """Retag multiple documents at once."""
    doc_ids = data["document_ids"]
    tags = data["tags"]
    mode = data.get("mode", "replace")  # replace, add, remove

    conn = get_db()
    updated = 0
    for doc_id in doc_ids:
        if mode == "replace":
            conn.execute("UPDATE documents SET tags = ? WHERE id = ?", (json.dumps(tags), doc_id))
        elif mode == "add":
            row = conn.execute("SELECT tags FROM documents WHERE id = ?", (doc_id,)).fetchone()
            if row:
                existing = json.loads(row["tags"]) if row["tags"] else []
                merged = list(set(existing + tags))
                conn.execute("UPDATE documents SET tags = ? WHERE id = ?", (json.dumps(merged), doc_id))
        elif mode == "remove":
            row = conn.execute("SELECT tags FROM documents WHERE id = ?", (doc_id,)).fetchone()
            if row:
                existing = json.loads(row["tags"]) if row["tags"] else []
                filtered = [t for t in existing if t not in tags]
                conn.execute("UPDATE documents SET tags = ? WHERE id = ?", (json.dumps(filtered), doc_id))
        updated += 1
    conn.commit()
    conn.close()
    _log_activity("batch_retag", f"Retagged {updated} documents", metadata={"tags": tags, "mode": mode})
    return {"updated": updated}


@router.post("/api/batch/recategorize")
def batch_recategorize(data: dict):
    """Change category for multiple documents."""
    doc_ids = data["document_ids"]
    category = data["category"]
    subcategory = data.get("subcategory")

    conn = get_db()
    for doc_id in doc_ids:
        fields = "category = ?"
        params = [category]
        if subcategory:
            fields += ", subcategory = ?"
            params.append(subcategory)
        params.append(doc_id)
        conn.execute(f"UPDATE documents SET {fields} WHERE id = ?", params)
    conn.commit()
    conn.close()
    _log_activity("batch_recategorize", f"Recategorized {len(doc_ids)} documents to {category}")
    return {"updated": len(doc_ids)}


@router.post("/api/batch/delete")
def batch_delete(data: dict):
    """Soft-delete multiple documents."""
    doc_ids = data["document_ids"]
    conn = get_db()
    for doc_id in doc_ids:
        conn.execute("UPDATE documents SET is_deleted = 1 WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    _log_activity("batch_delete", f"Deleted {len(doc_ids)} documents")
    return {"deleted": len(doc_ids)}


@router.post("/api/batch/archive")
def batch_archive(data: dict):
    """Archive multiple documents."""
    doc_ids = data["document_ids"]
    conn = get_db()
    for doc_id in doc_ids:
        conn.execute("UPDATE documents SET is_archived = 1 WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    _log_activity("batch_archive", f"Archived {len(doc_ids)} documents")
    return {"archived": len(doc_ids)}


@router.post("/api/batch/reclassify")
def batch_reclassify(data: dict):
    """Reclassify multiple documents with AI."""
    from server import classify_document
    doc_ids = data["document_ids"]
    conn = get_db()
    results = []
    for doc_id in doc_ids:
        row = conn.execute("SELECT full_text, original_filename, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if row:
            classification = classify_document(row["full_text"] or "", row["original_filename"] or "", row["mime_type"] or "")
            conn.execute("""
                UPDATE documents SET title=?, category=?, subcategory=?, summary=?,
                ai_confidence=?, tags=?, people=?, organizations=?, document_date=? WHERE id=?
            """, (
                classification.get("title"), classification.get("category"),
                classification.get("subcategory"), classification.get("summary"),
                classification.get("confidence"),
                json.dumps(classification.get("tags", [])),
                json.dumps(classification.get("people", [])),
                json.dumps(classification.get("organizations", [])),
                classification.get("date"), doc_id,
            ))
            results.append({"id": doc_id, "category": classification.get("category")})
    conn.commit()
    conn.close()
    _log_activity("batch_reclassify", f"Reclassified {len(results)} documents")
    return {"reclassified": results}


# ============================================================
# 13. ACTIVITY FEED
# ============================================================

def _log_activity(action: str, description: str, document_id: str = None,
                  document_title: str = None, metadata: dict = None):
    """Log an activity for the feed."""
    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO activity_log (id, action, description, document_id, document_title, metadata) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), action, description, document_id, document_title,
             json.dumps(metadata) if metadata else None)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # Don't let activity logging break the main flow


@router.get("/api/activity")
def get_activity(limit: int = 50, offset: int = 0, days: int = None):
    """Get activity feed."""
    conn = get_db()
    query = "SELECT * FROM activity_log"
    params = []
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query += " WHERE created_at >= ?"
        params.append(cutoff)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM activity_log").fetchone()[0]

    # Also generate auto-activities from document indexing
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    indexed_today = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE is_deleted = 0 AND indexed_at LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    conn.close()

    activities = [dict(r) for r in rows]
    for a in activities:
        if a.get("metadata"):
            try:
                a["metadata"] = json.loads(a["metadata"])
            except Exception:
                pass

    return {
        "activities": activities,
        "total": total,
        "summary": {
            "indexed_today": indexed_today,
        },
    }


# ============================================================
# 14. ANALYTICS DASHBOARD
# ============================================================

@router.get("/api/analytics")
def analytics(days: int = 30):
    """Analytics data: classifications, searches, storage trends."""
    conn = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Documents indexed per day
    daily_indexed = conn.execute("""
        SELECT DATE(indexed_at) as day, COUNT(*) as count
        FROM documents WHERE is_deleted = 0 AND indexed_at >= ?
        GROUP BY DATE(indexed_at) ORDER BY day
    """, (since,)).fetchall()

    # Categories distribution
    categories = conn.execute("""
        SELECT COALESCE(category, 'Other') as category, COUNT(*) as count,
               COALESCE(SUM(file_size), 0) as total_size
        FROM documents WHERE is_deleted = 0
        GROUP BY category ORDER BY count DESC
    """).fetchall()

    # File types distribution
    file_types = conn.execute("""
        SELECT COALESCE(mime_type, 'unknown') as type, COUNT(*) as count
        FROM documents WHERE is_deleted = 0
        GROUP BY mime_type ORDER BY count DESC LIMIT 15
    """).fetchall()

    # AI confidence distribution
    confidence_dist = conn.execute("""
        SELECT
            CASE
                WHEN ai_confidence >= 0.9 THEN 'high (90-100%)'
                WHEN ai_confidence >= 0.7 THEN 'good (70-89%)'
                WHEN ai_confidence >= 0.5 THEN 'medium (50-69%)'
                ELSE 'low (<50%)'
            END as bracket,
            COUNT(*) as count
        FROM documents WHERE is_deleted = 0
        GROUP BY bracket
    """).fetchall()

    # Storage growth over time
    storage_growth = conn.execute("""
        SELECT DATE(indexed_at) as day,
               SUM(file_size) as daily_size
        FROM documents WHERE is_deleted = 0 AND indexed_at >= ?
        GROUP BY DATE(indexed_at) ORDER BY day
    """, (since,)).fetchall()

    # Language distribution
    languages = conn.execute("""
        SELECT COALESCE(language, 'unknown') as language, COUNT(*) as count
        FROM documents WHERE is_deleted = 0
        GROUP BY language ORDER BY count DESC LIMIT 10
    """).fetchall()

    # Top people and organizations
    conn2 = get_db()
    all_people = {}
    all_orgs = {}
    rows = conn2.execute("SELECT people, organizations FROM documents WHERE is_deleted = 0").fetchall()
    for r in rows:
        for field, target in [("people", all_people), ("organizations", all_orgs)]:
            try:
                items = json.loads(r[field]) if r[field] else []
                for item in items:
                    if item:
                        target[item] = target.get(item, 0) + 1
            except Exception:
                pass
    conn2.close()

    top_people = sorted(all_people.items(), key=lambda x: x[1], reverse=True)[:10]
    top_orgs = sorted(all_orgs.items(), key=lambda x: x[1], reverse=True)[:10]

    # Total stats
    totals = conn.execute("""
        SELECT COUNT(*) as total_docs,
               COALESCE(SUM(file_size), 0) as total_size,
               AVG(ai_confidence) as avg_confidence
        FROM documents WHERE is_deleted = 0
    """).fetchone()

    conn.close()

    return {
        "period_days": days,
        "totals": {
            "documents": totals["total_docs"],
            "size_bytes": totals["total_size"],
            "avg_confidence": round(totals["avg_confidence"] or 0, 2),
        },
        "daily_indexed": [dict(r) for r in daily_indexed],
        "categories": [dict(r) for r in categories],
        "file_types": [dict(r) for r in file_types],
        "confidence_distribution": [dict(r) for r in confidence_dist],
        "storage_growth": [dict(r) for r in storage_growth],
        "languages": [dict(r) for r in languages],
        "top_people": [{"name": p, "count": c} for p, c in top_people],
        "top_organizations": [{"name": o, "count": c} for o, c in top_orgs],
    }


@router.get("/api/analytics/search-stats")
def search_analytics():
    """Track search patterns from audit log."""
    conn = get_db()
    searches = conn.execute("""
        SELECT details, timestamp FROM audit_log
        WHERE action = 'search' ORDER BY timestamp DESC LIMIT 100
    """).fetchall()
    conn.close()
    return {"recent_searches": [dict(r) for r in searches]}
