// Toast container — sonner-styled
const ToastCtx = React.createContext(null);
function useToast() { return React.useContext(ToastCtx); }

function ToastProvider({ children }) {
  const [items, setItems] = React.useState([]);
  const push = React.useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    const item = { id, kind: "default", ...t };
    setItems(s => [...s, item]);
    setTimeout(() => setItems(s => s.filter(x => x.id !== id)), t.duration || 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {items.map(t => <ToastItem key={t.id} t={t} />)}
      </div>
    </ToastCtx.Provider>
  );
}
function ToastItem({ t }) {
  const palette = {
    default: { bg: "var(--bg-card)", color: "var(--fg-primary)", icon: "info", iconColor: "var(--fg-tertiary)" },
    success: { bg: "var(--bg-card)", color: "var(--fg-primary)", icon: "check-circle", iconColor: "var(--success)" },
    danger:  { bg: "var(--bg-card)", color: "var(--fg-primary)", icon: "alert-circle", iconColor: "var(--danger)" },
  }[t.kind || "default"];
  return (
    <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: palette.bg, color: palette.color,
                  border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)", minWidth: 240, maxWidth: 360,
                  animation: "slideUp 240ms cubic-bezier(0.5, 1.4, 0.5, 1)" }}>
      <Icon name={palette.icon} size={15} color={palette.iconColor} />
      <div style={{ flex: 1, fontSize: 13 }}>{t.message}</div>
      {t.sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{t.sub}</div>}
    </div>
  );
}

Object.assign(window, { ToastProvider, useToast });
