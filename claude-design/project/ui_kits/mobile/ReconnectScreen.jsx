import React from "react";
import { AppShell } from "../../components/foundation/AppShell.jsx";
import { PhaseHeader } from "../../components/information/PhaseHeader.jsx";
import { RecorderMessage } from "../../components/information/RecorderMessage.jsx";
import { ConnectionBanner } from "../../components/information/ConnectionBanner.jsx";
import { ReconnectOverlay } from "../../components/overlays/ReconnectOverlay.jsx";
export function ReconnectScreen({ lang = "jp" }) {
  const T = (jp, en) => (lang === "en" ? en : jp);
  return (
    <AppShell phase="day" pad={false} style={{ height: "100%", position: "relative" }}>
      <ConnectionBanner state="offline" detail={T("電波の届く場所で自動的に再接続します。", "Reconnects automatically when signal returns.")} />
      <div style={{ padding: "12px var(--page-pad)", filter: "grayscale(0.4)", opacity: 0.6 }}>
        <PhaseHeader phase="day" dayCount={2} title={T("評議を開始します。", "The council begins.")} />
        <RecorderMessage text={T("評議を開始します。", "The council begins.")} compact />
      </div>
      <ReconnectOverlay state="reconnecting" attempt={2} />
    </AppShell>
  );
}
