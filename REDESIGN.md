# DocuVault — Desktop-First Redesign

## The Problem
Nobody uploads 1TB of files through a browser. The app needs to work with files WHERE THEY ARE — on your local drive, external SSD, NAS.

## New Architecture: Local-First

```
Your Files (SSD, local disk)          DocuVault App
   /Finance/                    +------------------+
   /Immigration/        <-----> |  Electron/Tauri  |
   /Career Job/                 |  Desktop App     |
   /Education/                  |  (Mac + Windows) |
   ...                          +--------+---------+
                                         |
                                +--------+---------+
                                |  SQLite DB       |
                                |  (local, no PG)  |
                                +--------+---------+
                                         |
                          +--------------+--------------+
                          |              |              |
                 +--------+---+  +------+------+  +----+-------+
                 | Meilisearch |  | Claude API  |  | Tesseract  |
                 | (embedded)  |  | (classify)  |  | (OCR)      |
                 +-------------+  +-------------+  +------------+
```

## Key Changes

1. **No file upload/copy** — index files IN PLACE on disk
2. **SQLite** instead of PostgreSQL — single file DB, no server needed
3. **Desktop app** (Tauri) — native Mac/Windows, ~10MB, fast
4. **No MinIO** — files stay on disk, DB stores the path
5. **Meilisearch** — runs as embedded sidecar process
6. **Portable** — everything in one app, double-click to run

## How It Works

1. User adds a folder: "Scan /Volumes/Mihir-SSD"
2. DocuVault walks the directory tree
3. For each file: extract text (OCR if needed) -> Claude Haiku classifies -> index in Meilisearch
4. Files STAY WHERE THEY ARE — only metadata is stored in SQLite
5. User searches via the app — results link to the actual file on disk
6. Click to open file in default app (Preview, Word, etc.)

## Database (SQLite)

```sql
-- No more storage_path to MinIO. Just the actual file path.
documents (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,  -- actual path on disk
    title TEXT,
    category TEXT,
    subcategory TEXT,
    file_hash TEXT,
    mime_type TEXT,
    file_size INTEGER,
    summary TEXT,
    full_text TEXT,
    ai_confidence REAL,
    document_date TEXT,
    tags TEXT,        -- JSON array
    people TEXT,      -- JSON array
    organizations TEXT, -- JSON array
    created_at TEXT,
    indexed_at TEXT,
    source TEXT       -- which watched folder
);

watched_folders (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    last_scan TEXT,
    file_count INTEGER
);
```

## Tech Stack (Desktop)

| Component | Old (Web) | New (Desktop) |
|---|---|---|
| Frontend | Next.js (browser) | Tauri + React (native window) |
| Backend | FastAPI (server) | Tauri Rust backend (embedded) |
| Database | PostgreSQL (server) | SQLite (single file) |
| Storage | MinIO (object store) | Direct disk access |
| Search | Meilisearch (server) | Meilisearch (sidecar) |
| AI | Claude API | Claude API (same) |
| OCR | Tesseract (server) | Tesseract (bundled) |
| Deploy | Docker Compose | Single .dmg/.exe installer |

## User Flow

1. Download DocuVault.dmg (Mac) or DocuVault.exe (Windows)
2. Install, open
3. Add folder: /Volumes/Mihir-SSD
4. Click "Scan" — progress bar shows classification
5. Search instantly: "find my T4 2024"
6. Click result -> opens file in Finder/Explorer
7. Right-click -> Reclassify, Move, Tag, Delete

## Cost: Same
- App: Free (open source)
- Claude API: ~$0.005/doc for classification
- No server needed (runs on your Mac)
