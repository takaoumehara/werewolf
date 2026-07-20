import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { Button } from "../actions/Button.jsx";
const reconnectPulseCss = "@keyframes km-pulse{0%,100%{opacity:.35}50%{opacity:1}}@media (prefers-reduced-motion: reduce){.km-pulse{animation:none !important;opacity:1}}";
export function ReconnectOverlay({ state = "reconnecting", attempt, onRetry, style }) {
  const failed = state === "failed";
  return (
    <div role="alert" style={{ position: "absolute", inset: 0, zIndex: 50, background: "var(--overlay-scrim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-ui)", ...style }}>
      <style>{reconnectPulseCss}</style>
      <div style={{ width: "100%", maxWidth: 320, background: "var(--surface-raised)", borderRadius: "var(--radius-3)", border: "1px solid var(--rule-strong)", boxShadow: "var(--shadow-modal)", padding: "28px 24px", textAlign: "center" }}>
        <span className={failed ? "" : "km-pulse"} style={{ display: "inline-flex", color: failed ? "var(--status-offline)" : "var(--status-reconnecting)", animation: failed ? "none" : "km-pulse 1.6s var(--ease-inout) infinite" }}>
          <Icon name={failed ? "WifiOff" : "RefreshCw"} size={30} />
        </span>
        <div style={{ marginTop: 12, fontSize: "var(--type-heading-size)", fontWeight: 700, color: "var(--ink-strong)" }}>
          {failed ? "接続できませんでした。" : "接続を復旧しています。"}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.7, color: "var(--ink-muted)" }}>
          {failed ? "電波の届く場所で、もう一度お試しください。あなたの入力は保存されています。" : "入力済みの内容は保存されています。ゲームはあなたの復帰を待ちます。"}
        </p>
        {attempt != null && !failed && <div style={{ marginTop: 8, fontSize: "var(--type-caption-size)", color: "var(--ink-faint)", fontFamily: "var(--font-code)" }}>再試行 {attempt} 回目</div>}
        {failed && <div style={{ marginTop: 16 }}><Button full variant="secondary" onClick={onRetry}>もう一度接続する</Button></div>}
      </div>
    </div>
  );
}
