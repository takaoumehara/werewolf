import React from "react";
import { StatusBadge } from "./StatusBadge.jsx";
export function Toast({ open, text, status = "success", bottom = 24, style }) {
  return (
    <div aria-live="polite" style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 40,
      opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)", transition: "opacity var(--t-micro) var(--ease-out), transform var(--t-micro) var(--ease-out)", ...style }}>
      {open && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "var(--radius-full)", background: "var(--surface-raised)", border: "1px solid var(--rule-strong)", boxShadow: "var(--shadow-modal)", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--ink-strong)" }}>
          <StatusBadge status={status} label="" style={{ border: "none", background: "transparent", padding: 0 }} />
          {text}
        </div>
      )}
    </div>
  );
}
