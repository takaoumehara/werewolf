import React from "react";
import { Button } from "../actions/Button.jsx";
export function Dialog({ open, title, body, actions = [], tone = "neutral", style }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-ui)" }}>
      <div style={{ position: "absolute", inset: 0, background: "var(--overlay-modal)" }} />
      <div role="alertdialog" aria-modal="true" style={{ position: "relative", width: "100%", maxWidth: 320, background: "var(--surface-raised)", borderRadius: "var(--radius-3)", border: "1px solid var(--rule-strong)", borderTop: tone === "danger" ? "2px solid var(--status-danger)" : "1px solid var(--rule-strong)", boxShadow: "var(--shadow-modal)", padding: "20px 20px 16px", ...style }}>
        <div style={{ fontSize: "var(--type-heading-size)", fontWeight: 700, color: "var(--ink-strong)" }}>{title}</div>
        {body && <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.7, color: "var(--ink-muted)" }}>{body}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {actions.map((a, i) => <Button key={i} full variant={a.variant || (i === 0 ? "primary" : "quiet")} onClick={a.onClick}>{a.label}</Button>)}
        </div>
      </div>
    </div>
  );
}
