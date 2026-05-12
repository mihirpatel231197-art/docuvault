function Chat({ data, onOpenDoc }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const toast = useToast();

  const starters = [
    { icon: "calendar-clock", q: "What's expiring in the next 60 days?" },
    { icon: "search", q: "Find my 2023 tax documents" },
    { icon: "file-text", q: "Summarize my lease agreement" },
    { icon: "users", q: "Who is mentioned across my contracts?" },
  ];

  function send(q) {
    const text = (q ?? input).trim();
    if (!text) return;
    setMsgs(m => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, {
        role: "assistant",
        text: `Based on your indexed documents, here's what I found related to "${text.replace(/[?.!]+$/, "")}". Your lease at ~/Documents/Apartments/lease-2024-renewal.pdf expires on March 31, 2025; the auto-renew clause requires 60 days written notice. Two other contracts also expire within the window.`,
        sources: [data.docs[0], data.docs[6]],
      }]);
    }, 900);
  }

  function clearHistory() {
    setMsgs([]);
    toast({ kind: "success", message: "History cleared." });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Chat with your documents" subtitle="Ask anything. Answers cite the files they came from."
                  actions={<Button variant="ghost" leadingIcon="trash-2" onClick={clearHistory} disabled={msgs.length === 0}>Clear history</Button>} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {msgs.length === 0 ? (
          <ChatEmpty data={data} starters={starters} onPick={send} onOpenDoc={onOpenDoc} />
        ) : (
          <>
            {msgs.map((m, i) => <ChatTurn key={i} msg={m} onOpenDoc={onOpenDoc} />)}
            {typing && <TypingBubble />}
          </>
        )}
      </div>
      <div style={{ borderTop: "1px solid var(--border-faint)", padding: "12px 24px 18px", background: "var(--bg-sidebar)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
                        background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-inset-top)", height: 42 }}>
            <Icon name="paperclip" size={14} color="var(--fg-muted)" />
            <input value={input} onChange={e => setInput(e.target.value)}
                   onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                   placeholder="Ask about your documents…"
                   style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--fg-primary)",
                            fontFamily: "var(--font-sans)", fontSize: 14 }} />
            <Kbd>↵</Kbd>
          </div>
          <Button variant="primary" onClick={() => send()} disabled={!input.trim()} style={{ height: 42 }}>
            <Icon name="send" size={14} /> Send
          </Button>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
          Files stay on your disk. Only metadata and snippets are sent for AI classification.
        </div>
      </div>
    </div>
  );
}

function ChatEmpty({ data, starters, onPick, onOpenDoc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760, margin: "0 auto", width: "100%", paddingTop: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 0" }}>
        <img src="../../assets/glyph-docuvault.svg" width={48} height={48} alt="" />
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>What do you want to know?</div>
        <div style={{ fontSize: 13, color: "var(--fg-tertiary)" }}>Your {data.stats.total_documents.toLocaleString()} documents are ready.</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 8 }}>For your attention</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {data.insights.map((al, i) => <CompactInsight key={i} alert={al} />)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 8 }}>Try asking</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {starters.map((s, i) => <StarterCard key={i} {...s} onClick={() => onPick(s.q)} />)}
        </div>
      </div>
    </div>
  );
}
function CompactInsight({ alert }) {
  const tone = { warning: { fg: "var(--warning)", bg: "var(--warning-bg)", bd: "oklch(0.80 0.15 78 / 0.4)" },
                 danger:  { fg: "var(--danger)",  bg: "var(--danger-bg)",  bd: "oklch(0.68 0.20 25 / 0.4)" },
                 info:    { fg: "var(--info)",    bg: "var(--info-bg)",    bd: "oklch(0.72 0.13 220 / 0.4)" } }[alert.severity];
  const icon = alert.severity === "warning" ? "alert-triangle" : alert.severity === "danger" ? "alert-circle" : "info";
  return (
    <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: tone.bg, border: `1px solid ${tone.bd}` }}>
      <Icon name={icon} size={14} color={tone.fg} />
      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6, color: "var(--fg-primary)" }}>{alert.message}</div>
      <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>{alert.details}</div>
    </div>
  );
}
function StarterCard({ icon, q, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: hover ? "var(--bg-hover)" : "var(--bg-card)",
                  border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                  cursor: "pointer", transition: "background var(--dur-base) var(--ease-out)" }}>
      <Icon name={icon} size={14} color="var(--fg-tertiary)" />
      <div style={{ fontSize: 13, color: "var(--fg-primary)" }}>{q}</div>
      <Icon name="arrow-up-right" size={12} color="var(--fg-muted)" style={{ marginLeft: "auto" }} />
    </div>
  );
}

function ChatTurn({ msg, onOpenDoc }) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: "var(--radius-lg)",
                      background: "var(--accent-700)", color: "oklch(0.99 0.002 264)",
                      fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: 4 }}>{msg.text}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex" }}>
      <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: "var(--radius-lg)",
                    background: "var(--bg-card)", border: "1px solid var(--border-default)",
                    color: "var(--fg-primary)", fontSize: 13, lineHeight: 1.55, borderBottomLeftRadius: 4 }}>
        {msg.text}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}>
            {msg.sources.map(s => (
              <SourceBadge key={s.id} doc={s} onClick={() => onOpenDoc(s.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function SourceBadge({ doc, onClick }) {
  const c = categoryColor(doc.category);
  const [hover, setHover] = useState(false);
  return (
    <span onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px",
                   borderRadius: "var(--radius-md)", background: hover ? "var(--bg-hover)" : "var(--ink-3)",
                   border: "1px solid var(--ink-5)", fontSize: 11, color: "var(--fg-secondary)", cursor: "pointer" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
      {doc.title}
      <Icon name="external-link" size={11} color="var(--fg-muted)" />
    </span>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px",
                    borderRadius: "var(--radius-lg)", background: "var(--bg-card)",
                    border: "1px solid var(--border-default)", fontSize: 12, color: "var(--fg-tertiary)",
                    borderBottomLeftRadius: 4 }}>
        <span className="dv-dots"><span /><span /><span /></span> Reading your documents…
      </div>
    </div>
  );
}

Object.assign(window, { Chat });
