import React from "react";
import { IconButton } from "../actions/IconButton.jsx";
export function BottomSheet({ open, title, onClose, children, maxHeight = "70%", style }) {
  return (
    <div aria-hidden={!open} style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: open ? "auto" : "none", fontFamily: "var(--font-ui)" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "var(--overlay-modal)", opacity: open ? 1 : 0, transition: "opacity var(--t-micro) var(--ease-out)" }} />
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight, display: "flex", flexDirection: "column",
          background: "var(--surface-raised)", borderRadius: "var(--radius-3) var(--radius-3) 0 0", border: "1px solid var(--rule)", borderBottom: "none",
          boxShadow: "var(--shadow-modal)", paddingBottom: "var(--safe-bottom)",
          transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform var(--t-phase) var(--ease-ritual)", ...style }}>
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: "var(--rule-strong)", margin: "10px auto 0" }} />
        <div style={{ display: "flex", alignItems: "center", padding: "8px 8px 8px 20px" }}>
          <div style={{ flex: 1, fontSize: "var(--type-heading-size)", fontWeight: 700, color: "var(--ink-strong)" }}>{title}</div>
          {onClose && <IconButton name="X" label="閉じる" onClick={onClose} />}
        </div>
        <div style={{ padding: "0 20px 20px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
