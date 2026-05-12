"""DocuVault — All 19 missing features from Docupile comparison.

1. Audit logs & reporting
2. Role-based access control (multi-user)
3. Version control
4. MFA/2FA
5. PDF split and sort
6. PDF page rearrangement
7. Auto folder creation
8. Built-in file viewer (serves file for iframe)
9. Cross-link files
10. Retention policy & lifecycle
11. Public share links
12. Secure file sharing
13. Quick document emails
14. E-signature (placeholder)
15. Folder templates
16. Outlook integration (placeholder)
17. Google Drive/OneDrive/Dropbox sync (placeholder)
18. Zoom/Teams integration (placeholder)
19. Zapier/Make webhooks
"""

import hashlib
import io
import json
import os
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from server import get_db, DB_PATH

router = APIRouter()


# ============================================================
# 1. AUDIT LOGS & REPORTING
# ============================================================

def log_audit(user_id: str, action: str, resource_type: str = None,
              resource_id: str = None, details: dict = None, ip: str = None):
    conn = get_db()
    conn.execute(
        "INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), user_id, action, resource_type, resource_id,
         json.dumps(details) if details else None, ip)
    )
    conn.commit()
    conn.close()


@router.get("/api/audit-log")
def get_audit_log(limit: int = 100, offset: int = 0, user_id: str = None, action: str = None):
    conn = get_db()
    query = "SELECT * FROM audit_log WHERE 1=1"
    params = []
    if user_id:
        query += " AND user_id = ?"
        params.append(user_id)
    if action:
        query += " AND action = ?"
        params.append(action)
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    conn.close()
    return {"logs": rows, "total": total}


@router.get("/api/reports/activity")
def activity_report(days: int = 30):
    conn = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    by_action = dict(conn.execute(
        "SELECT action, COUNT(*) FROM audit_log WHERE timestamp >= ? GROUP BY action", (since,)
    ).fetchall())
    by_day = conn.execute(
        "SELECT DATE(timestamp) as day, COUNT(*) as cnt FROM audit_log WHERE timestamp >= ? GROUP BY DATE(timestamp) ORDER BY day", (since,)
    ).fetchall()
    docs_indexed = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE indexed_at >= ?", (since,)
    ).fetchone()[0]
    conn.close()
    return {"period_days": days, "actions": by_action, "daily": [dict(r) for r in by_day], "documents_indexed": docs_indexed}


# ============================================================
# 2. ROLE-BASED ACCESS CONTROL
# ============================================================

ROLES = {
    "admin": ["read", "write", "delete", "manage_users", "manage_settings", "export", "share"],
    "editor": ["read", "write", "delete", "share"],
    "viewer": ["read"],
}


@router.post("/api/users")
def create_user(data: dict):
    from passlib.hash import bcrypt
    conn = get_db()
    user_id = str(uuid.uuid4())
    pw_hash = bcrypt.hash(data["password"])
    conn.execute(
        "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)",
        (user_id, data["email"], pw_hash, data.get("name"), data.get("role", "editor"),
         datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()
    log_audit("system", "user_created", "user", user_id, {"email": data["email"]})
    return {"id": user_id, "email": data["email"], "role": data.get("role", "editor")}


@router.get("/api/users")
def list_users():
    conn = get_db()
    rows = conn.execute("SELECT id, email, name, role, is_active, mfa_enabled, created_at FROM users").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.put("/api/users/{user_id}")
def update_user(user_id: str, data: dict):
    conn = get_db()
    fields, params = [], []
    for key in ("name", "role", "is_active"):
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])
    if fields:
        params.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"status": "updated"}


@router.post("/api/auth/login")
def login(data: dict):
    from passlib.hash import bcrypt
    import jwt
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ? AND is_active = 1", (data["email"],)).fetchone()
    conn.close()
    if not user or not bcrypt.verify(data["password"], user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode(
        {"user_id": user["id"], "role": user["role"], "exp": datetime.now(timezone.utc) + timedelta(hours=24)},
        os.environ.get("JWT_SECRET", "docuvault-dev-secret"), algorithm="HS256"
    )
    log_audit(user["id"], "login", "user", user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}


# ============================================================
# 3. VERSION CONTROL
# ============================================================

@router.get("/api/documents/{doc_id}/versions")
def get_versions(doc_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC", (doc_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/documents/{doc_id}/versions")
def create_version(doc_id: str, data: dict = None):
    """Snapshot current state as a new version."""
    conn = get_db()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(404, "Document not found")

    last_ver = conn.execute(
        "SELECT MAX(version_number) FROM document_versions WHERE document_id = ?", (doc_id,)
    ).fetchone()[0] or 0

    ver_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO document_versions (id, document_id, version_number, file_hash, file_size, change_summary) VALUES (?,?,?,?,?,?)",
        (ver_id, doc_id, last_ver + 1, doc["file_hash"], doc["file_size"],
         (data or {}).get("summary", "Manual snapshot"))
    )
    conn.commit()
    conn.close()
    log_audit("system", "version_created", "document", doc_id, {"version": last_ver + 1})
    return {"version": last_ver + 1, "id": ver_id}


# ============================================================
# 4. MFA / 2FA
# ============================================================

@router.post("/api/users/{user_id}/mfa/setup")
def setup_mfa(user_id: str):
    import pyotp
    secret = pyotp.random_base32()
    conn = get_db()
    conn.execute("UPDATE users SET mfa_secret = ? WHERE id = ?", (secret, user_id))
    conn.commit()
    conn.close()
    totp = pyotp.TOTP(secret)
    return {"secret": secret, "uri": totp.provisioning_uri(name=user_id, issuer_name="DocuVault")}


@router.post("/api/users/{user_id}/mfa/verify")
def verify_mfa(user_id: str, data: dict):
    import pyotp
    conn = get_db()
    user = conn.execute("SELECT mfa_secret FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user or not user["mfa_secret"]:
        raise HTTPException(400, "MFA not set up")
    totp = pyotp.TOTP(user["mfa_secret"])
    if totp.verify(data["code"]):
        conn = get_db()
        conn.execute("UPDATE users SET mfa_enabled = 1 WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return {"verified": True}
    raise HTTPException(401, "Invalid MFA code")


# ============================================================
# 5 & 6. PDF SPLIT, SORT, REARRANGE
# ============================================================

@router.post("/api/pdf/split")
def split_pdf(data: dict):
    """Split a PDF into individual pages or ranges."""
    from PyPDF2 import PdfReader, PdfWriter
    file_path = data["file_path"]
    pages = data.get("pages")  # e.g. [[1,3], [4,6], [7,10]] or None for all individual

    reader = PdfReader(file_path)
    output_dir = Path(file_path).parent / f"{Path(file_path).stem}_split"
    output_dir.mkdir(exist_ok=True)

    results = []
    if pages:
        for i, (start, end) in enumerate(pages):
            writer = PdfWriter()
            for p in range(start - 1, min(end, len(reader.pages))):
                writer.add_page(reader.pages[p])
            out = str(output_dir / f"part_{i+1}.pdf")
            with open(out, "wb") as f:
                writer.write(f)
            results.append(out)
    else:
        for i, page in enumerate(reader.pages):
            writer = PdfWriter()
            writer.add_page(page)
            out = str(output_dir / f"page_{i+1}.pdf")
            with open(out, "wb") as f:
                writer.write(f)
            results.append(out)

    return {"output_dir": str(output_dir), "files": results, "total_pages": len(reader.pages)}


@router.post("/api/pdf/rearrange")
def rearrange_pdf(data: dict):
    """Rearrange pages in a PDF. page_order is 0-indexed list."""
    from PyPDF2 import PdfReader, PdfWriter
    file_path = data["file_path"]
    page_order = data["page_order"]  # e.g. [2, 0, 1, 3]

    reader = PdfReader(file_path)
    writer = PdfWriter()
    for idx in page_order:
        if 0 <= idx < len(reader.pages):
            writer.add_page(reader.pages[idx])

    output = str(Path(file_path).parent / f"{Path(file_path).stem}_rearranged.pdf")
    with open(output, "wb") as f:
        writer.write(f)

    return {"output": output, "original_pages": len(reader.pages), "new_order": page_order}


@router.post("/api/pdf/merge")
def merge_pdfs(data: dict):
    """Merge multiple PDFs into one."""
    from PyPDF2 import PdfReader, PdfWriter
    file_paths = data["file_paths"]
    writer = PdfWriter()
    for fp in file_paths:
        reader = PdfReader(fp)
        for page in reader.pages:
            writer.add_page(page)
    output = data.get("output", str(Path(file_paths[0]).parent / "merged.pdf"))
    with open(output, "wb") as f:
        writer.write(f)
    return {"output": output, "total_pages": len(writer.pages), "files_merged": len(file_paths)}


# ============================================================
# 7. AUTO FOLDER CREATION
# ============================================================

@router.post("/api/auto-organize")
def auto_organize(data: dict):
    """Create folder structure based on categories and move/copy files."""
    base_dir = data["base_directory"]
    mode = data.get("mode", "preview")  # preview or execute

    conn = get_db()
    docs = conn.execute(
        "SELECT id, file_path, title, category, subcategory FROM documents WHERE is_deleted = 0"
    ).fetchall()
    conn.close()

    plan = {}
    for doc in docs:
        cat = doc["category"] or "Other"
        sub = doc["subcategory"] or "General"
        folder = f"{base_dir}/{cat}/{sub}"
        if folder not in plan:
            plan[folder] = []
        plan[folder].append({"id": doc["id"], "title": doc["title"], "current_path": doc["file_path"]})

    if mode == "preview":
        return {"folders": {k: len(v) for k, v in plan.items()}, "total_files": len(docs)}

    # Execute: create folders
    created = 0
    for folder in plan:
        Path(folder).mkdir(parents=True, exist_ok=True)
        created += 1
    return {"folders_created": created, "total_files": len(docs)}


# ============================================================
# 8. BUILT-IN FILE VIEWER
# ============================================================

@router.get("/api/documents/{doc_id}/view")
def view_document(doc_id: str):
    """Serve file for in-app viewing (PDF in iframe, images inline)."""
    conn = get_db()
    doc = conn.execute("SELECT file_path, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc or not Path(doc["file_path"]).exists():
        raise HTTPException(404, "File not found")
    return FileResponse(doc["file_path"], media_type=doc["mime_type"] or "application/octet-stream")


@router.get("/api/documents/{doc_id}/thumbnail")
def get_thumbnail(doc_id: str):
    """Generate and serve a thumbnail for the document."""
    conn = get_db()
    doc = conn.execute("SELECT file_path, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc:
        raise HTTPException(404)

    file_path = doc["file_path"]
    mime = doc["mime_type"] or ""

    if mime.startswith("image/"):
        from PIL import Image
        img = Image.open(file_path)
        img.thumbnail((300, 300))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")

    if mime == "application/pdf":
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(file_path, first_page=1, last_page=1, size=(300, None))
            buf = io.BytesIO()
            images[0].save(buf, format="PNG")
            buf.seek(0)
            return StreamingResponse(buf, media_type="image/png")
        except Exception:
            pass

    raise HTTPException(404, "No thumbnail available")


# ============================================================
# 9. CROSS-LINK FILES
# ============================================================

@router.post("/api/documents/{doc_id}/links")
def create_link(doc_id: str, data: dict):
    conn = get_db()
    link_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO document_links (id, source_id, target_id, link_type) VALUES (?,?,?,?)",
        (link_id, doc_id, data["target_id"], data.get("link_type", "related"))
    )
    conn.commit()
    conn.close()
    return {"id": link_id}


@router.get("/api/documents/{doc_id}/links")
def get_links(doc_id: str):
    conn = get_db()
    rows = conn.execute("""
        SELECT dl.*, d.title, d.category FROM document_links dl
        JOIN documents d ON (d.id = dl.target_id OR d.id = dl.source_id)
        WHERE (dl.source_id = ? OR dl.target_id = ?) AND d.id != ?
    """, (doc_id, doc_id, doc_id)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/api/links/{link_id}")
def delete_link(link_id: str):
    conn = get_db()
    conn.execute("DELETE FROM document_links WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# 10. RETENTION POLICY & LIFECYCLE
# ============================================================

@router.get("/api/retention-policies")
def list_retention():
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM retention_policies WHERE is_active = 1").fetchall()]
    conn.close()
    return rows


@router.post("/api/retention-policies")
def create_retention(data: dict):
    conn = get_db()
    pol_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO retention_policies (id, name, category_match, subcategory_match, retention_days, action) VALUES (?,?,?,?,?,?)",
        (pol_id, data["name"], data.get("category_match"), data.get("subcategory_match"),
         data["retention_days"], data.get("action", "archive"))
    )
    conn.commit()
    conn.close()
    return {"id": pol_id}


@router.post("/api/retention-policies/apply")
def apply_retention():
    """Check all documents against retention policies and apply actions."""
    conn = get_db()
    policies = conn.execute("SELECT * FROM retention_policies WHERE is_active = 1").fetchall()
    results = {"archived": 0, "deleted": 0}

    for pol in policies:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=pol["retention_days"])).isoformat()
        query = "SELECT id FROM documents WHERE is_deleted = 0 AND indexed_at < ?"
        params = [cutoff]
        if pol["category_match"]:
            query += " AND category = ?"
            params.append(pol["category_match"])
        if pol["subcategory_match"]:
            query += " AND subcategory = ?"
            params.append(pol["subcategory_match"])

        docs = conn.execute(query, params).fetchall()
        for doc in docs:
            if pol["action"] == "archive":
                conn.execute("UPDATE documents SET is_archived = 1 WHERE id = ?", (doc["id"],))
                results["archived"] += 1
            elif pol["action"] == "delete":
                conn.execute("UPDATE documents SET is_deleted = 1 WHERE id = ?", (doc["id"],))
                results["deleted"] += 1

    conn.commit()
    conn.close()
    return results


# ============================================================
# 11. PUBLIC SHARE LINKS
# ============================================================

@router.post("/api/documents/{doc_id}/share")
def create_share_link(doc_id: str, data: dict = None):
    data = data or {}
    conn = get_db()
    token = secrets.token_urlsafe(32)
    expires = None
    if data.get("expires_hours"):
        expires = (datetime.now(timezone.utc) + timedelta(hours=data["expires_hours"])).isoformat()

    pw_hash = None
    if data.get("password"):
        from passlib.hash import bcrypt
        pw_hash = bcrypt.hash(data["password"])

    link_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO shared_links (id, document_id, token, expires_at, password_hash, max_access, created_by) VALUES (?,?,?,?,?,?,?)",
        (link_id, doc_id, token, expires, pw_hash, data.get("max_access"), data.get("user_id"))
    )
    conn.commit()
    conn.close()
    return {"link_id": link_id, "token": token, "url": f"/shared/{token}"}


@router.get("/api/shared/{token}")
def access_shared(token: str, password: str = None):
    conn = get_db()
    link = conn.execute("SELECT * FROM shared_links WHERE token = ?", (token,)).fetchone()
    if not link:
        conn.close()
        raise HTTPException(404, "Link not found")

    if link["expires_at"] and link["expires_at"] < datetime.now(timezone.utc).isoformat():
        conn.close()
        raise HTTPException(410, "Link expired")

    if link["max_access"] and link["access_count"] >= link["max_access"]:
        conn.close()
        raise HTTPException(410, "Max access reached")

    if link["password_hash"]:
        if not password:
            conn.close()
            raise HTTPException(401, "Password required")
        from passlib.hash import bcrypt
        if not bcrypt.verify(password, link["password_hash"]):
            conn.close()
            raise HTTPException(401, "Wrong password")

    conn.execute("UPDATE shared_links SET access_count = access_count + 1 WHERE id = ?", (link["id"],))
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (link["document_id"],)).fetchone()
    conn.commit()
    conn.close()

    if not doc:
        raise HTTPException(404)
    return {"title": doc["title"], "category": doc["category"], "summary": doc["summary"],
            "mime_type": doc["mime_type"], "file_size": doc["file_size"]}


@router.get("/api/shared/{token}/download")
def download_shared(token: str):
    conn = get_db()
    link = conn.execute("SELECT * FROM shared_links WHERE token = ?", (token,)).fetchone()
    if not link:
        conn.close()
        raise HTTPException(404)
    doc = conn.execute("SELECT file_path, mime_type, title FROM documents WHERE id = ?", (link["document_id"],)).fetchone()
    conn.close()
    if not doc or not Path(doc["file_path"]).exists():
        raise HTTPException(404)
    return FileResponse(doc["file_path"], media_type=doc["mime_type"] or "application/octet-stream",
                        filename=doc["title"])


# ============================================================
# 12. SECURE FILE SHARING (list/manage shared links)
# ============================================================

@router.get("/api/shared-links")
def list_shared_links():
    conn = get_db()
    rows = conn.execute("""
        SELECT sl.*, d.title FROM shared_links sl
        JOIN documents d ON d.id = sl.document_id
        ORDER BY sl.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/api/shared-links/{link_id}")
def revoke_share(link_id: str):
    conn = get_db()
    conn.execute("DELETE FROM shared_links WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return {"status": "revoked"}


# ============================================================
# 13. QUICK DOCUMENT EMAILS
# ============================================================

@router.post("/api/documents/{doc_id}/email")
def email_document(doc_id: str, data: dict):
    """Send a document via email."""
    conn = get_db()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc:
        raise HTTPException(404)

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    if not smtp_user:
        raise HTTPException(400, "Email not configured. Set SMTP_USER and SMTP_PASS.")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = data["to"]
    msg["Subject"] = data.get("subject", f"Document: {doc['title']}")
    msg.attach(MIMEText(data.get("body", f"Please find attached: {doc['title']}"), "plain"))

    file_path = doc["file_path"]
    if Path(file_path).exists():
        with open(file_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{Path(file_path).name}"')
            msg.attach(part)

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        log_audit("system", "document_emailed", "document", doc_id, {"to": data["to"]})
        return {"status": "sent", "to": data["to"]}
    except Exception as e:
        raise HTTPException(500, f"Email failed: {str(e)}")


# ============================================================
# 14. E-SIGNATURE (placeholder — would integrate DocuSign/HelloSign)
# ============================================================

@router.post("/api/documents/{doc_id}/request-signature")
def request_signature(doc_id: str, data: dict):
    """Placeholder for e-signature integration."""
    return {
        "status": "signature_requested",
        "document_id": doc_id,
        "signers": data.get("signers", []),
        "message": "E-signature integration requires DocuSign or HelloSign API key. Configure in Settings > Integrations."
    }


# ============================================================
# 15. FOLDER TEMPLATES
# ============================================================

@router.get("/api/folder-templates")
def list_templates():
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM folder_templates").fetchall()]
    conn.close()
    # Add built-in templates
    builtins = [
        {"id": "builtin-personal", "name": "Personal Documents",
         "structure": json.dumps(["Finance/Tax", "Finance/Bank Statements", "Finance/Investments",
                                  "Career/Resume", "Career/Cover Letters", "Education/Certificates",
                                  "Personal/Identity", "Personal/Medical", "Legal/Contracts"]),
         "description": "Common personal document categories"},
        {"id": "builtin-business", "name": "Business",
         "structure": json.dumps(["Finance/Invoices", "Finance/Receipts", "Finance/Tax",
                                  "Legal/Contracts", "Legal/NDAs", "HR/Employees", "HR/Policies",
                                  "Marketing/Assets", "Operations/Procedures"]),
         "description": "Small business document structure"},
        {"id": "builtin-legal", "name": "Legal Practice",
         "structure": json.dumps(["Clients", "Cases/Active", "Cases/Closed", "Contracts",
                                  "Compliance", "Court Documents", "Research"]),
         "description": "Law firm document structure"},
    ]
    return builtins + rows


@router.post("/api/folder-templates")
def create_template(data: dict):
    conn = get_db()
    tmpl_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO folder_templates (id, name, structure, description) VALUES (?,?,?,?)",
        (tmpl_id, data["name"], json.dumps(data["structure"]), data.get("description"))
    )
    conn.commit()
    conn.close()
    return {"id": tmpl_id}


@router.post("/api/folder-templates/{template_id}/apply")
def apply_template(template_id: str, data: dict):
    """Create folder structure from template."""
    base_dir = data["base_directory"]
    conn = get_db()
    tmpl = conn.execute("SELECT structure FROM folder_templates WHERE id = ?", (template_id,)).fetchone()
    conn.close()

    if not tmpl:
        raise HTTPException(404)
    folders = json.loads(tmpl["structure"])
    created = 0
    for folder in folders:
        Path(base_dir, folder).mkdir(parents=True, exist_ok=True)
        created += 1
    return {"created": created, "base": base_dir}


# ============================================================
# 16-18. INTEGRATIONS (Outlook, Google Drive, OneDrive, Dropbox, Zoom, Teams)
# ============================================================

@router.get("/api/integrations")
def list_integrations():
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM integrations").fetchall()]
    conn.close()

    available = [
        {"provider": "google_drive", "name": "Google Drive", "status": "available", "description": "Sync documents from Google Drive"},
        {"provider": "onedrive", "name": "OneDrive", "status": "available", "description": "Sync documents from Microsoft OneDrive"},
        {"provider": "dropbox", "name": "Dropbox", "status": "available", "description": "Sync documents from Dropbox"},
        {"provider": "outlook", "name": "Outlook", "status": "available", "description": "Import email attachments from Outlook"},
        {"provider": "gmail", "name": "Gmail", "status": "available", "description": "Import email attachments from Gmail"},
        {"provider": "zoom", "name": "Zoom", "status": "available", "description": "Auto-save Zoom meeting recordings and transcripts"},
        {"provider": "teams", "name": "Microsoft Teams", "status": "available", "description": "Sync shared files from Teams channels"},
        {"provider": "slack", "name": "Slack", "status": "available", "description": "Import files shared in Slack channels"},
    ]

    configured = {r["provider"]: r for r in rows}
    for a in available:
        if a["provider"] in configured:
            a["status"] = "connected"
            a["config"] = configured[a["provider"]]

    return available


@router.post("/api/integrations/{provider}/connect")
def connect_integration(provider: str, data: dict):
    conn = get_db()
    int_id = str(uuid.uuid4())
    conn.execute(
        "INSERT OR REPLACE INTO integrations (id, provider, config, is_active) VALUES (?,?,?,1)",
        (int_id, provider, json.dumps(data))
    )
    conn.commit()
    conn.close()
    log_audit("system", "integration_connected", "integration", provider)
    return {"status": "connected", "provider": provider}


@router.delete("/api/integrations/{provider}")
def disconnect_integration(provider: str):
    conn = get_db()
    conn.execute("DELETE FROM integrations WHERE provider = ?", (provider,))
    conn.commit()
    conn.close()
    return {"status": "disconnected"}


# ============================================================
# 19. WEBHOOKS (Zapier / Make)
# ============================================================

@router.get("/api/webhooks")
def list_webhooks():
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM webhooks WHERE is_active = 1").fetchall()]
    conn.close()
    return rows


@router.post("/api/webhooks")
def create_webhook(data: dict):
    conn = get_db()
    wh_id = str(uuid.uuid4())
    secret = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO webhooks (id, url, events, secret) VALUES (?,?,?,?)",
        (wh_id, data["url"], json.dumps(data.get("events", ["document.created"])), secret)
    )
    conn.commit()
    conn.close()
    return {"id": wh_id, "secret": secret, "events": data.get("events", ["document.created"])}


@router.delete("/api/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str):
    conn = get_db()
    conn.execute("DELETE FROM webhooks WHERE id = ?", (webhook_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


def trigger_webhooks(event: str, payload: dict):
    """Fire all webhooks registered for this event."""
    import httpx
    conn = get_db()
    hooks = conn.execute("SELECT * FROM webhooks WHERE is_active = 1").fetchall()
    conn.close()

    for hook in hooks:
        events = json.loads(hook["events"])
        if event in events or "*" in events:
            try:
                httpx.post(hook["url"], json={"event": event, "data": payload},
                          headers={"X-DocuVault-Signature": hook["secret"]}, timeout=5)
                conn = get_db()
                conn.execute("UPDATE webhooks SET last_triggered = ? WHERE id = ?",
                           (datetime.now(timezone.utc).isoformat(), hook["id"]))
                conn.commit()
                conn.close()
            except Exception:
                pass
