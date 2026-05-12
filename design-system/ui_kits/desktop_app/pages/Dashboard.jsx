function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "20px 24px 16px",
                  borderBottom: "1px solid var(--border-faint)", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-primary)" }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

function Dashboard({ data, onNavigate }) {
  const formatBytes = (b) => {
    const gb = b / 1024 / 1024 / 1024; return gb.toFixed(1) + " GiB";
  };
  const cls = data.stats.classification;
  const aiPct = Math.round(cls.ai_classified / data.stats.total_documents * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Dashboard" subtitle="Overview of your indexed documents."
                  actions={<>
                    <Button variant="secondary" leadingIcon="message-square" onClick={() => onNavigate("chat")}>Open chat</Button>
                    <Button variant="primary" leadingIcon="folder-plus" onClick={() => onNavigate("settings")}>Scan a folder</Button>
                  </>} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatCard icon="files"      label="Total documents" value={data.stats.total_documents.toLocaleString()} delta="+24" deltaLabel="since last scan" />
          <StatCard icon="hard-drive" label="Storage indexed" value={formatBytes(data.stats.total_size_bytes)} sub={`across ${data.stats.watched_folders} watched folders`} />
          <StatCard icon="tags"       label="Categories" value={Object.keys(data.stats.categories).length} sub="auto-derived by AI" />
          <StatCard icon="alert-circle" label="Pending review" value={data.stats.pending_review} sub="< 50% confidence" intent="warning" />
        </div>

        {/* Insights + AI cost */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <Card padding={0}>
            <CardHeader title="Proactive insights" hint="Updated 2 minutes ago" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 18px 18px" }}>
              {data.insights.map((alert, i) => <InsightRow key={i} alert={alert} />)}
            </div>
          </Card>
          <Card padding={0}>
            <CardHeader title="AI classification cost"
                        hint={<span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-tertiary)" }}>${cls.estimated_api_cost.toFixed(2)}</span>} />
            <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <BarSplit a={cls.rule_based_free} b={cls.ai_classified} aLabel="Free" bLabel="Claude" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 12, color: "var(--fg-tertiary)" }}>
                <KV label="Free matches" value={cls.rule_based_free.toLocaleString()} />
                <KV label="AI classified" value={cls.ai_classified.toLocaleString()} />
                <KV label="Cached" value={cls.cached_patterns} />
              </div>
            </div>
          </Card>
        </div>

        {/* Categories chart + recent docs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
          <Card padding={0}>
            <CardHeader title="Category breakdown" />
            <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {data.cats.slice(0, 8).map(c => <CatBar key={c.name} cat={c} max={Math.max(...data.cats.map(x => x.count))} onClick={() => onNavigate("documents", { category: c.name })} />)}
            </div>
          </Card>
          <Card padding={0}>
            <CardHeader title="Recently indexed" hint={<a style={{ fontSize: 12, color: "var(--fg-tertiary)", cursor: "pointer" }} onClick={() => onNavigate("documents")}>View all →</a>} />
            <div style={{ padding: 6 }}>
              {data.docs.slice(0, 6).map(d => <RecentDocRow key={d.id} doc={d} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, delta, deltaLabel, intent }) {
  return (
    <Card padding={16}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--fg-tertiary)",
                    letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <Icon name={icon} size={13} color={intent === "warning" ? "var(--warning)" : "var(--fg-muted)"} />
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--fg-tertiary)", marginTop: 6 }}>
        {delta && <span style={{ fontFamily: "var(--font-mono)", color: "var(--success)" }}>{delta}</span>}
        {(deltaLabel || sub) && <span>{deltaLabel || sub}</span>}
      </div>
    </Card>
  );
}

function CardHeader({ title, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px 10px", borderBottom: "1px solid var(--border-faint)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-primary)" }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{hint}</div>}
    </div>
  );
}

function InsightRow({ alert }) {
  const tone = { warning: { bg: "var(--warning-bg)", fg: "var(--warning)", icon: "alert-triangle", bd: "oklch(0.80 0.15 78 / 0.4)" },
                 danger:  { bg: "var(--danger-bg)",  fg: "var(--danger)",  icon: "alert-circle",   bd: "oklch(0.68 0.20 25 / 0.4)" },
                 info:    { bg: "var(--info-bg)",    fg: "var(--info)",    icon: "info",           bd: "oklch(0.72 0.13 220 / 0.4)" } }[alert.severity];
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)",
                  background: tone.bg, border: `1px solid ${tone.bd}` }}>
      <div style={{ width: 26, height: 26, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center",
                    background: tone.bg, color: tone.fg, flexShrink: 0 }}>
        <Icon name={tone.icon} size={14} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-primary)" }}>{alert.message}</div>
        <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>{alert.details}</div>
      </div>
    </div>
  );
}

function BarSplit({ a, b, aLabel, bLabel }) {
  const total = a + b; const aPct = (a / total * 100);
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--ink-3)" }}>
        <div style={{ width: aPct + "%", background: "var(--ink-7)" }} />
        <div style={{ width: (100 - aPct) + "%", background: "var(--accent-500)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--fg-tertiary)" }}>
        <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "var(--ink-7)", marginRight: 6 }} />{aLabel}</span>
        <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "var(--accent-500)", marginRight: 6 }} />{bLabel}</span>
      </div>
    </div>
  );
}
function KV({ label, value }) {
  return <div><div style={{ fontSize: 10, color: "var(--fg-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-primary)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div></div>;
}

function CatBar({ cat, max, onClick }) {
  const c = categoryColor(cat.name);
  const pct = (cat.count / max) * 100;
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", opacity: hover ? 1 : 0.92 }}>
      <div style={{ width: 90, fontSize: 12, color: "var(--fg-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: c.fg, borderRadius: 999, transition: "width 320ms" }} />
      </div>
      <div style={{ width: 40, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-tertiary)", fontVariantNumeric: "tabular-nums" }}>{cat.count}</div>
    </div>
  );
}

function RecentDocRow({ doc }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--radius-md)",
                  background: hover ? "var(--bg-hover)" : "transparent", cursor: "pointer" }}>
      <FileTypeIcon mime={doc.mime_type} size={28} mode="icon" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_path}</div>
      </div>
      <CategoryBadge name={doc.category} size="sm" />
      <div style={{ fontSize: 11, color: "var(--fg-muted)", width: 90, textAlign: "right" }}>{doc.indexed_at}</div>
    </div>
  );
}

Object.assign(window, { Dashboard, PageHeader, StatCard, CardHeader });
