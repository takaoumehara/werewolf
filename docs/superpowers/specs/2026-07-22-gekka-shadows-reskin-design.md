# 月下ノ影 / GEKKA — SHADOWS リブランド・リスキン設計

作成日: 2026-07-22
ブランチ: `mobile-ui-design-system`
出典デザイン: `claude-design2/ダークファンタジーオープニング企画/`
  - `人狼ゲームUI.dc.html`(20画面 UI モック / 月下ノ影スキン)
  - `オープニング演出設計.dc.html`(オープニング演出設計書 + 生成済み mp4)
  - `uploads/design-system.md`(トークン正本)

## 目的

現行アプリの見た目を、新ダークファンタジー・ブランド「月下ノ影 / GEKKA — SHADOWS」へ全面差し替える。ユーザー承認済みスコープ:
1. アプリ全面リスキン + オープニング差し替え
2. オープニングは生成済み mp4 動画(`kling_20260723_VIDEO_Illustrati_1149_0.mp4`, 1080×1916, 7秒, 無音)を採用
3. ブランド表記を「記録網 / Kirokumō」→「月下ノ影 / GEKKA — SHADOWS」へ改名(ゲーム内用語「人狼」は維持)

## 戦略: リスキン・イン・プレイス

現行 `index.html`(= `mobile_app.html`, 3259行)+ `design-system.css`(1199行)はすでに4a「Kirokumō」スキンで、月下ノ影は同一トークン体系の次進化。

**原則:** モックの inline-style HTML を貼り替えない。既存の機能配線 — 全 `id` / `data-*` 属性・`renderS03/S05/S07/S11/renderS06/renderS18/buildFakeQrSvg`・`selectNightTarget` 等のハンドラ・game-client・Firebase・長押し開示(HoldToReveal)・`visibilitychange` 保護 — を一切壊さず、CSSトークン・見出しマークアップ・ブランド文言・オープニングのみ差し替える。

**却下案:** ①モック HTML 丸ごと移植 → renderXX/ハンドラ全断。②新規 index 別ファイル化 → デプロイ二重管理。

## 変更詳細

### A. design-system.css(トークン)
- `@import` にフォント追加: `Shippori Mincho`(400;500;600;800)、`Cormorant Garamond`(400;600)。
- `--font-heading` / `--font-display` を `'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif` へ再ポイント。
- `--fs-display` を 28px → 36px 前後へ引き上げ(明朝見出しの重厚感)。
- `.app-shell`(または `body`)背景を暖色ラジアルへ: `radial-gradient(120% 80% at 50% -10%, #14110c 0%, #0b0a0a 55%, #08070c 100%)`。
- 金 `#C9A84C`・月光 `#9FB4CE`・淡金 `#D9C7A0`・評決赤の意味色は維持。ひし形ユーティリティ(`.diamond*`)流用。
- Cinzel(アイブロウ)・IBM Plex Mono・Zen Kaku Gothic New(本文)は維持。

### B. ブランド改名(index.html 3箇所)
- L964 top-bar: `Kirokumō` → `GEKKA — SHADOWS`(Cinzel アイブロウ)。
- L991 s01: `記録網` → `月下ノ影`。L992: `Kirokumō` → `GEKKA — SHADOWS`。
- ゲーム内(ルールドロワー・役職名)の「人狼」表記は維持。

### C. オープニング差し替え(index.html)
- 現行の3画像クロスフェード(`op-bg-1/2/3`)+ 5カット `opScript` テキスト演出を撤去。
- 生成済み mp4 を `design-development/opening/` と `public/` へ複製。
- フルスクリーン `<video autoplay muted playsinline preload>` で再生。7秒後に最終タイトルカード「月下ノ影 / GEKKA — SHADOWS」を重ね、既存の skip / tap-to-start / `hideOpeningOverlay()` 配線を流用。
- `prefers-reduced-motion: reduce` では動画を再生せず静止フレーム + タイトルへ縮退。
- `playOpeningAnimation()` を動画制御へ書き換え(関数名・呼び出し元は維持)。

### D. s01–s20 画面パス
- 各画面をモック(`人狼ゲームUI.dc.html` s01–s20)と突き合わせ、見出しの明朝化・ひし形装飾・暖色背景の整合を適用。構造・id・ハンドラ・renderXX は不変。4aで再構築済みのため大半は装飾差分。

### E. デプロイ同期・検証
- 更新後 `index.html` / `design-system.css` / 動画を `public/` へ同期(`public/index.html` は `public` hosting root)。
- 検証: `bash tests/design_system_test.sh`、`bash tests/mobile_app_test.sh`、`node --check`(script抽出)、中国語混入チェック、div開閉一致。

## 必須維持事項(退行禁止)
- 必須文言「接続を復旧しています」「選択を記録しました」「あと」。
- アセットパス `backgrounds-72/{id}_bg.png` / `00_transparent-illustrations-72-a-refined/{id}_ver_a.png`(例外 `magician_ver_c.png`)。
- `buildCardWrapper` マークアップ、`.card-*` / `.role-name-*` / `.camp-*` CSS。
- 全20画面(s01–s20)・長押し開示・dev drawer・`prefers-reduced-motion` 縮退。
- 中国語(簡体字)混入ゼロ。
