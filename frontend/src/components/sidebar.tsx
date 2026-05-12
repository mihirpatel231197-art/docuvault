"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { categoryColor } from "@/lib/utils";
import {
  LayoutDashboard, MessageSquare, FileText, Search,
  Copy, UploadCloud, Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import Image from "next/image";

const NAV_ITEMS = [
  { id: "dashboard",  label: "Dashboard",  Icon: LayoutDashboard, href: "/" },
  { id: "chat",       label: "Chat",       Icon: MessageSquare,   href: "/chat" },
  { id: "documents",  label: "Documents",  Icon: FileText,        href: "/documents" },
  { id: "search",     label: "Search",     Icon: Search,          href: "/search", kbd: ["⌘", "K"] },
  { id: "duplicates", label: "Duplicates", Icon: Copy,            href: "/duplicates" },
  { id: "upload",     label: "Upload",     Icon: UploadCloud,     href: "/upload" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const w = collapsed ? 56 : 260;

  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: api.stats,
    staleTime: 60_000,
  });

  const categories = statsData?.categories
    ? Object.entries(statsData.categories)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <aside style={{
      width: w, flexShrink: 0,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border-faint)",
      display: "flex", flexDirection: "column",
      transition: "width 160ms cubic-bezier(0.22,1,0.36,1)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 12px", height: 56, flexShrink: 0 }}>
        <Image src="/glyph.svg" width={26} height={26} alt="DocuVault" style={{ flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-primary)" }}>
            DocuVault
          </div>
        )}
        {!collapsed && (
          <div style={{ marginLeft: "auto" }}>
            <IconBtn onClick={() => setCollapsed(true)} title="Collapse sidebar">
              <ChevronLeft size={14} />
            </IconBtn>
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 8px", flexShrink: 0 }}>
        {NAV_ITEMS.map(({ id, label, Icon, href, kbd }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <NavItem
              key={id}
              icon={<Icon size={15} strokeWidth={active ? 1.8 : 1.5} />}
              label={label}
              kbd={kbd}
              active={active}
              collapsed={collapsed}
              onClick={() => router.push(href)}
            />
          );
        })}
      </nav>

      {/* Categories */}
      {!collapsed && categories.length > 0 && (
        <div style={{ marginTop: 18, padding: "0 8px", display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px 4px", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
              Categories
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)" }}>{categories.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflowY: "auto", paddingBottom: 8 }}>
            {categories.map(cat => (
              <CategoryRow
                key={cat.name}
                cat={cat}
                active={pathname.startsWith("/documents") && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("category") === cat.name}
                onClick={() => router.push(`/documents?category=${encodeURIComponent(cat.name)}`)}
              />
            ))}
          </div>
        </div>
      )}

      {collapsed && <div style={{ flex: 1 }} />}

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-faint)", padding: "6px 8px", flexShrink: 0 }}>
        <NavItem
          icon={<Settings size={15} strokeWidth={pathname === "/settings" ? 1.8 : 1.5} />}
          label="Settings"
          active={pathname === "/settings"}
          collapsed={collapsed}
          onClick={() => router.push("/settings")}
        />
        {collapsed && (
          <div style={{ marginTop: 4 }}>
            <NavItem
              icon={<ChevronRight size={15} />}
              label="Expand"
              active={false}
              collapsed={collapsed}
              onClick={() => setCollapsed(false)}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ icon, label, kbd, active, collapsed, onClick }: {
  icon: React.ReactNode; label: string; kbd?: string[];
  active: boolean; collapsed: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 10,
        height: 32, padding: collapsed ? 0 : "0 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "var(--radius-md)", cursor: "pointer",
        color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
        background: active ? "var(--bg-pressed)" : hover ? "var(--bg-hover)" : "transparent",
        transition: "background 160ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {active && (
        <div style={{ position: "absolute", left: -4, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "var(--accent-500)" }} />
      )}
      {icon}
      {!collapsed && <div style={{ flex: 1, fontSize: 13, fontWeight: active ? 500 : 400 }}>{label}</div>}
      {!collapsed && kbd && (
        <div style={{ display: "flex", gap: 2 }}>
          {kbd.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat, active, onClick }: { cat: { name: string; count: number }; active: boolean; onClick: () => void }) {
  const c = categoryColor(cat.name);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        height: 28, padding: "0 12px",
        borderRadius: "var(--radius-md)", cursor: "pointer",
        background: active ? "var(--bg-pressed)" : hover ? "var(--bg-hover)" : "transparent",
        color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
        transition: "background 160ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>{cat.count}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", padding: "1px 5px",
      fontSize: 10, fontWeight: 500, color: "var(--fg-secondary)",
      background: "var(--ink-3)", border: "1px solid var(--ink-5)", borderBottomWidth: 2,
      borderRadius: "var(--radius-xs)", fontFamily: "var(--font-mono)", lineHeight: 1.4,
    }}>{children}</kbd>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, display: "grid", placeItems: "center",
        border: "none", borderRadius: "var(--radius-sm)",
        background: hover ? "var(--ink-4)" : "transparent",
        color: hover ? "var(--fg-primary)" : "var(--fg-tertiary)",
        cursor: "pointer", transition: "all 160ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >{children}</button>
  );
}
