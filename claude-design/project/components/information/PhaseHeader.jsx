import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { EngravedRule } from "../foundation/EngravedRule.jsx";
const META = {
  day: { icon: "Sun", jp: "昼 — 公開評議", en: "Day Council" },
  night: { icon: "Moon", jp: "夜 — 一斉消灯", en: "Night" },
  dawn: { icon: "Sunrise", jp: "夜明け", en: "Dawn" },
  verdict: { icon: "Scale", jp: "裁定 — 投票", en: "The Verdict" },
  finished: { icon: "Flag", jp: "終局", en: "Finished" },
};
export function PhaseHeader({ phase = "day", dayCount, title, subtitle, right, style }) {
  const m = META[phase] || META.day;
  return (
    <header style={{ fontFamily: "var(--font-ui)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={m.icon} size={16} color="var(--accent)" />
        <div style={{ fontSize: "var(--type-caption-size)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--accent)" }}>
          {dayCount != null && ("第 " + dayCount + " 日　")}{m.jp}
        </div>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      <h1 style={{ margin: "6px 0 0", fontSize: "var(--type-title-size)", lineHeight: "var(--type-title-lh)", fontWeight: 800, color: "var(--ink-strong)" }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", fontSize: "var(--type-body-size)", lineHeight: 1.6, color: "var(--ink-muted)" }}>{subtitle}</p>}
      <EngravedRule spacing="var(--space-3)" />
    </header>
  );
}
