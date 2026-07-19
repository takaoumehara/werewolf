# AI Design Context — 設計仕様

更新日: 2026-07-19

## 目的

人狼ゲームのカード、世界観、UI、アセットを扱うすべてのAIセッションが、作業開始時に現在の最終デザインを確認できるようにする。AIごとに仕様を複製せず、`design/` を唯一のデザイン正本として運用する。

## 現在の正本

既存の次のファイルを維持する。

- `AI_CONTEXT.md`: リポジトリ共通の短い入口
- `design/README.md`: デザイン資料の目次、優先順位、更新手順
- `design/current-card-design.md`: 最終カードのレンダリング条件、使い方、アセット規則
- `design/refined-position-calibration.json`: 25 役職の人物レイヤー位置と倍率
- `design/design-system.md`: モバイル UI のデザイン原則とトークン
- `world-theme.md`: 世界観と美術設定

最終カードは `Refined / Transparent / Background ON`、人物は `00_transparent-illustrations-72-a-refined`、背景は `backgrounds-72` を使用する。日本語と英語のタイトルは `card_viewer.html` を正本とし、人物配置は `design/refined-position-calibration.json` を使用する。

## AI別の自動読込入口

リポジトリ直下に次の3ファイルを置く。

- `AGENTS.md`: Codexなど、`AGENTS.md` を認識するエージェント向け
- `CLAUDE.md`: Claude Code向け
- `GEMINI.md`: Gemini CLI向け

各ファイルは詳細なデザイン仕様を複製しない。作業開始前に `AI_CONTEXT.md` を読み、デザイン関連の作業では `design/README.md` と必要なリンク先を確認することだけを指示する。ユーザーの最新指示を最優先し、秘密情報をデザイン資料へ保存しないことも明記する。

AIが自動読込入口を認識しない環境でも、人間またはAIが見つけられる共通入口として `AI_CONTEXT.md` を残す。

## 参照の流れ

```text
AIセッション開始
  └─ AGENTS.md / CLAUDE.md / GEMINI.md
       └─ AI_CONTEXT.md
            └─ design/README.md
                 ├─ current-card-design.md
                 ├─ refined-position-calibration.json
                 ├─ design-system.md
                 └─ ../world-theme.md
```

AIは必要な資料だけを順番に読み、旧案、生成途中の画像、比較用バージョンを現在の最終案として扱わない。

## 更新規則

最終デザインを変更するときは、人間向け仕様、機械可読設定、実装を同じ変更単位で同期する。

1. `design/current-card-design.md` を更新する。
2. 人物配置が変わる場合は `design/refined-position-calibration.json` を更新する。
3. `card_gallery.html`、`card_viewer.html`、`card_position_editor.html` などの対象実装へ反映する。
4. 更新日、変更理由、影響画面を変更履歴へ残す。
5. テストで正本と実装の一致を確認する。

AI別の入口ファイルにはカード値やデザイントークンを記載しない。入口は原則として変更せず、正本だけを更新する。

## 不整合時の扱い

資料と実装が一致しない場合、AIは推測で一方を上書きしない。まずユーザーの最新指示を確認し、その次に `design/README.md` の優先順位を使う。不整合を解消するときは、変更理由と影響範囲を `design/current-card-design.md` に記録する。

リンク先が存在しない、JSONが壊れている、25役職が揃っていない場合は、最終仕様が読み込めたものとして作業を続けず、問題を明示する。

## 検証

自動テストで次を確認する。

- 3つのAI別入口ファイルが存在し、`AI_CONTEXT.md` を参照している。
- `AI_CONTEXT.md` が `design/README.md` を参照している。
- `design/README.md` がカード仕様、配置JSON、デザインシステム、世界観へリンクしている。
- `design/refined-position-calibration.json` が有効なJSONで、25役職を含む。
- カード仕様に `Refined`、`Transparent`、`Background ON`、日英切替の条件が明記されている。
- APIキー、アクセストークン、Firebaseの秘密情報をデザインフォルダへ保存していない。

既存のユーザー作業中ファイルや画像には触れず、この仕組みに必要な指示・仕様・テストだけを変更対象とする。
