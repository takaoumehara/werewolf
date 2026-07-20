import React from "react";
import { PlayerRow } from "./PlayerRow.jsx";
export function PlayerList({ players, selectedId, onSelect, style }) {
  return (
    <div role={onSelect ? "listbox" : "list"} style={{ display: "flex", flexDirection: "column", ...style }}>
      {players.map((p, i) => (
        <React.Fragment key={p.id != null ? p.id : i}>
          {i > 0 && <div aria-hidden="true" style={{ height: 1, background: "var(--rule)", margin: "0 12px" }} />}
          <PlayerRow {...p} selected={selectedId != null && p.id === selectedId} onSelect={onSelect && !p.disabled ? () => onSelect(p.id) : undefined} />
        </React.Fragment>
      ))}
    </div>
  );
}
