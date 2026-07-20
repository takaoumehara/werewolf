---
name: kirokumo-design
description: Use this skill to generate well-branded interfaces and assets for 記録網 (Kirokumō) — a mobile companion werewolf party game set in a post-apocalyptic dark-fantasy / retro-futuristic medieval world. Contains design principles, tokens (colors, type, spacing, shape, motion, phase modes), role-card and background illustrations, and mobile UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key rules to enforce:
- Default phase is night (dark). Switch surfaces via data-phase: day / night / dawn / verdict / finished.
- LINE Seed JP for UI text; Cinzel Decorative (Title Case only, never all caps) for English display; IBM Plex Mono for codes/timers.
- Faction colors (citizen/werewolf/third) appear ONLY in private or reveal contexts — never in public UI; night screens look identical for every role.
- Secret content is covered by fully opaque overlays (no blur), revealed only while holding.
- Recorder (GM AI) copy: quiet, precise, neutral, short. e.g. 「選択を記録しました。」 Never threats, never vague errors.
- Minimum 12px text, 44×44px touch targets, WCAG AA contrast, prefers-reduced-motion alternatives.
