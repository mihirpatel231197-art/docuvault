"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  PageHeader,
  Card,
  Btn,
  FileTypeIcon,
  CategoryBadge,
  EmptyState,
} from "@/components/ds";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

interface DupeDoc {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  indexed_at: string;
  document_date: string | null;
  source: string;
  category: string;
  mime_type?: string | null;
}

interface DupeGroup {
  file_hash: string;
  count: number;
  documents: DupeDoc[];
}

export default function DuplicatesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duplicates"],
    queryFn: () =>
      fetch(`${API_BASE}/api/duplicates`).then((r) => r.json()),
  });

  const merge = useMutation({
    mutationFn: ({ keepId, deleteIds }: { keepId: string; deleteIds: string[] }) =>
      fetch(`${API_BASE}/api/duplicates/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: keepId, delete_ids: deleteIds }),
      }).then((r) => r.json()),
    onSuccess: (_, { keepId }) => {
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Duplicates merged");
    },
    onError: () => toast.error("Merge failed"),
  });

  const dupes: DupeGroup[] = data?.hash_duplicates ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      <PageHeader
        title="Duplicates"
        subtitle="Files with identical content (same SHA-256). Choose the one to keep."
        actions={
          <Btn
            variant="ghost"
            icon={<RefreshCw size={14} />}
            onClick={() => refetch()}
          >
            Re-scan
          </Btn>
        }
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 120,
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                }}
              />
            ))}
          </div>
        )}

        {!isLoading && dupes.length === 0 && (
          <EmptyState
            icon={<CheckCircle size={28} strokeWidth={1.3} style={{ color: "var(--success)" } as React.CSSProperties} />}
            title="No duplicates found."
            description="Every file in your index is unique."
          />
        )}

        {dupes.map((group) => (
          <Card key={group.file_hash} padding={0}>
            {/* Group header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Copy size={14} color="var(--fg-tertiary)" />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-primary)" }}>
                    {group.count} copies
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      marginLeft: 8,
                    }}
                  >
                    sha256: {group.file_hash.slice(0, 12)}…
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {formatBytes(group.documents[0]?.file_size ?? 0)} each &middot;{" "}
                {formatBytes((group.count - 1) * (group.documents[0]?.file_size ?? 0))} recoverable
              </span>
            </div>

            {/* Document rows */}
            <div>
              {group.documents.map((doc, i) => (
                <DupRow
                  key={doc.id}
                  doc={doc}
                  isFirst={i === 0}
                  onKeep={() => {
                    const deleteIds = group.documents
                      .filter((d) => d.id !== doc.id)
                      .map((d) => d.id);
                    merge.mutate({ keepId: doc.id, deleteIds });
                  }}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DupRow({
  doc,
  isFirst,
  onKeep,
}: {
  doc: DupeDoc;
  isFirst: boolean;
  onKeep: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        background: hover ? "var(--bg-hover)" : "transparent",
        borderTop: isFirst ? "none" : "1px solid var(--border-faint)",
        transition: "background 160ms",
      }}
    >
      <FileTypeIcon mime={doc.mime_type ?? null} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-primary)" }}>{doc.title}</div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg-muted)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {doc.file_path}
        </div>
      </div>

      {doc.category && <CategoryBadge name={doc.category} size="sm" />}

      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
        from {doc.source}
      </span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
        {doc.indexed_at ? formatDate(doc.indexed_at) : ""}
      </span>

      <Btn
        variant="secondary"
        size="sm"
        icon={<Check size={12} />}
        onClick={onKeep}
      >
        Keep
      </Btn>
    </div>
  );
}
