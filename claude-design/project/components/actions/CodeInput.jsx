import React from "react";
export function CodeInput({ length = 6, value = "", onChange, error, label, style }) {
  const ref = React.useRef(null);
  const [focus, setFocus] = React.useState(false);
  const chars = value.split("");
  const active = Math.min(value.length, length - 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-ui)", ...style }}>
      {label && <div style={{ fontSize: "var(--type-label-size)", fontWeight: 700, color: "var(--ink-strong)" }}>{label}</div>}
      <div onClick={() => ref.current && ref.current.focus()} style={{ position: "relative", display: "flex", gap: 8, cursor: "text" }}>
        <input ref={ref} value={value} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" aria-label={label || "参加コード"}
          onChange={(e) => onChange && onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, length))}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ position: "absolute", inset: 0, opacity: 0, border: "none", width: "100%", height: "100%", fontSize: 16 }} />
        {Array.from({ length }).map((_, i) => (
          <div key={i} aria-hidden="true" style={{ flex: 1, minWidth: 0, height: 56, borderRadius: "var(--radius-2)",
            border: "1px solid " + (error ? "var(--status-danger)" : focus && i === active ? "var(--accent)" : "var(--rule-strong)"),
            background: "var(--surface-field)", boxShadow: focus && i === active ? "var(--focus-ring)" : "var(--engraved-rule)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-code)", fontSize: 24, fontWeight: 600, color: "var(--ink-strong)", fontVariantNumeric: "tabular-nums" }}>
            {chars[i] || ""}
          </div>
        ))}
      </div>
      {error && <div style={{ fontSize: "var(--type-caption-size)", color: "var(--status-danger)" }}>{error}</div>}
    </div>
  );
}
