"""DocuVault Chat — Ask questions about your documents.

Supports:
  1. Single doc Q&A: "What's in this document?"
  2. Cross-document: "Compare my 2023 vs 2024 salary"
  3. Proactive alerts: "What's expiring soon?"
  4. Missing doc detection: "What tax documents am I missing?"
"""

import json
import os
import sqlite3
from pathlib import Path

import anthropic

from server import DB_PATH, get_db, extract_text

SYSTEM_PROMPT = """You are DocuVault AI — a document assistant. You help users find, understand, and manage their documents.

You have access to the user's document index (titles, categories, summaries, dates, tags, people, organizations) and can read full document content when needed.

Capabilities:
- Answer questions about specific documents
- Compare information across multiple documents
- Find missing or related documents
- Alert about expiring dates, duplicates, or inconsistencies
- Suggest organization improvements

Rules:
- ONLY reference documents that actually exist in the index
- Quote specific text when answering from document content
- If you can't find the answer, say so — never make up document content
- When comparing documents, cite both sources
- For date-sensitive queries, always mention the document date"""


def search_relevant_docs(query: str, limit: int = 10) -> list[dict]:
    """Find documents relevant to the user's question."""
    conn = get_db()
    # SQLite FTS-like search across title, summary, tags, category
    like = f"%{query}%"
    words = query.lower().split()

    # Build OR conditions for each word
    conditions = []
    params = []
    for word in words[:5]:  # max 5 keywords
        w = f"%{word}%"
        conditions.append(
            "(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(tags) LIKE ? "
            "OR LOWER(category) LIKE ? OR LOWER(subcategory) LIKE ? "
            "OR LOWER(people) LIKE ? OR LOWER(organizations) LIKE ?)"
        )
        params.extend([w, w, w, w, w, w, w])

    if not conditions:
        conn.close()
        return []

    sql = f"""
        SELECT id, file_path, title, category, subcategory, summary,
               document_date, tags, people, organizations, file_size, mime_type
        FROM documents
        WHERE is_deleted = 0 AND ({' OR '.join(conditions)})
        ORDER BY indexed_at DESC
        LIMIT ?
    """
    params.append(limit)

    rows = conn.execute(sql, params).fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        for field in ("tags", "people", "organizations"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    d[field] = []
        results.append(d)
    return results


def get_doc_content(doc_id: str) -> str:
    """Read full text of a document (from index or re-extract)."""
    conn = get_db()
    row = conn.execute(
        "SELECT full_text, file_path, mime_type FROM documents WHERE id = ?",
        (doc_id,)
    ).fetchone()
    conn.close()

    if not row:
        return ""

    # Use stored text if available
    if row["full_text"] and len(row["full_text"]) > 50:
        return row["full_text"][:8000]

    # Re-extract if needed
    if row["file_path"] and Path(row["file_path"]).exists():
        text = extract_text(row["file_path"], row["mime_type"] or "")
        return text[:8000]

    return ""


def get_all_doc_summaries(limit: int = 200) -> str:
    """Get a compact summary of all documents for context."""
    conn = get_db()
    rows = conn.execute("""
        SELECT title, category, subcategory, document_date, tags, summary
        FROM documents WHERE is_deleted = 0
        ORDER BY indexed_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()

    lines = []
    for row in rows:
        tags = ""
        try:
            t = json.loads(row["tags"]) if row["tags"] else []
            tags = ", ".join(t[:3])
        except Exception:
            pass
        date = row["document_date"] or ""
        line = f"- [{row['category']}/{row['subcategory']}] {row['title']}"
        if date:
            line += f" ({date})"
        if tags:
            line += f" [tags: {tags}]"
        lines.append(line)

    return "\n".join(lines)


def get_expiring_docs(days: int = 90) -> list[dict]:
    """Find documents with dates in the near future."""
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    conn = get_db()
    rows = conn.execute("""
        SELECT id, title, category, subcategory, document_date
        FROM documents
        WHERE is_deleted = 0 AND document_date IS NOT NULL
          AND document_date >= ? AND document_date <= ?
        ORDER BY document_date
    """, (today, cutoff)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_category_stats() -> dict:
    """Get document counts by category for context."""
    conn = get_db()
    rows = conn.execute("""
        SELECT COALESCE(category, 'Other') as cat, COUNT(*) as cnt
        FROM documents WHERE is_deleted = 0
        GROUP BY category ORDER BY cnt DESC
    """).fetchall()
    conn.close()
    return {r["cat"]: r["cnt"] for r in rows}


def chat(user_message: str, conversation_history: list[dict] = None) -> dict:
    """Main chat function. Returns AI response + sources used."""

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"response": "API key not configured. Set ANTHROPIC_API_KEY.", "sources": []}

    # Build context from document index
    relevant_docs = search_relevant_docs(user_message, limit=10)
    stats = get_category_stats()
    expiring = get_expiring_docs(90)

    # Build document context
    doc_context_parts = []

    doc_context_parts.append(f"Document stats: {json.dumps(stats)}")
    doc_context_parts.append(f"Total categories: {len(stats)}")

    if expiring:
        exp_lines = [f"  - {d['title']} ({d['category']}) expires {d['document_date']}" for d in expiring[:10]]
        doc_context_parts.append(f"Expiring soon:\n" + "\n".join(exp_lines))

    if relevant_docs:
        doc_context_parts.append(f"\nRelevant documents ({len(relevant_docs)} found):")
        for doc in relevant_docs:
            doc_context_parts.append(
                f"\n--- Document: {doc['title']} ---\n"
                f"ID: {doc['id']}\n"
                f"Category: {doc['category']}/{doc['subcategory']}\n"
                f"Date: {doc.get('document_date', 'N/A')}\n"
                f"Tags: {', '.join(doc.get('tags', []))}\n"
                f"People: {', '.join(doc.get('people', []))}\n"
                f"Organizations: {', '.join(doc.get('organizations', []))}\n"
                f"Summary: {doc.get('summary', 'N/A')}"
            )

    # If the query seems to need full content, fetch it for top 3 docs
    needs_content = any(kw in user_message.lower() for kw in [
        "what does", "read", "show me", "details", "content", "says",
        "compare", "difference", "clause", "section", "amount", "total",
        "how much", "when", "extract", "quote", "find in",
    ])

    if needs_content and relevant_docs:
        for doc in relevant_docs[:3]:
            content = get_doc_content(doc["id"])
            if content:
                doc_context_parts.append(
                    f"\n=== Full content of '{doc['title']}' ===\n{content[:4000]}"
                )

    doc_context = "\n".join(doc_context_parts)

    # Build messages
    messages = []
    if conversation_history:
        messages.extend(conversation_history[-10:])  # keep last 10 turns

    messages.append({
        "role": "user",
        "content": f"[Document Context]\n{doc_context}\n\n[User Question]\n{user_message}",
    })

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-6-20250514",  # Sonnet for chat quality
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        answer = response.content[0].text

        return {
            "response": answer,
            "sources": [
                {"id": d["id"], "title": d["title"], "category": d.get("category")}
                for d in relevant_docs[:5]
            ],
            "expiring": expiring[:5] if expiring else [],
        }

    except Exception as e:
        return {"response": f"Error: {str(e)}", "sources": []}


def proactive_insights() -> dict:
    """Generate proactive alerts without user asking."""
    conn = get_db()

    # 1. Expiring documents
    expiring = get_expiring_docs(60)

    # 2. Duplicates
    dupes = conn.execute("""
        SELECT file_hash, COUNT(*) as cnt FROM documents
        WHERE is_deleted = 0 AND file_hash IS NOT NULL
        GROUP BY file_hash HAVING cnt > 1
    """).fetchall()

    # 3. Uncategorized / low confidence
    uncertain = conn.execute("""
        SELECT id, title, ai_confidence FROM documents
        WHERE is_deleted = 0 AND (category = 'Other' OR ai_confidence < 0.5)
        ORDER BY ai_confidence LIMIT 10
    """).fetchall()

    # 4. Large files
    large = conn.execute("""
        SELECT title, file_size, category FROM documents
        WHERE is_deleted = 0
        ORDER BY file_size DESC LIMIT 5
    """).fetchall()

    conn.close()

    alerts = []

    if expiring:
        alerts.append({
            "type": "expiring",
            "severity": "high",
            "message": f"{len(expiring)} document(s) expiring in the next 60 days",
            "details": [{"title": d["title"], "date": d["document_date"]} for d in expiring],
        })

    if dupes:
        total_dupes = sum(d["cnt"] - 1 for d in dupes)
        alerts.append({
            "type": "duplicates",
            "severity": "medium",
            "message": f"{total_dupes} duplicate file(s) found across {len(dupes)} groups",
        })

    if uncertain:
        alerts.append({
            "type": "review_needed",
            "severity": "low",
            "message": f"{len(uncertain)} document(s) need classification review",
            "details": [{"title": d["title"], "confidence": d["ai_confidence"]} for d in uncertain],
        })

    return {"alerts": alerts, "total_documents": get_category_stats()}
