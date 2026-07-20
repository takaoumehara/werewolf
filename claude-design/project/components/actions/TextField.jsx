import React from "react";
export function TextField({ label, value, onChange, placeholder, hint, error, maxLength, type = "text", style }) {
  const [focus, setFocus] = React.useState(false);
  const id = React.useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)", ...style }}>
      {label && <label htmlFor={id} style={{ fontSize: "var(--type-label-size)", fontWeight: 700, color: "var(--ink-strong)" }}>{label}</label>}
      <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange && onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        aria-invalid={!!error || undefined} aria-describedby={error || hint ? id + "-d" : undefined}
        style={{ minHeight: 48, padding: "0 14px", borderRadius: "var(--radius-2)", boxSizing: "border-box",
          border: "1px solid " + (error ? "var(--status-danger)" : focus ? "var(--accent)" : "var(--rule-strong)"),
          background: "var(--surface-field)", color: "var(--ink-strong)", fontSize: 16, fontFamily: "var(--font-ui)",
          outline: "none", boxShadow: focus ? "var(--focus-ring)" : "var(--engraved-rule)", width: "100%" }} />
      {(error || hint) && <div id={id + "-d"} style={{ fontSize: "var(--type-caption-size)", lineHeight: 1.55, color: error ? "var(--status-danger)" : "var(--ink-muted)" }}>{error || hint}</div>}
    </div>
  );
}
