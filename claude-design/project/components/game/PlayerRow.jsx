import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { StatusBadge } from "../information/StatusBadge.jsx";
// 公開コンテキスト: 役職情報を一切持たない。
export function PlayerRow({ name, me = false, alive = true, connection = "online", ready, right, selected = false, onSelect, style }) {
  const clickable = !!onSelect;
  return (
    <div role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined} aria-pressed={clickable ? selected : undefined}
      onClick={onSelect} onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(); } }}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "6px 12px", borderRadius: "var(--radius-2)",
        border: selected ? "1px solid var(--accent)" : "1px solid transparent",
        boxShadow: selected ? "var(--focus-ring)" : "none",
        background: selected ? "var(--surface-raised)" : "transparent",
        opacity: alive ? 1 : 0.5, cursor: clickable ? "pointer" : "default",
        transition: "background var(--t-micro) var(--ease-out), border-color var(--t-micro) var(--ease-out)",
        fontFamily: "var(--font-ui)", WebkitTapHighlightColor: "transparent", ...style }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", flex: "none", background: "var(--surface-sunken)", border: "1px solid var(--rule-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--ink-muted)", textDecoration: alive ? "none" : "line-through" }}>
        {alive ? String(typeof name === "string" ? name : "?").slice(0, 1) : <Icon name="X" size={16} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-strong)", overflowWrap: "anywhere", lineHeight: 1.4 }}>
          {name}{me && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: "var(--radius-1)", padding: "1px 5px", verticalAlign: "2px" }}>あなた</span>}
        </div>
        {!alive && <div style={{ fontSize: "var(--type-caption-size)", color: "var(--ink-faint)" }}>脱落</div>}
      </div>
      {connection === "offline" && <StatusBadge status="offline" label="切断" />}
      {connection === "reconnecting" && <StatusBadge status="reconnecting" label="復旧中" />}
      {ready === true && <StatusBadge status="success" label="記録済" />}
      {ready === false && <StatusBadge status="neutral" label="入力待ち" />}
      {right}
      {selected && <span style={{ color: "var(--accent)", display: "inline-flex" }}><Icon name="Check" size={18} /></span>}
    </div>
  );
}
