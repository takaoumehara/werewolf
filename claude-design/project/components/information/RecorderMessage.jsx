import React from "react";
// 記録者 (GM AI) の発話。静か・正確・中立・短い。
export function RecorderMessage({ text, sub, tone = "neutral", compact = false, style }) {
  const accent = tone === "urgent" ? "var(--status-warning)" : "var(--accent)";
  return (
    <figure style={{ margin: 0, padding: compact ? "10px 14px" : "14px 16px", background: "var(--surface-raised)", borderRadius: "var(--radius-2)", borderLeft: "2px solid " + accent, boxShadow: "var(--shadow-raised)", fontFamily: "var(--font-ui)", ...style }}>
      <figcaption style={{ fontSize: "var(--type-caption-size)", fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-muted)", marginBottom: 4 }}>記録者</figcaption>
      <div style={{ fontSize: "var(--type-body-size)", lineHeight: "var(--type-body-lh)", color: "var(--ink-strong)" }}>{text}</div>
      {sub && <div style={{ marginTop: 4, fontSize: "var(--type-caption-size)", lineHeight: 1.55, color: "var(--ink-muted)" }}>{sub}</div>}
    </figure>
  );
}
