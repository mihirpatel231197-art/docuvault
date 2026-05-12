function Upload({ data }) {
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const toast = useToast();
  const sample = [
    { name: "lease-renewal-2024.pdf",  size: 2_140_000, mime: "application/pdf", category: "Legal", confidence: 0.94 },
    { name: "Q3-board-memo.docx",      size: 340_000, mime: "application/msword", category: "Project", confidence: 0.71 },
    { name: "wifi-card.png",           size: 920_000, mime: "image/png", category: "Reference", confidence: 0.55 },
  ];
  function fakeDrop() {
    setItems(sample.map((s, i) => ({ ...s, id: "f" + i, stage: "uploading", progress: 0 })));
    sample.forEach((_, i) => {
      setTimeout(() => updateItem(i, { stage: "extracting", progress: 0.4 }), 600 + i * 300);
      setTimeout(() => updateItem(i, { stage: "classifying", progress: 0.75 }), 1400 + i * 300);
      setTimeout(() => {
        updateItem(i, { stage: "done", progress: 1 });
        toast({ kind: "success", message: `Indexed ${sample[i].name}` });
      }, 2200 + i * 300);
    });
  }
  function updateItem(i, patch) {
    setItems(arr => arr.map((it, j) => j === i ? { ...it, ...patch } : it));
  }

  const steps = [
    { icon: "upload-cloud", label: "Upload",     desc: "Drag files into the zone above." },
    { icon: "file-search-2", label: "Extract",   desc: "Text extracted; OCR runs on scans." },
    { icon: "sparkles",     label: "Classify",   desc: "Claude assigns category, tags, dates." },
    { icon: "search",       label: "Searchable", desc: "Indexed in SQLite, ready to query." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Upload" subtitle="Drop files to index them without adding a watched folder." />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Drop zone */}
        <div onDragOver={e => { e.preventDefault(); setDragOver(true); }}
             onDragLeave={() => setDragOver(false)}
             onDrop={e => { e.preventDefault(); setDragOver(false); fakeDrop(); }}
             onClick={fakeDrop}
             style={{ minHeight: 200, borderRadius: "var(--radius-lg)",
                      border: `1.5px dashed ${dragOver ? "var(--accent-500)" : "var(--ink-5)"}`,
                      background: dragOver
                          ? "radial-gradient(circle at center, oklch(0.62 0.19 248 / 0.08), transparent 70%), var(--bg-card)"
                          : "var(--bg-card)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 10, padding: 24, cursor: "pointer", transition: "all var(--dur-base) var(--ease-out)" }}>
          <div style={{ width: 52, height: 52, borderRadius: "var(--radius-lg)", background: "var(--ink-3)",
                          display: "grid", placeItems: "center", color: dragOver ? "var(--accent-500)" : "var(--fg-tertiary)" }}>
            <Icon name="upload-cloud" size={24} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Drop files here, or click to browse</div>
          <div style={{ fontSize: 12, color: "var(--fg-tertiary)" }}>PDF, Word, Excel, images, audio, code — anything.</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 4 }}>
            Files are copied to <span style={{ color: "var(--fg-tertiary)" }}>~/Library/DocuVault/uploads/</span>
          </div>
        </div>

        {/* Pipeline */}
        <Card padding={0}>
          <CardHeader title="How it works" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: 16, gap: 12 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ position: "relative", padding: "14px 14px 12px",
                                      background: "var(--ink-1)", border: "1px solid var(--border-faint)",
                                      borderRadius: "var(--radius-md)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "var(--radius-md)",
                                background: "var(--ink-3)", display: "grid", placeItems: "center", color: "var(--fg-secondary)" }}>
                  <Icon name={s.icon} size={14} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 4, lineHeight: 1.5 }}>{s.desc}</div>
                <div style={{ position: "absolute", top: 18, right: -8, color: "var(--fg-muted)", display: i === 3 ? "none" : "block" }}>
                  <Icon name="chevron-right" size={12} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live results */}
        {items.length > 0 && (
          <Card padding={0}>
            <CardHeader title="Indexing in progress" hint={`${items.filter(i => i.stage === "done").length}/${items.length} complete`} />
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(it => <UploadItem key={it.id} item={it} />)}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function UploadItem({ item }) {
  const stageLabel = { uploading: "Uploading…", extracting: "Extracting text…", classifying: "Asking Claude…", done: "Indexed" }[item.stage];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)",
                  background: item.stage === "done" ? "var(--ink-1)" : "var(--bg-card)", border: "1px solid var(--border-faint)" }}>
      <FileTypeIcon mime={item.mime} size={28} mode="icon" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
            <div style={{ width: `${item.progress * 100}%`, height: "100%",
                            background: item.stage === "done" ? "var(--success)" : "var(--accent-500)",
                            transition: "width 320ms" }} />
          </div>
          <div style={{ fontSize: 11, color: item.stage === "done" ? "var(--success)" : "var(--fg-tertiary)", minWidth: 110, textAlign: "right" }}>{stageLabel}</div>
        </div>
      </div>
      {item.stage === "done" ? (
        <>
          <CategoryBadge name={item.category} size="sm" />
          <ConfidenceBadge value={item.confidence} />
        </>
      ) : (
        <Icon name="loader-2" size={14} color="var(--fg-tertiary)" style={{ animation: "spin 0.8s linear infinite" }} />
      )}
    </div>
  );
}

Object.assign(window, { Upload });
