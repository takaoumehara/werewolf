import React from "react";
import { PhaseBackdrop } from "../foundation/PhaseBackdrop.jsx";
import { Button } from "../actions/Button.jsx";
// 儀式的な全画面開示 (処刑結果・勝敗・役職開示)。reveal motion (1400ms) を使う唯一の場所。
export function FullScreenReveal({ open, image, kicker, title, children, continueLabel = "確認しました", onContinue, style }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => { if (open) { const t = setTimeout(() => setShown(true), 30); return () => clearTimeout(t); } setShown(false); }, [open]);
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, fontFamily: "var(--font-ui)", ...style }}>
      <PhaseBackdrop image={image} gradient={!!image} style={{ height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center",
          opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(12px)", transition: "opacity var(--t-reveal) var(--ease-ritual), transform var(--t-reveal) var(--ease-ritual)" }}>
          {kicker && <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.12em", color: "var(--accent)" }}>{kicker}</div>}
          <h1 style={{ margin: "10px 0 0", fontSize: "var(--type-display-size)", lineHeight: "var(--type-display-lh)", fontWeight: 800, color: "#F2EFE6", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>{title}</h1>
          <div style={{ marginTop: 20, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>{children}</div>
        </div>
        {onContinue && <div style={{ padding: "0 20px calc(var(--safe-bottom) + 20px)" }}><Button full size="lg" variant="secondary" onClick={onContinue} style={{ background: "rgba(7,6,10,0.5)" }}>{continueLabel}</Button></div>}
      </PhaseBackdrop>
    </div>
  );
}
