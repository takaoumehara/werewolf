# AIハイブリッド型人狼ゲーム — 設計フェーズ ハンドオフ

## Resume Capsule

Project: 人狼ゲーム
Handoff: .handoff/2026-07-23-ai-hybrid-werewolf-design.md
Passphrase: "人狼ゲーム: 帳面に刻まれた三日月の影"
Goal: 既存の対面スマホ人狼にAIプレイヤーを足す（MVP1: ソロAI対戦）
State: **MVP1 実装完了**。plan(docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md) を subagent-driven で全17タスク実装・レビュー済み。branch mobile-ui-design-system (tip 4ede362)。unit 62/62 + build + a11y/mobile テスト緑。Cloud Functions エミュレータ・スモークも通過(seatAiPlayers→AI3体, advanceAiTurn(night)→actions:3)。**未merge**。
Next: (1) 本番前に `firebase functions:secrets:set ANTHROPIC_API_KEY`（鍵はコミット禁止）。(2) エミュレータで人手のソロE2E確認(create→seat→夜→昼chat→投票→決着)。(3) mobile-ui-design-system を main へ merge/PR するか判断（並行セッションが local main に i18n(e35d03f) と orphan C1(018c08a) を残している—main 整理はユーザー判断）。(4) 進捗詳細は .superpowers/sdd/progress.md、フォローアップ小課題も同ファイル末尾。
Read first: docs/superpowers/plans/2026-07-23-ai-hybrid-werewolf-mvp1.md / .superpowers/sdd/progress.md
Running: none

## 経緯（何をしたか）

- superpowers:brainstorming で「既存の動く人狼にAIをどう足すか」を対話で詰めた（ゼロからではない点が起点）。
- 設計書を新規作成・コミット: `docs/superpowers/specs/2026-07-23-ai-hybrid-werewolf-design.md`（commit adc4395、339行）。
- Google Gemini の設計もレビューし、良い部分を取り込み・不採用を明記（設計書 §12）。

## 確定した設計判断（設計書に反映済み）

- **判断A**: LLMに推理させない。意思決定は決定論コード（Step1 数値エンジン）、LLMは言語化のみ。
- **判断B**: 音声認識は解かない。公式アクション（CO/投票/生死）を構造化データ化しAIはそれだけ知覚。
- **パターンB は A案（リーン）で確定**: AIが知覚するのは CO・投票・生死のみ。自由文ディクテーション案（B案）は破綻モードのため不採用。
- **席モデル**: 卓の席＝人間＋AI。3モード統一（普通/ソロ/マルチ補充）。開始前は全項目自由編集。
- **途中の人数変更は不可**（人狼の勝敗計算の性質）。離脱はAI引き継ぎで吸収、構成変更は再戦時。
- **アクセシビリティ**: WCAG AA を全箇所必須・本文AAA目標。コントラスト是正＋CIに回帰テスト追加（§7）。
- **亡霊(ghost_wolf)**: 現状エンジン未登録（カードのみ）。s07にオプトイン＋説明、デフォルトOFF（§8）。
- 用語: 「記録者/GM(既存)」と「AIキャラクター(新規プレイヤー)」を明確に区別。

## Geminiから取り込んだ具体化

- 人狼の二重マトリクス（表 trust / 裏 trueTrust）を採用（§3.3）。
- JSON Schema で対象ID強制＝ハルシネーション物理防御をハード要件化（§3.6）。
- 発言100文字上限・小型高速モデル・定型アクションボタン採用。
- 不採用: ワンナイト人狼+CLI試作（既存エンジンが完成済みで資産を捨てるため）。

## 現在の状態（検証済み / 未検証）

- 検証済み: 設計書はセルフレビュー（プレースホルダ/矛盾/スコープ/曖昧さ）通過、コミット済み。
- 未検証/未着手: 実装は一切していない。UI変更・エンジン変更・AI実装すべて未着手。
- ブランチ: mobile-ui-design-system（main ではない）。作業ツリーに claude-design2/ 等の未追跡あり（今回の作業と無関係）。

## 次の具体的ステップ

1. ユーザーが設計書をレビューし承認するのを待つ（修正要望あれば設計書を直す）。
2. 承認後、**writing-plans スキル**で MVP1 の実装計画を作成。
   - MVP1範囲: パターンA「ひとりで遊ぶ(AI対戦)」／人間1+AI／役職は村人・人狼・占い師のみ／人格2軸(logic/aggression)。
   - 新規: AIオーケストレータ(Functions内で dispatchWerewolfCommand を AI actorId で叩く)、チャットUI1画面、発言プロンプト＋検証パス、JSON Schema対象強制、卓設定ソロ経路、アクセシビリティ是正第一弾。

## 次に読むファイル

- docs/superpowers/specs/2026-07-23-ai-hybrid-werewolf-design.md ← 正本（全設計）
- game-engine/src/roles.mjs（26役職・ghost_wolf 未登録の確認）
- functions/index.js（dispatchWerewolfCommand の叩き方）
- mobile_app.html（s02–s07 の卓作成フロー、s14 昼の議論）
- design-system.css（アクセシビリティ是正対象の低不透明度トークン）

## Running state

none — バックグラウンドプロセス・devサーバー・worktree いずれも起動していない。
