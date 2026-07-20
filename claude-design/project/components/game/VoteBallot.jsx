import React from "react";
import { PlayerTargetSelector } from "./PlayerTargetSelector.jsx";
import { StatusBadge } from "../information/StatusBadge.jsx";
// 裁定 (投票)。自分の投票は Private — submitted 後も他者に見せない。
export function VoteBallot({ players, value, onChange, submitted = false, deadlineNote, style }) {
  return (
    <div style={{ fontFamily: "var(--font-ui)", ...style }}>
      <PlayerTargetSelector players={players.map((p) => ({ ...p, disabled: submitted || p.disabled }))} value={value} onChange={submitted ? undefined : onChange} prompt="生存権の裁定です。追放する対象を 1 人選んでください。" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        {submitted ? <StatusBadge status="success" label="投票を記録しました" /> : <StatusBadge status="neutral" label="未投票" />}
        {deadlineNote && <span style={{ fontSize: "var(--type-caption-size)", color: "var(--ink-muted)" }}>{deadlineNote}</span>}
      </div>
    </div>
  );
}
