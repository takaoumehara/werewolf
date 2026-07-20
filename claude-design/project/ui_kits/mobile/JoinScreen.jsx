import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { SegmentedControl } from "../../components/actions/SegmentedControl.jsx";
import { QRJoinPanel } from "../../components/game/QRJoinPanel.jsx";
import { PlayerList } from "../../components/game/PlayerList.jsx";
import { Button } from "../../components/actions/Button.jsx";
import { EngravedRule } from "../../components/foundation/EngravedRule.jsx";
export function JoinScreen({ lang = "jp", onLangChange }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  const players = [
    { id: 1, name: "たかお", me: true, ready: true },
    { id: 2, name: "ゆき", ready: true },
    { id: 3, name: "Ken", ready: true },
    { id: 4, name: "あおい", ready: false },
    { id: 5, name: "みなと", ready: false },
  ];
  return (
    <AppShell phase="night" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, letterSpacing: "0.05em", color: "var(--ink-strong)" }}>Kirokumō</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.4em", color: "var(--ink-muted)" }}>記録網</div>
        </div>
        <SegmentedControl options={[{ value: "jp", label: "日本語" }, { value: "en", label: "English" }]} value={lang} onChange={onLangChange} />
      </div>
      <EngravedRule spacing="var(--space-3)" />
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-muted)", marginBottom: 12 }}>
        {T("同じ避難区画の住民を名簿へ登録します。", "Register residents of this shelter block to the roster.")}
      </div>
      <QRJoinPanel url="https://kirokumo.example/join/834107" code="834107" hint={T("カメラで読み取るか、コードを入力してください。", "Scan with a camera, or enter the code.")} />
      <div style={{ marginTop: 16, fontSize: "var(--type-caption-size)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-muted)" }}>
        {T("名簿", "Roster")}　5/8
      </div>
      <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-3)", padding: 4, marginTop: 6 }}>
        <PlayerList players={players.map((p) => ({ ...p, ready: undefined, right: p.ready ? undefined : undefined }))} />
      </div>
      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <Button full size="lg" variant="primary">{T("準備ができました", "I Am Ready")}</Button>
      </div>
    </AppShell>
  );
}
