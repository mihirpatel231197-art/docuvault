"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, categoryColor } from "@/lib/utils";
import { api } from "@/lib/api";
import { useTheme } from "@/components/providers";
import {
  LayoutDashboard, FolderOpen, Search, Upload, Settings,
  FileText, Copy, MessageSquare, Clock, BarChart3,
  FolderSearch, Sun, Moon, Monitor, HelpCircle, ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/search", label: "Search", icon: Search, kbd: ["Cmd", "K"] },
  { href: "/duplicates", label: "Duplicates", icon: Copy },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/smart-folders", label: "Smart folders", icon: FolderSearch },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme, resolved } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const { data: facets } = useQuery({
    queryKey: ["facets"],
    queryFn: api.facets,
    staleTime: 60_000,
  });

  const categories = facets?.category
    ? Object.entries(facets.category).sort(([, a], [, b]) => b - a)
    : [];

  const w = collapsed ? 56 : 260;
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        width: w,
        background: "var(--ink-1)",
        borderRight: "1px solid var(--ink-3)",
        transition: `width var(--dur-base) var(--ease-out)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ padding: "14px 14px 12px", height: 60 }}>
        <img src="/glyph.svg" width={26} height={26} alt="" className="flex-shrink-0" />
        {!collapsed && (
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>
            DocuVault
          </span>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto"
            style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 5, border: "none", background: "transparent", color: "var(--ink-8)", cursor: "pointer" }}
          >
            <ChevronsLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-px" style={{ padding: "0 8px" }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="relative flex items-center gap-2.5 no-underline"
              style={{
                height: 32,
                padding: collapsed ? 0 : "0 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 7,
                color: active ? "var(--ink-10)" : "var(--ink-8)",
                background: active ? "var(--ink-4)" : "transparent",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                transition: `background var(--dur-base) var(--ease-out)`,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--ink-3)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {active && (
                <span style={{
                  position: "absolute", left: -4, top: 6, bottom: 6,
                  width: 2, borderRadius: 2, background: "var(--accent-500)",
                }} />
              )}
              <item.icon size={15} strokeWidth={active ? 1.8 : 1.5} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.kbd && (
                <span className="flex gap-0.5">
                  {item.kbd.map((k) => <kbd key={k}>{k === "Cmd" ? "\u2318" : k}</kbd>)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Categories */}
      {!collapsed && categories.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col" style={{ marginTop: 18, padding: "0 8px" }}>
          <div className="flex items-center justify-between" style={{ padding: "6px 12px 4px" }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-7)" }}>
              Categories
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-7)" }}>
              {categories.length}
            </span>
          </div>
          <div className="flex flex-col gap-px overflow-auto pb-2">
            {categories.slice(0, 12).map(([name, count]) => {
              const c = categoryColor(name);
              return (
                <Link key={name} href={`/documents?category=${name}`}
                  className="flex items-center gap-2.5 no-underline"
                  style={{
                    height: 28, padding: "0 12px", borderRadius: 7,
                    color: "var(--ink-8)", fontSize: 12,
                    transition: `background var(--dur-base) var(--ease-out)`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-3)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-7)", fontVariantNumeric: "tabular-nums" }}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--ink-3)", padding: "6px 8px" }}>
        <button
          onClick={() => setTheme(nextTheme)}
          className="w-full flex items-center gap-2.5"
          style={{
            height: 32, padding: collapsed ? 0 : "0 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 7, border: "none", background: "transparent",
            color: "var(--ink-8)", fontSize: 13, cursor: "pointer",
          }}
        >
          <ThemeIcon size={15} strokeWidth={1.5} />
          {!collapsed && <span>{theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}</span>}
        </button>
        <Link href="/help"
          className="w-full flex items-center gap-2.5 no-underline"
          style={{ height: 32, padding: collapsed ? 0 : "0 12px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 7, color: "var(--ink-8)", fontSize: 13 }}
        >
          <HelpCircle size={15} strokeWidth={1.5} />
          {!collapsed && <span>Help</span>}
        </Link>
        <Link href="/settings"
          className="w-full flex items-center gap-2.5 no-underline"
          style={{ height: 32, padding: collapsed ? 0 : "0 12px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 7, color: "var(--ink-8)", fontSize: 13 }}
        >
          <Settings size={15} strokeWidth={1.5} />
          {!collapsed && <span>Settings</span>}
        </Link>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center"
            style={{ height: 32, borderRadius: 7, border: "none", background: "transparent", color: "var(--ink-8)", cursor: "pointer", marginTop: 4 }}
          >
            <ChevronsRight size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}
