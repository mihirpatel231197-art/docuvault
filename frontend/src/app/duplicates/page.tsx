"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatBytes, formatDate, inferFileType, FILE_TYPE_META } from "@/lib/utils";
import { Copy, Check, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

interface DupeDoc {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  indexed_at: string;
  source: string;
  category: string;
}

interface DupeGroup {
  file_hash: string;
  count: number;
  documents: DupeDoc[];
}

export default function DuplicatesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["duplicates"],
    queryFn: () => fetch(`${API_BASE}/api/duplicates`).then(r => r.json()),
  });

  const merge = useMutation({
    mutationFn: ({ keepId, deleteIds }: { keepId: string; deleteIds: string[] }) =>
      fetch(`${API_BASE}/api/duplicates/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: keepId, delete_ids: deleteIds }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      toast.success("Duplicates merged");
    },
  });

  const dupes: DupeGroup[] = data?.hash_duplicates || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--ink-3)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>Duplicates</h1>
          <p style={{ fontSize: 12, color: "var(--ink-8)", marginTop: 4 }}>
            Files with identical content (same SHA-256). Choose the one to keep.
          </p>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 10, background: "var(--ink-2)", border: "1px solid var(--ink-4)" }} />
          ))}
        </div>
      )}

      {dupes.length === 0 && !isLoading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ink-2)", border: "1px solid var(--ink-4)", color: "var(--dv-success)" }}>
            <CheckCircle size={28} strokeWidth={1.3} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-10)" }}>No duplicates found.</div>
          <div style={{ fontSize: 13, color: "var(--ink-8)" }}>Every file in your index is unique.</div>
        </div>
      )}

      {dupes.map((group) => (
        <div key={group.file_hash} style={{
          background: "var(--ink-2)", border: "1px solid var(--ink-4)",
          borderRadius: 10, boxShadow: "var(--shadow-inset-top)", overflow: "hidden",
        }}>
          {/* Group header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px", borderBottom: "1px solid var(--ink-3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Copy size={14} color="var(--ink-8)" />
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-10)" }}>{group.count} copies</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-7)", marginLeft: 8 }}>
                  sha256: {group.file_hash.slice(0, 12)}...
                </span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-8)", fontFamily: "var(--font-mono)" }}>
              {formatBytes(group.documents[0]?.file_size || 0)} each &middot;{" "}
              {formatBytes((group.count - 1) * (group.documents[0]?.file_size || 0))} recoverable
            </span>
          </div>

          {/* Documents */}
          {group.documents.map((doc, i) => (
            <DupRow
              key={doc.id}
              doc={doc}
              isFirst={i === 0}
              onKeep={() => {
                const deleteIds = group.documents.filter(d => d.id !== doc.id).map(d => d.id);
                merge.mutate({ keepId: doc.id, deleteIds });
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DupRow({ doc, isFirst, onKeep }: { doc: DupeDoc; isFirst: boolean; onKeep: () => void }) {
  const [hover, setHover] = useState(false);
  const ft = inferFileType(doc.title?.endsWith(".pdf") ? "application/pdf" : null);
  const meta = FILE_TYPE_META[ft];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
        background: hover ? "var(--ink-3)" : "transparent",
        borderTop: isFirst ? "none" : "1px solid var(--ink-3)",
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center",
        background: meta.bg, color: meta.color, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
      }}>
        {meta.label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--ink-10)" }}>{doc.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-7)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.file_path}
        </div>
      </div>
      <span style={{ fontSize: 11, color: "var(--ink-7)", fontFamily: "var(--font-mono)" }}>
        from {doc.source}
      </span>
      <span style={{ fontSize: 11, color: "var(--ink-7)" }}>
        {doc.indexed_at ? formatDate(doc.indexed_at) : ""}
      </span>
      <button
        onClick={onKeep}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 12, fontWeight: 500,
          borderRadius: 7, background: "var(--ink-3)", border: "1px solid var(--ink-5)",
          color: "var(--ink-10)", cursor: "pointer", boxShadow: "var(--shadow-inset-top)",
        }}
      >
        <Check size={12} /> Keep
      </button>
    </div>
  );
}
