"use client";

/**
 * DocuVault Design System primitives
 * Matches the reference JSX from design-system/ui_kits/desktop_app/
 */

import { useState } from "react";
import { categoryColor } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ── FileTypeIcon ───────────────────────────────────────────────────

const FT_META: Record<string, { label: string; color: string; bg: string }> = {
  pdf:    { label: "PDF", color: "var(--ft-pdf)",    bg: "oklch(0.66 0.20 25 / 0.15)" },
  image:  { label: "IMG", color: "var(--ft-image)",  bg: "oklch(0.74 0.16 0 / 0.15)" },
  word:   { label: "DOC", color: "var(--ft-word)",   bg: "oklch(0.65 0.16 248 / 0.15)" },
  excel:  { label: "XLS", color: "var(--ft-excel)",  bg: "oklch(0.72 0.16 145 / 0.15)" },
  code:   { label: "{ }", color: "var(--ft-code)",   bg: "oklch(0.65 0.01 264 / 0.20)" },
  audio:  { label: "WAV", color: "var(--ft-audio)",  bg: "oklch(0.68 0.18 295 / 0.15)" },
  video:  { label: "MP4", color: "var(--ft-video)",  bg: "oklch(0.74 0.16 50 / 0.15)" },
  default:{ label: "···", color: "var(--ft-default)", bg: "oklch(0.60 0.01 264 / 0.20)" },
};

function inferFT(mime: string | null | undefined): string {
  if (!mime) return "default";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("word") || mime.includes("msword")) return "word";
  if (mime.includes("sheet") || mime.includes("excel")) return "excel";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("javascript")) return "code";
  return "default";
}

export function FileTypeIcon({ mime, size = 32 }: { mime?: string | null; size?: number }) {
  const meta = FT_META[inferFT(mime)];
  return (
    <div style={{
      width: size, height: size, borderRadius: "var(--radius-md)",
      display: "grid", placeItems: "center", flexShrink: 0,
      background: meta.bg, color: meta.color,
      fontFamily: "var(--font-mono)", fontSize: size <= 28 ? 9 : 10,
      fontWeight: 700, letterSpacing: "0.02em",
    }}>
      {meta.label}
    </div>
  );
}

// ── CategoryBadge ─────────────────────────────────────────────────

export function CategoryBadge({ name, count, size = "md", active, onClick }: {
  name: string; count?: number; size?: "sm" | "md";
  active?: boolean; onClick?: () => void;
}) {
  const c = categoryColor(name);
  const s = size === "sm"
    ? { padding: "2px 7px", fontSize: 10, dotSize: 5, gap: 4 }
    : { padding: "3px 9px", fontSize: 11, dotSize: 6, gap: 5 };
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: s.gap,
      padding: s.padding, borderRadius: "var(--radius-md)",
      fontSize: s.fontSize, fontWeight: 500,
      color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
      cursor: onClick ? "pointer" : undefined,
      ...(active ? { boxShadow: `0 0 0 1px ${c.fg}` } : {}),
    }}>
      <span style={{ width: s.dotSize, height: s.dotSize, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      {name}
      {count !== undefined && (
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", opacity: 0.7, fontSize: s.fontSize - 1 }}>{count}</span>
      )}
    </span>
  );
}

// ── ConfidenceBadge ───────────────────────────────────────────────

export function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const pct = Math.round(value * 100);
  const tier = value > 0.8 ? "high" : value > 0.5 ? "mid" : "low";
  const colors = {
    high: { fg: "var(--success)", bg: "var(--success-bg)" },
    mid:  { fg: "var(--warning)", bg: "var(--warning-bg)" },
    low:  { fg: "var(--danger)",  bg: "var(--danger-bg)" },
  }[tier];
  return (
    <span style={{
      display: "inline-flex", padding: "2px 7px", borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
      fontVariantNumeric: "tabular-nums", color: colors.fg, background: colors.bg,
    }}>{pct}%</span>
  );
}

// ── PageHeader ────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      padding: "20px 24px 16px", borderBottom: "1px solid var(--border-faint)", gap: 16, flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-primary)" }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ── Card / CardHeader ─────────────────────────────────────────────

export function Card({ children, padding = 18, style, hoverable, onClick }: {
  children: React.ReactNode; padding?: number;
  style?: React.CSSProperties; hoverable?: boolean; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hoverable && hover ? "var(--bg-hover)" : "var(--bg-card)",
        border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
        padding, boxShadow: "var(--shadow-inset-top)",
        cursor: hoverable ? "pointer" : undefined,
        transition: "background 160ms cubic-bezier(0.22,1,0.36,1)",
        ...style,
      }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid var(--border-faint)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-primary)" }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{hint}</div>}
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────

export function Btn({ children, onClick, variant = "secondary", size = "md", icon, disabled, style }: {
  children?: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg"; icon?: React.ReactNode;
  disabled?: boolean; style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: "5px 10px", fontSize: 12, height: 26 },
    md: { padding: "7px 13px", fontSize: 13, height: 32 },
    lg: { padding: "9px 16px", fontSize: 14, height: 38 },
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent-500)", color: "oklch(0.99 0.002 264)", borderColor: "var(--accent-700)" },
    secondary: { background: "var(--ink-3)", color: "var(--fg-primary)", borderColor: "var(--ink-5)" },
    ghost: { background: "transparent", color: "var(--fg-secondary)", borderColor: "transparent", boxShadow: "none" },
    danger: { background: "transparent", color: "var(--danger)", borderColor: "oklch(0.68 0.20 25 / 0.4)", boxShadow: "none" },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontWeight: 500, borderRadius: "var(--radius-md)", border: "1px solid transparent",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
        transition: "all 160ms", whiteSpace: "nowrap", boxShadow: "var(--shadow-inset-top)",
        ...sizes[size], ...variants[variant],
        ...(hover && !disabled ? { filter: variant === "ghost" ? undefined : "brightness(1.1)", background: variant === "ghost" ? "var(--ink-3)" : undefined } : {}),
        ...style,
      }}
    >
      {icon}{children}
    </button>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────

export function IconBtn({ onClick, title, children, size = 26, color }: {
  onClick?: () => void; title?: string; children: React.ReactNode; size?: number; color?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, display: "grid", placeItems: "center",
        border: "none", borderRadius: "var(--radius-sm)",
        background: hover ? "var(--ink-4)" : "transparent",
        color: hover ? "var(--fg-primary)" : color || "var(--fg-tertiary)",
        cursor: "pointer", transition: "all 160ms",
      }}
    >{children}</button>
  );
}

// ── Kbd ───────────────────────────────────────────────────────────

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", padding: "1px 5px",
      fontSize: 10, fontWeight: 500, color: "var(--fg-secondary)",
      background: "var(--ink-3)", border: "1px solid var(--ink-5)", borderBottomWidth: 2,
      borderRadius: "var(--radius-xs)", fontFamily: "var(--font-mono)", lineHeight: 1.4,
    }}>{children}</kbd>
  );
}

// ── EmptyState ────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", display: "grid", placeItems: "center", background: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--fg-tertiary)" }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg-primary)" }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: "var(--fg-tertiary)", maxWidth: 380, lineHeight: 1.5 }}>{description}</div>}
      {action}
    </div>
  );
}
