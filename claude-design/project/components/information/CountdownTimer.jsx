import React from "react";
export function CountdownTimer({ seconds, total, warnAt = 30, dangerAt = 10, size = "md", label, style }) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const color = s <= dangerAt ? "var(--status-danger)" : s <= warnAt ? "var(--status-warning)" : "var(--ink-strong)";
  const big = size === "lg";
  return (
    <div role="timer" aria-live={s <= warnAt ? "assertive" : "off"} aria-label={(label || "残り時間") + " " + mm + "分" + ss + "秒"} style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: big ? "center" : "flex-end", fontFamily: "var(--font-ui)", ...style }}>
      {label && <div style={{ fontSize: "var(--type-caption-size)", color: "var(--ink-muted)" }}>{label}</div>}
      <div style={{ fontFamily: "var(--font-code)", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: big ? "var(--type-timer-size)" : 22, lineHeight: 1, letterSpacing: "0.03em", color, transition: "color var(--t-micro) var(--ease-out)" }}>{mm}:{ss}</div>
      {total > 0 && <div aria-hidden="true" style={{ width: big ? 160 : 72, height: 3, borderRadius: 2, background: "var(--rule)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: (Math.max(0, Math.min(1, s / total)) * 100) + "%", background: color, transition: "width 1s linear" }} />
      </div>}
    </div>
  );
}
