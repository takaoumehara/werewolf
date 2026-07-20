import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { PhaseHeader } from "../../components/information/PhaseHeader.jsx";
import { CountdownTimer } from "../../components/information/CountdownTimer.jsx";
import { RecorderMessage } from "../../components/information/RecorderMessage.jsx";
import { PlayerList } from "../../components/game/PlayerList.jsx";
import { VoteBallot } from "../../components/game/VoteBallot.jsx";
import { HoldToConfirm } from "../../components/actions/HoldToConfirm.jsx";
import { Button } from "../../components/actions/Button.jsx";
import { WaitingCount } from "../../components/information/WaitingCount.jsx";
export function DayScreen({ lang = "jp" }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  const [view, setView] = React.useState("council"); // council | vote
  const [v, setV] = React.useState(null);
  const [sent, setSent] = React.useState(false);
  const players = [
    { id: 1, name: "たかお", me: true }, { id: 2, name: "ゆき" }, { id: 3, name: "Ken" },
    { id: 4, name: "あおい", connection: "reconnecting" }, { id: 5, name: "みなと" }, { id: 6, name: "はるか", alive: false },
  ];
  const alive = players.filter((p) => p.alive !== false && !p.me);
  return (
    <AppShell phase="day" style={{ height: "100%" }}>
      <PhaseHeader phase="day" dayCount={2} title={view === "council" ? T("評議を開始します。", "The council begins.") : T("生存権の裁定", "The Verdict")} right={<CountdownTimer seconds={172} total={300} />} />
      {view === "council" ? (
        <React.Fragment>
          <RecorderMessage text={T("昨夜、はるか の記録が途絶えました。評議で追放する 1 人を決めてください。", "Last night, Haruka's record ended. Decide one resident to exile.")} />
          <div style={{ marginTop: 12, fontSize: "var(--type-caption-size)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-muted)" }}>{T("生存している住民", "Living Residents")}　5/6</div>
          <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-3)", padding: 4, marginTop: 6, flex: 1, overflowY: "auto" }}>
            <PlayerList players={players} />
          </div>
          <div style={{ paddingTop: 14 }}>
            <Button full size="lg" variant="primary" onClick={() => setView("vote")}>{T("投票へ進む", "Proceed to Vote")}</Button>
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <VoteBallot players={alive} value={v} onChange={setV} submitted={sent} deadlineNote={sent ? T("締切まで変更できます", "You can change until the deadline") : undefined} />
            {sent && <div style={{ marginTop: 14 }}><WaitingCount done={4} total={5} label={T("あと 1 人の入力を待っています。", "Waiting for 1 more input.")} /></div>}
          </div>
          {!sent ? (
            <HoldToConfirm label={T("この投票を確定する", "Confirm This Vote")} hint={T("長押しで確定", "hold to confirm")} disabled={v == null} onConfirm={() => setSent(true)} />
          ) : (
            <Button full variant="quiet" onClick={() => setSent(false)}>{T("投票をやり直す", "Change My Vote")}</Button>
          )}
        </React.Fragment>
      )}
    </AppShell>
  );
}
