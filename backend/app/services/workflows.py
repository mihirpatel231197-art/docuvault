import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.document import Document

logger = logging.getLogger(__name__)


WORKFLOW_RULES = [
    {
        "name": "Auto-file tax documents",
        "match": {"category": "Finance", "tags_any": ["tax", "t4", "assessment", "notice of assessment"]},
        "actions": {"subfolder": "Tax"},
    },
    {
        "name": "Auto-file payslips",
        "match": {"category": "Career", "subcategory_contains": "payslip"},
        "actions": {"subfolder": "Payslips"},
    },
    {
        "name": "Auto-file bank statements",
        "match": {"category": "Finance", "tags_any": ["bank statement", "chequing", "savings"]},
        "actions": {"subfolder": "Bank Statements"},
    },
    {
        "name": "Auto-file IELTS materials",
        "match": {"category": "Education", "tags_any": ["ielts", "cambridge", "listening test"]},
        "actions": {"subfolder": "IELTS"},
    },
    {
        "name": "Auto-file immigration docs",
        "match": {"category": "Immigration"},
        "actions": {},
    },
    {
        "name": "Auto-file resumes",
        "match": {"category": "Career", "subcategory_contains": "resume"},
        "actions": {"subfolder": "Resume"},
    },
    {
        "name": "Auto-file cover letters",
        "match": {"category": "Career", "subcategory_contains": "cover letter"},
        "actions": {"subfolder": "Cover Letters"},
    },
    {
        "name": "Flag expiring immigration docs",
        "match": {"category": "Immigration", "has_date": True},
        "actions": {"alert_days_before": 30},
    },
]


def run_workflows(db: Session, doc: Document) -> list[str]:
    """Run all workflow rules against a document. Returns list of actions taken."""
    actions_taken = []
    tags = [t.name.lower() for t in doc.tags] if doc.tags else []
    category = (doc.category or "").lower()
    subcategory = (doc.subcategory or "").lower()

    for rule in WORKFLOW_RULES:
        match = rule["match"]

        if "category" in match and match["category"].lower() != category:
            continue

        if "subcategory_contains" in match:
            if match["subcategory_contains"].lower() not in subcategory:
                continue

        if "tags_any" in match:
            if not any(t in tags for t in match["tags_any"]):
                continue

        actions = rule["actions"]

        if "subfolder" in actions:
            new_sub = actions["subfolder"]
            if doc.subcategory != new_sub:
                doc.subcategory = new_sub
                actions_taken.append(f"Set subcategory to {new_sub}")

        if "alert_days_before" in actions and doc.document_date:
            alert_date = doc.document_date - timedelta(days=actions["alert_days_before"])
            if datetime.now(timezone.utc).date() >= alert_date:
                actions_taken.append(f"ALERT: {doc.title} expires on {doc.document_date}")
                logger.warning(f"Document expiry alert: {doc.title} expires {doc.document_date}")

        if actions_taken:
            logger.info(f"Workflow '{rule['name']}' matched: {actions_taken}")

    if actions_taken:
        db.commit()

    return actions_taken


def get_expiring_documents(db: Session, days: int = 30) -> list[dict]:
    """Find documents with dates expiring within N days."""
    cutoff = datetime.now(timezone.utc).date() + timedelta(days=days)
    today = datetime.now(timezone.utc).date()

    docs = (
        db.query(Document)
        .filter(
            Document.is_deleted == False,
            Document.document_date.isnot(None),
            Document.document_date <= cutoff,
            Document.document_date >= today,
            Document.category == "Immigration",
        )
        .order_by(Document.document_date)
        .all()
    )

    return [
        {
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "document_date": str(d.document_date),
            "days_until": (d.document_date - today).days,
        }
        for d in docs
    ]
