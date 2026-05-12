"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers";

export function useGlobalShortcuts() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd+K — search
      if (mod && e.key === "k") {
        e.preventDefault();
        router.push("/search");
        return;
      }

      // Cmd+, — settings
      if (mod && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }

      // Cmd+Shift+D — toggle dark mode
      if (mod && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
        return;
      }

      // Don't handle single-key shortcuts in inputs
      if (isInput) return;

      // / — focus search (vim-style)
      if (e.key === "/") {
        e.preventDefault();
        router.push("/search");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, theme, setTheme]);
}
