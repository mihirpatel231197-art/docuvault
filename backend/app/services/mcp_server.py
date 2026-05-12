"""MCP Server for DocuVault — lets Claude Code query/upload/manage documents."""

import json
import sys
import logging
from datetime import date

from app.core.database import SessionLocal
from app.models.document import Document, Tag
from app.services.search import search_service
from app.services.storage import storage_service
from app.services.ocr import extract_text
from app.services.classifier import classifier_service
from app.services.dedup import find_duplicates
from app.services.workflows import get_expiring_documents

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "search_documents",
        "description": "Search across all documents by keyword, category, or tag. Use this to find any document like 'find my T4' or 'show immigration docs'.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search text"},
                "category": {"type": "string", "description": "Filter by category: Finance, Immigration, Career, Education, Engineering, Personal, Medical, Legal"},
                "limit": {"type": "integer", "description": "Max results", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_document",
        "description": "Get full details of a specific document by ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string"},
            },
            "required": ["document_id"],
        },
    },
    {
        "name": "list_documents",
        "description": "List documents, optionally filtered by category.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "limit": {"type": "integer", "default": 20},
            },
        },
    },
    {
        "name": "get_stats",
        "description": "Get document statistics: total count, storage used, category breakdown.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "find_duplicates",
        "description": "Find duplicate documents by file hash.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_expiring",
        "description": "Get immigration or other documents expiring within N days.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "default": 30},
            },
        },
    },
    {
        "name": "reclassify_document",
        "description": "Re-run AI classification on a document.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string"},
            },
            "required": ["document_id"],
        },
    },
]


def handle_tool_call(name: str, arguments: dict) -> str:
    db = SessionLocal()
    try:
        if name == "search_documents":
            result = search_service.search(
                arguments.get("query", ""),
                filters=f'category = "{arguments["category"]}"' if arguments.get("category") else None,
                limit=arguments.get("limit", 10),
            )
            hits = []
            for h in result.get("hits", []):
                hits.append({
                    "id": h.get("id"),
                    "title": h.get("title"),
                    "category": h.get("category"),
                    "subcategory": h.get("subcategory"),
                    "summary": h.get("summary"),
                    "tags": h.get("tags", []),
                    "date": h.get("document_date"),
                })
            return json.dumps({"total": result.get("estimatedTotalHits", 0), "results": hits})

        elif name == "get_document":
            doc = db.query(Document).filter(Document.id == arguments["document_id"]).first()
            if not doc:
                return json.dumps({"error": "Document not found"})
            return json.dumps({
                "id": doc.id, "title": doc.title, "category": doc.category,
                "subcategory": doc.subcategory, "summary": doc.summary,
                "tags": [t.name for t in doc.tags],
                "people": [p.name for p in doc.people],
                "organizations": [o.name for o in doc.organizations],
                "date": str(doc.document_date) if doc.document_date else None,
                "file_size": doc.file_size, "mime_type": doc.mime_type,
                "created_at": doc.created_at.isoformat(),
            })

        elif name == "list_documents":
            query = db.query(Document).filter(Document.is_deleted == False)
            if arguments.get("category"):
                query = query.filter(Document.category == arguments["category"])
            docs = query.order_by(Document.created_at.desc()).limit(arguments.get("limit", 20)).all()
            return json.dumps([{
                "id": d.id, "title": d.title, "category": d.category,
                "subcategory": d.subcategory, "date": str(d.document_date) if d.document_date else None,
            } for d in docs])

        elif name == "get_stats":
            from sqlalchemy import func
            total = db.query(Document).filter(Document.is_deleted == False).count()
            size = db.query(func.sum(Document.file_size)).filter(Document.is_deleted == False).scalar() or 0
            cats = dict(db.query(Document.category, func.count()).filter(
                Document.is_deleted == False
            ).group_by(Document.category).all())
            return json.dumps({"total": total, "size_bytes": size, "categories": cats})

        elif name == "find_duplicates":
            dupes = find_duplicates(db)
            return json.dumps({"duplicate_groups": len(dupes), "details": dupes[:10]})

        elif name == "get_expiring":
            expiring = get_expiring_documents(db, arguments.get("days", 30))
            return json.dumps(expiring)

        elif name == "reclassify_document":
            doc = db.query(Document).filter(Document.id == arguments["document_id"]).first()
            if not doc:
                return json.dumps({"error": "Document not found"})
            classification = classifier_service.classify(doc.full_text or "", doc.original_filename or "", doc.mime_type or "")
            doc.title = classification.get("title", doc.title)
            doc.category = classification.get("category")
            doc.subcategory = classification.get("subcategory")
            doc.summary = classification.get("summary")
            doc.ai_confidence = classification.get("confidence")
            db.commit()
            return json.dumps({"status": "reclassified", "title": doc.title, "category": doc.category})

        return json.dumps({"error": f"Unknown tool: {name}"})
    finally:
        db.close()


def run_mcp_server():
    """Run as stdio MCP server for Claude Code."""
    server_info = {
        "jsonrpc": "2.0",
        "result": {
            "protocolVersion": "2024-11-05",
            "serverInfo": {"name": "docuvault", "version": "1.0.0"},
            "capabilities": {"tools": {"listChanged": False}},
        },
    }

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = request.get("method", "")
        req_id = request.get("id")

        if method == "initialize":
            response = {**server_info, "id": req_id}
        elif method == "notifications/initialized":
            continue
        elif method == "tools/list":
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": TOOLS},
            }
        elif method == "tools/call":
            params = request.get("params", {})
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})
            result_text = handle_tool_call(tool_name, arguments)
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": result_text}],
                },
            }
        else:
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"},
            }

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    run_mcp_server()
