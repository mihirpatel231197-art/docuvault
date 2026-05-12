"""DocuVault — Collaboration features (Roadmap items 22-27).

22. Comments on documents (threaded discussion)
23. Team workspaces (multi-tenant)
24. Permissions per folder/document
25. Watermarking on shared docs
26. Download tracking on shared links
27. SSO (Google/Microsoft login)
"""

import io
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from server import get_db

router = APIRouter()


# ============================================================
# 22. COMMENTS ON DOCUMENTS
# ============================================================

@router.get("/api/documents/{doc_id}/comments")
def get_comments(doc_id: str):
    """Get all comments for a document, threaded."""
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM comments WHERE document_id = ?
        ORDER BY created_at ASC
    """, (doc_id,)).fetchall()
    conn.close()

    comments = [dict(r) for r in rows]
    # Build threaded structure
    by_id = {c["id"]: {**c, "replies": []} for c in comments}
    roots = []
    for c in comments:
        if c["parent_id"] and c["parent_id"] in by_id:
            by_id[c["parent_id"]]["replies"].append(by_id[c["id"]])
        else:
            roots.append(by_id[c["id"]])

    return {"comments": roots, "total": len(comments)}


@router.post("/api/documents/{doc_id}/comments")
def add_comment(doc_id: str, data: dict):
    """Add a comment to a document."""
    conn = get_db()
    comment_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO comments (id, document_id, parent_id, user_id, user_name, content) VALUES (?,?,?,?,?,?)",
        (comment_id, doc_id, data.get("parent_id"), data.get("user_id"),
         data.get("user_name", "You"), data["content"])
    )
    conn.commit()
    conn.close()
    return {"id": comment_id}


@router.put("/api/comments/{comment_id}")
def update_comment(comment_id: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE comments SET content = ?, updated_at = ? WHERE id = ?",
        (data["content"], datetime.now(timezone.utc).isoformat(), comment_id)
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: str):
    conn = get_db()
    # Delete replies too
    conn.execute("DELETE FROM comments WHERE parent_id = ?", (comment_id,))
    conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# 23. TEAM WORKSPACES
# ============================================================

@router.get("/api/workspaces")
def list_workspaces():
    conn = get_db()
    rows = conn.execute("SELECT * FROM workspaces WHERE is_active = 1").fetchall()
    conn.close()
    if not rows:
        return [{"id": "default", "name": "My Documents", "description": "Personal workspace", "is_default": True}]
    return [dict(r) for r in rows]


@router.post("/api/workspaces")
def create_workspace(data: dict):
    conn = get_db()
    ws_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO workspaces (id, name, owner_id, description) VALUES (?,?,?,?)",
        (ws_id, data["name"], data.get("owner_id"), data.get("description"))
    )
    conn.commit()
    conn.close()
    return {"id": ws_id}


@router.put("/api/workspaces/{workspace_id}")
def update_workspace(workspace_id: str, data: dict):
    conn = get_db()
    fields, params = [], []
    for key in ("name", "description"):
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])
    if fields:
        params.append(workspace_id)
        conn.execute(f"UPDATE workspaces SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/api/workspaces/{workspace_id}")
def delete_workspace(workspace_id: str):
    conn = get_db()
    conn.execute("UPDATE workspaces SET is_active = 0 WHERE id = ?", (workspace_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# 24. PERMISSIONS PER FOLDER/DOCUMENT
# ============================================================

@router.get("/api/documents/{doc_id}/permissions")
def get_permissions(doc_id: str):
    conn = get_db()
    rows = conn.execute("""
        SELECT dp.*, u.email, u.name as user_name FROM document_permissions dp
        LEFT JOIN users u ON u.id = dp.user_id
        WHERE dp.document_id = ?
    """, (doc_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/documents/{doc_id}/permissions")
def set_permission(doc_id: str, data: dict):
    conn = get_db()
    perm_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO document_permissions (id, document_id, user_id, permission, granted_by) VALUES (?,?,?,?,?)",
        (perm_id, doc_id, data["user_id"], data.get("permission", "read"), data.get("granted_by"))
    )
    conn.commit()
    conn.close()
    return {"id": perm_id}


@router.delete("/api/permissions/{perm_id}")
def revoke_permission(perm_id: str):
    conn = get_db()
    conn.execute("DELETE FROM document_permissions WHERE id = ?", (perm_id,))
    conn.commit()
    conn.close()
    return {"status": "revoked"}


@router.get("/api/permissions/by-category")
def get_category_permissions():
    """Get permissions set at category level."""
    conn = get_db()
    rows = conn.execute("""
        SELECT dp.*, u.email, u.name as user_name FROM document_permissions dp
        LEFT JOIN users u ON u.id = dp.user_id
        WHERE dp.document_id IS NULL AND dp.category_match IS NOT NULL
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/permissions/by-category")
def set_category_permission(data: dict):
    conn = get_db()
    perm_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO document_permissions (id, category_match, user_id, permission, granted_by) VALUES (?,?,?,?,?)",
        (perm_id, data["category"], data["user_id"], data.get("permission", "read"), data.get("granted_by"))
    )
    conn.commit()
    conn.close()
    return {"id": perm_id}


# ============================================================
# 25. WATERMARKING ON SHARED DOCS
# ============================================================

@router.get("/api/documents/{doc_id}/watermarked")
def get_watermarked(doc_id: str, text: str = "CONFIDENTIAL"):
    """Serve a watermarked version of a PDF."""
    conn = get_db()
    doc = conn.execute("SELECT file_path, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not doc or doc["mime_type"] != "application/pdf":
        raise HTTPException(400, "Only PDF watermarking is supported")

    try:
        from PyPDF2 import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter

        reader = PdfReader(doc["file_path"])
        writer = PdfWriter()

        # Create watermark
        watermark_buf = io.BytesIO()
        c = canvas.Canvas(watermark_buf, pagesize=letter)
        c.setFont("Helvetica", 60)
        c.setFillAlpha(0.15)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.translate(300, 400)
        c.rotate(45)
        c.drawCentredString(0, 0, text)
        c.save()
        watermark_buf.seek(0)
        watermark_page = PdfReader(watermark_buf).pages[0]

        for page in reader.pages:
            page.merge_page(watermark_page)
            writer.add_page(page)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)
        return StreamingResponse(output, media_type="application/pdf",
                                 headers={"Content-Disposition": f'inline; filename="watermarked_{doc_id[:8]}.pdf"'})
    except ImportError:
        raise HTTPException(500, "Install reportlab for watermarking: pip install reportlab")
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================================
# 26. DOWNLOAD TRACKING ON SHARED LINKS
# ============================================================

@router.get("/api/shared-links/analytics")
def shared_link_analytics():
    """Get download/access analytics for shared links."""
    conn = get_db()
    rows = conn.execute("""
        SELECT sl.id, sl.token, sl.access_count, sl.max_access,
               sl.expires_at, sl.created_at, d.title, d.category
        FROM shared_links sl
        JOIN documents d ON d.id = sl.document_id
        ORDER BY sl.access_count DESC
    """).fetchall()

    total_accesses = conn.execute("SELECT COALESCE(SUM(access_count), 0) FROM shared_links").fetchone()[0]
    active_links = conn.execute("""
        SELECT COUNT(*) FROM shared_links
        WHERE (expires_at IS NULL OR expires_at > ?)
        AND (max_access IS NULL OR access_count < max_access)
    """, (datetime.now(timezone.utc).isoformat(),)).fetchone()[0]

    conn.close()
    return {
        "links": [dict(r) for r in rows],
        "total_accesses": total_accesses,
        "active_links": active_links,
    }


# ============================================================
# 27. SSO (Google/Microsoft login)
# ============================================================

@router.get("/api/auth/providers")
def auth_providers():
    """List available SSO providers."""
    providers = []
    if os.environ.get("GOOGLE_CLIENT_ID"):
        providers.append({"id": "google", "name": "Google", "configured": True})
    else:
        providers.append({"id": "google", "name": "Google", "configured": False})

    if os.environ.get("MICROSOFT_CLIENT_ID"):
        providers.append({"id": "microsoft", "name": "Microsoft", "configured": True})
    else:
        providers.append({"id": "microsoft", "name": "Microsoft", "configured": False})

    return {"providers": providers, "local_auth": True}


@router.post("/api/auth/sso/{provider}")
def sso_login(provider: str, data: dict):
    """Handle SSO token exchange (frontend sends OAuth token)."""
    token = data.get("token")
    if not token:
        raise HTTPException(400, "OAuth token required")

    if provider == "google":
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        if not client_id:
            raise HTTPException(400, "Google SSO not configured")
        # Verify Google token
        try:
            import httpx
            resp = httpx.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}", timeout=10)
            if resp.status_code != 200:
                raise HTTPException(401, "Invalid Google token")
            info = resp.json()
            email = info.get("email")
            name = info.get("name")
        except ImportError:
            raise HTTPException(500, "httpx required for SSO")

    elif provider == "microsoft":
        # Microsoft token verification would go here
        email = data.get("email")
        name = data.get("name")
        if not email:
            raise HTTPException(400, "Email required")
    else:
        raise HTTPException(400, f"Unknown provider: {provider}")

    # Find or create user
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)",
            (user_id, email, f"sso:{provider}", name, "editor", datetime.now(timezone.utc).isoformat())
        )
        conn.commit()
    else:
        user_id = user["id"]
    conn.close()

    # Generate JWT
    import jwt
    token = jwt.encode(
        {"user_id": user_id, "role": "editor", "exp": datetime.now(timezone.utc) + timedelta(hours=24)},
        os.environ.get("JWT_SECRET", "docuvault-dev-secret"), algorithm="HS256"
    )
    return {"token": token, "user": {"id": user_id, "email": email, "name": name}}
