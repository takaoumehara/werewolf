import React from "react";
import { Icon } from "../foundation/Icon.jsx";
export function IconButton({ name, label, variant = "quiet", size = 44, disabled, onClick, style }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button type="button" aria-label={label} title={label} onClick={disabled ? undefined : onClick} disabled={disabled}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-2)", borderWidth: 1, borderStyle: "solid",
        borderColor: variant === "secondary" ? "var(--rule-strong)" : "transparent",
        background: "transparent", color: disabled ? "var(--status-disabled-ink)" : "var(--ink-muted)",
        cursor: disabled ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent",
        transition: "transform var(--t-instant) var(--ease-out)", transform: pressed && !disabled ? "scale(0.94)" : "none", ...style }}>
      <Icon name={name} size={22} />
    </button>
  );
}
