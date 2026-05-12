"use client";

import { useState } from "react";
import {
  ExternalLink, FolderOpen, RotateCcw, Trash2,
} from "lucide-react";
import { type Document, api } from "@/lib/api";
import { formatBytes, formatDate, categoryColor, inferFileType, FILE_TYPE_META, confidenceColor } from "@/lib/utils";

function FileTypeIcon({ mime, size = 32 }: { mime: string | null; size?: number }) {
  const t = inferFileType(mime);
  const meta = FILE_TYPE_META[t];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 7,
        display: "grid", placeItems: "center", flexShrink: 0,
        background: meta.bg, color: meta.color,
        fontFamily: "var(--font-mono)", fontSize: size <= 28 ? 9 : 10,
        fontWeight: 700, letterSpacing: "0.02em",
      }}
    >
      {meta.label}
    </div>
  );
}

function CategoryBadge({ name }: { name: string }) {
  const c = categoryColor(name);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 7,
        fontSize: 10, fontWeight: 500,
        color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      {name}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const c = confidenceColor(value);
  return (
    <span
      style={{
        display: "inline-flex", padding: "2px 7px", borderRadius: 7,
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
        fontVariantNumeric: "tabular-nums", color: c.fg, background: c.bg,
      }}
    >
      {pct}%
    </span>
  );
}

function IconButton({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size: number }>; onClick: (e: React.MouseEvent) => void; title: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, display: "grid", placeItems: "center",
        border: "none", borderRadius: 5,
        background: hover ? "var(--ink-4)" : "transparent",
        color: hover ? "var(--ink-10)" : "var(--ink-8)",
        cursor: "pointer", transition: `all var(--dur-base) var(--ease-out)`,
      }}
    >
      <Icon size={14} />
    </button>
  );
}

export function DocumentCard({
  doc,
  onDelete,
  onReclassify,
  onClick,
}: {
  doc: Document;
  onDelete?: (id: string) => void;
  onReclassify?: (id: string) => void;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "10px 14px", borderRadius: 7,
        background: hover ? "var(--ink-2)" : "transparent",
        border: hover ? "1px solid var(--ink-4)" : "1px solid transparent",
        cursor: onClick ? "pointer" : undefined,
        transition: `background var(--dur-base) var(--ease-out)`,
      }}
    >
      <FileTypeIcon mime={doc.mime_type} size={32} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 500, color: "var(--ink-10)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {doc.title}
          </span>
          {doc.category && <CategoryBadge name={doc.category} />}
          {doc.subcategory && (
            <span style={{ fontSize: 11, color: "var(--ink-7)" }}>{doc.subcategory}</span>
          )}
        </div>

        {/* Summary */}
        {doc.summary && (
          <div style={{
            fontSize: 12, color: "var(--ink-8)", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {doc.summary}
          </div>
        )}

        {/* Path */}
        {doc.file_path && (
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-7)", marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {doc.file_path}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        gap: 4, fontSize: 11, color: "var(--ink-8)", flexShrink: 0, width: 120, whiteSpace: "nowrap",
      }}>
        {doc.file_size && (
          <span style={{ fontFamily: "var(--font-mono)" }}>{formatBytes(doc.file_size)}</span>
        )}
        <span>{formatDate(doc.created_at)}</span>
      </div>

      {doc.ai_confidence != null && <ConfidenceBadge value={doc.ai_confidence} />}

      {/* Actions on hover */}
      <div style={{
        display: "flex", gap: 2,
        opacity: hover ? 1 : 0,
        transition: "opacity 120ms",
      }}>
        <IconButton icon={ExternalLink} title="Open file" onClick={() => api.documents.open(doc.id)} />
        <IconButton icon={FolderOpen} title="Reveal in Finder" onClick={() => api.documents.reveal(doc.id)} />
        {onReclassify && (
          <IconButton icon={RotateCcw} title="Reclassify" onClick={() => onReclassify(doc.id)} />
        )}
        {onDelete && (
          <IconButton icon={Trash2} title="Delete" onClick={() => onDelete(doc.id)} />
        )}
      </div>
    </div>
  );
}
