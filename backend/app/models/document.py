import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, BigInteger, Float, Boolean, ForeignKey, DateTime, Date, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def genuuid():
    return str(uuid.uuid4())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    subcategory: Mapped[str] = mapped_column(String(200), nullable=True, index=True)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float] = mapped_column(Float, nullable=True)
    storage_path: Mapped[str] = mapped_column(Text, nullable=True)
    thumbnail_path: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    document_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(50), nullable=True)
    folder_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=True)
    ai_metadata: Mapped[dict] = mapped_column(JSON, nullable=True)

    tags = relationship("Tag", secondary="document_tags", back_populates="documents")
    people = relationship("Person", secondary="document_people", back_populates="documents")
    organizations = relationship("Organization", secondary="document_organizations", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", order_by="DocumentVersion.version_number")
    folder = relationship("Folder", back_populates="documents")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    color: Mapped[str] = mapped_column(String(7), nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=True)

    documents = relationship("Document", secondary="document_tags", back_populates="tags")


class DocumentTag(Base):
    __tablename__ = "document_tags"

    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Person(Base):
    __tablename__ = "people"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    documents = relationship("Document", secondary="document_people", back_populates="people")


class DocumentPerson(Base):
    __tablename__ = "document_people"

    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    person_id: Mapped[str] = mapped_column(String(36), ForeignKey("people.id", ondelete="CASCADE"), primary_key=True)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    name: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)

    documents = relationship("Document", secondary="document_organizations", back_populates="organizations")


class DocumentOrganization(Base):
    __tablename__ = "document_organizations"

    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    document = relationship("Document", back_populates="versions")


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    parent_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=True)
    path: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    auto_rules: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    documents = relationship("Document", back_populates="folder")
    children = relationship("Folder", backref="parent", remote_side="Folder.id")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="editor")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_secret: Mapped[str] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=genuuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    document_id: Mapped[str] = mapped_column(String(36), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
