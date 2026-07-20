import React from "react";
// 役職カード — 正本は card_viewer.html / current-card-design.md (2026-07-19)。
// 360×640。背景レイヤー + 透過人物レイヤー + タイトルオーバーレイ。
// JP: 左上縦書き LINE Seed JP Bold 38px 字間6px + ルビ。EN: 右上 Cinzel Decorative Black (長さで 22/26/32px)。
const FACTION = {
  citizen: { jp: "市民陣営", en: "Citizen", ink: "var(--faction-citizen-ink)", c: "var(--faction-citizen)" },
  werewolf: { jp: "人狼陣営", en: "Werewolf", ink: "var(--faction-werewolf-ink)", c: "var(--faction-werewolf)" },
  third: { jp: "第三陣営", en: "Others", ink: "var(--faction-third-ink)", c: "var(--faction-third)" },
};
export function RoleCard({ image, background, character, roleName, ruby, roleNameEn, faction = "citizen", accent, summary, width = 280, showFaction = true, showTitles = true, style }) {
  const f = FACTION[faction] || FACTION.citizen;
  const w = typeof width === "number" ? width : 280;
  const k = w / 360; // 正本は 360px 幅基準
  const en = roleNameEn || "";
  const enSize = (en.length > 12 ? 22 : en.length > 8 ? 26 : 32) * k;
  return (
    <figure style={{ margin: 0, width, aspectRatio: "360 / 640", position: "relative", borderRadius: 16 * k, overflow: "hidden",
      background: "var(--surface-sunken)", boxShadow: "var(--shadow-card), inset 0 0 0 1px rgba(255,255,255,0.14)",
      fontFamily: "var(--font-ui)", "--role-accent": accent || f.c, ...style }}>
      {(background || image) && <img src={background || image} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      {character && <img src={character} alt={typeof roleName === "string" ? roleName : ""} style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", height: "94%", width: "auto" }} />}
      {showTitles && (
        <div aria-hidden={!!character} style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", left: 18 * k, top: 16 * k, writingMode: "vertical-rl", fontWeight: 700, fontSize: 38 * k, letterSpacing: 6 * k + "px", lineHeight: 1, color: "#FFFFFF", textShadow: "0 2px 10px rgba(0,0,0,0.55)" }}>
            {ruby ? <ruby>{roleName}<rt style={{ fontSize: 11 * k, letterSpacing: 2 * k + "px", fontWeight: 700, opacity: 0.85 }}>{ruby}</rt></ruby> : roleName}
          </div>
          {en && <div style={{ position: "absolute", right: 16 * k, top: 16 * k, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: enSize, letterSpacing: "0.06em", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.55)", textAlign: "right" }}>{en}</div>}
        </div>
      )}
      {summary && (
        <figcaption style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 12 * k, padding: (12 * k) + "px " + (14 * k) + "px", background: "rgba(10,9,14,0.88)", backdropFilter: "none" }}>
          {showFaction && (
            <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 * k, minWidth: 48 * k }}>
              <span aria-hidden="true" style={{ width: 9 * k, height: 9 * k, transform: "rotate(45deg)", background: "var(--role-accent)" }} />
              <span style={{ fontSize: Math.max(10, 10 * k), fontWeight: 700, color: f.ink, whiteSpace: "nowrap" }}>{f.jp}</span>
            </div>
          )}
          {showFaction && <span style={{ width: 1, alignSelf: "stretch", background: "rgba(237,233,220,0.16)" }} />}
          <p style={{ margin: 0, fontSize: Math.max(11, 12.5 * k), lineHeight: 1.8, color: "rgba(242,239,230,0.92)" }}>{summary}</p>
        </figcaption>
      )}
    </figure>
  );
}
