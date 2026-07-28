# Handoff — 2026-07-28 モバイル/デスクトップ全面監査

**Passphrase**: `人狼ゲーム: 実測が暴いた三日月の綻び`

## Objective

本番 https://jinro-bb5a5.web.app の全面検証（デスクトップ/モバイル、特にモバイル）と改善案の洗い出し。
**監査は完了済み。次はソロAI対戦が成立していない不具合（C+E）の修正に入るところ。**

## Verified State

- **監査完了** — 7方向の並列監査 + headless Chrome による21画面×6ビューポートの実測。50件超の所見を7つの構造的原因に集約。正本は `docs/2026-07-28-mobile-desktop-audit.md`。
- **git 整理済み** — `main` = `3e5b7b5`（origin と同期）。未マージだった `mobile-ui-design-system` を main へマージ済み。衝突は `functions/index.js` 1箇所のみで、main の `applyServerCommand` とブランチの `seatAiPlayers`/`advanceAiTurn` は独立した追加のため両方採用。export 重複なし・`node --check` OK を確認済み。
- **テスト** — `functions/ai` 19/19 pass、`mobile_app_test.sh` / `design_system_test.sh` pass。`design_source_of_truth_test.sh` は `rg` がシェル関数に差し替わっている環境要因で失敗（マージ差分とは無関係）。
- **未着手** — コード修正は一切行っていない。監査レポートとハーネスの追加のみ。

## Running Processes & Active Ports

なし（計測用の `python3 -m http.server 8899` は停止済み）。
計測を再開する場合はリポジトリ直下で起動し、`tests/viewport-harness/README.md` の手順に従うこと。

## Immediate Next Steps

ユーザーが選択した着手順は **C+E（ソロが成立していない問題）**。`superpowers:systematic-debugging` の Phase 1（根本原因）は監査で完了済みなので、Phase 4（失敗するテストを書く → 最小修正 → 検証）から入る。

1. **C-1 [P0]** `renderS15Live()` が `liveVoteSelectedId = null` + `innerHTML=''` で毎回選択を破棄（`mobile_app.html:3976`）。公開データ更新のたびに呼ばれる（`:2747`）ため、ソロではAIの投票が入るたびに人間の選択が飛ぶ。差分更新にして選択を復元する。
2. **C-2 [P1]** `renderS11Live()` も同様に `liveNightSelected = []` + 全再生成（`:3696`）。夜行動が選べない。
3. **E-1 [P1]** `runAiPhase` が各AIを try/catch していないため（`functions/ai/orchestrator.mjs:42/47/68`）、1体の失敗で全体が reject → `aiTurnDone` が立たず **RESOLVE_NIGHT/VOTE が二度と送られない**。「進める」も同じガード下で復旧不可（`mobile_app.html:2602-2622, 2650-2665`）。加えて毎秒リトライし続ける。
4. **E-2 [P2]** AI処理が直列 + `timeoutSeconds` 未指定（既定60秒）。11体では最大22回の逐次API呼び出しでタイムアウト → E-1 に直結。`Promise.all` 化と明示指定。
5. **E-3 [P2]** `startWerewolfGame` が `phaseDurations` を渡さず（`functions/index.js:169`）既定の夜90秒/昼180秒/投票60秒。ソロで全員行動済みでも待たされる。ユーザーが見た「3:00で誰も喋らない」画面はこれ。
6. **E-4 [P2]** `aiTurnKey` が `R:vote → R:day` の遷移で2回目の発話を発火し、夜にAI発言が流れ込む + LLM二重課金。
7. **E-5 [P2]** `advanceAiTurn` にホスト/ソロのガードが無く（`functions/index.js:330`）、任意のメンバーが任意回数呼べる = 課金誘発。

**注意**: 「AIが喋らない」の原因はチャットの配線ではない。サーバ→RTDB→`onChat`→`renderChatLog` は全段照合済みで繋がっている。原因は E-1/E-2/E-3 の複合。

## Files to Read First

1. `docs/2026-07-28-mobile-desktop-audit.md` — 監査の正本。C/E 以外の残タスク（A ビューポート、B オーバーレイ、D プレースホルダ11箇所、I アセット最適化、F ファイル分岐）もここに全部ある
2. `mobile_app.html:2600-2670`（ホストドライバ）/ `:3690-3720`（夜行動）/ `:3975-4000`（投票）
3. `functions/ai/orchestrator.mjs` / `functions/index.js:160-180, 326-345`
4. `tests/viewport-harness/README.md` — 実測をやり直す場合

## 未決の論点（ユーザーと相談が必要）

- 最初の相談だった **UX再設計**（カードを主役にする、評議の会話体験、「誰だっけ」問題、トップバーの整理）は未着手。監査とは別トラック。
- **アプリファイルが2つに分岐**（root `index.html` に i18n、本番の `mobile_app.html` に無し）。一本化するか役割を分けるかの方針決定が先。
