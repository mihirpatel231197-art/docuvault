"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Scan, RefreshCw, X, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, CardHeader, Btn } from "@/components/ds";

async function pickFolder(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false, title: "Select folder to scan" });
    return typeof selected === "string" ? selected : null;
  } catch {
    // Not running in Tauri — fall through (web dev mode)
    return null;
  }
}

// ── ResultStat ─────────────────────────────────────────────────────

function ResultStat({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--ink-1)",
        border: "1px solid var(--border-faint)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--fg-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 600,
          color: color ?? "var(--fg-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-primary)", margin: 0 }}>
          {title}
        </h3>
        {hint && (
          <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <Card padding={16}>{children}</Card>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [scanPath, setScanPath] = useState("");

  const { data: folders } = useQuery({
    queryKey: ["watched-folders"],
    queryFn: api.watchedFolders,
  });
  const { data: aiStatus } = useQuery({
    queryKey: ["ai-status"],
    queryFn: api.ai.status,
  });
  const { data: versionData } = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
  });
  const { data: diagnostics } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: api.diagnostics,
  });
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.stats,
  });

  const preview = useMutation({
    mutationFn: (dir: string) => api.scan(dir, true),
  });

  const scanMutation = useMutation({
    mutationFn: (dir: string) => api.scan(dir, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-folders"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Scan complete");
    },
    onError: (err) =>
      toast.error(`Scan failed: ${err instanceof Error ? err.message : "Unknown"}`),
  });

  const rescan = useMutation({
    mutationFn: (dir: string) => api.scan(dir, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-folders"] });
      toast.success("Rescan complete");
    },
  });

  const scanResult = scanMutation.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      <PageHeader
        title="Settings"
        subtitle="Manage scan locations, AI access, and storage."
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: 720,
        }}
      >
        {/* Scan a folder */}
        <Section
          title="Scan a folder"
          hint="Index all files in a directory and add it to your watched folders."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                placeholder="/Users/you/Documents or ~/Downloads"
                style={{
                  flex: 1,
                  height: 34,
                  padding: "0 12px",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-primary)",
                  outline: "none",
                }}
              />
              <Btn
                variant="secondary"
                icon={<FolderOpen size={13} />}
                onClick={async () => {
                  const path = await pickFolder();
                  if (path) setScanPath(path);
                }}
              >
                Browse
              </Btn>
              <Btn
                variant="secondary"
                disabled={!scanPath || preview.isPending}
                onClick={() => preview.mutate(scanPath)}
              >
                {preview.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Preview
              </Btn>
              <Btn
                variant="primary"
                icon={<Scan size={13} />}
                disabled={!scanPath || scanMutation.isPending}
                onClick={() => scanMutation.mutate(scanPath)}
              >
                {scanMutation.isPending ? "Scanning…" : "Scan"}
              </Btn>
            </div>

            {/* Scan progress bar */}
            {scanMutation.isPending && (
              <div
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: "var(--ink-3)",
                  overflow: "hidden",
                }}
              >
                <div
                  className="dv-progress"
                  style={{
                    height: "100%",
                    background: "var(--accent-500)",
                    borderRadius: 999,
                    animation: "dv-progress-anim 1.4s ease-in-out infinite",
                  }}
                />
              </div>
            )}

            {/* Preview result */}
            {preview.data && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--ink-2)",
                  border: "1px solid var(--border-faint)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  color: "var(--fg-secondary)",
                }}
              >
                <strong style={{ fontFamily: "var(--font-mono)" }}>{preview.data.total}</strong>{" "}
                files found in{" "}
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "var(--ink-3)",
                    padding: "1px 5px",
                    borderRadius: "var(--radius-xs)",
                  }}
                >
                  {scanPath}
                </code>
              </div>
            )}

            {/* Scan result stats */}
            {scanResult && !scanResult.dry_run && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <ResultStat label="Total" value={scanResult.total} />
                <ResultStat
                  label="Indexed"
                  value={scanResult.indexed ?? 0}
                  color="var(--success)"
                />
                <ResultStat
                  label="Skipped"
                  value={scanResult.skipped ?? 0}
                  color="var(--warning)"
                />
                <ResultStat
                  label="Failed"
                  value={scanResult.failed ?? 0}
                  color="var(--danger)"
                />
              </div>
            )}
          </div>
        </Section>

        {/* Watched folders */}
        <Section
          title="Watched folders"
          hint="Folders that are automatically re-scanned when files change."
        >
          {!folders || folders.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-muted)", padding: "8px 0" }}>
              No folders scanned yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-faint)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--fg-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {folder.path}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}
                    >
                      {folder.file_count} files &middot; Last scan:{" "}
                      {folder.last_scan ? formatDate(folder.last_scan) : "Never"}
                    </div>
                  </div>
                  <Btn
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw size={12} />}
                    onClick={() => rescan.mutate(folder.path)}
                  >
                    Rescan
                  </Btn>
                  <Btn
                    variant="ghost"
                    size="sm"
                    icon={<X size={12} />}
                    style={{ padding: "5px 8px" }}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* AI Status */}
        <Section title="AI Status" hint="Connected AI providers used for document classification.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--fg-primary)" }}>Claude API</span>
              <span
                style={{
                  display: "inline-flex",
                  padding: "2px 9px",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  fontWeight: 500,
                  background: aiStatus?.claude
                    ? "var(--success-bg)"
                    : "var(--bg-card)",
                  color: aiStatus?.claude ? "var(--success)" : "var(--fg-muted)",
                  border: `1px solid ${aiStatus?.claude ? "var(--success)" : "var(--border-default)"}`,
                }}
              >
                {aiStatus?.claude ? "Active" : "Not configured"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--fg-primary)" }}>Active backend</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-secondary)",
                  background: "var(--ink-3)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {aiStatus?.active_backend ?? "—"}
              </span>
            </div>
            {aiStatus?.ollama && aiStatus.ollama_models?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 6 }}>
                  Ollama models:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {aiStatus.ollama_models.map((m: string) => (
                    <span
                      key={m}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--ink-3)",
                        border: "1px solid var(--border-faint)",
                        color: "var(--fg-secondary)",
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* About */}
        <Section title="About" hint="Version info and storage details.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <ResultStat label="Version" value={versionData?.version ?? "—"} />
            <ResultStat label="Documents" value={stats?.total_documents ?? "—"} />
            <ResultStat
              label="DB Path"
              value={
                <span style={{ fontSize: 11 }}>
                  {(diagnostics as { db_path?: string } | undefined)?.db_path ?? "—"}
                </span>
              }
            />
            <ResultStat label="Platform" value={versionData?.platform ?? "—"} />
          </div>
        </Section>
      </div>
    </div>
  );
}
