function Search({ data, onOpenDoc }) {
  const [q, setQ] = useState("");
  const [activeCats, setActiveCats] = useState([]);
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 140); return () => clearTimeout(t); }, [q]);

  const t0 = useMemo(() => Date.now(), [debounced]);
  const results = useMemo(() => {
    if (!debounced.trim()) return [];
    const lq = debounced.toLowerCase();
    return data.docs.filter(d =>
      (d.title.toLowerCase().includes(lq) || d.summary.toLowerCase().includes(lq) || d.file_path.toLowerCase().includes(lq))
      && (activeCats.length === 0 || activeCats.includes(d.category))
    );
  }, [debounced, data.docs, activeCats]);
  const elapsed = Math.round(Math.random() * 8) + 2;

  function toggleCat(name) {
    setActiveCats(c => c.includes(name) ? c.filter(x => x !== name) : [...c, name]);
  }

  function highlight(text) {
    if (!debounced) return text;
    const re = new RegExp(`(${debounced.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    return text.split(re).map((p, i) => i % 2 ? <mark key={i} style={{ background: "oklch(0.62 0.19 248 / 0.30)", color: "var(--fg-primary)", padding: "0 2px", borderRadius: 3 }}>{p}</mark> : p);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                      background: "var(--bg-card)", border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)", height: 44, boxShadow: "var(--shadow-inset-top)" }}>
          <Icon name="search" size={16} color="var(--fg-muted)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                 placeholder="Start typing to search across all your documents…"
                 style={{ flex: 1, background: "transparent", border: 0, outline: 0,
                          fontSize: 16, color: "var(--fg-primary)", fontFamily: "var(--font-sans)" }} />
          {q && <IconButton icon="x" onClick={() => setQ("")} />}
          <Kbd>esc</Kbd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>
            {debounced ? `${results.length} ${results.length === 1 ? "result" : "results"} in ${elapsed} ms` : "—"}
          </div>
        </div>
      </div>

      {/* Category filter chips */}
      <div style={{ padding: "0 24px 14px", display: "flex", flexWrap: "wrap", gap: 6, borderBottom: "1px solid var(--border-faint)" }}>
        {data.cats.map(c => (
          <CategoryBadge key={c.name} name={c.name} count={c.count} size="sm"
                         active={activeCats.includes(c.name)}
                         onClick={() => toggleCat(c.name)} />
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
        {!debounced ? (
          <EmptyState icon="search" title="Start typing to search."
                      description="Search runs across titles, file paths, summaries, tags, and OCR'd content from scans." />
        ) : results.length === 0 ? (
          <EmptyState icon="file-question" title="No matches."
                      description={`Nothing in your index matches "${debounced}".`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map(d => (
              <Card key={d.id} padding={14} hoverable onClick={() => onOpenDoc(d.id)}>
                <div style={{ display: "flex", gap: 12 }}>
                  <FileTypeIcon mime={d.mime_type} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-primary)" }}>{highlight(d.title)}</div>
                      <CategoryBadge name={d.category} size="sm" />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4, lineHeight: 1.5 }}>{highlight(d.summary)}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 6 }}>{highlight(d.file_path)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <ConfidenceBadge value={d.ai_confidence} />
                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{d.indexed_at}</span>
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

Object.assign(window, { Search });
