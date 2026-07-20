import React from "react";
// 不可逆操作 (投票確定・処刑執行など) の長押し確定。誤操作防止の要。
export function HoldToConfirm({ label, hint = "長押しで確定", duration = 900, variant = "danger", disabled, onConfirm, full = true, style }) {
  const [p, setP] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const raf = React.useRef(null); const t0 = React.useRef(0);
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; setP(0); };
  const fire = () => { setDone(true); setP(1); if (onConfirm) onConfirm(); };
  const start = () => {
    if (disabled || done) return;
    if (reduced) { fire(); return; }
    t0.current = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0.current) / duration);
      setP(k);
      if (k >= 1) { raf.current = null; fire(); } else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const release = () => { if (!done) stop(); };
  const color = variant === "danger" ? "var(--status-danger)" : "var(--accent)";
  const onColor = variant === "danger" ? "#F5EDE9" : "var(--accent-ink-on)";
  return (
    <button type="button" disabled={disabled} aria-label={label + "（" + hint + "）"}
      onPointerDown={start} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(); }}
      onKeyUp={release}
      style={{ position: "relative", overflow: "hidden", minHeight: 52, width: full ? "100%" : undefined, padding: "0 20px",
        borderRadius: "var(--radius-2)", border: "1px solid " + (disabled ? "var(--rule)" : color),
        background: "transparent", color: disabled ? "var(--status-disabled-ink)" : done ? onColor : color,
        fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none", userSelect: "none", touchAction: "none", ...style }}>
      <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: color, transformOrigin: "left", transform: "scaleX(" + p + ")", transition: done ? "none" : p === 0 ? "transform var(--t-micro) var(--ease-out)" : "none" }} />
      <span style={{ position: "relative", mixBlendMode: done ? "normal" : undefined, color: p > 0.45 || done ? onColor : undefined, display: "inline-flex", alignItems: "center", gap: 8 }}>
        {done ? "記録しました" : label}
        {!done && <span style={{ fontSize: "var(--type-caption-size)", fontWeight: 400, opacity: 0.8 }}>{hint}</span>}
      </span>
    </button>
  );
}
