import React from "react";
// モバイル画面の共通シェル: phase mode + safe area + 最大幅 430px
export function AppShell({ phase = "night", children, pad = true, style }) {
  return (
    <div data-phase={phase} style={{ minHeight: "100%", background: "var(--surface-page)", color: "var(--ink-body)", fontFamily: "var(--font-ui)", display: "flex", flexDirection: "column", transition: "background var(--t-phase) var(--ease-ritual)", ...style }}>
      <div style={{ width: "100%", maxWidth: "var(--content-max)", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", paddingTop: "calc(var(--safe-top) + " + (pad ? "12px" : "0px") + ")", paddingBottom: "calc(var(--safe-bottom) + " + (pad ? "16px" : "0px") + ")", paddingLeft: pad ? "var(--page-pad)" : 0, paddingRight: pad ? "var(--page-pad)" : 0, boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}
