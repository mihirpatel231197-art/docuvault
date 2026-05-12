import meilisearch

from app.core.config import settings

INDEX_NAME = "documents"

SEARCHABLE_ATTRIBUTES = [
    "title",
    "summary",
    "full_text",
    "tags",
    "people",
    "organizations",
    "category",
    "subcategory",
    "original_filename",
]

FILTERABLE_ATTRIBUTES = [
    "category",
    "subcategory",
    "tags",
    "language",
    "source",
    "is_archived",
    "document_date",
    "created_at",
]

SORTABLE_ATTRIBUTES = ["created_at", "document_date", "title", "file_size"]


class SearchService:
    def __init__(self):
        self.client = meilisearch.Client(settings.meilisearch_url, settings.meilisearch_key)
        self._ensure_index()

    def _ensure_index(self):
        try:
            self.client.get_index(INDEX_NAME)
        except meilisearch.errors.MeilisearchApiError:
            self.client.create_index(INDEX_NAME, {"primaryKey": "id"})

        index = self.client.index(INDEX_NAME)
        index.update_searchable_attributes(SEARCHABLE_ATTRIBUTES)
        index.update_filterable_attributes(FILTERABLE_ATTRIBUTES)
        index.update_sortable_attributes(SORTABLE_ATTRIBUTES)
        index.update_displayed_attributes(["*"])
        index.update_typo_tolerance({"enabled": True})

    def index_document(self, doc: dict):
        """Add or update a document in the search index."""
        search_doc = {
            "id": doc["id"],
            "title": doc.get("title", ""),
            "original_filename": doc.get("original_filename", ""),
            "category": doc.get("category", ""),
            "subcategory": doc.get("subcategory", ""),
            "summary": doc.get("summary", ""),
            "full_text": (doc.get("full_text", "") or "")[:50000],
            "tags": doc.get("tags", []),
            "people": doc.get("people", []),
            "organizations": doc.get("organizations", []),
            "language": doc.get("language", ""),
            "source": doc.get("source", ""),
            "is_archived": doc.get("is_archived", False),
            "file_size": doc.get("file_size", 0),
            "mime_type": doc.get("mime_type", ""),
            "document_date": doc.get("document_date"),
            "created_at": doc.get("created_at"),
        }
        index = self.client.index(INDEX_NAME)
        index.add_documents([search_doc])

    def search(self, query: str, filters: str = None, sort: list = None,
               offset: int = 0, limit: int = 20) -> dict:
        """Search documents."""
        index = self.client.index(INDEX_NAME)
        params = {
            "offset": offset,
            "limit": limit,
            "attributesToHighlight": ["title", "summary", "full_text"],
            "highlightPreTag": "<mark>",
            "highlightPostTag": "</mark>",
            "attributesToCrop": ["full_text"],
            "cropLength": 200,
        }
        if filters:
            params["filter"] = filters
        if sort:
            params["sort"] = sort

        return index.search(query, params)

    def delete_document(self, doc_id: str):
        """Remove a document from the search index."""
        index = self.client.index(INDEX_NAME)
        index.delete_document(doc_id)

    def get_facets(self) -> dict:
        """Get faceted counts for categories and tags."""
        index = self.client.index(INDEX_NAME)
        result = index.search("", {
            "facets": ["category", "subcategory", "tags", "language"],
            "limit": 0,
        })
        return result.get("facetDistribution", {})


search_service = SearchService()
