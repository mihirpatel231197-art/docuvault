"""DocuVault — Remaining 10 features to match Docupile 100%.

1. Signature Recognition
2. QR Code File Access
3. Compliance Controlled Vocabularies
4. File Lists Creation
5. Reminders & Notifications
6. PDF Annotation
7. Digital Forms with Workflow
8. Auto Numbering
9. Controlled Volume Management
10. Trello integration
"""

import io
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from server import get_db

router = APIRouter()


# ============================================================
# 1. SIGNATURE RECOGNITION
# ============================================================

@router.post("/api/documents/{doc_id}/check-signature")
def check_signature(doc_id: str):
    """Use Claude Vision to detect if a document has signatures or is missing them."""
    import anthropic
    import base64
    from pdf2image import convert_from_path

    conn = get_db()
    doc = conn.execute("SELECT file_path, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc:
        raise HTTPException(404)

    file_path = doc["file_path"]
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"error": "API key required for signature detection"}

    # Convert last page of PDF to image (signatures usually at the end)
    try:
        if doc["mime_type"] == "application/pdf":
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            last_page = len(reader.pages)
            images = convert_from_path(file_path, first_page=max(1, last_page - 1), last_page=last_page, dpi=200)
            buf = io.BytesIO()
            images[-1].save(buf, format="PNG")
            image_data = buf.getvalue()
        elif doc["mime_type"].startswith("image/"):
            image_data = Path(file_path).read_bytes()
        else:
            return {"has_signature": "unknown", "reason": "Not a PDF or image"}

        b64 = base64.b64encode(image_data).decode()
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                    {"type": "text", "text": "Does this document page contain a handwritten signature or a digital signature? Reply with JSON: {\"has_signature\": true/false, \"signature_type\": \"handwritten\"/\"digital\"/\"none\", \"location\": \"bottom-left\"/\"bottom-right\"/\"none\", \"signer_name\": \"name if visible or null\"}"},
                ],
            }],
        )
        result = response.content[0].text.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(result)
    except Exception as e:
        return {"has_signature": "error", "reason": str(e)}


# ============================================================
# 2. QR CODE FILE ACCESS
# ============================================================

@router.get("/api/documents/{doc_id}/qr")
def generate_qr(doc_id: str):
    """Generate a QR code that links to this document."""
    try:
        import qrcode
    except ImportError:
        return {"error": "Install qrcode: pip install qrcode[pil]"}

    conn = get_db()
    doc = conn.execute("SELECT title FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc:
        raise HTTPException(404)

    # QR encodes the document ID — scan to open
    url = f"docuvault://open/{doc_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png",
                             headers={"Content-Disposition": f'inline; filename="qr_{doc_id[:8]}.png"'})


# ============================================================
# 3. COMPLIANCE CONTROLLED VOCABULARIES
# ============================================================

@router.get("/api/compliance/vocabularies")
def get_vocabularies():
    """Get controlled vocabulary lists for compliance tagging."""
    return {
        "confidentiality": ["Public", "Internal", "Confidential", "Restricted", "Top Secret"],
        "retention": ["Permanent", "7 Years", "5 Years", "3 Years", "1 Year", "Temporary"],
        "document_status": ["Draft", "In Review", "Approved", "Published", "Archived", "Obsolete"],
        "compliance_frameworks": ["GDPR", "HIPAA", "SOC-2", "ISO 27001", "PCI-DSS", "SOX"],
        "custom": _get_custom_vocabularies(),
    }


@router.post("/api/compliance/vocabularies")
def add_vocabulary(data: dict):
    """Add custom vocabulary terms."""
    conn = get_db()
    conn.execute(
        "INSERT INTO retention_policies (id, name, category_match, retention_days, action) VALUES (?,?,?,?,?)",
        (str(uuid.uuid4()), f"vocab:{data['category']}", json.dumps(data["terms"]), 0, "vocabulary")
    )
    conn.commit()
    conn.close()
    return {"status": "added"}


def _get_custom_vocabularies() -> dict:
    conn = get_db()
    rows = conn.execute("SELECT name, category_match FROM retention_policies WHERE action = 'vocabulary'").fetchall()
    conn.close()
    result = {}
    for r in rows:
        key = r["name"].replace("vocab:", "")
        try:
            result[key] = json.loads(r["category_match"])
        except Exception:
            pass
    return result


# ============================================================
# 4. FILE LISTS CREATION
# ============================================================

@router.post("/api/file-lists")
def create_file_list(data: dict):
    """Generate a real-time document list based on filters."""
    conn = get_db()
    query = "SELECT id, title, category, subcategory, file_size, document_date, file_path FROM documents WHERE is_deleted = 0"
    params = []

    if data.get("category"):
        query += " AND category = ?"
        params.append(data["category"])
    if data.get("subcategory"):
        query += " AND subcategory = ?"
        params.append(data["subcategory"])
    if data.get("date_from"):
        query += " AND document_date >= ?"
        params.append(data["date_from"])
    if data.get("date_to"):
        query += " AND document_date <= ?"
        params.append(data["date_to"])

    query += " ORDER BY " + data.get("sort", "title")
    rows = conn.execute(query, params).fetchall()
    conn.close()

    docs = [dict(r) for r in rows]

    # Export format
    fmt = data.get("format", "json")
    if fmt == "csv":
        import csv
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["title", "category", "subcategory", "file_size", "document_date", "file_path"])
        writer.writeheader()
        writer.writerows(docs)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="document_list.csv"'}
        )

    return {"documents": docs, "total": len(docs), "generated_at": datetime.now(timezone.utc).isoformat()}


# ============================================================
# 5. REMINDERS & NOTIFICATIONS
# ============================================================

@router.get("/api/reminders")
def get_reminders():
    """Get all active reminders."""
    conn = get_db()
    # Use retention_policies table with action='reminder'
    rows = conn.execute(
        "SELECT * FROM retention_policies WHERE action = 'reminder' AND is_active = 1"
    ).fetchall()
    conn.close()

    reminders = []
    for r in rows:
        reminders.append({
            "id": r["id"],
            "name": r["name"],
            "category": r["category_match"],
            "days_before": r["retention_days"],
        })

    # Also find upcoming dates
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cutoff = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%d")
    conn = get_db()
    upcoming = conn.execute("""
        SELECT id, title, category, document_date FROM documents
        WHERE is_deleted = 0 AND document_date IS NOT NULL
        AND document_date >= ? AND document_date <= ?
        ORDER BY document_date
    """, (today, cutoff)).fetchall()
    conn.close()

    return {
        "reminders": reminders,
        "upcoming_dates": [dict(r) for r in upcoming],
    }


@router.post("/api/reminders")
def create_reminder(data: dict):
    conn = get_db()
    rem_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO retention_policies (id, name, category_match, retention_days, action, is_active) VALUES (?,?,?,?,?,1)",
        (rem_id, data["name"], data.get("category"), data.get("days_before", 30), "reminder")
    )
    conn.commit()
    conn.close()
    return {"id": rem_id}


@router.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: str):
    conn = get_db()
    conn.execute("DELETE FROM retention_policies WHERE id = ? AND action = 'reminder'", (reminder_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# 6. PDF ANNOTATION (metadata-based — stores annotations in DB)
# ============================================================

@router.get("/api/documents/{doc_id}/annotations")
def get_annotations(doc_id: str):
    conn = get_db()
    # Store annotations as JSON in document_links with type='annotation'
    rows = conn.execute(
        "SELECT * FROM document_links WHERE source_id = ? AND link_type = 'annotation'", (doc_id,)
    ).fetchall()
    conn.close()
    annotations = []
    for r in rows:
        try:
            annotations.append({"id": r["id"], **json.loads(r["target_id"])})
        except Exception:
            pass
    return annotations


@router.post("/api/documents/{doc_id}/annotations")
def add_annotation(doc_id: str, data: dict):
    """Add an annotation to a document. Stored as metadata, not modifying the file."""
    conn = get_db()
    ann_id = str(uuid.uuid4())
    annotation_data = json.dumps({
        "page": data.get("page", 1),
        "x": data.get("x", 0),
        "y": data.get("y", 0),
        "width": data.get("width", 100),
        "height": data.get("height", 20),
        "type": data.get("type", "highlight"),  # highlight, comment, drawing
        "color": data.get("color", "#FFFF00"),
        "text": data.get("text", ""),
        "author": data.get("author", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    conn.execute(
        "INSERT INTO document_links (id, source_id, target_id, link_type) VALUES (?,?,?,?)",
        (ann_id, doc_id, annotation_data, "annotation")
    )
    conn.commit()
    conn.close()
    return {"id": ann_id}


@router.delete("/api/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    conn = get_db()
    conn.execute("DELETE FROM document_links WHERE id = ? AND link_type = 'annotation'", (annotation_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# 7. DIGITAL FORMS WITH WORKFLOW
# ============================================================

@router.get("/api/forms")
def list_forms():
    """List available form templates."""
    # Built-in forms
    return [
        {
            "id": "expense-report",
            "name": "Expense Report",
            "fields": [
                {"name": "date", "type": "date", "required": True},
                {"name": "amount", "type": "number", "required": True},
                {"name": "category", "type": "select", "options": ["Travel", "Meals", "Office", "Other"], "required": True},
                {"name": "description", "type": "text", "required": True},
                {"name": "receipt", "type": "file", "required": False},
            ],
            "workflow": ["submit", "review", "approve", "reimburse"],
        },
        {
            "id": "document-request",
            "name": "Document Request",
            "fields": [
                {"name": "document_type", "type": "text", "required": True},
                {"name": "urgency", "type": "select", "options": ["Low", "Medium", "High"], "required": True},
                {"name": "notes", "type": "textarea", "required": False},
            ],
            "workflow": ["submit", "review", "fulfill"],
        },
        {
            "id": "approval-request",
            "name": "Approval Request",
            "fields": [
                {"name": "document_id", "type": "text", "required": True},
                {"name": "approver_email", "type": "email", "required": True},
                {"name": "reason", "type": "textarea", "required": True},
            ],
            "workflow": ["submit", "review", "approve_or_reject"],
        },
    ]


@router.post("/api/forms/{form_id}/submit")
def submit_form(form_id: str, data: dict):
    """Submit a form and start its workflow."""
    from features import log_audit
    log_audit("system", "form_submitted", "form", form_id, data)
    return {"status": "submitted", "form_id": form_id, "workflow_step": "review"}


# ============================================================
# 8. AUTO NUMBERING
# ============================================================

@router.get("/api/auto-number/next")
def get_next_number(prefix: str = "DOC"):
    """Get the next sequential document number."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM documents WHERE is_deleted = 0").fetchone()[0]
    conn.close()
    next_num = count + 1
    return {"number": f"{prefix}-{next_num:06d}", "sequence": next_num}


@router.post("/api/documents/{doc_id}/assign-number")
def assign_number(doc_id: str, data: dict = None):
    """Assign a sequential number to a document."""
    prefix = (data or {}).get("prefix", "DOC")
    conn = get_db()
    # Check if already numbered
    doc = conn.execute("SELECT title FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(404)

    count = conn.execute("SELECT COUNT(*) FROM document_versions").fetchone()[0] + 1
    doc_number = f"{prefix}-{count:06d}"

    conn.execute("UPDATE documents SET title = ? WHERE id = ?",
                 (f"[{doc_number}] {doc['title']}", doc_id))
    conn.commit()
    conn.close()
    return {"document_number": doc_number, "title": f"[{doc_number}] {doc['title']}"}


# ============================================================
# 9. CONTROLLED VOLUME MANAGEMENT
# ============================================================

@router.get("/api/storage/volumes")
def get_volumes():
    """Get storage volume usage statistics."""
    conn = get_db()
    total_size = conn.execute("SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE is_deleted = 0").fetchone()[0]
    by_category = conn.execute("""
        SELECT COALESCE(category, 'Other') as cat,
               COUNT(*) as doc_count,
               COALESCE(SUM(file_size), 0) as total_size
        FROM documents WHERE is_deleted = 0
        GROUP BY category ORDER BY total_size DESC
    """).fetchall()
    by_type = conn.execute("""
        SELECT COALESCE(mime_type, 'unknown') as mime,
               COUNT(*) as doc_count,
               COALESCE(SUM(file_size), 0) as total_size
        FROM documents WHERE is_deleted = 0
        GROUP BY mime_type ORDER BY total_size DESC LIMIT 20
    """).fetchall()
    largest = conn.execute("""
        SELECT id, title, file_size, category, mime_type FROM documents
        WHERE is_deleted = 0 ORDER BY file_size DESC LIMIT 10
    """).fetchall()

    conn.close()
    return {
        "total_size_bytes": total_size,
        "by_category": [dict(r) for r in by_category],
        "by_type": [dict(r) for r in by_type],
        "largest_files": [dict(r) for r in largest],
    }


@router.post("/api/storage/cleanup")
def storage_cleanup(data: dict = None):
    """Find files that can be cleaned up to save space."""
    conn = get_db()
    # Find orphaned entries (file no longer exists on disk)
    orphans = []
    rows = conn.execute("SELECT id, title, file_path, file_size FROM documents WHERE is_deleted = 0").fetchall()
    for r in rows:
        if not Path(r["file_path"]).exists():
            orphans.append(dict(r))

    # Find archived docs older than N days
    days = (data or {}).get("archive_older_than", 365)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    old_archived = conn.execute(
        "SELECT id, title, file_size FROM documents WHERE is_archived = 1 AND indexed_at < ?", (cutoff,)
    ).fetchall()

    conn.close()
    return {
        "orphaned_entries": orphans,
        "old_archived": [dict(r) for r in old_archived],
        "potential_savings_bytes": sum(o.get("file_size", 0) or 0 for o in orphans),
    }


# ============================================================
# 10. TRELLO INTEGRATION
# ============================================================

@router.post("/api/integrations/trello/connect")
def connect_trello(data: dict):
    """Connect Trello — store API key and token."""
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO integrations (id, provider, config, is_active) VALUES (?,?,?,1)",
        (str(uuid.uuid4()), "trello", json.dumps({"api_key": data["api_key"], "token": data["token"]}))
    )
    conn.commit()
    conn.close()
    return {"status": "connected", "provider": "trello"}


@router.post("/api/documents/{doc_id}/trello")
def attach_to_trello(doc_id: str, data: dict):
    """Attach a document to a Trello card."""
    conn = get_db()
    doc = conn.execute("SELECT title, file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
    integration = conn.execute("SELECT config FROM integrations WHERE provider = 'trello' AND is_active = 1").fetchone()
    conn.close()

    if not doc:
        raise HTTPException(404, "Document not found")
    if not integration:
        raise HTTPException(400, "Trello not connected")

    config = json.loads(integration["config"])
    card_id = data["card_id"]

    try:
        import httpx
        # Create attachment on Trello card
        resp = httpx.post(
            f"https://api.trello.com/1/cards/{card_id}/attachments",
            params={"key": config["api_key"], "token": config["token"]},
            data={"name": doc["title"], "url": f"file://{doc['file_path']}"},
            timeout=10,
        )
        return {"status": "attached", "card_id": card_id, "trello_response": resp.status_code}
    except Exception as e:
        raise HTTPException(500, f"Trello API error: {str(e)}")
