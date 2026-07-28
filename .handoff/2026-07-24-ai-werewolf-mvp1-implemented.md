# AIハイブリッド人狼 MVP1 — 実装完了ハンドオフ

## Resume Capsule

Project: 人狼ゲーム
Handoff: .handoff/2026-07-24-ai-werewolf-mvp1-implemented.md
Passphrase: "人狼ゲーム: 三日月に囁くAIの席"
Goal: 既存の対面スマホ人狼にAIプレイヤーを足す（MVP1 ソロAI対戦）を実装
State: 全17タスク実装＋レビュー完了。unit 62/62・build・a11y/mobileテスト緑。エミュレータ・スモーク通過。未merge
Next: 本番前に `firebase functions:secrets:set ANTHROPIC_API_KEY` を設定（鍵はコミット禁止）
Read first: docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md / .superpowers/sdd/progress.md
Running: none

## Passphrase
`人狼ゲーム: 三日月に囁くAIの席`

## What was done
subagent-driven-development で [docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md](../docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md) を全17タスク実装。branch `mobile-ui-design-system`（tip `4ede362`、未merge）。
- 決定論ブレイン: `game-engine/src/ai-brain.mjs`（+ test）。意思決定は全てここ、LLMは言語化のみ。
- 発話層: `functions/ai/`（roster/prompt/validate/llm[Claude Haiku]/context/orchestrator、各 *.test.mjs）。
- サーバー権威: `functions/index.js` に `applyServerCommand`（AI用・人間経路のuid固定は不変）＋ `seatAiPlayers`/`advanceAiTurn`＋`defineSecret`。`database.rules.json` に chat/aiPlayers ルール。
- client: `game-client/firebase-game-client.mjs`（seatAiPlayers/advanceAiTurn/postChat/onChat）。
- フロント: `mobile_app.html`（s02 ソロ入口＋s02b 卓設定、s14 チャットUI、hostDriver AI駆動＋resolveゲート、solo構成を3役職にクランプ）。
- a11y: `design-system.css`（コントラスト是正・:focus-visible・44pxタップ）＋ `tests/contrast_check.mjs`（design_system_test に統合）。
- 進捗＋フォローアップ小課題は `.superpowers/sdd/progress.md` 末尾。

## Current state
- 検証済み: unit 62/62 pass、functions esbuild成功、design_system+contrast緑、mobile_app_test緑。Functionsエミュレータ・スモーク走行（seatAiPlayers→AI3体、advanceAiTurn(night)→actions:3）。Part別＋最終Opus全体レビュー通過（検出バグ全修正: rematchゲート/solo+人間GMデッドロック/solo役職クランプ）。
- 未検証: 人手のソロE2E（create→seat→夜→昼chat→投票→決着）を実機/エミュレータで通していない。本番の実LLM発話は未確認（鍵未設定）。
- 未実施: main へ未merge。ANTHROPIC_API_KEY シークレット未設定。

## Running state
none — バックグラウンドプロセス・devサーバー・worktree いずれも無し。エミュレータは各スモーク後に停止済み。

## Next concrete step
本番前に `firebase functions:secrets:set ANTHROPIC_API_KEY` を設定（鍵はリポジトリ/design/AI資料に絶対保存しない）。その後、エミュレータで人手のソロE2Eを1回通す。

## Follow-ups / 判断が要る点
- merge/PR 判断: `mobile-ui-design-system` → `main`（保護ブランチ＋並行セッションの絡み）。
- 並行セッションが local `main`（未push）に i18n(`e35d03f`) と orphan C1(`018c08a`) を残置。main整理は保留（保護ブランチ・要ユーザー判断）。
- commit `03d7d1f`「i18n toggle」は名前に反し mobile_app.html に data-i18n を含まない（i18n未実装）。
- 非ブロッキング: validateのvalidNames強制、AI発話の陣営整合、advanceAiTurnのsolo限定化、seatAiPlayersのjoinState更新（共有卓時）。

## Files to read next
- docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md（正本・全タスク）
- .superpowers/sdd/progress.md（各タスクcommit＋フォローアップ）
- functions/index.js / functions/ai/orchestrator.mjs（AI駆動の中核）
- mobile_app.html（s02b・s14・hostDriver）
