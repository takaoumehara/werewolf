import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { FullScreenReveal } from "../../components/overlays/FullScreenReveal.jsx";
import { Button } from "../../components/actions/Button.jsx";
// 終局: 役職名簿の公開 (この時点で faction 色は公開してよい)
export function VictoryScreen({ lang = "jp" }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  const roster = [
    { name: "たかお", role: T("騎士団", "Knight"), f: "citizen" },
    { name: "ゆき", role: T("人狼", "Werewolf"), f: "werewolf" },
    { name: "Ken", role: T("予言者", "Seer"), f: "citizen" },
    { name: "あおい", role: T("市民", "Citizen"), f: "citizen" },
    { name: "みなと", role: T("妖狐", "Fox"), f: "third" },
  ];
  const FC = { citizen: "var(--faction-citizen-ink)", werewolf: "var(--faction-werewolf-ink)", third: "var(--faction-third-ink)" };
  return (
    <AppShell phase="finished" pad={false} style={{ height: "100%", position: "relative" }}>
      <FullScreenReveal open image="../../assets/backgrounds/bg-07.png" kicker="The Last Dawn" title={T("市民陣営の勝利", "The Citizens Prevail")}>
        <div style={{ width: "100%", maxWidth: 300, background: "rgba(7,6,10,0.62)", border: "1px solid var(--rule)", borderRadius: "var(--radius-3)", padding: "8px 14px", textAlign: "left" }}>
          {roster.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--rule)" : "none" }}>
              <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: FC[r.f], flex: "none" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F2EFE6", flex: 1, overflowWrap: "anywhere" }}>{r.name}</span>
              <span style={{ fontSize: 13, color: FC[r.f] }}>{r.role}</span>
            </div>
          ))}
        </div>
        <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
          <Button full size="lg" variant="primary">{T("もう一度遊ぶ", "Play Again")}</Button>
          <Button full variant="quiet" style={{ color: "rgba(242,239,230,0.75)" }}>{T("記録を閉じる", "Close the Record")}</Button>
        </div>
      </FullScreenReveal>
    </AppShell>
  );
}
