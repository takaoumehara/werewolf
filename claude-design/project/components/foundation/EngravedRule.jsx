import React from "react";
// 刻印罫線: 暗い線 + 直下の内側ハイライト
export function EngravedRule({ spacing = "var(--space-4)", style }) {
  return <div role="separator" style={{ height: 2, margin: spacing + " 0", background: "rgba(0,0,0,0.55)", boxShadow: "0 1px 0 var(--edge-highlight)", ...style }} />;
}
