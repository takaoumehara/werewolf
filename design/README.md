# 人狼ゲーム — Design Source of Truth

このフォルダは、ゲームの世界観・カード・UI・アセット運用に関する最新のデザイン正本です。新しいAIセッションや別のAIが作業するときは、まずこのファイルを読み、必要な資料だけを順番に確認してください。

## AIセッションの入口

Codex、Claude Code、Gemini CLIでは、リポジトリ直下の `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` から共通の [`AI_CONTEXT.md`](../AI_CONTEXT.md) を経由してこの目次へ到達する。AI別の入口へカード値やデザイントークンを複製せず、最新情報はこのフォルダの正本だけを更新する。

## 読む順番

1. [`current-card-design.md`](current-card-design.md) — 現在の最終カード仕様と使い方
2. [`refined-position-calibration.json`](refined-position-calibration.json) — 25役職の人物レイヤー位置・倍率
3. [`design-system.md`](design-system.md) — モバイル UI デザインシステム正本(トークン・コンポーネント・秘匿設計)
4. [`world-theme.md`](../world-theme.md) — 世界観・美術設定の詳細
5. 必要に応じて [`docs/superpowers/specs/2026-07-19-refined-card-position-editor-design.md`](../docs/superpowers/specs/2026-07-19-refined-card-position-editor-design.md) — 調整画面の設計

## 優先順位

新しい指示がない限り、次の順で判断する。

1. ユーザーの最新指示
2. `current-card-design.md`
3. `refined-position-calibration.json`
4. `world-theme.md`
5. 過去の仕様書・生成スクリプト・旧バージョン

## 最終デザインを更新する手順

最終案が変わった場合は、次の3箇所を同じコミットで更新する。

- `current-card-design.md` に人間向けの説明を追記・更新する
- `refined-position-calibration.json` に機械可読の設定を保存する
- 実装（`card_gallery.html`、`card_viewer.html`、`card_position_editor.html` など）へ反映する

更新日、変更理由、影響する画面を `current-card-design.md` の変更履歴に残す。APIキー、招待トークン、Firebaseの秘密情報はこのフォルダに保存しない。

## 現在の実装入口

- 最終カード調整: [`card_position_editor.html`](../card_position_editor.html)
- 全カードギャラリー: [`card_gallery.html`](../card_gallery.html)
- 個別カードビュー: [`card_viewer.html`](../card_viewer.html)
