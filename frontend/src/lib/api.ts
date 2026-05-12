const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

export interface Document {
  id: string;
  title: string;
  original_filename: string | null;
  file_path: string | null;
  category: string | null;
  subcategory: string | null;
  file_hash: string | null;
  mime_type: string | null;
  file_size: number | null;
  page_count: number | null;
  language: string | null;
  summary: string | null;
  full_text?: string | null;
  ai_confidence: number | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  created_at: string;
  updated_at: string | null;
  indexed_at?: string | null;
  document_date: string | null;
  is_archived: boolean;
  source: string | null;
  folder_id: string | null;
  tags: string[];
  people: string[];
  organizations: string[];
}

export interface DocumentList {
  documents: Document[];
  total: number;
  offset: number;
  limit: number;
}

export interface SearchResult {
  hits: Document[];
  total: number;
  query: string;
  processing_time_ms: number;
  facets: Record<string, Record<string, number>> | null;
}

export interface Stats {
  total_documents: number;
  total_size_bytes: number;
  categories: Record<string, number>;
  recent_uploads: number;
  pending_review: number;
  watched_folders: number;
}

export interface MediaMetadata {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  genre?: string | null;
  year?: string | null;
  track?: string | null;
  comment?: string | null;
  duration?: number | null;
  duration_str?: string | null;
  bitrate_kbps?: number | null;
  size_bytes?: number | null;
  // video
  width?: number | null;
  height?: number | null;
  video_codec?: string | null;
  fps?: number | null;
  // audio
  audio_codec?: string | null;
  channels?: number | null;
  sample_rate?: number | null;
}

export interface ArchiveEntry {
  name: string;
  size: number;
  compressed: number;
  is_dir: boolean;
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  mode?: string;
  Make?: string;
  Model?: string;
  DateTime?: string;
  DateTimeOriginal?: string;
  ExposureTime?: string;
  FNumber?: string;
  ISOSpeedRatings?: string;
  Flash?: string;
  FocalLength?: string;
  GPSInfo?: string;
}

export interface PreviewData extends Document {
  file_exists: boolean;
  preview_type: "image" | "pdf" | "audio" | "video" | "archive" | "code" | "text" | "document" | "none";
  view_url: string | null;
  thumbnail_url: string | null;
  linked_documents: Array<{ id: string; title: string; category: string; link_type: string }>;
  versions: Array<{ id: string; version_number: number; change_summary: string; created_at: string }>;
  comment_count: number;
  text_preview: string;
  media_metadata?: MediaMetadata | null;
  archive_contents?: ArchiveEntry[] | null;
  image_metadata?: ImageMetadata | null;
}

export interface Comment {
  id: string;
  document_id: string;
  parent_id: string | null;
  user_name: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  replies: Comment[];
}

export interface SmartFolder {
  id: string;
  name: string;
  icon: string;
  filters: Record<string, unknown>;
  sort_by?: string;
  builtin?: boolean;
}

export interface Activity {
  id: string;
  action: string;
  description: string;
  document_id: string | null;
  document_title: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Analytics {
  period_days: number;
  totals: { documents: number; size_bytes: number; avg_confidence: number };
  daily_indexed: Array<{ day: string; count: number }>;
  categories: Array<{ category: string; count: number; total_size: number }>;
  file_types: Array<{ type: string; count: number }>;
  confidence_distribution: Array<{ bracket: string; count: number }>;
  storage_growth: Array<{ day: string; daily_size: number }>;
  languages: Array<{ language: string; count: number }>;
  top_people: Array<{ name: string; count: number }>;
  top_organizations: Array<{ name: string; count: number }>;
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || error.message || "API error");
  }
  return res.json();
}

export const api = {
  documents: {
    list: (params?: { category?: string; offset?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.category) query.set("category", params.category);
      if (params?.offset) query.set("offset", String(params.offset));
      if (params?.limit) query.set("limit", String(params.limit));
      return fetchAPI<DocumentList>(`/api/documents?${query}`);
    },

    get: (id: string) => fetchAPI<Document>(`/api/documents/${id}`),

    preview: (id: string) => fetchAPI<PreviewData>(`/api/documents/${id}/preview`),

    upload: async (file: File, autoClassify = true) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetchAPI<Document>(
        `/api/documents?auto_classify=${autoClassify}`,
        { method: "POST", body: formData }
      );
    },

    update: (id: string, data: Partial<Document>) =>
      fetchAPI<Document>(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchAPI<{ status: string }>(`/api/documents/${id}`, { method: "DELETE" }),

    reclassify: (id: string) =>
      fetchAPI<Document>(`/api/documents/${id}/reclassify`, { method: "POST" }),

    open: (id: string) => fetchAPI<{ status: string }>(`/api/documents/${id}/open`),

    reveal: (id: string) => fetchAPI<{ status: string }>(`/api/documents/${id}/reveal`),

    downloadUrl: (id: string) => `${API_BASE}/api/documents/${id}/download`,

    viewUrl: (id: string) => `${API_BASE}/api/documents/${id}/view`,

    thumbnailUrl: (id: string) => `${API_BASE}/api/documents/${id}/thumbnail`,

    scroll: (params?: { cursor?: string; limit?: number; category?: string }) => {
      const query = new URLSearchParams();
      if (params?.cursor) query.set("cursor", params.cursor);
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.category) query.set("category", params.category);
      return fetchAPI<{ documents: Document[]; next_cursor: string | null; has_more: boolean }>(`/api/documents/scroll?${query}`);
    },
  },

  search: (query: string, params?: { category?: string; tags?: string; offset?: number }) => {
    const q = new URLSearchParams({ q: query });
    if (params?.category) q.set("category", params.category);
    if (params?.tags) q.set("tags", params.tags);
    if (params?.offset) q.set("offset", String(params.offset));
    return fetchAPI<SearchResult>(`/api/search?${q}`);
  },

  stats: () => fetchAPI<Stats>("/api/stats"),

  facets: () => fetchAPI<Record<string, Record<string, number>>>("/api/facets"),

  health: () => fetchAPI<{ status: string }>("/api/health"),

  scan: (directory: string, dryRun = true) =>
    fetchAPI<{ total: number; indexed?: number; skipped?: number; failed?: number; dry_run?: boolean }>(
      `/api/scan?directory=${encodeURIComponent(directory)}&dry_run=${dryRun}`,
      { method: "POST" }
    ),

  watchedFolders: () => fetchAPI<Array<{ id: string; path: string; last_scan: string; file_count: number }>>("/api/watched-folders"),

  // Timeline
  timeline: (year?: number, month?: number) => {
    const query = new URLSearchParams();
    if (year) query.set("year", String(year));
    if (month) query.set("month", String(month));
    return fetchAPI<{ months?: Array<{ month: string; count: number; categories: string[] }>; documents?: Document[] }>(`/api/timeline?${query}`);
  },

  // Smart Folders
  smartFolders: {
    list: () => fetchAPI<SmartFolder[]>("/api/smart-folders"),
    create: (data: { name: string; filters: Record<string, unknown>; icon?: string }) =>
      fetchAPI<{ id: string }>("/api/smart-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchAPI<{ status: string }>(`/api/smart-folders/${id}`, { method: "DELETE" }),
    documents: (id: string, params?: { offset?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.offset) query.set("offset", String(params.offset));
      if (params?.limit) query.set("limit", String(params.limit));
      return fetchAPI<DocumentList>(`/api/smart-folders/${id}/documents?${query}`);
    },
  },

  // Graph
  graph: (limit?: number) => fetchAPI<{ nodes: Array<{ id: string; title: string; category: string }>; edges: Array<{ source: string; target: string; type: string }> }>(`/api/graph?limit=${limit || 100}`),

  // Batch Operations
  batch: {
    retag: (docIds: string[], tags: string[], mode: string = "replace") =>
      fetchAPI<{ updated: number }>("/api/batch/retag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds, tags, mode }),
      }),
    recategorize: (docIds: string[], category: string, subcategory?: string) =>
      fetchAPI<{ updated: number }>("/api/batch/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds, category, subcategory }),
      }),
    delete: (docIds: string[]) =>
      fetchAPI<{ deleted: number }>("/api/batch/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds }),
      }),
    archive: (docIds: string[]) =>
      fetchAPI<{ archived: number }>("/api/batch/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds }),
      }),
    reclassify: (docIds: string[]) =>
      fetchAPI<{ reclassified: Array<{ id: string; category: string }> }>("/api/batch/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds }),
      }),
  },

  // Activity Feed
  activity: (params?: { limit?: number; days?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.days) query.set("days", String(params.days));
    return fetchAPI<{ activities: Activity[]; total: number; summary: { indexed_today: number } }>(`/api/activity?${query}`);
  },

  // Analytics
  analytics: (days?: number) => fetchAPI<Analytics>(`/api/analytics?days=${days || 30}`),

  // Comments
  comments: {
    list: (docId: string) => fetchAPI<{ comments: Comment[]; total: number }>(`/api/documents/${docId}/comments`),
    add: (docId: string, content: string, parentId?: string) =>
      fetchAPI<{ id: string }>(`/api/documents/${docId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: parentId }),
      }),
    delete: (commentId: string) => fetchAPI<{ status: string }>(`/api/comments/${commentId}`, { method: "DELETE" }),
  },

  // AI
  ai: {
    status: () => fetchAPI<{ claude: boolean; ollama: boolean; ollama_models: string[]; active_backend: string }>("/api/ai/status"),
    settings: () => fetchAPI<Record<string, unknown>>("/api/ai/settings"),
    updateSettings: (data: Record<string, unknown>) =>
      fetchAPI<{ status: string }>("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    findSimilar: (docId: string) =>
      fetchAPI<{ similar: Array<{ id: string; title: string; category: string; similarity: number }> }>("/api/ai/find-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      }),
    compare: (docIdA: string, docIdB: string) =>
      fetchAPI<Record<string, unknown>>("/api/ai/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id_a: docIdA, document_id_b: docIdB }),
      }),
    extractTables: (docId: string) =>
      fetchAPI<{ tables: Array<Record<string, unknown>> }>("/api/ai/extract-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      }),
  },

  // Settings
  settings: {
    get: () => fetchAPI<Record<string, string>>("/api/settings"),
    update: (data: Record<string, string>) =>
      fetchAPI<{ status: string }>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    shortcuts: () => fetchAPI<Array<{ key_combo: string; action: string; description: string }>>("/api/settings/shortcuts"),
  },

  // Help
  help: () => fetchAPI<{ sections: Array<{ title: string; items: Array<{ title: string; content: string }> }> }>("/api/help"),

  // Diagnostics
  diagnostics: () => fetchAPI<Record<string, unknown>>("/api/diagnostics"),

  // Version
  version: () => fetchAPI<{ version: string; build: string; platform: string }>("/api/version"),

  // Database
  db: {
    backup: () => fetchAPI<{ backup_path: string; size_bytes: number }>("/api/db/backup", { method: "POST" }),
    backups: () => fetchAPI<Array<{ path: string; name: string; size_bytes: number; created_at: string }>>("/api/db/backups"),
    restore: (backupPath: string) =>
      fetchAPI<{ status: string }>("/api/db/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup_path: backupPath }),
      }),
  },

  // Document Templates
  templates: {
    list: () => fetchAPI<Array<{ id: string; name: string; template_type: string; description: string; variables: string[]; builtin?: boolean }>>("/api/document-templates"),
    generate: (templateId: string, variables: Record<string, string>) =>
      fetchAPI<{ content: string; file_path: string }>(`/api/document-templates/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables, ai_enhance: true }),
      }),
  },

  // Plugins
  plugins: {
    list: () => fetchAPI<Array<{ id: string; name: string; version: string; description: string; is_active: boolean; builtin?: boolean }>>("/api/plugins"),
    toggle: (id: string, active: boolean) =>
      fetchAPI<{ status: string }>(`/api/plugins/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      }),
  },
};
