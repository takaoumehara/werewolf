# superforge — project settings

> Written by: superforge · Last updated: 2026-08-02

## Language
会話: 日本語
docs/ のファイル: 日本語
（`CLAUDE.md` / `AI_CONTEXT.md` が日本語で、ユーザーの指示も日本語のため。
初回確認は行わず推測を採用した — 変えたいときは「言語を変えて」と言えば書き換える）

## Pinned by the user
- **モバイル中心。ただしデスクトップでも使えること。** 片方だけの最適化は不可。
- 正本は `mobile_app.html`（単一ファイル）。`public/index.html` は
  `bash tools/build-public.sh` の生成物なので直接編集しない。
- カードの正本は `design/current-card-design.md` と
  `design/refined-position-calibration.json`。過去案を最終デザイン扱いしない。
- APIキー・アクセストークン・Firebase の秘密情報を `docs/` や AI 向け資料に書かない。
- 完成の判断は「動いた」ではなく **実ブラウザでの実測**（`/superforge-verify` の基準）。

## Model tiering の実運用
このセッションはサブエージェント禁止の運用下にある（ホスト側の指示）。
そのため superforge §1 の fan-out は行わず、**Opus 5 単独・インライン**で進める。
台帳は「1行版」で残す。
