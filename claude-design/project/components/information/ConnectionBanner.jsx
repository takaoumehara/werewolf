import React from "react";
import { Icon } from "../foundation/Icon.jsx";
const pulseCss = "@keyframes km-pulse{0%,100%{opacity:.35}50%{opacity:1}}@media (prefers-reduced-motion: reduce){.km-pulse{animation:none !important;opacity:1}}";
export function ConnectionBanner({ state = "reconnecting", compact = false, detail, style }) {
  const M = {
    offline: { icon: "WifiOff", c: "var(--status-offline)", jp: "接続が切れました。", d: "電波の届く場所で自動的に再接続します。" },
    reconnecting: { icon: "RefreshCw", c: "var(--status-reconnecting)", jp: "接続を復旧しています。", d: "入力済みの内容は保存されています。" },
    restored: { icon: "Wifi", c: "var(--status-success)", jp: "接続が復旧しました。", d: "" },
  }[state];
  if (compact) {
    return (
      <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-ui)", fontSize: "var(--type-caption-size)", fontWeight: 700, color: M.c, ...style }}>
        <style>{pulseCss}</style>
        <span className={state === "reconnecting" ? "km-pulse" : ""} style={{ display: "inline-flex", animation: state === "reconnecting" ? "km-pulse 1.6s var(--ease-inout) infinite" : "none" }}><Icon name={M.icon} size={16} /></span>
        {M.jp}
      </span>
    );
  }
  return (
    <div role="status" aria-live="assertive" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", background: "var(--surface-raised)", borderBottom: "1px solid var(--rule-strong)", borderTop: "2px solid " + M.c, fontFamily: "var(--font-ui)", ...style }}>
      <style>{pulseCss}</style>
      <span className={state === "reconnecting" ? "km-pulse" : ""} style={{ color: M.c, display: "inline-flex", marginTop: 1, animation: state === "reconnecting" ? "km-pulse 1.6s var(--ease-inout) infinite" : "none" }}><Icon name={M.icon} size={18} /></span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-strong)" }}>{M.jp}</div>
        {(detail || M.d) && <div style={{ fontSize: "var(--type-caption-size)", lineHeight: 1.55, color: "var(--ink-muted)", marginTop: 2 }}>{detail || M.d}</div>}
      </div>
    </div>
  );
}
