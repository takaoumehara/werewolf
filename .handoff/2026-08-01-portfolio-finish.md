# Handoff — 2026-08-01 ポートフォリオ公開まで

**Passphrase**: `人狼ゲーム: 遊べるが、遊び方が伝わっていない`

## Objective

**最優先はユーザーの明言どおり「一旦終わらせてポートフォリオとして発表できる状態にする」**。
機能追加ではなく、初見の人が遊べて、用意した絵札が見える状態にすること。

作業ブランチ: `claude/werewolf-solo-ai-fix-zc4emn`（main `8419a13` からの派生。コードは全てマージ済み）
このカプセル自体は **draft PR #1** で上がっている（https://github.com/takaoumehara/werewolf/pull/1 · CI green）。

## Verified State

監査 A〜I と追補 J は**コードで直せるものはすべて対応済み**（詳細は下の docs 台帳）。
本番 https://jinro-bb5a5.web.app へのデプロイは**ユーザーが自分の端末で実行**する
（この環境に認証情報が無い / `*.firebaseio.com` が組織ポリシーで 403）。

| コマンド | 結果 |
|---|---|
| `cd game-engine && npm test` | 78/78 pass |
| `node --test functions/ai/*.test.mjs` | 39/39 pass |
| `bash tests/live_selection_test.sh` | 121/121 pass（実ブラウザ） |
| `bash tests/viewport_fit_test.sh` / `mobile_app_test.sh` / `design_system_test.sh` | pass |
| エミュレータ系（`ai_functions_smoke.sh` 等） | **この環境では原理的に不可**（`docs/deploy.md`） |

**完成度の自己評価は 55/100。** 動くが、初見の人には遊び方が伝わらない。

## docs/

| File | Status | Last updated | Open questions |
|---|---|---|---|
| superforge.md | **存在しない** | — | 言語設定は `CLAUDE.md` / `AI_CONTEXT.md` 側。**会話は日本語** |
| 2026-07-28-mobile-desktop-audit.md | 各章に対応済み注記あり | 2026-07-29 | 末尾「監査に無かった問題」表 J-1…J-11 が正本 |
| deploy.md | agreed | 2026-07-29 | `ANTHROPIC_API_KEY` シークレット未確認 |
| firebase-live-access-key.md | agreed | 2026-07-28 | none |
| integration-roadmap.html | reference | 2026-07-28 | none |
| superpowers/plans/*.md（9件）| 実装済み | 2026-07-19〜07-26 | 最新は `2026-07-26-solo-polish-plan.md` |
| superpowers/specs/*.md（7件）| 設計正本 | 2026-07-19〜07-23 | none |
| audit-evidence/ | 証跡（PNG 1枚）| 2026-07-28 | none |
| verification.md | — | — | **not run yet** |
| security.md | — | — | **not run yet** |
| ship-readiness.md | — | — | **not run yet** |
| failforward.md | — | — | **not run yet**（今回の再発防止は監査レポート末尾に記録） |

## Running Processes & Active Ports

常駐プロセスなし。テストは自前で `python3 -m http.server`（8901 / 8908）を起動し終了時に落とす。
PR #1 の自己点検を1時間ごとに入れてあるが、**これはセッション内だけの予約**でセッションが終われば消える。

## Immediate Next Steps

ユーザーに A/B/C を提示済み・**未回答**。推薦は **C → A（並行可）→ B**。

- **C（推薦・最優先）**: 発表可能にする7項目 ①QRを読んだ所からの遊び方説明 ②この卓の役職構成を
  全員に見せる ③結果画面の自動送り停止（タップで進む/戻れる） ④生死の常時表示＋終局カードの拡大
  ⑤役職構成画面の余白を詰めて札を大きく ⑥図鑑の入れ子と札の頭切れ ⑦トップバー整理と音楽が鳴らない
- **A**: プロモ動画の構成表＋プロンプト（費用ゼロ。**この環境から動画生成はできない**——
  KIE.AI の鍵が無く、プロキシ経由でも `api.kie.ai` に到達不可。ユーザーがブラウザで実行する）
- **B**: アプリ内の「ゆらゆら」を CSS/canvas で（AI動画にしない。容量ゼロ）

## 未決 / 既知の穴

- **ルーム番号の TTL が5分**→ 途中復帰ができない
- **AIが喋らない**のは `ANTHROPIC_API_KEY` 未設定か functions 未デプロイの可能性が高い
  （夜行動は鍵不要、昼の発話だけ鍵が要る）
- `ghost_wolf` は図鑑と画像にあるが `rolesData` / `ROLE_IDS` に無く配れない
- **決選投票**はエンジンに無い（同数なら処刑なし）
- AIペルソナに顔（アバター）が無い
- トップバーの整理は未着手（ユーザーが繰り返し指摘）
- **チャットで会話した内容にAIが反応しない**（怪しい/賛成ボタンも意味が伝わっていない）

## Files to Read First

1. `docs/2026-07-28-mobile-desktop-audit.md` — 監査の正本。末尾の追補表から読む
2. `docs/deploy.md` — 出し方と、この環境の制約
3. `tests/live-selection-harness.html` — 実ブラウザ検証の入口。`window.__liveRenderTestHooks`
   が無いと必ず落ちるので、**起動失敗の検知にも効く**
4. `mobile_app.html` — 単一ファイルの本体。`public/index.html` は
   `bash tools/build-public.sh` が組み立てる**生成物**（直接編集しない）
5. `game-engine/src/ai-brain.mjs` — 役職を足したら `NIGHT_ACTION_BY_ROLE` と `TARGETING` に対を追加

## 決めたこと

- ハンターの道連れは**夜のうちに狙いを定める**方式（サーバ権威の進行に割り込まないため）
- 妖狐が襲撃を耐えた表示は**騎士に守られたときと同じ**（区別できると正体が漏れる）
- スパイの `relay` は**盤面を変えない演出専用**
- 読み上げ(TTS)は**音の消音に連動**（消音の意味を1つに保つ）
- 画像は二段構え。一覧は `thumbs/`(400px)、全画面は `cards/`(1200px)。原画は配信物に入れない
