function Documents({ data, params, onOpenDoc, onNavigate }) {
  const [view, setView] = useState("list");
  const [sort, setSort] = useState("date");
  const cat = params?.category;
  const filtered = useMemo(() => cat ? data.docs.filter(d => d.category === cat) : data.docs, [data.docs, cat]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "name") arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "size") arr.sort((a, b) => b.file_size - a.file_size);
    else arr.sort((a, b) => b.indexed_at.length - a.indexed_at.length); // fake "date"
    return arr;
  }, [filtered, sort]);
  const c = cat ? categoryColor(cat) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title={cat ? cat : "All documents"}
                  subtitle={`${sorted.length.toLocaleString()} documents` + (cat ? "" : " across all categories")}
                  actions={<>
                    <Button variant="ghost" leadingIcon="filter">Filter</Button>
                    <Button variant="primary" leadingIcon="folder-plus" onClick={() => onNavigate("settings")}>Scan a folder</Button>
                  </>} />

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 24px",
                    borderBottom: "1px solid var(--border-faint)", background: "var(--bg-canvas)" }}>
        <Select label="Category" value={cat || "All"} onClear={cat ? () => onNavigate("documents") : undefined} />
        <Select label="Sort by" value={sort === "date" ? "Recently indexed" : sort === "name" ? "Name (A→Z)" : "Size (largest)"} />
        <div style={{ flex: 1 }} />
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: view === "list" ? "8px 16px 24px" : "20px 24px" }}>
        {sorted.length === 0 ? (
          <EmptyState icon="files" title="Nothing indexed yet."
                      description="DocuVault doesn't move or upload your files. Point it at a folder and it'll start cataloguing."
                      action={<Button variant="primary" leadingIcon="folder-plus" onClick={() => onNavigate("settings")}>Scan a folder</Button>} />
        ) : view === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sorted.map(d => <DocRow key={d.id} doc={d} onClick={() => onOpenDoc(d.id)} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {sorted.map(d => <DocCard key={d.id} doc={d} onClick={() => onOpenDoc(d.id)} />)}
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 12, borderTop: "1px solid var(--border-faint)" }}>
          <div style={{ fontSize: 12, color: "var(--fg-tertiary)" }}>Showing 1–{sorted.length} of {sorted.length}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="sm" variant="ghost" leadingIcon="chevron-left" disabled>Prev</Button>
            <Button size="sm" variant="ghost" trailingIcon="chevron-right">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onClear }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px",
                  background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                  fontSize: 12, cursor: "pointer", color: "var(--fg-secondary)" }}>
      <span style={{ color: "var(--fg-muted)" }}>{label}:</span>
      <span style={{ color: "var(--fg-primary)" }}>{value}</span>
      {onClear ? <span onClick={onClear} style={{ color: "var(--fg-muted)", cursor: "pointer" }}><Icon name="x" size={11} /></span>
                : <Icon name="chevron-down" size={11} color="var(--fg-muted)" />}
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  const opts = [{ id: "list", icon: "list" }, { id: "grid", icon: "layout-grid" }];
  return (
    <div style={{ display: "inline-flex", padding: 2, background: "var(--ink-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--ink-5)" }}>
      {opts.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)}
                style={{ width: 28, height: 24, display: "grid", placeItems: "center",
                         background: view === o.id ? "var(--bg-card)" : "transparent",
                         border: "none", color: view === o.id ? "var(--fg-primary)" : "var(--fg-muted)",
                         borderRadius: "calc(var(--radius-md) - 2px)", cursor: "pointer",
                         boxShadow: view === o.id ? "var(--shadow-xs)" : "none" }}>
          <Icon name={o.icon} size={13} />
        </button>
      ))}
    </div>
  );
}

function DocRow({ doc, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick}
         style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: "var(--radius-md)",
                  background: hover ? "var(--bg-card)" : "transparent", cursor: "pointer",
                  border: hover ? "1px solid var(--border-default)" : "1px solid transparent",
                  transition: "background var(--dur-base) var(--ease-out)" }}>
      <FileTypeIcon mime={doc.mime_type} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
          <CategoryBadge name={doc.category} size="sm" />
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{doc.subcategory}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.summary}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_path}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 11, color: "var(--fg-tertiary)", flexShrink: 0, width: 150, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>{(doc.file_size / 1024 / 1024).toFixed(1)} MiB</span>
        <span>{doc.indexed_at}</span>
      </div>
      <ConfidenceBadge value={doc.ai_confidence} />
      <div style={{ display: "flex", gap: 2, opacity: hover ? 1 : 0, transition: "opacity 120ms" }}>
        <IconButton icon="external-link" title="Open file" />
        <IconButton icon="folder" title="Reveal in Finder" />
        <IconButton icon="refresh-cw" title="Reclassify" />
        <IconButton icon="trash-2" title="Delete" />
      </div>
    </div>
  );
}

function DocCard({ doc, onClick }) {
  return (
    <Card padding={0} hoverable onClick={onClick}>
      <div style={{ aspectRatio: "4 / 3", background: "var(--ink-1)", borderTopLeftRadius: "var(--radius-lg)", borderTopRightRadius: "var(--radius-lg)",
                    display: "grid", placeItems: "center", borderBottom: "1px solid var(--border-faint)" }}>
        <FileTypeIcon mime={doc.mime_type} size={48} mode="icon" />
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <CategoryBadge name={doc.category} size="sm" />
          <ConfidenceBadge value={doc.ai_confidence} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8, lineHeight: 1.35 }}>{doc.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 6,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_path}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--fg-tertiary)" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>{(doc.file_size / 1024 / 1024).toFixed(1)} MiB</span>
          <span>{doc.indexed_at}</span>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { Documents, DocRow, DocCard });
