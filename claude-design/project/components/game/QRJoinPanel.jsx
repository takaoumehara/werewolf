import React from "react";
import { RoomCode } from "./RoomCode.jsx";
// QR は白地 + quiet zone を厳守 (読み取りコントラスト)。
export function QRJoinPanel({ url, code, hint = "カメラで読み取るか、コードを入力してください。", style }) {
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=" + encodeURIComponent(url || "");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 20px", borderRadius: "var(--radius-3)", background: "var(--surface-raised)", border: "1px solid var(--rule)", boxShadow: "var(--shadow-raised)", fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ background: "#FFFFFF", padding: 14, borderRadius: "var(--radius-2)" }}>
        <img src={qr} alt={"参加用 QR コード。" + hint} width="180" height="180" style={{ display: "block" }} />
      </div>
      {code && <RoomCode code={code} />}
      <p style={{ margin: 0, fontSize: "var(--type-caption-size)", lineHeight: 1.6, color: "var(--ink-muted)", textAlign: "center", maxWidth: 260 }}>{hint}</p>
    </div>
  );
}
