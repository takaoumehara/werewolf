import React from "react";
import { PlayerList } from "./PlayerList.jsx";
// 夜の対象選択。役職に関わらず同一の外観骨格を使う (Secrecy)。
export function PlayerTargetSelector({ players, value, onChange, prompt = "対象を 1 人選んでください。", style }) {
  return (
    <div style={{ fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ fontSize: "var(--type-body-size)", color: "var(--ink-body)", marginBottom: 8 }}>{prompt}</div>
      <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-3)", padding: 4, background: "var(--surface-sunken)" }}>
        <PlayerList players={players} selectedId={value} onSelect={onChange} />
      </div>
    </div>
  );
}
