import json
import anthropic

from app.core.config import settings

CLASSIFY_PROMPT = """You are a document classification AI. Analyze the document text and return a JSON object with:

{
  "title": "A clean, descriptive filename (no hash names, no junk). Use the document's actual title or describe its content.",
  "category": "One of: Finance, Immigration, Career, Education, Engineering, Personal, Medical, Legal, Other",
  "subcategory": "Specific type, e.g.: Tax, Bank Statement, IELTS, Resume, Cover Letter, Passport, Work Permit, Payslip, Invoice, ASME Standard, Drawing, Assignment, etc.",
  "tags": ["list", "of", "relevant", "searchable", "tags"],
  "date": "YYYY-MM-DD if a date is found in the document, otherwise null",
  "language": "en, hi, gu, fr, etc.",
  "summary": "1-2 sentence summary of what this document is about",
  "people": ["names of people mentioned"],
  "organizations": ["companies/institutions mentioned"],
  "is_duplicate_likely": false,
  "confidence": 0.95
}

Rules:
- Title should be human-readable: "T4 Tax Statement 2024" not "00046634.pdf"
- Category must be exactly one of the listed options
- Tags should be specific and useful for searching
- Extract dates in YYYY-MM-DD format
- List all people and organizations mentioned
- Confidence should reflect how sure you are about the classification (0.0-1.0)
- If the document is very short or unclear, set confidence low

Return ONLY valid JSON, no other text."""


class ClassifierService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def classify(self, text: str, filename: str = "", mime_type: str = "") -> dict:
        """Classify a document using Claude Haiku."""
        if not text or len(text.strip()) < 10:
            return self._fallback_classify(filename, mime_type)

        truncated = text[:6000]

        context = f"Original filename: {filename}\nMIME type: {mime_type}\n\n"

        try:
            response = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": f"{CLASSIFY_PROMPT}\n\n{context}Document text:\n{truncated}",
                    }
                ],
            )
            result_text = response.content[0].text.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(result_text)
        except (json.JSONDecodeError, anthropic.APIError, IndexError):
            return self._fallback_classify(filename, mime_type)

    def classify_with_vision(self, image_data: bytes, filename: str = "") -> dict:
        """Classify a scanned document using Claude Vision."""
        import base64
        b64 = base64.b64encode(image_data).decode("utf-8")

        try:
            response = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {"type": "base64", "media_type": "image/png", "data": b64},
                            },
                            {
                                "type": "text",
                                "text": f"Original filename: {filename}\n\n{CLASSIFY_PROMPT}",
                            },
                        ],
                    }
                ],
            )
            result_text = response.content[0].text.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(result_text)
        except (json.JSONDecodeError, anthropic.APIError, IndexError):
            return self._fallback_classify(filename, "image/png")

    @staticmethod
    def _fallback_classify(filename: str, mime_type: str) -> dict:
        """Basic classification when AI fails."""
        name = filename.rsplit(".", 1)[0] if "." in filename else filename
        return {
            "title": name.replace("_", " ").replace("-", " ").strip() or "Untitled Document",
            "category": "Other",
            "subcategory": "Uncategorized",
            "tags": [],
            "date": None,
            "language": "en",
            "summary": f"Uploaded file: {filename}",
            "people": [],
            "organizations": [],
            "is_duplicate_likely": False,
            "confidence": 0.1,
        }


classifier_service = ClassifierService()
