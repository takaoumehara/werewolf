import React from "react";
export function SegmentedControl({ options, value, onChange, full = false, style }) {
  return (
    <div role="radiogroup" style={{ display: full ? "flex" : "inline-flex", border: "1px solid var(--rule-strong)", borderRadius: "var(--radius-full)", overflow: "hidden", background: "var(--surface-sunken)", ...style }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={sel} onClick={() => onChange && onChange(o.value)}
            style={{ flex: full ? 1 : undefined, minHeight: 40, minWidth: 44, padding: "0 18px", border: "none",
              fontFamily: "var(--font-ui)", fontSize: "var(--type-label-size)", fontWeight: 700, cursor: "pointer",
              background: sel ? "var(--accent)" : "transparent", color: sel ? "var(--accent-ink-on)" : "var(--ink-muted)",
              transition: "background var(--t-micro) var(--ease-out), color var(--t-micro) var(--ease-out)", WebkitTapHighlightColor: "transparent" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
