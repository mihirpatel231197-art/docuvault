"""DocuVault — AI Enhancements (Roadmap items 15-21).

15. Offline mode (local LLM via Ollama)
16. AI content-similarity dedup (semantic matching)
17. OCR language auto-detection
18. Handwriting OCR
19. Table extraction from PDFs
20. Chart/graph extraction from documents
21. Document comparison (visual diff two PDFs/contracts)
"""

import io
import json
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from server import get_db

router = APIRouter()


# ============================================================
# 15. OFFLINE MODE (Ollama)
# ============================================================

@router.get("/api/ai/status")
def ai_status():
    """Check which AI backends are available."""
    status = {
        "claude": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "ollama": False,
        "ollama_models": [],
        "active_backend": "none",
    }

    # Check Ollama
    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=3)
        if resp.status_code == 200:
            status["ollama"] = True
            models = resp.json().get("models", [])
            status["ollama_models"] = [m["name"] for m in models]
    except Exception:
        pass

    if status["claude"]:
        status["active_backend"] = "claude"
    elif status["ollama"]:
        status["active_backend"] = "ollama"

    return status


@router.post("/api/ai/classify-offline")
def classify_offline(data: dict):
    """Classify a document using Ollama (offline mode)."""
    text = data.get("text", "")
    model = data.get("model", "llama3.2")

    if not text:
        return {"error": "No text provided"}

    prompt = """Classify this document. Return JSON only:
{"title":"descriptive title","category":"Finance/Legal/Medical/Education/Career/Business/Engineering/Technology/Personal/Government/Other","subcategory":"specific type","tags":["searchable","tags"],"date":"YYYY-MM-DD or null","summary":"1-2 sentences","people":["names"],"organizations":["orgs"],"confidence":0.0-1.0}

Document:
""" + text[:3000]

    try:
        import httpx
        resp = httpx.post("http://localhost:11434/api/generate", json={
            "model": model, "prompt": prompt, "stream": False,
            "options": {"temperature": 0.1, "num_predict": 512},
        }, timeout=60)

        if resp.status_code != 200:
            return {"error": f"Ollama error: {resp.status_code}"}

        response_text = resp.json().get("response", "")
        # Try to extract JSON
        if "```" in response_text:
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        return json.loads(response_text.strip())
    except json.JSONDecodeError:
        return {"error": "Failed to parse Ollama response", "raw": response_text[:500]}
    except Exception as e:
        return {"error": str(e)}


@router.post("/api/ai/chat-offline")
def chat_offline(data: dict):
    """Chat with documents using Ollama."""
    message = data.get("message", "")
    model = data.get("model", "llama3.2")
    context = data.get("context", "")

    try:
        import httpx
        prompt = f"You are DocuVault AI. Answer based on these documents:\n\n{context[:4000]}\n\nQuestion: {message}"
        resp = httpx.post("http://localhost:11434/api/generate", json={
            "model": model, "prompt": prompt, "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1024},
        }, timeout=60)
        return {"response": resp.json().get("response", ""), "backend": "ollama"}
    except Exception as e:
        return {"response": f"Ollama error: {str(e)}", "backend": "ollama"}


@router.get("/api/ai/settings")
def ai_settings():
    """Get AI configuration."""
    conn = get_db()
    settings = {}
    rows = conn.execute("SELECT key, value FROM app_settings WHERE key LIKE 'ai.%'").fetchall()
    conn.close()
    for r in rows:
        settings[r["key"].replace("ai.", "")] = r["value"]

    return {
        "backend": settings.get("backend", "auto"),
        "claude_model": settings.get("claude_model", "claude-haiku-4-5-20251001"),
        "ollama_model": settings.get("ollama_model", "llama3.2"),
        "auto_classify": settings.get("auto_classify", "true") == "true",
        "classify_on_scan": settings.get("classify_on_scan", "true") == "true",
    }


@router.put("/api/ai/settings")
def update_ai_settings(data: dict):
    """Update AI configuration."""
    conn = get_db()
    for key, value in data.items():
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
            (f"ai.{key}", str(value))
        )
    conn.commit()
    conn.close()
    return {"status": "updated"}


# ============================================================
# 16. AI CONTENT-SIMILARITY DEDUP
# ============================================================

@router.post("/api/ai/find-similar")
def find_similar(data: dict):
    """Find semantically similar documents using title/summary comparison."""
    doc_id = data.get("document_id")
    threshold = data.get("threshold", 0.6)

    conn = get_db()
    if doc_id:
        source = conn.execute(
            "SELECT title, summary, tags, category FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not source:
            conn.close()
            raise HTTPException(404)
        query_text = f"{source['title']} {source['summary'] or ''}"
    else:
        query_text = data.get("text", "")

    if not query_text:
        conn.close()
        return {"similar": []}

    # Get all docs and compute text similarity
    rows = conn.execute("""
        SELECT id, title, summary, category, subcategory, file_size, tags
        FROM documents WHERE is_deleted = 0 AND id != ?
    """, (doc_id or "",)).fetchall()
    conn.close()

    query_words = set(query_text.lower().split())
    results = []
    for row in rows:
        doc_text = f"{row['title']} {row['summary'] or ''}"
        doc_words = set(doc_text.lower().split())

        # Jaccard similarity
        if not query_words or not doc_words:
            continue
        intersection = query_words & doc_words
        union = query_words | doc_words
        similarity = len(intersection) / len(union) if union else 0

        if similarity >= threshold:
            results.append({
                "id": row["id"],
                "title": row["title"],
                "category": row["category"],
                "similarity": round(similarity, 3),
                "matching_words": list(intersection)[:10],
            })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return {"similar": results[:20], "threshold": threshold}


@router.get("/api/ai/semantic-duplicates")
def semantic_duplicates():
    """Find all potential semantic duplicates across the library."""
    conn = get_db()
    rows = conn.execute("""
        SELECT id, title, summary, category, file_size
        FROM documents WHERE is_deleted = 0
        ORDER BY category, title
    """).fetchall()
    conn.close()

    docs = [dict(r) for r in rows]
    groups = []
    seen = set()

    for i, doc_a in enumerate(docs):
        if doc_a["id"] in seen:
            continue
        text_a = f"{doc_a['title']} {doc_a['summary'] or ''}".lower().split()
        words_a = set(text_a)
        group = [doc_a]

        for doc_b in docs[i + 1:]:
            if doc_b["id"] in seen:
                continue
            text_b = f"{doc_b['title']} {doc_b['summary'] or ''}".lower().split()
            words_b = set(text_b)

            intersection = words_a & words_b
            union = words_a | words_b
            similarity = len(intersection) / len(union) if union else 0

            if similarity >= 0.5:
                group.append({**doc_b, "similarity": round(similarity, 3)})
                seen.add(doc_b["id"])

        if len(group) > 1:
            groups.append(group)
            seen.add(doc_a["id"])

    return {"groups": groups, "total_potential_duplicates": sum(len(g) - 1 for g in groups)}


# ============================================================
# 17. OCR LANGUAGE AUTO-DETECTION
# ============================================================

@router.post("/api/ai/detect-language")
def detect_language(data: dict):
    """Detect the language of a document's text."""
    text = data.get("text", "")
    if not text:
        return {"language": "unknown", "confidence": 0}

    # Simple heuristic-based detection
    sample = text[:2000].lower()

    lang_indicators = {
        "en": ["the ", " is ", " are ", " was ", " were ", " and ", " for ", " with "],
        "fr": [" les ", " des ", " est ", " une ", " que ", " pour ", " dans ", " avec "],
        "es": [" los ", " las ", " una ", " que ", " del ", " por ", " con ", " para "],
        "de": [" der ", " die ", " das ", " ist ", " und ", " ein ", " von ", " mit "],
        "hi": ["\u0915\u093e", "\u0915\u0947", "\u0915\u0940", "\u0939\u0948", "\u0915\u094b", "\u092e\u0947\u0902", "\u0938\u0947", "\u0915\u0930"],
        "gu": ["\u0a9b\u0ac7", "\u0aa8\u0ac0", "\u0a9b\u0ac7", "\u0aae\u0abe\u0a82", "\u0aa8\u0abe", "\u0a95\u0ac7", "\u0aa8\u0ac7", "\u0aaa\u0ab0"],
        "zh": ["\u7684", "\u662f", "\u4e86", "\u5728", "\u6709", "\u4e2d", "\u4eba", "\u4e0d"],
        "ar": ["\u0641\u064a", "\u0645\u0646", "\u0639\u0644\u0649", "\u0625\u0644\u0649", "\u0623\u0646", "\u0647\u0630\u0627", "\u0630\u0644\u0643", "\u0644\u0627"],
        "ja": ["\u306e", "\u306f", "\u3092", "\u306b", "\u3067", "\u304c", "\u3068", "\u3082"],
        "pt": [" os ", " as ", " uma ", " que ", " dos ", " por ", " com ", " para "],
    }

    scores = {}
    for lang, indicators in lang_indicators.items():
        score = sum(1 for ind in indicators if ind in sample)
        if score > 0:
            scores[lang] = score

    if not scores:
        return {"language": "en", "confidence": 0.3, "method": "default"}

    best_lang = max(scores, key=scores.get)
    best_score = scores[best_lang]
    confidence = min(best_score / len(lang_indicators[best_lang]), 1.0)

    return {
        "language": best_lang,
        "confidence": round(confidence, 2),
        "all_scores": scores,
        "method": "heuristic",
    }


# ============================================================
# 18. HANDWRITING OCR
# ============================================================

@router.post("/api/ai/handwriting-ocr")
def handwriting_ocr(data: dict):
    """Use Claude Vision for handwriting recognition (better than Tesseract for handwriting)."""
    file_path = data.get("file_path")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(404, "File not found")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(400, "API key required for handwriting OCR")

    try:
        import anthropic
        import base64

        mime = data.get("mime_type", "image/png")
        if file_path.lower().endswith(".pdf"):
            from pdf2image import convert_from_path
            images = convert_from_path(file_path, first_page=1, last_page=5, dpi=300)
            results = []
            for i, img in enumerate(images):
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode()

                client = anthropic.Anthropic(api_key=api_key)
                resp = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=2048,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                            {"type": "text", "text": "Transcribe ALL text in this image, including any handwriting. Preserve the original layout and formatting as much as possible. If there's handwriting, note what appears to be handwritten vs printed."},
                        ],
                    }],
                )
                results.append({"page": i + 1, "text": resp.content[0].text})
            return {"pages": results, "total_pages": len(results)}
        else:
            image_data = Path(file_path).read_bytes()
            b64 = base64.b64encode(image_data).decode()
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}},
                        {"type": "text", "text": "Transcribe ALL text in this image, including any handwriting. Preserve the original layout."},
                    ],
                }],
            )
            return {"text": resp.content[0].text}
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================================
# 19. TABLE EXTRACTION FROM PDFs
# ============================================================

@router.post("/api/ai/extract-tables")
def extract_tables(data: dict):
    """Extract structured table data from a document."""
    file_path = data.get("file_path")
    doc_id = data.get("document_id")

    if doc_id and not file_path:
        conn = get_db()
        row = conn.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        conn.close()
        if row:
            file_path = row["file_path"]

    if not file_path or not Path(file_path).exists():
        raise HTTPException(404, "File not found")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(400, "API key required for table extraction")

    try:
        import anthropic
        import base64
        from pdf2image import convert_from_path

        if file_path.lower().endswith(".pdf"):
            images = convert_from_path(file_path, first_page=1, last_page=5, dpi=200)
        else:
            from PIL import Image
            images = [Image.open(file_path)]

        all_tables = []
        client = anthropic.Anthropic(api_key=api_key)

        for i, img in enumerate(images):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                        {"type": "text", "text": 'Extract ALL tables from this page as JSON arrays. Return: {"tables": [{"title": "table name", "headers": ["col1","col2"], "rows": [["val1","val2"]]}]}. If no tables, return {"tables": []}'},
                    ],
                }],
            )

            result_text = resp.content[0].text.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0]
            try:
                parsed = json.loads(result_text)
                for table in parsed.get("tables", []):
                    table["page"] = i + 1
                    all_tables.append(table)
            except json.JSONDecodeError:
                pass

        return {"tables": all_tables, "pages_scanned": len(images)}
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================================
# 20. CHART/GRAPH EXTRACTION
# ============================================================

@router.post("/api/ai/extract-charts")
def extract_charts(data: dict):
    """Extract data from charts/graphs in documents using Claude Vision."""
    file_path = data.get("file_path")
    doc_id = data.get("document_id")

    if doc_id and not file_path:
        conn = get_db()
        row = conn.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        conn.close()
        if row:
            file_path = row["file_path"]

    if not file_path or not Path(file_path).exists():
        raise HTTPException(404)

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(400, "API key required")

    try:
        import anthropic
        import base64

        if file_path.lower().endswith(".pdf"):
            from pdf2image import convert_from_path
            images = convert_from_path(file_path, first_page=1, last_page=5, dpi=200)
        else:
            from PIL import Image
            images = [Image.open(file_path)]

        charts = []
        client = anthropic.Anthropic(api_key=api_key)

        for i, img in enumerate(images):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                        {"type": "text", "text": 'Identify any charts, graphs, or diagrams. For each, extract: {"charts": [{"type": "bar/line/pie/scatter/other", "title": "chart title", "x_axis": "label", "y_axis": "label", "data_points": [{"label":"x","value":"y"}], "description": "what the chart shows"}]}. If none found, return {"charts": []}'},
                    ],
                }],
            )

            result_text = resp.content[0].text.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0]
            try:
                parsed = json.loads(result_text)
                for chart in parsed.get("charts", []):
                    chart["page"] = i + 1
                    charts.append(chart)
            except json.JSONDecodeError:
                pass

        return {"charts": charts, "pages_scanned": len(images)}
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================================
# 21. DOCUMENT COMPARISON
# ============================================================

@router.post("/api/ai/compare")
def compare_documents(data: dict):
    """Compare two documents and highlight differences."""
    doc_id_a = data.get("document_id_a")
    doc_id_b = data.get("document_id_b")

    conn = get_db()
    doc_a = conn.execute("SELECT * FROM documents WHERE id = ? AND is_deleted = 0", (doc_id_a,)).fetchone()
    doc_b = conn.execute("SELECT * FROM documents WHERE id = ? AND is_deleted = 0", (doc_id_b,)).fetchone()
    conn.close()

    if not doc_a or not doc_b:
        raise HTTPException(404, "One or both documents not found")

    text_a = doc_a["full_text"] or ""
    text_b = doc_b["full_text"] or ""

    # Compute text diff
    import difflib
    diff = list(difflib.unified_diff(
        text_a[:5000].splitlines(keepends=True),
        text_b[:5000].splitlines(keepends=True),
        fromfile=doc_a["title"],
        tofile=doc_b["title"],
        lineterm="",
    ))

    # Metadata comparison
    meta_diff = {}
    for field in ("title", "category", "subcategory", "file_size", "mime_type", "document_date", "language"):
        val_a = doc_a[field]
        val_b = doc_b[field]
        if val_a != val_b:
            meta_diff[field] = {"a": val_a, "b": val_b}

    # Tags comparison
    tags_a = set(json.loads(doc_a["tags"]) if doc_a["tags"] else [])
    tags_b = set(json.loads(doc_b["tags"]) if doc_b["tags"] else [])

    # Similarity score
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if words_a or words_b:
        similarity = len(words_a & words_b) / len(words_a | words_b) if (words_a | words_b) else 0
    else:
        similarity = 0

    # AI comparison if API key available
    ai_summary = None
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key and text_a and text_b:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": f"Compare these two documents briefly. What are the key differences and similarities?\n\nDocument A ({doc_a['title']}):\n{text_a[:2000]}\n\nDocument B ({doc_b['title']}):\n{text_b[:2000]}",
                }],
            )
            ai_summary = resp.content[0].text
        except Exception:
            pass

    return {
        "document_a": {"id": doc_id_a, "title": doc_a["title"], "category": doc_a["category"]},
        "document_b": {"id": doc_id_b, "title": doc_b["title"], "category": doc_b["category"]},
        "similarity": round(similarity, 3),
        "text_diff": "\n".join(diff[:200]),
        "metadata_diff": meta_diff,
        "tags": {
            "only_in_a": list(tags_a - tags_b),
            "only_in_b": list(tags_b - tags_a),
            "common": list(tags_a & tags_b),
        },
        "ai_summary": ai_summary,
    }
