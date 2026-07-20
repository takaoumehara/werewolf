import React from "react";
export function RoomCode({ code, label = "参加コード", size = "lg", style }) {
  const groups = String(code).replace(/\s/g, "").match(/.{1,2}/g) || [];
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: "center", fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ fontSize: "var(--type-caption-size)", fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-muted)" }}>{label}</div>
      <div aria-label={label + " " + String(code).split("").join(" ")} style={{ display: "flex", gap: 10, padding: size === "lg" ? "12px 18px" : "8px 12px", borderRadius: "var(--radius-2)", background: "var(--surface-field)", border: "1px solid var(--rule-strong)", boxShadow: "var(--engraved-rule)" }}>
        {groups.map((g, i) => (
          <span key={i} style={{ fontFamily: "var(--font-code)", fontWeight: 600, fontSize: size === "lg" ? 30 : 20, letterSpacing: "0.14em", color: "var(--ink-strong)", fontVariantNumeric: "tabular-nums" }}>{g}</span>
        ))}
      </div>
    </div>
  );
}
