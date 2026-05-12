"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, CheckCircle, XCircle } from "lucide-react";
import { api, type Document } from "@/lib/api";
import { formatBytes, inferFileType, FILE_TYPE_META, categoryColor, confidenceColor } from "@/lib/utils";
import { toast } from "sonner";

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "classifying" | "done" | "error";
  result?: Document;
  error?: string;
  progress: number;
}

export function UploadZone({ onComplete }: { onComplete?: () => void }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const items: UploadItem[] = acceptedFiles.map((file) => ({
      file, status: "pending" as const, progress: 0,
    }));
    setUploads((prev) => [...prev, ...items]);

    for (const item of items) {
      setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "uploading", progress: 0.2 } : u));

      try {
        setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "classifying", progress: 0.6 } : u));
        const result = await api.documents.upload(item.file);
        setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "done", result, progress: 1 } : u));
        toast.success(`Indexed ${result.title}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "error", error: message, progress: 0 } : u));
        toast.error(`Failed: ${item.file.name}`);
      }
    }
    onComplete?.();
  }, [onComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
  const completed = uploads.filter((u) => u.status === "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        style={{
          minHeight: 200, borderRadius: 10,
          border: `1.5px dashed ${isDragActive ? "var(--accent-500)" : "var(--ink-5)"}`,
          background: isDragActive
            ? "radial-gradient(circle at center, oklch(0.62 0.19 248 / 0.08), transparent 70%), var(--ink-2)"
            : "var(--ink-2)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10, padding: 24, cursor: "pointer",
          transition: `all var(--dur-base) var(--ease-out)`,
        }}
      >
        <input {...getInputProps()} />
        <div style={{
          width: 52, height: 52, borderRadius: 10, background: "var(--ink-3)",
          display: "grid", placeItems: "center",
          color: isDragActive ? "var(--accent-500)" : "var(--ink-8)",
        }}>
          <UploadCloud size={24} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-10)" }}>
          {isDragActive ? "Drop files here" : "Drop files here, or click to browse"}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-8)" }}>
          PDF, Word, Excel, images, audio, code \u2014 anything.
        </div>
      </div>

      {/* Upload items */}
      {uploads.length > 0 && (
        <div style={{
          background: "var(--ink-2)", border: "1px solid var(--ink-4)", borderRadius: 10,
          boxShadow: "var(--shadow-inset-top)", overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px 10px", borderBottom: "1px solid var(--ink-3)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-10)" }}>Indexing progress</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-7)" }}>
              {completed}/{uploads.length} complete
            </span>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {uploads.map((item, i) => {
              const ft = inferFileType(item.file.type);
              const meta = FILE_TYPE_META[ft];
              const stageLabel: Record<string, string> = {
                pending: "Queued", uploading: "Uploading...", classifying: "Asking Claude...", done: "Indexed", error: "Failed",
              };

              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 7,
                  background: item.status === "done" ? "var(--ink-1)" : "var(--ink-2)",
                  border: "1px solid var(--ink-3)",
                }}>
                  {/* File type icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center",
                    background: meta.bg, color: meta.color, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                  }}>
                    {meta.label}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-10)" }}>
                      {item.result?.title || item.file.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
                        <div style={{
                          width: `${item.progress * 100}%`, height: "100%",
                          background: item.status === "done" ? "var(--dv-success)" : item.status === "error" ? "var(--dv-danger)" : "var(--accent-500)",
                          transition: "width 320ms",
                        }} />
                      </div>
                      <span style={{
                        fontSize: 11, minWidth: 90, textAlign: "right",
                        color: item.status === "done" ? "var(--dv-success)" : item.status === "error" ? "var(--dv-danger)" : "var(--ink-8)",
                      }}>
                        {stageLabel[item.status]}
                      </span>
                    </div>
                  </div>

                  {item.status === "done" && item.result && (
                    <>
                      {item.result.category && (() => {
                        const c = categoryColor(item.result.category);
                        return (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 7px", borderRadius: 7, fontSize: 10, fontWeight: 500,
                            color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }} />
                            {item.result.category}
                          </span>
                        );
                      })()}
                      {item.result.ai_confidence != null && (() => {
                        const cc = confidenceColor(item.result.ai_confidence);
                        return (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                            padding: "2px 7px", borderRadius: 7,
                            color: cc.fg, background: cc.bg,
                          }}>
                            {Math.round(item.result.ai_confidence * 100)}%
                          </span>
                        );
                      })()}
                    </>
                  )}

                  {item.status === "classifying" && (
                    <Loader2 size={14} color="var(--ink-8)" className="animate-spin" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
