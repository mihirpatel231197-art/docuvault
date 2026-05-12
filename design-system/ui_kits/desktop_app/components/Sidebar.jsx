function Sidebar({ page, onNavigate, collapsed, onToggleCollapse, categories, activeCategory }) {
  const w = collapsed ? 56 : 260;
  const navItems = [
    { id: "dashboard",  label: "Dashboard",  icon: "layout-dashboard" },
    { id: "chat",       label: "Chat",       icon: "message-square" },
    { id: "documents",  label: "Documents",  icon: "file-text" },
    { id: "search",     label: "Search",     icon: "search", kbd: ["⌘","K"] },
    { id: "duplicates", label: "Duplicates", icon: "copy" },
    { id: "upload",     label: "Upload",     icon: "upload-cloud" },
  ];
  return (
    <aside style={{ width: w, flexShrink: 0, background: "var(--bg-sidebar)",
                    borderRight: "1px solid var(--border-faint)",
                    display: "flex", flexDirection: "column", transition: "width var(--dur-base) var(--ease-out)",
                    overflow: "hidden" }}>
      {/* Header / logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 12px", height: 60 }}>
        <img src="../../assets/glyph-docuvault.svg" width={26} height={26} style={{ flexShrink: 0 }} alt="" />
        {!collapsed && <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-primary)" }}>DocuVault</div>}
        {!collapsed && <div style={{ marginLeft: "auto" }}>
          <IconButton icon="chevrons-left" onClick={onToggleCollapse} title="Collapse sidebar" />
        </div>}
      </div>

      {/* Primary nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 8px" }}>
        {navItems.map(item => (
          <SidebarItem key={item.id}
                       active={page === item.id}
                       collapsed={collapsed}
                       icon={item.icon}
                       label={item.label}
                       kbd={item.kbd}
                       onClick={() => onNavigate(item.id)} />
        ))}
      </nav>

      {/* Categories */}
      {!collapsed && (
        <div style={{ marginTop: 18, padding: "0 8px", display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px 4px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>Categories</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)" }}>{categories.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "auto", paddingBottom: 8 }}>
            {categories.map(cat => (
              <CategoryRow key={cat.name} cat={cat}
                           active={activeCategory === cat.name}
                           onClick={() => onNavigate("documents", { category: cat.name })} />
            ))}
          </div>
        </div>
      )}
      {collapsed && <div style={{ flex: 1 }} />}

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-faint)", padding: "6px 8px" }}>
        <SidebarItem collapsed={collapsed}
                     icon="settings"
                     label="Settings"
                     active={page === "settings"}
                     onClick={() => onNavigate("settings")} />
        {collapsed && (
          <div style={{ marginTop: 4 }}>
            <SidebarItem collapsed={collapsed} icon="chevrons-right" label="Expand" onClick={onToggleCollapse} />
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, active, collapsed, kbd, onClick }) {
  const [hover, setHover] = useState(false);
  const bg = active ? "var(--bg-pressed)" : (hover ? "var(--bg-hover)" : "transparent");
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ position: "relative", display: "flex", alignItems: "center", gap: 10,
                  height: 32, padding: collapsed ? 0 : "0 12px", justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
                  background: bg,
                  transition: "background var(--dur-base) var(--ease-out)" }}>
      {active && <div style={{ position: "absolute", left: -4, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "var(--accent-500)" }} />}
      <Icon name={icon} size={15} strokeWidth={active ? 1.8 : 1.5} />
      {!collapsed && <div style={{ flex: 1, fontSize: 13, fontWeight: active ? 500 : 400 }}>{label}</div>}
      {!collapsed && kbd && <div style={{ display: "flex", gap: 2 }}>{kbd.map((k,i) => <Kbd key={i}>{k}</Kbd>)}</div>}
    </div>
  );
}

function CategoryRow({ cat, active, onClick }) {
  const c = categoryColor(cat.name);
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ display: "flex", alignItems: "center", gap: 10, height: 28, padding: "0 12px",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: active ? "var(--bg-pressed)" : (hover ? "var(--bg-hover)" : "transparent"),
                  color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
                  transition: "background var(--dur-base) var(--ease-out)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>{cat.count}</div>
    </div>
  );
}

Object.assign(window, { Sidebar });
