import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { PhaseHeader } from "../../components/information/PhaseHeader.jsx";
import { CountdownTimer } from "../../components/information/CountdownTimer.jsx";
import { RecorderMessage } from "../../components/information/RecorderMessage.jsx";
import { PlayerTargetSelector } from "../../components/game/PlayerTargetSelector.jsx";
import { HoldToConfirm } from "../../components/actions/HoldToConfirm.jsx";
import { WaitingCount } from "../../components/information/WaitingCount.jsx";
import { Toast } from "../../components/information/Toast.jsx";
// 夜: 役職に関わらず同一の骨格。確定後は待機表示のみ。
export function NightScreen({ lang = "jp" }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  const [target, setTarget] = React.useState(null);
  const [sent, setSent] = React.useState(false);
  const players = [
    { id: 2, name: "ゆき" }, { id: 3, name: "Ken" }, { id: 4, name: "あおい" }, { id: 5, name: "みなと" },
  ];
  return (
    <AppShell phase="night" style={{ height: "100%", position: "relative" }}>
      <PhaseHeader phase="night" dayCount={2} title={T("個別指令", "Night Order")} right={<CountdownTimer seconds={64} total={90} />} />
      <RecorderMessage text={T("対象を 1 人選んでください。", "Choose one target.")} compact />
      <div style={{ marginTop: 12, flex: 1 }}>
        {!sent ? (
          <PlayerTargetSelector players={players} value={target} onChange={setTarget} prompt="" />
        ) : (
          <div style={{ paddingTop: 24 }}>
            <WaitingCount done={6} total={8} label={T("あと 2 人の入力を待っています。", "Waiting for 2 more inputs.")} />
            <p style={{ fontSize: "var(--type-caption-size)", lineHeight: 1.6, color: "var(--ink-faint)", marginTop: 12 }}>
              {T("この画面は全員に同じ外観で表示されます。", "This screen looks identical on every device.")}
            </p>
          </div>
        )}
      </div>
      {!sent && (
        <HoldToConfirm variant="primary" disabled={target == null} label={T("選択を記録する", "Record Selection")} hint={T("長押しで確定", "hold to confirm")} onConfirm={() => setSent(true)} />
      )}
      <Toast open={sent} text={T("選択を記録しました。", "Selection recorded.")} />
    </AppShell>
  );
}
