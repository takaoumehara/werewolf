# Handoff — 2026-07-28 監査 → 全面ブラッシュアップ

**Passphrase**: `人狼ゲーム: 実測が暴いた三日月の綻び`

## Objective

本番 https://jinro-bb5a5.web.app の全面検証と改善。
**監査(A〜I)の指摘は、方針決定と画像再エンコードが要るものを除いてすべて対応済み。**
A / B / C / D / E / G(P0,P1) / I(P0,P1) 完了。あわせて、監査の対象外だった
「遊べる役職が4つだけだった」問題、3モードの導線、記録者の読み上げ(TTS)も実装済み。

作業ブランチ: `claude/werewolf-solo-ai-fix-zc4emn`

## Verified State

### 完了した修正

| 章 | 内容 |
|---|---|
| **C** | 投票/夜行動の再描画が選択を破棄する問題。差分更新にして選択を保持 |
| **E** | ソロAI進行の恒久停止・逐次タイムアウト・二重発火・課金誘発 |
| **J**（監査に無かった追補） | **遊べる役職が4つだけだった**問題。エンジンの未実装役職(hunter/妖狐/人狼の子ども)を仕上げ、AIブレインを全役職の夜行動に対応させ、24枚の絵札から選ぶ役職ピッカーへ置き換え |
| **モード** | 人間+AIの混合卓を通した。進行ドライバの判定を appState.solo から「実際にAIが座っているか」へ |
| **D** | 画面に出ていた11箇所の嘘の数字と名前を実データへ |
| **TTS** | 記録者の読み上げを実装（設計書で計画されながら未着手だった機能） |
| **A** | 実機の高さ(690/712pt)で主要ボタンが画面外へ沈む問題 |
| **B** | オーバーレイ共通基盤(暗転・背景ロック・ESC/暗転タップ・フォーカス・z-index・デスクトップの枠内収納) |
| **G** | 画面遷移のフォーカス移動、対象選択のキーボード操作、aria-live、入力ラベル |
| **I** | 動画の preload、キャッシュヘッダ、未使用フォント削除と並列取得、背面での音停止、タイマーのtransform化 |

詳細は `docs/2026-07-28-mobile-desktop-audit.md` の各章の冒頭注記と、末尾の「追補」表。

### テスト（すべてこの環境で実行済み）

| コマンド | 結果 |
|---|---|
| `cd game-engine && npm test` | **78/78 pass** |
| `node --test functions/ai/*.test.mjs` | **39/39 pass** |
| `bash tests/live_selection_test.sh` | **116/116 pass**（実ブラウザ） |
| `bash tests/viewport_fit_test.sh` | **pass**（690/712 の両方で21画面） |
| `bash tests/mobile_app_test.sh` / `design_system_test.sh` | pass |

新しく足したテスト:
- `game-engine/test/all-roles.test.mjs` — カード文言どおりに全役職が動くか
- `game-engine/test/ai-brain-all-roles.test.mjs` — AIが夜行動を取りこぼす役職が無いか
- `functions/ai/turn-policy.test.mjs` — フェーズ長と二重実行の判定
- `tests/live_selection_test.sh` + `tests/live-selection-harness.html` — 実ブラウザで
  描画・進行ドライバ・役職ピッカー・3モード・表示の実データ・読み上げ・カード露出を検証
- `tests/viewport_fit_test.sh` + `tests/viewport-harness/fit.html` — 主要ボタンの可視と
  タップ対象44pt

**このハーネスは「アプリが起動しない」ことの検知にも効く。** `window.__liveRenderTestHooks`
は IIFE の末尾で代入されるので、評価が途中で落ちるとフックが無くなり必ず落ちる
（実際に、TDZ による起動失敗をこれで検出した）。

### 未検証

- **エミュレータ系**（`tests/ai_functions_smoke.sh` / `tests/functions_smoke_test.sh`）は
  **この環境では原理的に動かない**。firebase CLI と functions の依存は入れて試したが、
  Database エミュレータが起動時に `firebase-public.firebaseio.com` へ出ようとして
  組織の外向き通信ポリシーに 403 で拒否される。エラーは
  `database.rules.json:Unable to parse JSON: ... "denied by "...` と出るが、
  **`database.rules.json` 自体は正しい JSON**（プロキシの拒否本文を読んでいる）。
  `functions/scripts/ai_smoke_assert.mjs` には advanceAiTurn のホスト限定・
  二度目は skip の検証を足してある。**制限のない環境で一度回すこと。**
- **実機での確認**（safe-area の +53px、iOS の読み上げ音声、TTSの初回ジェスチャ制限）。
  headless は `env(safe-area-inset-*)` を 0 として扱う。

### 既存の失敗（今回の変更とは無関係）

`card_position_editor_ui_test` / `card_transparent_variants_test` / `qr_blended_concepts_test` /
`qr_pass_mockup_test` / `design_source_of_truth_test` は**変更前の main でも同じく失敗**する
（`card_gallery.html` の内容ドリフト等）。要別途調査。

## Running Processes & Active Ports

なし。テストは自前で `python3 -m http.server` を起動して終了時に落とす（8901 / 8908）。

## Immediate Next Steps

コードで直せる指摘は出し切っている。残りは判断か、コード外の作業。

1. **実機確認** — safe-area の +53px、iOS の読み上げ音声、TTSの初回ジェスチャ制限。
   headless では検証できない。
2. **エミュレータ確認** — `bash tests/ai_functions_smoke.sh`。この環境では
   `*.firebaseio.com` が組織ポリシーで遮断されていて動かない（詳細は `docs/deploy.md`）。
3. **I-2 カード画像の再エンコード** — 5.77MB/枚の原画をサムネイルに使っている。
   画像処理が要るのでコード変更では終わらない。
4. **F の方針決定** — root `index.html`(i18nあり) と `mobile_app.html`(本番) のどちらを
   正本にするか。いまは `public/index.html` が `mobile_app.html` と一致することを
   `tests/mobile_app_test.sh` が保証している。
5. **UX再設計** — 最初の相談だったカード主役の体験設計。監査とは別トラック。

## Files to Read First

0. `docs/deploy.md` — デプロイに必要なものと手順。何が揃っていて何が足りないかの実測結果
1. `docs/2026-07-28-mobile-desktop-audit.md` — 監査の正本。修正済みの章には冒頭に注記、
   末尾に「監査に無かった問題」の追補表がある
2. `tests/live-selection-harness.html` — 実ブラウザ検証の入口。
   `mobile_app.html` の `window.__liveRenderTestHooks` から状態を差し替える
3. `game-engine/src/ai-brain.mjs` — `NIGHT_ACTION_BY_ROLE` と `TARGETING`。
   **役職を足したらここに対を追加すること**（テストが取りこぼしを検出する）
4. `functions/ai/turn-policy.mjs` — AI卓のフェーズ長と、advanceAiTurn の二重実行防止

## 決めたこと（後から見て迷わないように）

- **ハンターの道連れは「夜のうちに狙いを定めておく」方式**にした。死んでから選ばせると
  サーバ権威の進行に割り込みが要り、AIにも打たせられないため。カード文言
  「最後の一撃で他のプレイヤー一人を道連れにして死亡する」とは矛盾しない。
- **妖狐が襲撃を耐えたときの公開表示は、騎士に守られたときと同じ**にした。
  区別できると正体が漏れる。
- **スパイの `relay` は盤面を変えない演出専用**のまま。夜の会話を人狼へ流すという
  カード文言に、構造化アクション以外の情報経路は用意しない（設計の判断Bに従う）。
- **AI卓のフェーズ長は夜30秒/昼90秒/投票30秒**。暫定値。本来は「全員行動済みなら
  締切を待たず解決」が正しいが、夜行動の完了状況は公開ビューに人数しか出ない
  （誰が出したかを出すと役職が漏れる）ため別タスク。
- **読み上げは音の消音に連動**させた。消音の意味を1つに保つため。

## 未決の論点（ユーザーと相談が必要）

- 最初の相談だった **UX再設計**（カードを主役にする、評議の会話体験、「誰だっけ」問題、
  トップバーの整理）は未着手。監査とは別トラック。
- **決選投票**はエンジンに存在しない。いまは「同数のため処刑を行わない」と表示する形に
  合わせてある。実装するなら engine にフェーズとコマンドの追加が要る。
- **`ghost_wolf`（狼の亡霊）** は図鑑と画像素材にはあるが、`rolesData` にも
  エンジンの `ROLE_IDS` にも無い。配れない役職として残っている。
