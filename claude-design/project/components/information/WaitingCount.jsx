import React from "react";
// 「あと N 人」— 終わりの見える待機表示。無限スピナーを使わない。
export function WaitingCount({ done, total, label, style }) {
  const remain = Math.max(0, total - done);
  return (
    <div role="status" style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < done ? "var(--accent)" : "var(--rule)", transition: "background var(--t-micro) var(--ease-out)" }} />
        ))}
      </div>
      <div style={{ fontSize: "var(--type-body-size)", color: "var(--ink-body)" }}>
        {label || (remain === 0 ? "全員の入力を記録しました。" : "あと " + remain + " 人の入力を待っています。")}
        <span style={{ color: "var(--ink-muted)", fontSize: "var(--type-caption-size)", marginLeft: 8, fontFamily: "var(--font-code)" }}>{done}/{total}</span>
      </div>
    </div>
  );
}
