import React from "react";
// 色 + 形 + ラベルの三重符号。色だけに意味を持たせない。
const GLYPH = { success: "●", warning: "▲", danger: "■", info: "●", offline: "◌", reconnecting: "◌", neutral: "●" };
export function StatusBadge({ status = "neutral", label, style }) {
  const c = status === "neutral" ? "var(--ink-muted)" : "var(--status-" + status + ")";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: "var(--radius-1)", border: "1px solid var(--rule)", background: "var(--surface-sunken)", fontFamily: "var(--font-ui)", fontSize: "var(--type-caption-size)", fontWeight: 700, color: "var(--ink-body)", whiteSpace: "nowrap", ...style }}>
      <span aria-hidden="true" style={{ color: c, fontSize: 9, lineHeight: 1 }}>{GLYPH[status] || "●"}</span>
      {label}
    </span>
  );
}
