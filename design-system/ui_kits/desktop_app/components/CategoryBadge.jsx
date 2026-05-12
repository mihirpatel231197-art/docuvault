// Hash a string into a stable index 0..11 (matches the 12-cat palette)
function categoryHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 12;
}
const CAT_HUES = [248, 165, 145, 90, 70, 45, 25, 8, 340, 305, 280, 215];
function categoryColor(name) {
  const i = categoryHash(name);
  const h = CAT_HUES[i];
  return {
    fg:  `oklch(0.74 0.16 ${h})`,
    bg:  `oklch(0.74 0.16 ${h} / 0.12)`,
    bd:  `oklch(0.74 0.16 ${h} / 0.30)`,
    dot: `oklch(0.74 0.16 ${h})`,
  };
}

function CategoryBadge({ name, count, size = "md", asDot = false, active = false, onClick, style }) {
  const c = categoryColor(name);
  const sizes = {
    sm: { padding: "2px 7px", fontSize: 10, dotSize: 5, gap: 4 },
    md: { padding: "3px 9px", fontSize: 11, dotSize: 6, gap: 5 },
  };
  const s = sizes[size];
  return (
    <span onClick={onClick}
          style={{ display: "inline-flex", alignItems: "center", gap: s.gap, padding: s.padding,
                   borderRadius: "var(--radius-md)", fontSize: s.fontSize, fontWeight: 500,
                   color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
                   cursor: onClick ? "pointer" : undefined,
                   ...(active ? { boxShadow: `0 0 0 1px ${c.fg}`, background: `${c.bg.replace("0.12", "0.20")}` } : {}),
                   ...style }}>
      <span style={{ width: s.dotSize, height: s.dotSize, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      <span>{name}</span>
      {count !== undefined && <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                                              opacity: 0.7, fontSize: s.fontSize - 1 }}>{count}</span>}
    </span>
  );
}

function ConfidenceBadge({ value, style }) {
  const pct = Math.round(value * 100);
  const tier = value > 0.8 ? "high" : value > 0.5 ? "mid" : "low";
  const colors = {
    high: { fg: "var(--success)", bg: "var(--success-bg)" },
    mid:  { fg: "var(--warning)", bg: "var(--warning-bg)" },
    low:  { fg: "var(--danger)",  bg: "var(--danger-bg)"  },
  }[tier];
  return (
    <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: "var(--radius-md)",
                   fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                   fontVariantNumeric: "tabular-nums", color: colors.fg, background: colors.bg, ...style }}>
      {pct}%
    </span>
  );
}

Object.assign(window, { categoryHash, categoryColor, CategoryBadge, ConfidenceBadge });
