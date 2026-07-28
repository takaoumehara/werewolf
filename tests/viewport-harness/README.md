# ビューポート計測ハーネス

`mobile_app.html` を実際のブラウザで動かし、画面ごとの必要高さ・タップターゲット・横オーバーフローを**実測**するための道具。目視やモックではなく数値で判定するために使う。

監査結果の正本は [`../../docs/2026-07-28-mobile-desktop-audit.md`](../../docs/2026-07-28-mobile-desktop-audit.md)。

## 使い方

リポジトリ直下でローカルサーバを起動する（`file://` ではiframeへのアクセスが同一オリジン制約で失敗するため必須）。

```bash
python3 -m http.server 8899
```

### 1. 計測（数値を採る）

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --virtual-time-budget=12000 --window-size=1200,900 \
  --dump-dom "http://localhost:8899/tests/viewport-harness/measure.html?w=393&h=712" \
  | perl -0777 -ne 'print $1 if /RESULT_START(.*?)RESULT_END/s' > /tmp/measure.json
```

`w` / `h` はCSS px。返るJSONの中身:

| キー | 内容 |
|---|---|
| `screens[]` | 画面ID、コンテンツ必要高さ、top-bar高さ、712pt基準の超過量 |
| `smallTargets[]` | 44×44pt 未満のインタラクティブ要素 |
| `overflowX[]` | 横方向にはみ出す画面 |
| `s02Breakdown[]` | 「部屋を選ぶ」画面の高さ内訳 |

### 2. 撮影（見た目を確認する）

```bash
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=7000 --window-size=430,760 --screenshot=/tmp/shot.png \
  "http://localhost:8899/tests/viewport-harness/shot.html?s=s09&w=393&h=690"
```

パラメータ: `s`=画面ID（`s01`〜`s20`）、`w`/`h`=iframeサイズ、`overlay`=`rules`|`making`、`tab`=`rules`|`myrole`|`roles`

## 前提と注意

- **iframeラッパーである理由**: macOSのheadless Chromeは `--window-size` で390px幅を指定しても実際には500pxになる。iframeに固定幅を与えることで正確なモバイル幅を再現している。
- **オープニング演出は自動でスキップされる**（`op-skip-btn` をクリック後、`opening-overlay` を `display:none`）。これをしないと全画面が動画で覆われる。
- **`?demo=1` で読み込む**ため、Firebaseに接続せず単独で動く。ライブ固有の描画は再現されない。
- **safe-area は再現されない。** headless Chrome は `env(safe-area-inset-*)` を 0 として扱う。実機 iPhone 15 Pro は上59pt・下34ptで、`.safe-frame` の padding は `max(16px, env(top))` / `max(24px, env(bottom))` のため、**実機は計測値より +53px 多く必要**。この補正を必ず加えて判断すること。
