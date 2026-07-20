import React from "react";
import { Icon } from "../foundation/Icon.jsx";
// 完全不透明カバー。visibilitychange / blur で自動的に閉じる。
export function PrivacyCover({ covered, onCoveredChange, holdLabel = "長押しで表示", message = "周囲から画面が見えないことを確認してください。", children, minHeight = 320, style }) {
  const [held, setHeld] = React.useState(false);
  React.useEffect(() => {
    const cover = () => { setHeld(false); if (onCoveredChange) onCoveredChange(true); };
    document.addEventListener("visibilitychange", cover);
    window.addEventListener("blur", cover);
    return () => { document.removeEventListener("visibilitychange", cover); window.removeEventListener("blur", cover); };
  }, [onCoveredChange]);
  const open = covered === false || held;
  return (
    <div style={{ position: "relative", minHeight, borderRadius: "var(--radius-3)", overflow: "hidden", fontFamily: "var(--font-ui)", ...style }}>
      <div aria-hidden={!open} style={{ visibility: open ? "visible" : "hidden", height: "100%" }}>{children}</div>
      {!open && (
        <div style={{ position: "absolute", inset: 0, background: "var(--overlay-privacy)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <span style={{ color: "var(--ink-muted)" }}><Icon name="EyeOff" size={28} /></span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--ink-muted)", maxWidth: 240 }}>{message}</p>
          <button type="button"
            onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerLeave={() => setHeld(false)} onPointerCancel={() => setHeld(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setHeld(true); }} onKeyUp={() => setHeld(false)}
            style={{ minHeight: 52, padding: "0 24px", borderRadius: "var(--radius-2)", border: "1px solid var(--rule-strong)", background: "var(--surface-raised)", color: "var(--ink-strong)", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700, cursor: "pointer", WebkitUserSelect: "none", userSelect: "none", touchAction: "none", WebkitTapHighlightColor: "transparent", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="Eye" size={18} />{holdLabel}
          </button>
        </div>
      )}
    </div>
  );
}
