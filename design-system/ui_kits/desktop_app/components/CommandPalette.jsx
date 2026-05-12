// CommandPalette — ⌘K overlay
function CommandPalette({ open, onClose, docs, onPick }) {
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  const matches = useMemo(() => {
    if (!q.trim()) return docs.slice(0, 6);
    const lq = q.toLowerCase();
    return docs.filter(d => d.title.toLowerCase().includes(lq) || d.file_path.toLowerCase().includes(lq)).slice(0, 8);
  }, [q, docs]);
  const actions = useMemo(() => {
    const all = [
      { id: "scan", label: "Scan a folder…", icon: "folder-plus", kbd: "⌘N", onRun: () => onPick({ type: "nav", to: "settings" }) },
      { id: "chat", label: "Open chat",      icon: "message-square", onRun: () => onPick({ type: "nav", to: "chat" }) },
      { id: "dups", label: "Review duplicates", icon: "copy",     onRun: () => onPick({ type: "nav", to: "duplicates" }) },
    ];
    if (!q.trim()) return all;
    return all.filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
  }, [q]);

  if (!open) return null;
  return (
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, zIndex: 100,
                  background: "oklch(0.10 0.004 264 / 0.55)",
                  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                  paddingTop: "12vh", animation: "fadeIn 180ms var(--ease-out)" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: 580, background: "var(--bg-card)",
                    border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xl)",
                    boxShadow: "var(--shadow-overlay)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                    animation: "popIn 180ms var(--ease-out)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-faint)" }}>
          <Icon name="search" size={16} color="var(--fg-muted)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents and actions…"
                 style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--fg-primary)",
                          fontFamily: "var(--font-sans)", fontSize: 15 }} />
          <Kbd>esc</Kbd>
        </div>
        <div style={{ maxHeight: 420, overflow: "auto", padding: 6 }}>
          {matches.length > 0 && (
            <>
              <Group label={q ? "Documents" : "Recent documents"} />
              {matches.map((d, i) => (
                <CommandItem key={d.id} active={i === 0}
                             leading={<FileTypeIcon mime={d.mime_type} size={26} mode="icon" />}
                             label={d.title}
                             sub={d.file_path}
                             hint="↵ open"
                             onClick={() => onPick({ type: "doc", id: d.id })} />
              ))}
            </>
          )}
          {actions.length > 0 && (
            <>
              <Group label="Actions" />
              {actions.map(a => (
                <CommandItem key={a.id} icon={a.icon} label={a.label} hint={a.kbd} onClick={a.onRun} />
              ))}
            </>
          )}
          {matches.length === 0 && actions.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--fg-tertiary)", fontSize: 13 }}>No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ label }) {
  return <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                       color: "var(--fg-muted)", padding: "10px 10px 4px" }}>{label}</div>;
}
function CommandItem({ leading, icon, label, sub, hint, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: (active && !hover) || hover ? "var(--bg-pressed)" : "transparent" }}>
      {leading || (icon && <Icon name={icon} size={14} color="var(--fg-tertiary)" />)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-primary)" }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      {hint && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)" }}>{hint}</div>}
    </div>
  );
}

Object.assign(window, { CommandPalette });
