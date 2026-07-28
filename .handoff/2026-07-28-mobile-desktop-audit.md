# Handoff — 2026-07-28 モバイル/デスクトップ全面監査 → C+E 修正

**Passphrase**: `人狼ゲーム: 実測が暴いた三日月の綻び`

## Objective

本番 https://jinro-bb5a5.web.app の全面検証（デスクトップ/モバイル、特にモバイル）と改善案の洗い出し。
**監査は完了済み。ソロAI対戦が成立していない不具合（C+E）の修正も完了。次は D（プレースホルダ11箇所）から。**

## Verified State

- **監査完了** — 7方向の並列監査 + headless Chrome による21画面×6ビューポートの実測。50件超の所見を7つの構造的原因に集約。正本は `docs/2026-07-28-mobile-desktop-audit.md`。
- **C+E 修正完了（ブランチ `claude/werewolf-solo-ai-fix-zc4emn`）** — 詳細は監査レポートの C章・E章に追記した「修正の内訳」表。
  - C-1/C-2: `renderS15Live()` / `renderS11Live()` を差分更新化。名簿シグネチャが変わったときだけ作り直し、選択はラウンド変更と対象の脱落でのみ捨てる。
  - E-1: `runAiPhase` が各AIを try/catch で隔離し `errors` を返す。クライアントは再試行3回・バックオフ付きで打ち切り、打ち切り時は `aiTurnDone` を立てて進行を再開する。
  - E-2: 発話生成を `Promise.all` で並列化（投稿は id 順に直列）。`advanceAiTurn` に `timeoutSeconds: 180`。
  - E-3: AIが1体でも居る卓は夜30秒/昼90秒/投票30秒で開始（`functions/ai/turn-policy.mjs`）。
  - E-4: 発火判定を `aiTurnKey` → `aiTurnDone` に変更し、`R:vote → R:day` の二度目の発話を止めた。
  - E-5: `advanceAiTurn` をホスト限定＋`game/aiTurns/{round}_{phase}` の claim で (round, phase) ごと1回だけに制限。フェーズ不一致も拒否。
- **テスト**
  - `node --test functions/ai/*.test.mjs` → **33/33 pass**（orchestrator に隔離/並列/投稿順の7件、turn-policy に8件を追加）
  - `bash tests/live_selection_test.sh` → **26/26 pass**（新規。headless Chromium で実 DOM を検証）
  - `bash tests/mobile_app_test.sh` / `bash tests/design_system_test.sh` → pass
  - 修正前のコードに対して新テストが赤になることを実際に確認済み（C-1/C-2 の6件、E-1/E-4 の2件）。
- **未検証** — エミュレータ系（`tests/ai_functions_smoke.sh` / `tests/functions_smoke_test.sh`）は
  この環境に firebase CLI と `functions/node_modules` が無いため未実行。
  `functions/scripts/ai_smoke_assert.mjs` には E-5 の検証（ホスト限定・二度目は skip・errors=0）を追加してあるので、
  **CLI のある環境で一度回すこと**。
- **既存の失敗（今回の変更とは無関係）** — `card_position_editor_ui_test` / `card_transparent_variants_test` /
  `qr_blended_concepts_test` / `qr_pass_mockup_test` / `design_source_of_truth_test` は
  **変更前の main でも同じく失敗する**（`card_gallery.html` の内容ドリフト等）。要別途調査。

## Running Processes & Active Ports

なし。`tests/live_selection_test.sh` は自前で `python3 -m http.server 8901` を起動して終了時に落とす。

## Immediate Next Steps

監査レポートの「推奨する着手順」の 2 番目から。

1. **D【P1】プレースホルダ11箇所**（`docs/2026-07-28-mobile-desktop-audit.md` の D章）。特に:
   - D-1 `mobile_app.html:4411` の `state.myRole` → `currentSelfRoleId()`（「自分の役職」が常に市民）
   - D-2 共有リンクのコピーが `https://example.invalid/...` を配る
   - 「投票済み 3 / 7」は公開ビューに `pendingVoteCount` が既にあるので結線するだけ
2. **A（ビューポート）** → **B（オーバーレイ共通基盤）** → **I（アセット最適化のP0 2件）**

## Files to Read First

1. `docs/2026-07-28-mobile-desktop-audit.md` — 監査の正本。C/E は「修正済み」の注記付き
2. `tests/live_selection_test.sh` / `tests/live-selection-harness.html` — ライブ描画と進行ドライバの回帰テスト。
   `mobile_app.html` の `window.__liveRenderTestHooks` から状態を差し替える
3. `functions/ai/turn-policy.mjs` — フェーズ長と二重実行防止の純関数
4. `tests/viewport-harness/README.md` — ビューポート実測をやり直す場合

## 未決の論点（ユーザーと相談が必要）

- 最初の相談だった **UX再設計**（カードを主役にする、評議の会話体験、「誰だっけ」問題、トップバーの整理）は未着手。監査とは別トラック。
- **アプリファイルが2つに分岐**（root `index.html` に i18n、本番の `mobile_app.html` に無し）。一本化するか役割を分けるかの方針決定が先。
- **AI卓のフェーズ長**（夜30秒/昼90秒/投票30秒）は暫定値。実際に遊んでみて調整が要る。
  より根本的には「全員行動済みなら締切を待たずに解決する」方が正しいが、夜行動の完了状況が
  公開ビューに出ていない（投票は `pendingVoteCount` がある）。別タスク。
