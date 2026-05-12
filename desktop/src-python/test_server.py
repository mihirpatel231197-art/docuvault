"""DocuVault — Test Suite (Roadmap item 44).

Tests for all API endpoints. Run with: pytest test_server.py -v
"""

import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure we use a test database
os.environ.setdefault("DOCUVAULT_TEST", "1")

# Create temp DB for tests
_test_dir = tempfile.mkdtemp()
_test_db = Path(_test_dir) / "test.db"

import server
server.DB_PATH = _test_db
server.APP_DATA = Path(_test_dir)

from server import app, init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Initialize fresh DB for each test."""
    if _test_db.exists():
        _test_db.unlink()
    init_db()
    yield
    if _test_db.exists():
        _test_db.unlink()


# === Health & Stats ===

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_stats():
    r = client.get("/api/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_documents" in data
    assert "categories" in data


# === Documents ===

def test_list_documents_empty():
    r = client.get("/api/documents")
    assert r.status_code == 200
    assert r.json()["total"] == 0


def test_list_documents_with_offset():
    r = client.get("/api/documents?offset=0&limit=10")
    assert r.status_code == 200


def test_get_document_not_found():
    r = client.get("/api/documents/nonexistent")
    assert r.status_code == 404


def test_delete_document_not_found():
    r = client.delete(f"/api/documents/{uuid.uuid4()}")
    assert r.status_code == 200  # Soft delete doesn't error


# === Search ===

def test_search_empty():
    r = client.get("/api/search?q=test")
    assert r.status_code == 200
    assert "hits" in r.json()


def test_search_with_category():
    r = client.get("/api/search?q=test&category=Finance")
    assert r.status_code == 200


# === Facets ===

def test_facets():
    r = client.get("/api/facets")
    assert r.status_code == 200
    assert "category" in r.json()


# === Duplicates ===

def test_duplicates():
    r = client.get("/api/duplicates")
    assert r.status_code == 200
    assert "hash_duplicates" in r.json()


# === Scan ===

def test_scan_dry_run():
    r = client.post(f"/api/scan?directory={_test_dir}&dry_run=true")
    assert r.status_code == 200
    assert r.json()["dry_run"] is True


def test_scan_nonexistent():
    r = client.post("/api/scan?directory=/nonexistent/path/12345&dry_run=true")
    assert r.status_code == 404


# === Watched Folders ===

def test_watched_folders():
    r = client.get("/api/watched-folders")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# === Export ===

def test_export():
    r = client.get("/api/export")
    assert r.status_code == 200
    assert "documents" in r.json()


# === Chat ===

def test_chat_no_message():
    r = client.post("/api/chat", json={})
    assert r.status_code == 400


def test_clear_chat():
    r = client.delete("/api/chat/history")
    assert r.status_code == 200


# === Insights ===

def test_insights():
    r = client.get("/api/insights")
    assert r.status_code == 200
    assert "alerts" in r.json()


# === Features: Audit Log ===

def test_audit_log():
    r = client.get("/api/audit-log")
    assert r.status_code == 200
    assert "logs" in r.json()


def test_activity_report():
    r = client.get("/api/reports/activity?days=7")
    assert r.status_code == 200


# === Features: Users ===

def test_list_users():
    r = client.get("/api/users")
    assert r.status_code == 200


# === Features: Retention ===

def test_retention_policies():
    r = client.get("/api/retention-policies")
    assert r.status_code == 200


# === Features: Folder Templates ===

def test_folder_templates():
    r = client.get("/api/folder-templates")
    assert r.status_code == 200
    assert len(r.json()) >= 3  # Built-in templates


# === Features: Integrations ===

def test_integrations():
    r = client.get("/api/integrations")
    assert r.status_code == 200
    assert len(r.json()) >= 5


# === Features: Webhooks ===

def test_webhooks():
    r = client.get("/api/webhooks")
    assert r.status_code == 200


def test_create_webhook():
    r = client.post("/api/webhooks", json={"url": "https://example.com/hook", "events": ["document.created"]})
    assert r.status_code == 200
    assert "id" in r.json()


# === Views: Timeline ===

def test_timeline():
    r = client.get("/api/timeline")
    assert r.status_code == 200
    assert "months" in r.json()


# === Views: Smart Folders ===

def test_smart_folders():
    r = client.get("/api/smart-folders")
    assert r.status_code == 200
    assert len(r.json()) >= 5  # Built-in folders


def test_create_smart_folder():
    r = client.post("/api/smart-folders", json={"name": "Test Folder", "filters": {"category": "Finance"}})
    assert r.status_code == 200
    folder_id = r.json()["id"]

    r = client.get(f"/api/smart-folders/{folder_id}/documents")
    assert r.status_code == 200

    r = client.delete(f"/api/smart-folders/{folder_id}")
    assert r.status_code == 200


def test_smart_folder_builtin_documents():
    r = client.get("/api/smart-folders/builtin-recent/documents")
    assert r.status_code == 200
    assert "documents" in r.json()


# === Views: Graph ===

def test_graph():
    r = client.get("/api/graph")
    assert r.status_code == 200
    assert "nodes" in r.json()
    assert "edges" in r.json()


# === Views: Batch Operations ===

def test_batch_delete_empty():
    r = client.post("/api/batch/delete", json={"document_ids": []})
    assert r.status_code == 200
    assert r.json()["deleted"] == 0


def test_batch_archive_empty():
    r = client.post("/api/batch/archive", json={"document_ids": []})
    assert r.status_code == 200


def test_batch_retag_empty():
    r = client.post("/api/batch/retag", json={"document_ids": [], "tags": ["test"]})
    assert r.status_code == 200


# === Views: Activity ===

def test_activity():
    r = client.get("/api/activity")
    assert r.status_code == 200
    assert "activities" in r.json()


def test_activity_with_days():
    r = client.get("/api/activity?days=7")
    assert r.status_code == 200


# === Views: Analytics ===

def test_analytics():
    r = client.get("/api/analytics")
    assert r.status_code == 200
    data = r.json()
    assert "totals" in data
    assert "categories" in data
    assert "daily_indexed" in data
    assert "file_types" in data


# === Collab: Comments ===

def test_comments_empty():
    doc_id = str(uuid.uuid4())
    r = client.get(f"/api/documents/{doc_id}/comments")
    assert r.status_code == 200
    assert r.json()["total"] == 0


# === Collab: Workspaces ===

def test_workspaces():
    r = client.get("/api/workspaces")
    assert r.status_code == 200


def test_create_workspace():
    r = client.post("/api/workspaces", json={"name": "Test Workspace"})
    assert r.status_code == 200
    ws_id = r.json()["id"]

    r = client.delete(f"/api/workspaces/{ws_id}")
    assert r.status_code == 200


# === Collab: Auth Providers ===

def test_auth_providers():
    r = client.get("/api/auth/providers")
    assert r.status_code == 200
    assert "providers" in r.json()


# === AI: Status ===

def test_ai_status():
    r = client.get("/api/ai/status")
    assert r.status_code == 200
    assert "active_backend" in r.json()


def test_ai_settings():
    r = client.get("/api/ai/settings")
    assert r.status_code == 200


def test_update_ai_settings():
    r = client.put("/api/ai/settings", json={"backend": "auto"})
    assert r.status_code == 200


# === AI: Similarity ===

def test_find_similar_no_doc():
    r = client.post("/api/ai/find-similar", json={"text": "test document"})
    assert r.status_code == 200
    assert "similar" in r.json()


def test_semantic_duplicates():
    r = client.get("/api/ai/semantic-duplicates")
    assert r.status_code == 200
    assert "groups" in r.json()


# === AI: Language Detection ===

def test_detect_language_english():
    r = client.post("/api/ai/detect-language", json={"text": "The quick brown fox jumps over the lazy dog"})
    assert r.status_code == 200
    assert r.json()["language"] == "en"


def test_detect_language_french():
    r = client.post("/api/ai/detect-language", json={"text": "Les enfants jouent dans les parcs de la ville"})
    assert r.status_code == 200
    assert r.json()["language"] == "fr"


# === Platform: Settings ===

def test_settings():
    r = client.get("/api/settings")
    assert r.status_code == 200
    assert "theme" in r.json()


def test_update_settings():
    r = client.put("/api/settings", json={"theme": "dark"})
    assert r.status_code == 200

    r = client.get("/api/settings")
    assert r.json()["theme"] == "dark"


def test_shortcuts():
    r = client.get("/api/settings/shortcuts")
    assert r.status_code == 200
    assert len(r.json()) >= 5


# === Platform: Plugins ===

def test_plugins():
    r = client.get("/api/plugins")
    assert r.status_code == 200
    assert len(r.json()) >= 3  # Built-in plugins


# === Platform: Version ===

def test_version():
    r = client.get("/api/version")
    assert r.status_code == 200
    assert r.json()["version"] == "2.0.0"


def test_check_update():
    r = client.get("/api/update/check")
    assert r.status_code == 200


# === Platform: Help ===

def test_help():
    r = client.get("/api/help")
    assert r.status_code == 200
    assert "sections" in r.json()


# === Platform: Diagnostics ===

def test_diagnostics():
    r = client.get("/api/diagnostics")
    assert r.status_code == 200
    assert "dependencies" in r.json()


# === Platform: Database ===

def test_db_backup():
    r = client.post("/api/db/backup")
    assert r.status_code == 200
    assert "backup_path" in r.json()


def test_db_backups_list():
    client.post("/api/db/backup")
    r = client.get("/api/db/backups")
    assert r.status_code == 200


def test_db_test():
    r = client.get("/api/test/db")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# === Platform: Scroll Pagination ===

def test_scroll_documents():
    r = client.get("/api/documents/scroll")
    assert r.status_code == 200
    assert "documents" in r.json()
    assert "has_more" in r.json()


# === Platform: Sync ===

def test_sync_status():
    r = client.get("/api/sync/status")
    assert r.status_code == 200
    assert "device_id" in r.json()


def test_sync_export():
    r = client.post("/api/sync/export")
    assert r.status_code == 200
    assert "documents" in r.json()


# === Platform: Document Templates ===

def test_document_templates():
    r = client.get("/api/document-templates")
    assert r.status_code == 200
    assert len(r.json()) >= 4  # Built-in templates


# === Platform: Clip (Browser Extension) ===

def test_clip():
    r = client.post("/api/clip", json={
        "url": "https://example.com",
        "title": "Test Clip",
        "content": "Test content from browser extension",
    })
    assert r.status_code == 200
    assert r.json()["status"] == "clipped"


# === Platform: CLI Search ===

def test_cli_search():
    r = client.get("/api/cli/search?q=test")
    assert r.status_code == 200
    assert "results" in r.json()


def test_cli_search_table_format():
    r = client.get("/api/cli/search?q=test&format=table")
    assert r.status_code == 200
    assert "output" in r.json()


# === Platform: Migration ===

def test_export_migration():
    r = client.get("/api/migrate/export")
    assert r.status_code == 200
    assert "documents" in r.json()


# === Extra Features ===

def test_compliance_vocabularies():
    r = client.get("/api/compliance/vocabularies")
    assert r.status_code == 200
    assert "confidentiality" in r.json()


def test_forms():
    r = client.get("/api/forms")
    assert r.status_code == 200
    assert len(r.json()) >= 3


def test_auto_number():
    r = client.get("/api/auto-number/next")
    assert r.status_code == 200
    assert "number" in r.json()


def test_storage_volumes():
    r = client.get("/api/storage/volumes")
    assert r.status_code == 200
    assert "total_size_bytes" in r.json()


def test_shared_links_analytics():
    r = client.get("/api/shared-links/analytics")
    assert r.status_code == 200


def test_rate_limit_status():
    r = client.get("/api/rate-limit/status")
    assert r.status_code == 200
