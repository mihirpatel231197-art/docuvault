function Duplicates({ data, onOpenDoc }) {
  const toast = useToast();
  function keep(g, doc) {
    toast({ kind: "success", message: `Kept ${doc.title}.`, sub: `${g.count - 1} removed` });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Duplicates"
                  subtitle="Files with identical content (same SHA-256). Choose the one to keep — DocuVault deletes the rest."
                  actions={<Button variant="ghost" leadingIcon="refresh-cw">Re-scan</Button>} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {data.duplicates.length === 0 ? (
          <EmptyState icon="check-circle" title="No duplicates found." description="Every file in your index is unique." />
        ) : data.duplicates.map(g => (
          <Card key={g.file_hash} padding={0}>
            <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="copy" size={14} color="var(--fg-tertiary)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.count} copies</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>sha256: {g.file_hash}…</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-tertiary)", fontFamily: "var(--font-mono)" }}>
                {(g.documents[0].file_size / 1024 / 1024).toFixed(1)} MiB · {((g.count - 1) * g.documents[0].file_size / 1024 / 1024).toFixed(1)} MiB recoverable
              </div>
            </div>
            <div>
              {g.documents.map((doc, i) => <DupRow key={doc.id} doc={doc} onKeep={() => keep(g, doc)} onClick={() => onOpenDoc(doc.id)} isFirst={i === 0} />)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DupRow({ doc, onKeep, onClick, isFirst }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
                  background: hover ? "var(--bg-hover)" : "transparent",
                  borderTop: isFirst ? "none" : "1px solid var(--border-faint)" }}>
      <FileTypeIcon mime={doc.title.endsWith(".pdf") ? "application/pdf" : ""} size={28} mode="icon" />
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onClick}>
        <div style={{ fontSize: 13, color: "var(--fg-primary)" }}>{doc.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 2 }}>{doc.file_path}</div>
      </div>
      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>from {doc.source}</span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{doc.document_date}</span>
      <Button size="sm" variant="secondary" leadingIcon="check" onClick={onKeep}>Keep</Button>
    </div>
  );
}

Object.assign(window, { Duplicates });
