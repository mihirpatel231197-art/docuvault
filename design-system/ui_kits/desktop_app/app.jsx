// App — top-level router/state
function App() {
  const data = window.DV_DATA;
  const [page, setPage] = useState("dashboard");
  const [params, setParams] = useState({});
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toastFn = useToast();

  function navigate(p, prms = {}) { setPage(p); setParams(prms); setPaletteOpen(false); }
  function openDoc(id) {
    const doc = data.docs.find(d => d.id === id);
    toastFn({ kind: "default", message: `Opened ${doc?.title || id}`, sub: "in default app" });
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(o => !o); }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pageEl = (() => {
    switch (page) {
      case "dashboard":  return <Dashboard data={data} onNavigate={navigate} />;
      case "chat":       return <Chat data={data} onOpenDoc={openDoc} />;
      case "documents":  return <Documents data={data} params={params} onOpenDoc={openDoc} onNavigate={navigate} />;
      case "search":     return <Search data={data} onOpenDoc={openDoc} />;
      case "duplicates": return <Duplicates data={data} onOpenDoc={openDoc} />;
      case "settings":   return <Settings data={data} />;
      case "upload":     return <Upload data={data} />;
      default:           return <Dashboard data={data} onNavigate={navigate} />;
    }
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-canvas)" }}>
      <TitleBar>{pageTitleFor(page, params)}</TitleBar>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar page={page}
                 onNavigate={navigate}
                 collapsed={collapsed}
                 onToggleCollapse={() => setCollapsed(c => !c)}
                 categories={data.cats}
                 activeCategory={page === "documents" ? params.category : null} />
        <main data-screen-label={"app/" + page} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {pageEl}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} docs={data.docs}
                      onPick={(p) => {
                        if (p.type === "doc") openDoc(p.id);
                        else if (p.type === "nav") navigate(p.to);
                        setPaletteOpen(false);
                      }} />
    </div>
  );
}

function pageTitleFor(page, params) {
  if (page === "documents" && params.category) return "DocuVault — " + params.category;
  return "DocuVault — " + page[0].toUpperCase() + page.slice(1);
}

function Root() {
  return <ToastProvider><App /></ToastProvider>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
