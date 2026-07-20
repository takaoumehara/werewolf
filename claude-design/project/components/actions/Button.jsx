import React from "react";
const spinCss = "@keyframes km-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.km-spin{animation:none !important}}";
export function Button({ variant = "primary", size = "md", full = false, disabled = false, loading = false, icon, children, onClick, style, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const inert = disabled || loading;
  const v = {
    primary: { background: "var(--accent)", color: "var(--accent-ink-on)", borderColor: "transparent" },
    secondary: { background: "transparent", color: "var(--ink-strong)", borderColor: "var(--rule-strong)" },
    quiet: { background: "transparent", color: "var(--ink-muted)", borderColor: "transparent" },
    danger: { background: "transparent", color: "var(--status-danger)", borderColor: "var(--status-danger)" },
  }[variant] || {};
  const dis = inert ? { background: variant === "primary" ? "var(--status-disabled-surface)" : "transparent", color: "var(--status-disabled-ink)", borderColor: variant === "primary" || variant === "quiet" ? "transparent" : "var(--rule)" } : {};
  return (
    <button type="button" onClick={inert ? undefined : onClick} disabled={disabled} aria-busy={loading || undefined}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{ fontFamily: "var(--font-ui)", fontSize: size === "lg" ? 15 : "var(--type-label-size)", fontWeight: 700, letterSpacing: "0.02em",
        minHeight: size === "lg" ? 52 : 44, minWidth: 44, padding: "0 20px", borderRadius: "var(--radius-2)",
        borderWidth: 1, borderStyle: "solid", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: full ? "100%" : undefined, cursor: inert ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent",
        boxShadow: variant === "primary" && !inert ? "inset 0 1px 0 rgba(255,255,255,0.18)" : "none",
        transition: "transform var(--t-instant) var(--ease-out), filter var(--t-instant) var(--ease-out)",
        transform: pressed && !inert ? "scale(0.98)" : "none", filter: pressed && !inert ? "brightness(0.92)" : "none",
        ...v, ...dis, ...style }} {...rest}>
      <style>{spinCss}</style>
      {loading && <span className="km-spin" aria-hidden="true" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "km-spin 0.9s linear infinite" }} />}
      {icon}{children}
    </button>
  );
}
