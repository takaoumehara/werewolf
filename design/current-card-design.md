# Current Card Design — Final

更新日: 2026-07-19

このファイルは、現在のカードデザインと、カードを使うときの最終ルールをまとめた正本です。

## 最終レンダリング

最終カードは必ず次の組み合わせを使う。

- Style: `Refined`
- Mode: `Transparent`
- Background: `ON`
- Character folder: `00_transparent-illustrations-72-a-refined`
- Background folder: `backgrounds-72`
- Card size: `360 × 640 px`
- Language: 日本語／英語を切り替え可能

人物は透過PNGのレイヤー、背景は役職別の背景レイヤーとして合成する。人物の位置・倍率は [`refined-position-calibration.json`](refined-position-calibration.json) を使う。

## タイトル表現

タイトルは [`card_viewer.html`](../card_viewer.html) を正本とする。

### 日本語

- 左上に縦書き
- `LINE Seed JP` Bold
- 白文字、38px、字間6px
- 役職名の読みをルビで表示
- 右上に英語名を補助表示

### 英語

- 右上に横書き・右寄せ
- `Cinzel Decorative` Black
- 白文字
- 役職名の長さに応じて 22px / 26px / 32px に調整

日本語・英語の役職名、ルビ、位置、文字サイズを新しい画面で独自に書き換えない。`card_viewer.html` と同じデータ・DOM・CSSを使う。

## 画面の使い分け

### Position Editor

[`card_position_editor.html`](../card_position_editor.html) はPC向けの最終調整画面。25枚すべてを一覧で確認し、カードを選んで次の操作を行う。

- ドラッグ: 人物のX/Y位置を移動
- ホイール: 人物を拡大・縮小
- `X / Y / Scale`: 数値で微調整
- 矢印キー: 1%移動
- Shift + 矢印キー: 10%移動
- `COPY ALL POSITIONS`: 25役職分のJSONをクリップボードへコピー
- `RESET SELECTED`: 選択中の役職を現在の基準値へ戻す
- `RESET ALL`: 全役職を現在の基準値へ戻す

調整画面の初期値は `refined-position-calibration.json` と一致させる。コピーしたJSONをAIへ渡す場合は、役職ID、`scale`、`x`、`y` の値を改変せずに渡す。

### Card Gallery

[`card_gallery.html`](../card_gallery.html) は全カードの確認用。初期状態は `Refined / Transparent / Background ON`。必要に応じて旧バージョンを比較できるが、最終確認では必ずRefinedに戻す。

### Card Viewer

[`card_viewer.html`](../card_viewer.html) は1枚を大きく確認する画面。最終合成は `ver=refined-trans` を使う。

例:

```text
card_viewer.html?role=knights&lang=ja&ver=refined-trans
card_viewer.html?role=knights&lang=en&ver=refined-trans
```

## アセットの対応規則

通常の役職は次の命名規則を使う。

```text
00_transparent-illustrations-72-a-refined/{role_id}_ver_a.png
backgrounds-72/{role_id}_bg.png
```

`magician_c` だけは例外として次を使う。

```text
00_transparent-illustrations-72-a-refined/magician_ver_c.png
backgrounds-72/magician_bg.png
```

旧バージョン（Ver.A、Lifelike、動画など）は比較用であり、最終カードの基準にはしない。

## 変更履歴

| 日付 | 変更 |
|---|---|
| 2026-07-23 | 「奇術師 C（`magician_c`）」を全データから削除し全25役職構成に整理。Position Editorに日本語/英語完全UI切替、背景レイヤー移動・拡大、カラー＆ティントフィルター機能（明るさ・コントラスト・彩度・色相）を追加。 |
| 2026-07-23 | 特殊役職「狼の亡霊（`ghost_wolf`）」の最終ポジショニング位置 (`scale: 1.38, x: -2.03, y: -2.77`) を決定・正本へ反映。「の」の不要なルビを削除。 |
| 2026-07-23 | 特殊役職「狼の亡霊（`ghost_wolf`）」を26番目の役職として正式追加。Refined透過イラストおよび背景画像を配置・データ連動完了。 |
| 2026-07-19 | Refined透過＋背景ONを最終カードに決定。25役職の位置・倍率を確定。タイトルを `card_viewer.html` と統一。 |
| 2026-07-19 | PC向けPosition Editor、全設定コピー、ローカル `file://` 直開き対応を追加。 |
