# 月下ノ影 リスキン + UX/バグ修正 + デスクトップ対応

## Resume Capsule

Project: 人狼ゲーム
Handoff: .handoff/2026-07-23-gekka-reskin-ux.md
Passphrase: "人狼ゲーム: 月下の三日月コンソール"
Goal: モックに全画面一致させ、指摘バグ/可読性/デスクトップ表示を修正・本番反映
State: s01–s20リスキン+バグ/可読性/デスクトップ+**日/英フル i18n 全て完了・本番デプロイ済(main=0a4d21f, 2026-07-24)**
Next: なし(このタスクは完了)。任意フォローアップ=ALL_ROLES_MASTERのdesc/advice英訳、開発者ドロワー/オープニング字幕のi18n
Read first: index.html, design-system.css, claude-design2/ダークファンタジーオープニング企画/人狼ゲームUI.dc.html
Running: none

## Passphrase
`人狼ゲーム: 月下の三日月コンソール`

## やったこと(ファイル)
- **全20画面リスキン**: モック `claude-design2/ダークファンタジーオープニング企画/人狼ゲームUI.dc.html` に忠実一致。アプリ画面は**番号でなく内容**でマッピング(例: アプリs06=GM選択↔モックs03、アプリs07=役職構成↔モックs06、アプリs03=参加↔モックs05)。`index.html` の各 `<section id="sXX">` と `design-system.css` を更新。id/handler/renderXX/game-client/Firebase/長押し秘匿は不変。
- **バグ修正**(`index.html`): ①QR/共有リンク `?room=CODE` でオープニングを飛ばし合言葉入力へ直行+自動プリフィル(`prefillJoinCode`, DOMContentLoaded)。②合言葉マスの自動送り/Backspace/矢印/**ペースト分配**(`wireCodeInputs()`)。③上部 `冊`(Making)404→`openMakingModal()` に変更 + `making.html`/`making_of_card_design.html` を `public/` へ同梱。
- **可読性**(`design-system.css` + `index.html`): `--fs-body`16/`--fs-heading`22/`--fs-label`14/`--fs-caption`13、`--sem-text-dim` 0.5→0.64(全phase)。top-bar を「月下ノ影」+`映像/制作/ルール`のボタン化。ルールドロワー拡大。役職図鑑に**透過イラストのサムネイル**追加(`renderRolepedia`)。
- **デスクトップ/タブレット**(`index.html` @media): ≥1180=3カラムコンソール(左:brand/WORLD/HOW TO PLAY、中:端末フレーム、右:JOIN/SHORTCUTS)、860–1179=端末フレームのみ、<860=従来。`.app-shell` を固定サイズ端末化(width402/height min(880,94vh)/内部スクロール)。**`.app-shell` の閉じ `</div>` 追加 → div 231/231 一致**(右サイドバー非表示の原因=積年の不整合を解消)。
- ブランド=**月下ノ影/GEKKA**(旧記録網は廃止)。フォント見出し=Shippori Mincho。オープニング=`design-development/opening/opening_gekka.mp4`。

## 現在の状態(検証済/未)
- 検証済: `bash tests/design_system_test.sh` / `bash tests/mobile_app_test.sh` PASS、`node --check` OK、全20画面+join/rules/roles+desktop/tablet/mobile をヘッドレスで目視確認。
- 本番反映済: `main = bfd6a73` を push(Vercel `werewolf-gilt.vercel.app` 自動デプロイ)。作業ブランチ `mobile-ui-design-system` も同一。
- 未着手: **言語切替(日/英フル i18n)** — ユーザー承認済「次回」。役職データは `jp/en` 保持、モックの `<script data-dc-script>` に t.ja/t.en(20画面分英文)あり。メモ `werewolf-i18n-todo`。
- 注意: `card_position_editor.html` にセッション外の未コミット変更が居座る(自分の担当外)。中国語混入チェック維持(罠師 advice は「仕掛け」表記)。

## 次の具体的ステップ
1. s01 に日本語/English トグル(モック s01 準拠のセグメント)を追加し `lang` 状態(localStorage)を作る。
2. 20画面UI/ボタン/top-bar/ルール/役職図鑑を i18n 化(t.en 流用、renderXX も lang 参照)。id/handler/renderXX を壊さない。中国語混入チェック維持。

## 次に読むファイル
- `index.html`(画面マークアップ + renderXX + wireCodeInputs + DOMContentLoaded)
- `design-system.css`(トークン + components)
- `claude-design2/ダークファンタジーオープニング企画/人狼ゲームUI.dc.html`(モック正本 + t.ja/t.en)

## Running state
none(バックグラウンドプロセス・dev server・worktree なし。http.server は都度起動/kill 済み)
