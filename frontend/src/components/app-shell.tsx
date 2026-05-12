"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TitleBar } from "@/components/titlebar";
import { CommandPalette } from "@/components/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <TitleBar />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-canvas)" }}>
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
