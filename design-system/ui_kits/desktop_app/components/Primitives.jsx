// Primitives — Button, Badge, Card, Input, Kbd, IconButton
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

function Icon({ name, size = 14, strokeWidth = 1.5, color, style, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      i.setAttribute("stroke-width", strokeWidth);
      ref.current.appendChild(i);
      window.lucide.createIcons({ icons: window.lucide.icons, attrs: { width: size, height: size } });
      const svg = ref.current.querySelector("svg");
      if (svg) { svg.setAttribute("width", size); svg.setAttribute("height", size); }
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-flex", color: color || "currentColor", ...style }} {...rest} />;
}

function Button({ variant = "secondary", size = "md", children, leadingIcon, trailingIcon, onClick, disabled, style, kbd }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "var(--font-sans)", fontWeight: 500,
    borderRadius: "var(--radius-md)", border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all var(--dur-base) var(--ease-out)",
    opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
  };
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12, height: 26 },
    md: { padding: "7px 13px", fontSize: 13, height: 32 },
    lg: { padding: "9px 16px", fontSize: 14, height: 38 },
  };
  const variants = {
    primary: { background: "var(--accent-500)", color: "oklch(0.99 0.002 264)", borderColor: "var(--accent-700)", boxShadow: "var(--shadow-inset-top)" },
    secondary: { background: "var(--ink-3)", color: "var(--fg-primary)", borderColor: "var(--ink-5)", boxShadow: "var(--shadow-inset-top)" },
    ghost: { background: "transparent", color: "var(--fg-secondary)" },
    danger: { background: "transparent", color: "var(--danger)", borderColor: "oklch(0.68 0.20 25 / 0.4)" },
    icon: { background: "transparent", color: "var(--fg-tertiary)", padding: 0, width: sizes[size].height, height: sizes[size].height, justifyContent: "center" },
  };
  const [hover, setHover] = useState(false);
  const hoverStyle = hover && !disabled ? (variant === "ghost" ? { background: "var(--ink-3)", color: "var(--fg-primary)" } : { filter: "brightness(1.10)" }) : {};
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ ...base, ...sizes[size], ...variants[variant], ...hoverStyle, ...style }}>
      {leadingIcon && <Icon name={leadingIcon} size={size === "sm" ? 12 : 14} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={size === "sm" ? 12 : 14} />}
      {kbd && <span style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>{kbd.map((k,i) => <Kbd key={i}>{k}</Kbd>)}</span>}
    </button>
  );
}

function IconButton({ icon, size = 26, onClick, title, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ width: size, height: size, display: "grid", placeItems: "center", border: "none", borderRadius: "var(--radius-sm)",
                     background: hover ? "var(--ink-4)" : "transparent", color: hover ? "var(--fg-primary)" : (color || "var(--fg-tertiary)"),
                     cursor: "pointer", transition: "all var(--dur-base) var(--ease-out)" }}>
      <Icon name={icon} size={size <= 26 ? 14 : 16} />
    </button>
  );
}

function Kbd({ children, style }) {
  return <kbd style={{ display: "inline-flex", alignItems: "center", padding: "1px 5px", fontSize: 10, fontWeight: 500, color: "var(--fg-secondary)",
                       background: "var(--ink-3)", border: "1px solid var(--ink-5)", borderBottomWidth: 2, borderRadius: "var(--radius-xs)",
                       fontFamily: "var(--font-mono)", lineHeight: 1.4, ...style }}>{children}</kbd>;
}

function Card({ children, padding = 18, style, hoverable, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         style={{ background: hoverable && hover ? "var(--bg-hover)" : "var(--bg-card)",
                  border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
                  padding, boxShadow: "var(--shadow-inset-top)",
                  cursor: hoverable ? "pointer" : undefined,
                  transition: "background var(--dur-base) var(--ease-out)",
                  ...style }}>{children}</div>
  );
}

function Input({ value, onChange, placeholder, mono, leadingIcon, trailingSlot, autoFocus, size = "md", style, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  const heights = { sm: 28, md: 32, lg: 38 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: heights[size], padding: "0 12px",
                  background: "var(--bg-input)", border: `1px solid ${focused ? "var(--accent-500)" : "var(--border-default)"}`,
                  borderRadius: "var(--radius-sm)", boxShadow: focused ? "0 0 0 3px oklch(0.62 0.19 248 / 0.18)" : undefined,
                  transition: "all var(--dur-base) var(--ease-out)", ...style }}>
      {leadingIcon && <Icon name={leadingIcon} size={14} color="var(--fg-muted)" />}
      <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown}
             autoFocus={autoFocus} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
             style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--fg-primary)",
                      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: mono ? 12 : 13 }} />
      {trailingSlot}
    </div>
  );
}

function Divider({ vertical, style }) {
  return <div style={{ background: "var(--border-faint)", flexShrink: 0,
                       width: vertical ? 1 : "100%", height: vertical ? "100%" : 1, ...style }} />;
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                   padding: "48px 24px", gap: 14, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", display: "grid", placeItems: "center",
                    background: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--fg-tertiary)" }}>
        <Icon name={icon} size={28} strokeWidth={1.3} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg-primary)" }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: "var(--fg-tertiary)", maxWidth: 380, lineHeight: 1.5 }}>{description}</div>}
      {action}
    </div>
  );
}

Object.assign(window, { Icon, Button, IconButton, Kbd, Card, Input, Divider, EmptyState });
