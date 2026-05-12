"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { categoryColor } from "@/lib/utils";
import { FileTypeIcon, Kbd } from "@/components/ds";
import { Search, FolderPlus, MessageSquare, Copy, ExternalLink } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["documents", "list"],
    queryFn: () => api.documents.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: open,
  });

  const docs = data?.documents ?? [];

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const matches = useMemo(() => {
    if (!q.trim()) return docs.slice(0, 6);
    const lq = q.toLowerCase();
    return docs
      .filter(
        (d) =>
          d.title.toLowerCase().includes(lq) ||
          (d.file_path ?? "").toLowerCase().includes(lq)
      )
      .slice(0, 8);
  }, [q, docs]);

  const actions = useMemo(() => {
    const all = [
      { id: "scan",  label: "Scan a folder…",    Icon: FolderPlus,    to: "/settings" },
      { id: "chat",  label: "Open chat",          Icon: MessageSquare, to: "/chat" },
      { id: "dups",  label: "Review duplicates",  Icon: Copy,          to: "/duplicates" },
    ];
    if (!q.trim()) return all;
    return all.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));
  }, [q]);

  function pick(href: string) {
    router.push(href);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "oklch(0.10 0.004 264 / 0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", animation: "fadeIn 180ms var(--ease-out)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 580, background: "var(--bg-card)",
          border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-overlay)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "popIn 180ms var(--ease-out)",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-faint)" }}>
          <Search size={16} color="var(--fg-muted)" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder="Search documents and actions…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: 0,
              color: "var(--fg-primary)", fontFamily: "var(--font-geist-sans)", fontSize: 15,
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflow: "auto", padding: 6 }}>
          {matches.length > 0 && (
            <>
              <GroupLabel label={q ? "Documents" : "Recent documents"} />
              {matches.map((d, i) => (
                <CmdItem
                  key={d.id}
                  leading={<FileTypeIcon mime={d.mime_type} size={26} />}
                  label={d.title}
                  sub={d.file_path ?? undefined}
                  hint="↵ open"
                  active={i === 0 && !q}
                  onClick={() => pick(`/documents?id=${d.id}`)}
                />
              ))}
            </>
          )}
          {actions.length > 0 && (
            <>
              <GroupLabel label="Actions" />
              {actions.map((a) => (
                <CmdItem
                  key={a.id}
                  leading={<a.Icon size={14} color="var(--fg-tertiary)" />}
                  label={a.label}
                  onClick={() => pick(a.to)}
                />
              ))}
            </>
          )}
          {matches.length === 0 && actions.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--fg-tertiary)", fontSize: 13 }}>
              No matches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--fg-muted)", padding: "10px 10px 4px",
    }}>
      {label}
    </div>
  );
}

function CmdItem({
  leading, label, sub, hint, active, onClick,
}: {
  leading?: React.ReactNode; label: string; sub?: string;
  hint?: string; active?: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
        borderRadius: "var(--radius-md)", cursor: "pointer",
        background: (active && !hover) || hover ? "var(--bg-pressed)" : "transparent",
      }}
    >
      {leading && <div style={{ flexShrink: 0 }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-primary)" }}>{label}</div>
        {sub && (
          <div style={{
            fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--fg-muted)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {sub}
          </div>
        )}
      </div>
      {hint && (
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--fg-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
