"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CategoryBadge, ConfidenceBadge, FileTypeIcon, Card, EmptyState } from "@/components/ds";
import { Search, X, FileQuestion } from "lucide-react";
import { formatDate } from "@/lib/utils";

function highlight(text: string | null | undefined, query: string): React.ReactNode {
  if (!text || !query.trim()) return text ?? "";
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        style={{ background: "oklch(0.62 0.19 248 / 0.30)", color: "inherit", borderRadius: 2 }}
      >
        {p}
      </mark>
    ) : (
      p
    )
  );
}

export default function SearchPage() {
  return <Suspense fallback={null}><SearchInner /></Suspense>;
}

function SearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<string | undefined>(
    searchParams.get("category") ?? undefined
  );

  // Debounce query 140ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(inputValue), 140);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (activeCategory) params.set("category", activeCategory);
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [debouncedQ, activeCategory, router]);

  const { data } = useQuery({
    queryKey: ["search", debouncedQ, activeCategory],
    queryFn: () => api.search(debouncedQ, { category: activeCategory }),
    enabled: debouncedQ.length > 0,
    staleTime: 30_000,
  });

  const { data: facets } = useQuery({
    queryKey: ["facets"],
    queryFn: api.facets,
    staleTime: 60_000,
  });

  const cats = useMemo(() => {
    if (!facets?.category) return [];
    return Object.entries(facets.category as Record<string, number>).sort(
      ([, a], [, b]) => b - a
    );
  }, [facets]);

  const clearInput = useCallback(() => {
    setInputValue("");
    setDebouncedQ("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") clearInput();
    },
    [clearInput]
  );

  const results = data?.hits ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      {/* Search bar */}
      <div style={{ padding: "16px 24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            height: 44,
            boxShadow: "var(--shadow-inset-top)",
          }}
        >
          <Search size={16} color="var(--fg-tertiary)" />
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search across all your documents..."
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              outline: 0,
              fontSize: 16,
              color: "var(--fg-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
          {inputValue && (
            <button
              onClick={clearInput}
              style={{
                width: 26,
                height: 26,
                display: "grid",
                placeItems: "center",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--fg-tertiary)",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          )}
          <kbd
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "1px 5px",
              fontSize: 10,
              color: "var(--fg-secondary)",
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              borderBottomWidth: 2,
              borderRadius: "var(--radius-xs)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.4,
            }}
          >
            esc
          </kbd>
        </div>

        {/* Result count */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fg-muted)",
            }}
          >
            {debouncedQ
              ? `${results.length} results in ${data?.processing_time_ms ?? 0} ms`
              : "\u00a0"}
          </span>
        </div>

        {/* Category filter chips */}
        {cats.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              paddingBottom: 12,
            }}
          >
            {cats.map(([name, count]) => (
              <CategoryBadge
                key={name}
                name={name}
                count={count}
                size="sm"
                active={activeCategory === name}
                onClick={() => setActiveCategory(activeCategory === name ? undefined : name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 24px 24px" }}>
        {!debouncedQ ? (
          <EmptyState icon={<Search size={28} strokeWidth={1.3} />} title="Start typing to search." />
        ) : results.length === 0 ? (
          <EmptyState icon={<FileQuestion size={28} strokeWidth={1.3} />} title="No matches." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {results.map((doc) => (
              <Card key={doc.id} hoverable padding={14}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <FileTypeIcon mime={doc.mime_type} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title + badges */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--fg-primary)",
                        }}
                      >
                        {highlight(doc.title, debouncedQ)}
                      </span>
                      {doc.category && <CategoryBadge name={doc.category} size="sm" />}
                      {doc.ai_confidence != null && (
                        <ConfidenceBadge value={doc.ai_confidence} />
                      )}
                    </div>

                    {/* Summary */}
                    {doc.summary && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--fg-secondary)",
                          marginTop: 4,
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        } as React.CSSProperties}
                      >
                        {highlight(doc.summary, debouncedQ)}
                      </div>
                    )}

                    {/* File path + date */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--fg-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {highlight(doc.file_path, debouncedQ)}
                      </span>
                      {doc.indexed_at && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--fg-muted)",
                            flexShrink: 0,
                          }}
                        >
                          {formatDate(doc.indexed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
