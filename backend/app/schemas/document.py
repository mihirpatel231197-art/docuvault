from datetime import datetime, date
from pydantic import BaseModel


class DocumentCreate(BaseModel):
    title: str | None = None
    category: str | None = None
    subcategory: str | None = None
    tags: list[str] = []
    folder_id: str | None = None
    source: str = "upload"


class DocumentUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    subcategory: str | None = None
    tags: list[str] | None = None
    folder_id: str | None = None
    is_archived: bool | None = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    original_filename: str | None
    category: str | None
    subcategory: str | None
    file_hash: str | None
    mime_type: str | None
    file_size: int | None
    page_count: int | None
    language: str | None
    summary: str | None
    ai_confidence: float | None
    storage_path: str | None
    thumbnail_path: str | None
    created_at: datetime
    updated_at: datetime | None
    document_date: date | None
    is_archived: bool
    source: str | None
    folder_id: str | None
    tags: list[str] = []
    people: list[str] = []
    organizations: list[str] = []

    class Config:
        from_attributes = True


class DocumentList(BaseModel):
    documents: list[DocumentResponse]
    total: int
    offset: int
    limit: int


class SearchRequest(BaseModel):
    query: str = ""
    category: str | None = None
    subcategory: str | None = None
    tags: list[str] | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: str | None = None
    offset: int = 0
    limit: int = 20


class SearchResponse(BaseModel):
    hits: list[dict]
    total: int
    query: str
    processing_time_ms: int
    facets: dict | None = None


class StatsResponse(BaseModel):
    total_documents: int
    total_size_bytes: int
    categories: dict[str, int]
    recent_uploads: int
    pending_review: int
