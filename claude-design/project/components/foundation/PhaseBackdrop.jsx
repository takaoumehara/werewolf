import React from "react";
// 儀式画面用の背景: イラスト + scrim。通常画面では使わない。
export function PhaseBackdrop({ image, scrim = "var(--overlay-scrim)", gradient = false, children, style }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100%", display: "flex", flexDirection: "column", ...style }}>
      {image && <img src={image} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: gradient ? "var(--overlay-reveal)" : scrim }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
