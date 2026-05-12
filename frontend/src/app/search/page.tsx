"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import { categoryColor } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["search", query, category],
    queryFn: () => api.search(query, { category }),
    enabled: query.length > 0,
  });

  const { data: facets } = useQuery({
    queryKey: ["facets"],
    queryFn: api.facets,
  });

  const cats = useMemo(() => {
    if (!facets?.category) return [];
    return Object.entries(facets.category).sort(([, a], [, b]) => b - a);
  }, [facets]);

  const handleDelete = async (id: string) => {
    await api.documents.delete(id);
    toast.success("Document deleted");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      {/* Search bar */}
      <div style={{ padding: "0 0 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
          background: "var(--ink-2)", border: "1px solid var(--ink-4)",
          borderRadius: 7, height: 44, boxShadow: "var(--shadow-inset-top)",
        }}>
          <Search size={16} color="var(--ink-7)" />
          <input
            autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing to search across all your documents..."
            style={{
              flex: 1, background: "transparent", border: 0, outline: 0,
              fontSize: 16, color: "var(--ink-10)", fontFamily: "var(--font-sans)",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{
              width: 26, height: 26, display: "grid", placeItems: "center",
              border: "none", borderRadius: 5, background: "transparent",
              color: "var(--ink-8)", cursor: "pointer",
            }}>
              <X size={14} />
            </button>
          )}
          <kbd>esc</kbd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-7)" }}>
            {query ? `${data?.total ?? 0} ${data?.total === 1 ? "result" : "results"} in ${data?.processing_time_ms ?? 0} ms` : "\u2014"}
          </span>
        </div>
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 14, borderBottom: "1px solid var(--ink-3)" }}>
        {cats.map(([name, count]) => {
          const c = categoryColor(name);
          const active = category === name;
          return (
            <button key={name} onClick={() => setCategory(active ? undefined : name)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 9px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                color: c.fg, background: active ? c.bg.replace("0.12", "0.20") : c.bg,
                border: `1px solid ${c.border}`, cursor: "pointer",
                boxShadow: active ? `0 0 0 1px ${c.fg}` : "none",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }} />
              {name}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto", paddingTop: 16 }}>
        {!query ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ink-2)", border: "1px solid var(--ink-4)", color: "var(--ink-8)" }}>
              <Search size={28} strokeWidth={1.3} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-10)" }}>Start typing to search.</div>
            <div style={{ fontSize: 13, color: "var(--ink-8)", maxWidth: 380, lineHeight: 1.5 }}>
              Search runs across titles, file paths, summaries, tags, and OCR'd content from scans.
            </div>
          </div>
        ) : data?.hits.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-10)" }}>No matches.</div>
            <div style={{ fontSize: 13, color: "var(--ink-8)" }}>Nothing in your index matches "{query}".</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data?.hits.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
