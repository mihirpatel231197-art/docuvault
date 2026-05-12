"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileSearch2, Sparkles, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  PageHeader,
  Card,
  CardHeader,
  FileTypeIcon,
  CategoryBadge,
  ConfidenceBadge,
} from "@/components/ds";

type IndexStage = "uploading" | "extracting" | "classifying" | "done";

interface IndexingItem {
  id: string;
  name: string;
  mime: string | null;
  stage: IndexStage;
  progress: number;
  category?: string | null;
  confidence?: number | null;
}

const STAGE_LABELS: Record<IndexStage, string> = {
  uploading: "Uploading…",
  extracting: "Extracting text…",
  classifying: "Asking Claude…",
  done: "Indexed",
};

const steps = [
  { icon: UploadCloud, label: "Upload", desc: "Drag files into the zone above." },
  { icon: FileSearch2, label: "Extract", desc: "Text extracted; OCR runs on scans." },
  { icon: Sparkles, label: "Classify", desc: "Claude assigns category, tags, dates." },
  { icon: Search, label: "Searchable", desc: "Indexed in SQLite, ready to query." },
];

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<IndexingItem[]>([]);

  const updateItem = (id: string, patch: Partial<IndexingItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processFile = async (file: File) => {
    const id = `${Date.now()}-${Math.random()}`;
    const mime = file.type || null;

    setItems((prev) => [
      { id, name: file.name, mime, stage: "uploading", progress: 20 },
      ...prev,
    ]);

    try {
      updateItem(id, { stage: "extracting", progress: 40 });
      await new Promise((r) => setTimeout(r, 200));
      updateItem(id, { stage: "classifying", progress: 70 });

      const doc = await api.documents.upload(file, true);

      updateItem(id, {
        stage: "done",
        progress: 100,
        category: doc.category,
        confidence: doc.ai_confidence,
      });

      toast.success(`${file.name} indexed`);
    } catch (err) {
      toast.error(`Failed to index ${file.name}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(processFile);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Upload"
        subtitle="Drop files to index them without adding a watched folder."
      />

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          minHeight: 200,
          border: `2px dashed ${isDragging ? "var(--accent-500)" : "var(--ink-5)"}`,
          borderRadius: "var(--radius-lg)",
          background: isDragging
            ? "radial-gradient(ellipse at center, oklch(0.62 0.19 248 / 0.08) 0%, var(--bg-card) 70%)"
            : "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          cursor: "pointer",
          transition: "border-color 160ms, background 160ms",
          padding: "32px 24px",
        }}
      >
        {/* Icon box */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--radius-md)",
            background: "var(--ink-3)",
            display: "grid",
            placeItems: "center",
            color: isDragging ? "var(--accent-500)" : "var(--fg-tertiary)",
            transition: "color 160ms",
          }}
        >
          <UploadCloud size={24} />
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg-primary)" }}>
            Drop files here, or click to browse
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 4 }}>
            PDF, Word, Excel, images, audio, code — anything.
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fg-muted)",
              marginTop: 8,
            }}
          >
            Files are copied to ~/Library/DocuVault/uploads/
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Live results */}
      {items.length > 0 && (
        <Card padding={0}>
          <CardHeader title="Indexing" hint={`${items.filter((i) => i.stage === "done").length}/${items.length} done`} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--border-faint)",
                }}
              >
                <FileTypeIcon mime={item.mime} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--fg-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>
                      {STAGE_LABELS[item.stage]}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: 3,
                      borderRadius: 999,
                      background: "var(--ink-3)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${item.progress}%`,
                        background:
                          item.stage === "done"
                            ? "var(--success)"
                            : "var(--accent-500)",
                        borderRadius: 999,
                        transition: "width 300ms ease-out",
                      }}
                    />
                  </div>
                </div>
                {item.stage === "done" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {item.category && <CategoryBadge name={item.category} size="sm" />}
                    {item.confidence != null && <ConfidenceBadge value={item.confidence} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pipeline card */}
      <Card padding={0}>
        <CardHeader title="How it works" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            padding: 16,
            gap: 12,
          }}
        >
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
              <div
                style={{
                  flex: 1,
                  padding: "14px 14px 12px",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-faint)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--ink-3)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--fg-secondary)",
                  }}
                >
                  <s.icon size={14} />
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginTop: 10,
                    color: "var(--fg-primary)",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--fg-tertiary)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {s.desc}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                    color: "var(--fg-muted)",
                    alignSelf: "center",
                  }}
                >
                  <ChevronRight size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
