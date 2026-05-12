"use client";

export function TitleBar({ title }: { title?: string }) {
  return (
    <div
      className="dv-titlebar"
      style={{
        height: "var(--titlebar-h)",
        background: "var(--ink-1)",
        borderBottom: "1px solid var(--border-faint)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 10,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* macOS traffic lights */}
      <div style={{ display: "flex", gap: 7 }}>
        <div style={{ width: 12, height: 12, borderRadius: 999, background: "oklch(0.68 0.20 25)" }} />
        <div style={{ width: 12, height: 12, borderRadius: 999, background: "oklch(0.80 0.15 78)" }} />
        <div style={{ width: 12, height: 12, borderRadius: 999, background: "oklch(0.72 0.16 152)" }} />
      </div>
      <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--fg-muted)", fontWeight: 500 }}>
        {title || "DocuVault"}
      </div>
      {/* Spacer to balance traffic lights */}
      <div style={{ width: 52 }} />
    </div>
  );
}
