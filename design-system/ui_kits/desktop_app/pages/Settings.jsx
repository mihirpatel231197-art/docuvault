function Settings({ data }) {
  const [path, setPath] = useState("~/Documents/Archive");
  const [previewedCount, setPreviewedCount] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [apiKey, setApiKey] = useState("sk-ant-•••••••••••••••••••••••••••YQrk");
  const toast = useToast();

  function preview() { setPreviewedCount(173); }
  function scan() {
    setScanning(true); setScanResult(null);
    setTimeout(() => {
      setScanning(false);
      setScanResult({ total: 173, indexed: 168, skipped: 4, failed: 1 });
      toast({ kind: "success", message: "Scan complete.", sub: "168 indexed" });
    }, 1400);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Settings" subtitle="Manage scan locations, AI access, and storage." />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 920 }}>
        {/* Scan a Folder */}
        <Section title="Scan a folder" hint="Files stay where they are. Only metadata is stored.">
          <div style={{ display: "flex", gap: 8 }}>
            <Input mono value={path} onChange={e => setPath(e.target.value)} leadingIcon="folder" style={{ flex: 1 }} />
            <Button variant="ghost" leadingIcon="eye" onClick={preview}>Preview</Button>
            <Button variant="primary" leadingIcon="play" onClick={scan} disabled={scanning}>{scanning ? "Scanning…" : "Scan"}</Button>
          </div>
          {previewedCount !== null && !scanResult && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                           background: "var(--info-bg)", border: "1px solid oklch(0.72 0.13 220 / 0.4)",
                           borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--info)" }}>
              <Icon name="info" size={13} />
              <span><strong style={{ color: "var(--fg-primary)" }}>{previewedCount}</strong> files found in this folder. None indexed yet.</span>
            </div>
          )}
          {scanning && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginBottom: 6 }}>Indexing 173 files…</div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
                <div className="dv-progress" style={{ height: "100%", background: "var(--accent-500)", borderRadius: 999 }} />
              </div>
            </div>
          )}
          {scanResult && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <ResultStat label="Total" value={scanResult.total} />
              <ResultStat label="Indexed" value={scanResult.indexed} color="var(--success)" />
              <ResultStat label="Skipped" value={scanResult.skipped} color="var(--fg-tertiary)" />
              <ResultStat label="Failed" value={scanResult.failed} color="var(--danger)" />
            </div>
          )}
        </Section>

        <Section title="Watched folders" hint="Re-scanned automatically when files change.">
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {data.watched.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                                         background: "var(--bg-card)", borderRadius: "var(--radius-md)",
                                         border: "1px solid var(--border-default)" }}>
                <Icon name="folder" size={14} color="var(--fg-tertiary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-primary)" }}>{w.path}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>{w.file_count} files · last scan {w.last_scan}</div>
                </div>
                <Button size="sm" variant="ghost" leadingIcon="refresh-cw">Rescan</Button>
                <IconButton icon="x" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Anthropic API key" hint="Used for AI classification and chat. Stored in OS keychain.">
          <Input mono value={apiKey} onChange={e => setApiKey(e.target.value)} leadingIcon="key" />
        </Section>

        <Section title="About">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, fontSize: 12 }}>
            <KV label="Version" value="0.4.2 (build 318)" />
            <KV label="Database" value="~/Library/DocuVault/index.db" />
            <KV label="Storage in index" value="148 MiB metadata" />
            <KV label="Files tracked" value={data.stats.total_documents.toLocaleString()} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-primary)" }}>{title}</h3>
        {hint && <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>{hint}</div>}
      </div>
      <Card padding={16}>{children}</Card>
    </section>
  );
}
function ResultStat({ label, value, color }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--ink-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-faint)" }}>
      <div style={{ fontSize: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, marginTop: 4, color: color || "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

Object.assign(window, { Settings });
