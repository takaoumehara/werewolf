# 4a「刻印の台帳 / Quiet Ledger」実装仕様

目的: 動作中の `mobile_app.html` と `design-system.css` を、デザイン `claude-design/project/UI Screens 4a.dc.html` の見た目へ**その場で貼り替える**。機能・JS・正本カードは維持。

ピクセル詳細の正本は `claude-design/project/UI Screens 4a.dc.html`(全20画面)。本書はトークン対応と厳守事項のまとめ。迷ったらデザインHTMLの該当画面の実値を優先。

## 厳守事項(壊してはいけない)

1. **JSロジック・関数名・要素ID・data属性を変えない。** `showScreen` / `setPhase` / `appState` / `renderS03,05,06,07,09,11,14,15,18` / HoldToReveal / dev drawer / 投票・夜フロー / `buildCardWrapper` / `fitCardToSlot` / `updatePhaseHeader` 等。render関数が生成する innerHTML の**見た目**は 4a に変えてよいが、JSが参照するID/クラス/データの流れは保持する(例: `#roleCardSlot` `#voteTargetList` `#lobbyPlayerList` `#compositionList` `#s08Waiting` `#discussionCountdown` `#nightPanel` `#rosterGrid` `.target-option[data-pid]` `.is-selected` など)。
2. **正本カードは不変。** `buildCardWrapper` のマークアップと `.card-wrapper/.card/.card-layer-bg/.card-layer-char/.role-name-japanese/.role-name-english-rt/.card-description-band/.camp-*/.description-text` の CSS(card_viewer 由来)は値を変えない。アセットは `backgrounds-72/{id}_bg.png` と `00_transparent-illustrations-72-a-refined/{id}_ver_a.png`(magician_c 例外)。デザインHTMLの `assets/cards/...` パスは**使わない**(あれはバンドル内コピー)。カードの見せ方(s09 の約252px ヒーロー / s18 の4列ミニカード枠)は 4a に合わせてよいが、カード内部描画は正本のまま。
3. **20画面すべて維持**(s01〜s20)、dev drawer、長押し開示、visibilitychange 秘匿、`prefers-reduced-motion`、タップ領域 ≥44px(4a のプライマリボタンは54px。役職構成の +/- ステッパーはデザインが40pxだが **44px以上**にする)、**中国語を書かない**。
4. **テストを緑のまま保つ。** `tests/design_system_test.sh` は次を grep する→ トークン名 `--p-soot --p-charcoal --p-moonlight --p-werewolf --sp-1 --r-card --tap-min --t-phase --font-mono --fs-timer`、`data-phase="day|night|dawn|verdict|finished"` の5ブロック、クラス `.btn--hold .privacy-cover .hold-to-reveal .phase-header .conn-banner .reconnect-overlay .qr-panel .code-input .waiting-count`、`prefers-reduced-motion`、`:root` に `secret-faction` 文字列を出さない。`tests/mobile_app_test.sh` は `design-system.css` リンク、`id="s01".."s20"`、`REFINED_POSITIONS` `rolesData` `role-name-japanese` `Cinzel Decorative` `LINE Seed JP`、アセットパス、`magician_ver_c.png` `visibilitychange` `prefers-reduced-motion` と記録者文言 `接続を復旧しています` `選択を記録しました` `あと` を grep。→ **これらのトークン名/クラス名/ID/文字列は残す**(値だけ 4a へ)。

## トークン対応(`design-system.css` の :root プリミティブ。**名前は維持・値を差し替え**)

| トークン | 現行 | 4a 新値 | 用途 |
|---|---|---|---|
| `--p-soot` | #07080a | `#08070C` | 最深(暗転 s10) |
| `--p-charcoal` | #0d0f12 | `#0E0C12` | 画面基本地(昼系) |
| `--p-surface` | #111317 | `#14121A` | 面・カード枠地 |
| `--p-ash` | #94a3b8 | `#8F8C97` | 減光テキスト(単色近似) |
| `--p-paper` | #e8e0cf | `#EFE7D3` | 生成りプライマリボタン |
| `--p-oxidized` | #8a8f98 | `#6E6B76` | さらに減光 |
| `--p-line` | rgba(255,255,255,.08) | `rgba(237,233,220,0.12)` | 罫線 |
| `--p-text` | #f1f5f9 | `#EDE9DC` | 主テキスト(生成り) |
| `--p-moonlight` | #9fb4c7 | `#9FB4CE` | 夜アクセント |
| `--p-daylight` | #b7c3d0 | `#C9A84C` | (昼アクセント=金へ) |
| `--p-ember` | #b97a3d | `#D9C7A0` | 朝アクセント(淡い古紙金) |
| `--p-verdict-red` | #7a2226 | `#C25B5B` | 人狼札の赤系にも流用可 |
| `--p-citizen` | #4a6a5f | `#6E8B6A` | 市民陣営 |
| `--p-werewolf` | #8f1d22 | `#C25B5B` | 人狼陣営 |
| `--p-third` | #5f8f7a | `#6F8E86` | 第三陣営 |
| `--p-success` | #4a7a5a | `#6E8B6A` | |
| `--p-warning` | #b08a3d | `#C9A84C` | |
| `--p-danger` | #a03a30 | `#C25B5B` | |
| `--p-info` | #5a7a9a | `#9FB4CE` | |
| `--p-offline` | #6a6a72 | `#6E6B76` | |

**追加トークン:** `--p-gold:#C9A84C; --p-gold-hi:#E0C87E; --p-morning:#D9C7A0;`

**書体:** `--font-body` を `'Zen Kaku Gothic New', sans-serif` に。`--font-heading:'LINE Seed JP', sans-serif;` を追加。`--font-display:'Cinzel Decorative', serif;`(維持、カードEN)。`--font-mono:'IBM Plex Mono', monospace;`(維持)。英字の見出しアイブロウ用に `--font-eyebrow:'Cinzel', serif;` を追加。`@import` に `Zen Kaku Gothic New:wght@400;500;700`・`Cinzel:wght@600;700`・`Zen Antique Soft` を追加。

## セマンティック(各 `data-phase` の `--sem-bg/-bg-elevated/-text/-text-dim/-line/-accent/-glow`)

- **day**: bg `#0E0C12` / elevated `#14121A` / text `#EDE9DC` / dim `rgba(237,233,220,0.5)` / line `rgba(237,233,220,0.12)` / **accent 金 `#C9A84C`** / glow `rgba(201,168,76,0.16)`
- **night**: bg `#0B0A10` / elevated `#14121A` / **accent 月光 `#9FB4CE`** / glow `rgba(159,180,206,0.15)`
- **dawn**(朝 s13): bg `#131009` / **accent 淡金 `#D9C7A0`** / glow `rgba(217,199,160,0.16)`
- **verdict**(s17): bg `#110D0D` / **accent 金 `#C9A84C`** / glow `rgba(201,168,76,0.2)`
- **finished**(s18/s19): bg `#0E0C12` / **accent 金 `#C9A84C`** / text `#EDE9DC`

## コンポーネント再スキン要点

- **プライマリボタン** `.btn--primary`: 生成り `#EFE7D3` 地 / 文字 `#14100A` / min-height 54px / radius 12px / weight 700 / letter-spacing 0.14–0.18em / 枠なし。
- **セカンダリ** `.btn--secondary`: 透明 / 枠 `1px rgba(237,233,220,0.25)` / 文字 `#EDE9DC`。
- **ひし形モチーフ**(刻印): `width:7px;height:7px;transform:rotate(45deg)` 塗り=アクセント色 / 未選択=枠 `1px rgba(237,233,220,0.5)`。状態ドット/待機は 5–6px 版。ユーティリティ class `.diamond` を design-system.css に追加してよい。
- **画面ヘッダー**: 左に英字ブランド(`--font-eyebrow` Cinzel, 10px, letter-spacing .4em, `rgba(237,233,220,0.45)`)、右に「ルール」(12px, `rgba(237,233,220,0.5)`)。グローバル top-bar をこの見た目へ。
- **画面タイトル**: `--font-heading` 800 / 24px / `#EDE9DC` ＋ 12px 減光サブ。
- **台帳リスト行**(ロビー/対象/投票): min-height ~46px、先頭に mono の連番 `01`(18px幅, dim)、氏名(14px)、右に状態テキスト(11px dim)＋準備/選択でひし形。**選択中** = 金の内枠 `background:rgba(201,168,76,0.07); box-shadow: inset 0 0 0 1px rgba(201,168,76,0.55)`(夜は月光 `rgba(159,180,206,...)`)。`.target-option.is-selected` をこの見た目に。
- **記録者ブロック** `.recorder-msg`: アイブロウ「記録者」(10px, letter-spacing .3em, フェーズアクセント)＋本文(15px, line-height 1.9)。
- **待機カウント** `.waiting-count`: 「あと [40px mono アクセント数字] 人…」＋ひし形3つ(不透明度 0.9/0.45/0.2)。
- **大タイマー** `.discussion-timer`/`.countdown`: s14 は 56px mono 金＋細い進捗バー(2px, 金, track rgba .1)。
- **役職構成ステッパー**: 40×40 の枠付き ± ボタン → **44×44 以上**に。数値は mono。
- **QR** `.qr-panel`: 生成り `#F2EDE0` 176px、ファインダー3隅。既存の疑似QR SVG を流用しつつ地を生成りに。
- **カード下の勝利条件ストリップ**(s09): 左ボーダー=陣営色 / 地 `rgba(237,233,220,0.04)` / radius 右のみ。

## フェーズ別 背景(画面 body/セクション)

昼系(s01–s09,s13後の昼,s14,s15,s16,s18,s19)= `#0E0C12`、夜(s10=`#08070C` / s11,s12,s20=`#0B0A10`)、朝 s13=`#131009`、評決 s17=`#110D0D`。`data-phase` の `--sem-bg` で制御し、必要な画面だけ個別地を上書き。

## ブランド

既定アプリ名: 日本語 **記録網** / 英字 **Kirokumō**(デザインの props 既定)。タイトルや英字ブランドに使用。ゲーム名「人狼」は役職・ルール文脈で従来どおり。
