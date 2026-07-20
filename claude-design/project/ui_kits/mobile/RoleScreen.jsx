import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { PhaseHeader } from "../../components/information/PhaseHeader.jsx";
import { RecorderMessage } from "../../components/information/RecorderMessage.jsx";
import { PrivacyCover } from "../../components/game/PrivacyCover.jsx";
import { RoleCard } from "../../components/game/RoleCard.jsx";
import { Button } from "../../components/actions/Button.jsx";
export function RoleScreen({ lang = "jp" }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  const [ack, setAck] = React.useState(false);
  return (
    <AppShell phase="night" style={{ height: "100%" }}>
      <PhaseHeader phase="night" title={T("機密記録の閲覧", "Sealed Record")} subtitle={T("この記録はあなただけが閲覧できます。", "Only you may read this record.")} />
      <RecorderMessage text={T("記録を確認してください。", "Please confirm your record.")} compact />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
        <PrivacyCover minHeight={340} message={T("周囲から画面が見えないことを確認してください。", "Make sure no one around you can see this screen.")} holdLabel={T("長押しで表示", "Hold to reveal")} style={{ width: 230 }}>
          <RoleCard image="../../assets/roles/role-15.png" roleName="騎士団" ruby="きしだん" roleNameEn="Knights" faction="citizen" summary={T("夜、対象を 1 人選んで襲撃から守る。", "Each night, guard one resident from the attack.")} width="100%" />
        </PrivacyCover>
      </div>
      <Button full size="lg" variant={ack ? "secondary" : "primary"} onClick={() => setAck(true)}>
        {ack ? T("確認済み — 全員を待っています", "Confirmed — waiting for others") : T("確認しました", "I Have Confirmed")}
      </Button>
    </AppShell>
  );
}
