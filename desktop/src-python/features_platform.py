"""DocuVault — Platform, SaaS, and Engineering features (Roadmap items 28-48).

Platform & Distribution (28-35):
28. Mobile app (PWA endpoints)
29. Browser extension (clip endpoint)
30. CLI tool (JSON API mode)
31. Multi-device sync
32. Conflict resolution
33. Plugin/extension system
34. Auto-updater
35. Build pipeline config

SaaS & Business (36-43):
36. Pricing/billing placeholder
37. Landing page data
38. Help center / documentation
39. Data migration tool
40. API rate limiting
41. Crash reporting
42. Docker config
43. Document templates

Engineering (44-48):
44. Test suite endpoints
45. CI/CD config
46. Build config
47. Database migrations
48. Performance (virtual scrolling support, lazy loading)
"""

import io
import json
import os
import shutil
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from server import get_db, DB_PATH, APP_DATA

router = APIRouter()


# ============================================================
# 28. MOBILE / PWA ENDPOINTS
# ============================================================

@router.get("/api/manifest")
def pwa_manifest():
    """Serve PWA manifest for mobile app."""
    return {
        "name": "DocuVault",
        "short_name": "DocuVault",
        "description": "AI-Powered Document Management",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0f172a",
        "theme_color": "#0f172a",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }


# ============================================================
# 29. BROWSER EXTENSION (clip web pages)
# ============================================================

@router.post("/api/clip")
def clip_webpage(data: dict):
    """Save a web page as a document (browser extension endpoint)."""
    url = data.get("url", "")
    title = data.get("title", "Clipped Page")
    content = data.get("content", "")
    html = data.get("html", "")

    if not content and not html:
        raise HTTPException(400, "No content provided")

    # Save as text file
    clip_dir = APP_DATA / "clips"
    clip_dir.mkdir(exist_ok=True)

    filename = f"clip_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
    clip_path = clip_dir / filename

    text = f"Source: {url}\nClipped: {datetime.now(timezone.utc).isoformat()}\n\n{content or html}"
    clip_path.write_text(text)

    # Index it
    from server import scan_and_index
    result = scan_and_index(str(clip_path), source="clip")
    return {"status": "clipped", "file": str(clip_path), "document": result}


# ============================================================
# 30. CLI TOOL SUPPORT
# ============================================================

@router.get("/api/cli/search")
def cli_search(q: str, format: str = "json", limit: int = 10):
    """CLI-friendly search endpoint."""
    conn = get_db()
    like = f"%{q}%"
    rows = conn.execute("""
        SELECT id, title, category, subcategory, file_path, file_size, document_date
        FROM documents WHERE is_deleted = 0
        AND (title LIKE ? OR summary LIKE ? OR full_text LIKE ? OR tags LIKE ?)
        ORDER BY indexed_at DESC LIMIT ?
    """, (like, like, like, like, limit)).fetchall()
    conn.close()

    docs = [dict(r) for r in rows]

    if format == "table":
        lines = [f"{'Title':<50} {'Category':<15} {'Size':>10} {'Path'}"]
        lines.append("-" * 120)
        for d in docs:
            size = f"{(d['file_size'] or 0) / 1024:.0f}KB"
            lines.append(f"{d['title'][:50]:<50} {(d['category'] or 'Other'):<15} {size:>10} {d['file_path'] or ''}")
        return {"output": "\n".join(lines), "count": len(docs)}

    return {"results": docs, "count": len(docs), "query": q}


@router.get("/api/cli/open/{doc_id}")
def cli_open(doc_id: str):
    """CLI: open document by ID."""
    conn = get_db()
    row = conn.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)

    import subprocess, platform
    system = platform.system()
    if system == "Darwin":
        subprocess.Popen(["open", row["file_path"]])
    elif system == "Windows":
        os.startfile(row["file_path"])
    else:
        subprocess.Popen(["xdg-open", row["file_path"]])
    return {"opened": row["file_path"]}


# ============================================================
# 31-32. MULTI-DEVICE SYNC & CONFLICT RESOLUTION
# ============================================================

@router.get("/api/sync/status")
def sync_status():
    """Get sync status (for multi-device sync)."""
    conn = get_db()
    last_modified = conn.execute(
        "SELECT MAX(indexed_at) FROM documents WHERE is_deleted = 0"
    ).fetchone()[0]
    doc_count = conn.execute("SELECT COUNT(*) FROM documents WHERE is_deleted = 0").fetchone()[0]
    db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    conn.close()

    return {
        "device_id": _get_device_id(),
        "last_modified": last_modified,
        "document_count": doc_count,
        "db_size_bytes": db_size,
        "sync_enabled": False,
        "message": "Multi-device sync requires a sync server. Configure in Settings > Sync.",
    }


@router.post("/api/sync/export")
def sync_export():
    """Export database for sync (metadata only, not file content)."""
    conn = get_db()
    docs = conn.execute("""
        SELECT id, file_path, title, original_filename, category, subcategory,
               file_hash, mime_type, file_size, language, summary, ai_confidence,
               document_date, tags, people, organizations, source, created_at, indexed_at
        FROM documents WHERE is_deleted = 0
    """).fetchall()
    conn.close()

    return {
        "device_id": _get_device_id(),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "documents": [dict(d) for d in docs],
    }


@router.post("/api/sync/import")
def sync_import(data: dict):
    """Import synced metadata. Handles conflicts."""
    incoming_docs = data.get("documents", [])
    strategy = data.get("conflict_strategy", "keep_newer")  # keep_newer, keep_local, keep_remote

    conn = get_db()
    imported = 0
    skipped = 0
    conflicts = []

    for doc in incoming_docs:
        existing = conn.execute(
            "SELECT id, indexed_at FROM documents WHERE file_path = ? AND is_deleted = 0",
            (doc["file_path"],)
        ).fetchone()

        if existing:
            if strategy == "keep_local":
                skipped += 1
                continue
            elif strategy == "keep_newer":
                if existing["indexed_at"] and doc.get("indexed_at"):
                    if existing["indexed_at"] >= doc["indexed_at"]:
                        skipped += 1
                        continue
            conflicts.append({"file_path": doc["file_path"], "local_id": existing["id"]})

        # Upsert
        conn.execute("""
            INSERT OR REPLACE INTO documents (
                id, file_path, title, original_filename, category, subcategory,
                file_hash, mime_type, file_size, language, summary, ai_confidence,
                document_date, tags, people, organizations, source, created_at, indexed_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            doc.get("id", str(uuid.uuid4())), doc["file_path"], doc["title"],
            doc.get("original_filename"), doc.get("category"), doc.get("subcategory"),
            doc.get("file_hash"), doc.get("mime_type"), doc.get("file_size"),
            doc.get("language"), doc.get("summary"), doc.get("ai_confidence"),
            doc.get("document_date"), doc.get("tags"), doc.get("people"),
            doc.get("organizations"), doc.get("source", "sync"),
            doc.get("created_at"), doc.get("indexed_at"),
        ))
        imported += 1

    conn.commit()
    conn.close()
    return {"imported": imported, "skipped": skipped, "conflicts": len(conflicts)}


def _get_device_id() -> str:
    device_file = APP_DATA / "device_id"
    if device_file.exists():
        return device_file.read_text().strip()
    device_id = str(uuid.uuid4())[:8]
    device_file.write_text(device_id)
    return device_id


# ============================================================
# 33. PLUGIN/EXTENSION SYSTEM
# ============================================================

@router.get("/api/plugins")
def list_plugins():
    conn = get_db()
    rows = conn.execute("SELECT * FROM plugins").fetchall()
    conn.close()

    plugins = [dict(r) for r in rows]
    # Add built-in plugins
    builtins = [
        {"id": "builtin-ocr", "name": "OCR Engine", "version": "1.0", "description": "Tesseract OCR for text extraction", "is_active": True, "builtin": True},
        {"id": "builtin-ai", "name": "AI Classifier", "version": "1.0", "description": "Claude AI document classification", "is_active": True, "builtin": True},
        {"id": "builtin-search", "name": "Full-Text Search", "version": "1.0", "description": "Meilisearch/SQLite FTS", "is_active": True, "builtin": True},
    ]
    return builtins + plugins


@router.post("/api/plugins")
def install_plugin(data: dict):
    conn = get_db()
    plugin_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO plugins (id, name, version, description, entry_point, config) VALUES (?,?,?,?,?,?)",
        (plugin_id, data["name"], data.get("version", "1.0"),
         data.get("description"), data.get("entry_point"), json.dumps(data.get("config", {})))
    )
    conn.commit()
    conn.close()
    return {"id": plugin_id}


@router.put("/api/plugins/{plugin_id}")
def update_plugin(plugin_id: str, data: dict):
    conn = get_db()
    if "is_active" in data:
        conn.execute("UPDATE plugins SET is_active = ? WHERE id = ?", (int(data["is_active"]), plugin_id))
    if "config" in data:
        conn.execute("UPDATE plugins SET config = ? WHERE id = ?", (json.dumps(data["config"]), plugin_id))
    conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/api/plugins/{plugin_id}")
def uninstall_plugin(plugin_id: str):
    conn = get_db()
    conn.execute("DELETE FROM plugins WHERE id = ?", (plugin_id,))
    conn.commit()
    conn.close()
    return {"status": "uninstalled"}


# ============================================================
# 34. AUTO-UPDATER
# ============================================================

@router.get("/api/version")
def get_version():
    return {
        "version": "2.0.0",
        "build": "desktop",
        "platform": _get_platform(),
        "python": _get_python_version(),
    }


@router.get("/api/update/check")
def check_update():
    """Check for updates (placeholder — would hit a release server)."""
    return {
        "current_version": "2.0.0",
        "latest_version": "2.0.0",
        "update_available": False,
        "message": "You're running the latest version.",
    }


def _get_platform():
    import platform
    return f"{platform.system()} {platform.machine()}"


def _get_python_version():
    import sys
    return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"


# ============================================================
# 38. HELP CENTER / DOCUMENTATION
# ============================================================

@router.get("/api/help")
def help_center():
    """Return built-in help / documentation."""
    return {
        "sections": [
            {
                "title": "Getting Started",
                "items": [
                    {"title": "Scan a Folder", "content": "Go to Settings, enter a folder path, click 'Scan & Index'. DocuVault will read each file, extract text (OCR for scanned documents), and classify it with AI."},
                    {"title": "Search Documents", "content": "Use the Search page to instantly find any document by content, title, category, or tags. Results appear in real-time as you type."},
                    {"title": "Chat with Documents", "content": "Go to Chat and ask questions about your documents. The AI reads your index and can compare, summarize, and find information across all files."},
                    {"title": "Upload Files", "content": "Drag and drop files on the Upload page. Each file is automatically classified, tagged, and indexed."},
                ],
            },
            {
                "title": "Features",
                "items": [
                    {"title": "AI Classification", "content": "Every document is classified by Claude AI into categories, tags, and summaries. The AI detects people, organizations, and dates."},
                    {"title": "Smart Folders", "content": "Create saved searches that auto-update. E.g., 'All tax documents from 2024' or 'Large files over 10MB'."},
                    {"title": "Keyboard Shortcuts", "content": "Cmd+K: Search, J/K: Navigate, D: Delete, R: Reclassify, O: Open file, F: Show in Finder, Esc: Close panel."},
                    {"title": "PDF Tools", "content": "Split, merge, rearrange PDF pages. Extract tables and charts from PDFs using AI vision."},
                    {"title": "Document Comparison", "content": "Compare two documents side-by-side with AI-powered diff analysis."},
                    {"title": "Offline Mode", "content": "Use Ollama for local AI classification when offline. Install Ollama and a model like llama3.2."},
                ],
            },
            {
                "title": "Settings",
                "items": [
                    {"title": "AI Backend", "content": "Configure Claude API key for cloud AI, or Ollama for offline classification. Auto mode uses Claude when available, Ollama as fallback."},
                    {"title": "Watched Folders", "content": "Add folders to monitor. Rescan anytime to pick up new or changed files."},
                    {"title": "Keyboard Shortcuts", "content": "Customize keyboard shortcuts in Settings > Shortcuts."},
                    {"title": "Dark Mode", "content": "Toggle dark/light mode in the top-right corner or in Settings."},
                ],
            },
        ],
    }


# ============================================================
# 39. DATA MIGRATION TOOL
# ============================================================

@router.post("/api/migrate/import")
def import_from_service(data: dict):
    """Import documents from external service (Docupile, Google Drive export, etc.)."""
    source = data.get("source")
    import_path = data.get("path")

    if not import_path or not Path(import_path).exists():
        raise HTTPException(400, "Import path not found")

    if source == "docupile":
        return _import_docupile(import_path)
    elif source == "google_drive":
        return _import_directory(import_path, "google_drive")
    elif source == "folder":
        return _import_directory(import_path, "import")
    else:
        raise HTTPException(400, f"Unknown source: {source}")


def _import_docupile(path: str) -> dict:
    """Import from Docupile export (CSV + files)."""
    import csv
    csv_files = list(Path(path).glob("*.csv"))
    if not csv_files:
        # Just import as regular directory
        return _import_directory(path, "docupile")

    imported = 0
    for csv_file in csv_files:
        with open(csv_file, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                file_path = row.get("file_path") or row.get("File Path") or row.get("path")
                if file_path:
                    full_path = Path(path) / file_path if not Path(file_path).is_absolute() else Path(file_path)
                    if full_path.exists():
                        from server import scan_and_index
                        result = scan_and_index(str(full_path), source="docupile_import")
                        if result:
                            imported += 1

    return {"imported": imported, "source": "docupile"}


def _import_directory(path: str, source: str) -> dict:
    """Import all files from a directory."""
    from server import scan_directory
    result = scan_directory(path)
    return {**result, "source": source}


@router.get("/api/migrate/export")
def export_for_migration():
    """Export all metadata for migration to another system."""
    conn = get_db()
    docs = conn.execute("""
        SELECT id, file_path, title, original_filename, category, subcategory,
               file_hash, mime_type, file_size, language, summary, ai_confidence,
               document_date, tags, people, organizations, source, created_at
        FROM documents WHERE is_deleted = 0
    """).fetchall()
    conn.close()

    result = [dict(d) for d in docs]
    for d in result:
        for field in ("tags", "people", "organizations"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    d[field] = []

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
        "total": len(result),
        "documents": result,
    }


# ============================================================
# 40. API RATE LIMITING
# ============================================================

_rate_limits: dict[str, list[float]] = {}

@router.get("/api/rate-limit/status")
def rate_limit_status():
    """Get current rate limit status."""
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'rate_limit.requests_per_minute'").fetchone()
    conn.close()
    rpm = int(row["value"]) if row else 60

    return {
        "requests_per_minute": rpm,
        "current_usage": len(_rate_limits.get("global", [])),
        "ai_calls_today": _count_ai_calls_today(),
    }


def _count_ai_calls_today() -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conn = get_db()
    count = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE indexed_at LIKE ? AND ai_confidence > 0.5",
        (f"{today}%",)
    ).fetchone()[0]
    conn.close()
    return count


# ============================================================
# 41. CRASH REPORTING
# ============================================================

@router.get("/api/diagnostics")
def diagnostics():
    """System diagnostics for debugging."""
    import platform
    import sys

    diag = {
        "python_version": sys.version,
        "platform": platform.platform(),
        "db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists(),
        "db_size_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
        "app_data_path": str(APP_DATA),
    }

    # Check dependencies
    deps = {}
    for mod in ["anthropic", "meilisearch", "pytesseract", "magic", "PIL", "PyPDF2",
                 "docx", "openpyxl", "unstructured"]:
        try:
            __import__(mod)
            deps[mod] = "installed"
        except ImportError:
            deps[mod] = "missing"
    diag["dependencies"] = deps

    # Check services
    services = {}
    try:
        import httpx
        resp = httpx.get("http://127.0.0.1:7701/health", timeout=2)
        services["meilisearch"] = "running" if resp.status_code == 200 else "error"
    except Exception:
        services["meilisearch"] = "not running"

    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=2)
        services["ollama"] = "running" if resp.status_code == 200 else "error"
    except Exception:
        services["ollama"] = "not running"

    diag["services"] = services

    # DB stats
    conn = get_db()
    diag["document_count"] = conn.execute("SELECT COUNT(*) FROM documents WHERE is_deleted = 0").fetchone()[0]
    diag["total_size_bytes"] = conn.execute("SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE is_deleted = 0").fetchone()[0]
    conn.close()

    return diag


@router.post("/api/diagnostics/report")
def create_diagnostic_report(data: dict = None):
    """Generate a diagnostic report for bug reporting."""
    diag = diagnostics()
    diag["user_description"] = (data or {}).get("description", "")
    diag["timestamp"] = datetime.now(timezone.utc).isoformat()

    report_dir = APP_DATA / "reports"
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report_path.write_text(json.dumps(diag, indent=2))

    return {"report_path": str(report_path), "diagnostics": diag}


# ============================================================
# 43. DOCUMENT TEMPLATES
# ============================================================

@router.get("/api/document-templates")
def list_document_templates():
    conn = get_db()
    rows = conn.execute("SELECT * FROM document_templates").fetchall()
    conn.close()

    templates = [dict(r) for r in rows]
    for t in templates:
        if t.get("variables"):
            try:
                t["variables"] = json.loads(t["variables"])
            except Exception:
                t["variables"] = []

    # Built-in templates
    builtins = [
        {
            "id": "builtin-nda", "name": "Non-Disclosure Agreement", "template_type": "legal",
            "description": "Standard NDA template with customizable parties and terms",
            "variables": ["party_a", "party_b", "effective_date", "duration"],
            "builtin": True,
        },
        {
            "id": "builtin-invoice", "name": "Invoice", "template_type": "finance",
            "description": "Professional invoice template",
            "variables": ["from_company", "to_company", "items", "due_date"],
            "builtin": True,
        },
        {
            "id": "builtin-meeting-notes", "name": "Meeting Notes", "template_type": "business",
            "description": "Structured meeting notes with action items",
            "variables": ["meeting_title", "date", "attendees", "agenda"],
            "builtin": True,
        },
        {
            "id": "builtin-report", "name": "Status Report", "template_type": "business",
            "description": "Weekly/monthly status report template",
            "variables": ["period", "author", "department"],
            "builtin": True,
        },
    ]
    return builtins + templates


@router.post("/api/document-templates")
def create_document_template(data: dict):
    conn = get_db()
    tmpl_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO document_templates (id, name, description, template_type, content, variables) VALUES (?,?,?,?,?,?)",
        (tmpl_id, data["name"], data.get("description"), data["template_type"],
         data["content"], json.dumps(data.get("variables", [])))
    )
    conn.commit()
    conn.close()
    return {"id": tmpl_id}


@router.post("/api/document-templates/{template_id}/generate")
def generate_from_template(template_id: str, data: dict):
    """Generate a document from a template using AI."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    variables = data.get("variables", {})

    if template_id.startswith("builtin-"):
        content = _get_builtin_template_content(template_id, variables)
    else:
        conn = get_db()
        row = conn.execute("SELECT content, variables FROM document_templates WHERE id = ?", (template_id,)).fetchone()
        conn.close()
        if not row:
            raise HTTPException(404)
        content = row["content"]

    # Fill in variables
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))

    # If AI key available, enhance with AI
    if api_key and data.get("ai_enhance", False):
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": f"Complete and polish this document template. Fill in any remaining placeholders with appropriate professional content. Keep the format and structure:\n\n{content}",
                }],
            )
            content = resp.content[0].text
        except Exception:
            pass

    # Save as file
    output_dir = APP_DATA / "generated"
    output_dir.mkdir(exist_ok=True)
    filename = f"{variables.get('title', template_id)}_{datetime.now().strftime('%Y%m%d')}.txt"
    output_path = output_dir / filename
    output_path.write_text(content)

    return {"content": content, "file_path": str(output_path)}


def _get_builtin_template_content(template_id: str, variables: dict) -> str:
    templates = {
        "builtin-nda": """NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{effective_date}} by and between:

Party A: {{party_a}}
Party B: {{party_b}}

1. CONFIDENTIAL INFORMATION
Both parties agree to protect confidential information shared during the course of their business relationship.

2. OBLIGATIONS
The receiving party shall not disclose, publish, or disseminate Confidential Information to any third party.

3. DURATION
This Agreement shall remain in effect for {{duration}}.

4. GOVERNING LAW
This Agreement shall be governed by the laws of the jurisdiction of Party A.

Signatures:

_________________________          _________________________
{{party_a}}                        {{party_b}}
Date: {{effective_date}}           Date: {{effective_date}}
""",
        "builtin-invoice": """INVOICE

From: {{from_company}}
To: {{to_company}}
Date: {{due_date}}
Invoice #: INV-{{due_date}}

Items:
{{items}}

Subtotal: $0.00
Tax: $0.00
Total: $0.00

Payment Terms: Net 30
Due Date: {{due_date}}
""",
        "builtin-meeting-notes": """MEETING NOTES

Title: {{meeting_title}}
Date: {{date}}
Attendees: {{attendees}}

AGENDA:
{{agenda}}

DISCUSSION:
[Notes here]

ACTION ITEMS:
- [ ] [Action item 1] — Owner: [Name] — Due: [Date]
- [ ] [Action item 2] — Owner: [Name] — Due: [Date]

NEXT MEETING:
Date: TBD
""",
        "builtin-report": """STATUS REPORT

Period: {{period}}
Author: {{author}}
Department: {{department}}
Date: {date}

SUMMARY:
[Executive summary here]

ACCOMPLISHMENTS:
- [Item 1]
- [Item 2]

IN PROGRESS:
- [Item 1]
- [Item 2]

BLOCKERS:
- [None / Item 1]

NEXT PERIOD GOALS:
- [Goal 1]
- [Goal 2]
""",
    }
    return templates.get(template_id, "Template not found")


# ============================================================
# 44. HEALTH CHECK / TEST ENDPOINTS
# ============================================================

@router.get("/api/test/db")
def test_db():
    """Test database connectivity."""
    try:
        conn = get_db()
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        conn.close()
        return {"status": "ok", "tables": [t["name"] for t in tables], "document_count": count}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/api/test/search")
def test_search():
    """Test search engine."""
    try:
        from server import get_search_client
        client = get_search_client()
        if client:
            info = client.get_all_stats()
            return {"status": "ok", "engine": "meilisearch", "stats": info}
        return {"status": "ok", "engine": "sqlite_fts", "message": "Using SQLite fallback search"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/api/test/ai")
def test_ai():
    """Test AI backend."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"status": "no_key", "message": "ANTHROPIC_API_KEY not set"}

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": "Reply with 'ok'"}],
        )
        return {"status": "ok", "model": "claude-haiku-4-5-20251001", "response": resp.content[0].text}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================
# 47. DATABASE MIGRATIONS
# ============================================================

@router.get("/api/db/migrations")
def list_migrations():
    """List available and applied migrations."""
    return {
        "current_version": 2,
        "migrations": [
            {"version": 1, "name": "initial_schema", "applied": True},
            {"version": 2, "name": "add_collaboration_tables", "applied": True},
        ],
    }


@router.post("/api/db/backup")
def backup_database():
    """Create a backup of the database."""
    backup_dir = APP_DATA / "backups"
    backup_dir.mkdir(exist_ok=True)
    backup_name = f"docuvault_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    backup_path = backup_dir / backup_name
    shutil.copy2(str(DB_PATH), str(backup_path))

    # Clean old backups (keep last 10)
    backups = sorted(backup_dir.glob("docuvault_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in backups[10:]:
        old.unlink()

    return {"backup_path": str(backup_path), "size_bytes": backup_path.stat().st_size}


@router.post("/api/db/restore")
def restore_database(data: dict):
    """Restore from a backup."""
    backup_path = data.get("backup_path")
    if not backup_path or not Path(backup_path).exists():
        raise HTTPException(400, "Backup file not found")

    # Create a safety backup first
    safety = APP_DATA / "backups" / f"pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    (APP_DATA / "backups").mkdir(exist_ok=True)
    shutil.copy2(str(DB_PATH), str(safety))

    # Restore
    shutil.copy2(backup_path, str(DB_PATH))
    return {"status": "restored", "from": backup_path, "safety_backup": str(safety)}


@router.get("/api/db/backups")
def list_backups():
    backup_dir = APP_DATA / "backups"
    if not backup_dir.exists():
        return []
    backups = sorted(backup_dir.glob("docuvault_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [{"path": str(b), "name": b.name, "size_bytes": b.stat().st_size,
             "created_at": datetime.fromtimestamp(b.stat().st_mtime).isoformat()} for b in backups]


# ============================================================
# 48. PERFORMANCE (Pagination, Lazy loading support)
# ============================================================

@router.get("/api/documents/scroll")
def scroll_documents(cursor: str = None, limit: int = 20, category: str = None):
    """Cursor-based pagination for virtual scrolling."""
    conn = get_db()
    query = "SELECT * FROM documents WHERE is_deleted = 0 AND is_archived = 0"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if cursor:
        query += " AND indexed_at < ?"
        params.append(cursor)

    query += " ORDER BY indexed_at DESC LIMIT ?"
    params.append(limit + 1)

    rows = conn.execute(query, params).fetchall()
    conn.close()

    docs = []
    for r in rows[:limit]:
        d = dict(r)
        for field in ("tags", "people", "organizations"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    d[field] = []
        docs.append(d)

    next_cursor = docs[-1]["indexed_at"] if len(rows) > limit else None
    return {"documents": docs, "next_cursor": next_cursor, "has_more": len(rows) > limit}


# ============================================================
# APP SETTINGS (used by UX features: theme, shortcuts, onboarding)
# ============================================================

@router.get("/api/settings")
def get_settings():
    """Get all app settings."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    conn.close()
    settings = {r["key"]: r["value"] for r in rows}

    # Defaults
    defaults = {
        "theme": "system",
        "onboarding_complete": "false",
        "api_key_configured": "true" if os.environ.get("ANTHROPIC_API_KEY") else "false",
    }
    for k, v in defaults.items():
        if k not in settings:
            settings[k] = v

    return settings


@router.put("/api/settings")
def update_settings(data: dict):
    """Update app settings."""
    conn = get_db()
    for key, value in data.items():
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
            (key, str(value))
        )
    conn.commit()
    conn.close()
    return {"status": "updated"}


@router.get("/api/settings/shortcuts")
def get_shortcuts():
    """Get keyboard shortcuts."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM keyboard_shortcuts WHERE is_active = 1").fetchall()
    conn.close()

    if rows:
        return [dict(r) for r in rows]

    # Default shortcuts
    return [
        {"key_combo": "mod+k", "action": "search", "description": "Open search"},
        {"key_combo": "j", "action": "next_doc", "description": "Next document"},
        {"key_combo": "k", "action": "prev_doc", "description": "Previous document"},
        {"key_combo": "o", "action": "open_file", "description": "Open file in default app"},
        {"key_combo": "f", "action": "reveal_file", "description": "Show in Finder"},
        {"key_combo": "d", "action": "delete", "description": "Delete document"},
        {"key_combo": "r", "action": "reclassify", "description": "Reclassify with AI"},
        {"key_combo": "p", "action": "toggle_preview", "description": "Toggle preview panel"},
        {"key_combo": "escape", "action": "close_panel", "description": "Close panel"},
        {"key_combo": "mod+shift+d", "action": "toggle_theme", "description": "Toggle dark mode"},
        {"key_combo": "mod+,", "action": "open_settings", "description": "Open settings"},
    ]


@router.put("/api/settings/shortcuts")
def update_shortcuts(data: dict):
    """Update a keyboard shortcut."""
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO keyboard_shortcuts (id, key_combo, action, description, is_active) VALUES (?,?,?,?,1)",
        (str(uuid.uuid4()), data["key_combo"], data["action"], data.get("description", ""))
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}
