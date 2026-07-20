import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { Button } from "../actions/Button.jsx";
const ICONS = { info: "Info", warning: "AlertTriangle", danger: "AlertTriangle", success: "Check" };
export function InlineNotice({ tone = "info", title, body, actions, style }) {
  const c = "var(--status-" + (tone === "success" ? "success" : tone) + ")";
  return (
    <div role={tone === "danger" ? "alert" : "note"} style={{ padding: "14px 16px", borderRadius: "var(--radius-2)", border: "1px solid var(--rule)", borderLeft: "2px solid " + c, background: "var(--surface-raised)", fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ color: c, display: "inline-flex", marginTop: 2 }}><Icon name={ICONS[tone]} size={16} /></span>
        <div style={{ flex: 1 }}>
          {title && <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-strong)" }}>{title}</div>}
          {body && <div style={{ fontSize: "var(--type-caption-size)", lineHeight: 1.6, color: "var(--ink-muted)", marginTop: title ? 3 : 0 }}>{body}</div>}
          {actions && actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {actions.map((a, i) => <Button key={i} size="md" variant={a.variant || (i === 0 ? "secondary" : "quiet")} onClick={a.onClick}>{a.label}</Button>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
