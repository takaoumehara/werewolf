# Design System — 対面人狼ゲーム(モバイル UI)

更新日: 2026-07-19

このファイルは `design-system.css` の正本文書です。トークン値・class 名はすべて `design-system.css` の実装と一致させています。値を変更する場合は、必ず `design-system.css` を先に変更し、このファイルへ転記してください(逆方向の編集は禁止)。

対象読者: UI 実装者(`mobile_app.html` など)、および将来 Figma / JSON token へ移植する担当者。

---

## 1. 5 原則と判断例

デザイン判断はすべて次の 5 原則のどれかに紐づけられる。判断に迷ったときは、この順で優先する根拠にする。

### Ritual(儀式性)

参加・役職確認・夜・投票・結果には、儀式的な区切りを与える。

- 判断例: フェーズ切替(`data-phase` の変更)には `--t-phase`(600ms)のクロスフェードを必ず入れる。通常のボタン押下(`--t-instant` 120ms)と同じ速さで切り替えない。フェーズが「軽い」印象になり、ritual が壊れるため。

### Legibility(可読性)

暗い環境・小さい画面・緊張した状態でも読める。

- 判断例: 本文サイズは `--fs-body`(15px)を下限にし、`--fs-caption`(12px)未満は基本 UI に使わない。夜フェーズの `--sem-text-dim` は `--p-oxidized`(#8a8f98)を使い、`--p-soot` 背景でも AA コントラストを満たす組み合わせのみ採用する(3.で detail)。

### Secrecy(秘匿性)

端末の外観から秘密の役職や行動が漏れない。

- 判断例: `--secret-faction-color` / `--secret-role-accent` は `:root` に実値を置かない。`.hold-to-reveal .revealed` / `.hold-to-reveal.revealed` の内側でのみ実値化する。これにより、CSS を静的に読んでも「今どの陣営色が表示され得るか」が該当コンポーネントの外に漏れない。

### Recoverability(回復可能性)

通信切断・誤操作・画面離脱から安全に戻れる。

- 判断例: `ReconnectOverlay`(`.reconnect-overlay`)は「エラーが起きた」ではなく「接続を復旧しています」+最後に確認した状態を表示する。投票・夜行動の確定後は `.is-completed` 状態でボタンを無効化し、再接続後も重複送信されないようにする。

### Restraint(抑制)

カードイラストを主役にし、装飾を必要な場所だけに使う。

- 判断例: `.texture-overlay` の opacity は `--texture-opacity`(0.06)を超えない(上限 0.08)。ロビーや投票画面などの操作画面では、役職イラストを薄い背景装飾として使わない。カードを大きく見せるのは役職確認とゲーム終了(`RoleCard` / `RoleRosterReveal`)のみ。

---

## 2. トークン表

以下は `design-system.css` の実値をそのまま転記したものです(創作値なし)。

### 2.1 色 — Primitive(Neutral / Phase 基礎色)

| Token | 値 |
|---|---|
| `--p-soot` | `#07080a` |
| `--p-charcoal` | `#0d0f12` |
| `--p-surface` | `#111317` |
| `--p-ash` | `#94a3b8` |
| `--p-paper` | `#e8e0cf` |
| `--p-oxidized` | `#8a8f98` |
| `--p-line` | `rgba(255, 255, 255, 0.08)` |
| `--p-text` | `#f1f5f9` |
| `--p-moonlight` | `#9fb4c7` |
| `--p-daylight` | `#b7c3d0` |
| `--p-ember` | `#b97a3d` |
| `--p-verdict-red` | `#7a2226` |

### 2.2 色 — Primitive(Faction。秘密コンテキスト限定 — component 層でのみ参照)

| Token | 値 | 用途 |
|---|---|---|
| `--p-citizen` | `#4a6a5f` | 市民陣営(秘密表示時のみ) |
| `--p-werewolf` | `#8f1d22` | 人狼陣営(秘密表示時のみ) |
| `--p-third` | `#5f8f7a` | 第三陣営(秘密表示時のみ) |

### 2.3 色 — Primitive(semantic-status)

| Token | 値 |
|---|---|
| `--p-success` | `#4a7a5a` |
| `--p-warning` | `#b08a3d` |
| `--p-danger` | `#a03a30` |
| `--p-info` | `#5a7a9a` |
| `--p-offline` | `#6a6a72` |

### 2.4 色 — Semantic(`[data-phase]` ごとに切り替わる)

| Phase | `--sem-bg` | `--sem-bg-elevated` | `--sem-text` | `--sem-text-dim` | `--sem-line` | `--sem-accent` | `--sem-glow` |
|---|---|---|---|---|---|---|---|
| `day`(城塞の公開評議会) | `--p-charcoal` | `--p-surface` | `--p-text` | `--p-ash` | `--p-line` | `--p-daylight` | `rgba(183, 195, 208, 0.25)` |
| `night`(記録網による一斉消灯) | `--p-soot` | `--p-charcoal` | `--p-text` | `--p-oxidized` | `--p-line` | `--p-moonlight` | `rgba(159, 180, 199, 0.3)` |
| `dawn`(夜明け・ランタン) | `--p-charcoal` | `--p-surface` | `--p-text` | `--p-ash` | `--p-line` | `--p-ember` | `rgba(185, 122, 61, 0.28)` |
| `verdict`(生存権を決める裁定) | `--p-soot` | `--p-charcoal` | `--p-text` | `--p-ash` | `--p-line` | `--p-verdict-red` | `rgba(122, 34, 38, 0.35)` |
| `finished`(幕引き・古紙トーン) | `--p-charcoal` | `--p-surface` | `--p-paper` | `--p-oxidized` | `--p-line` | `--p-paper` | `rgba(232, 224, 207, 0.18)` |

### 2.5 タイポグラフィ

| Token | 値 |
|---|---|
| `--font-body` | `'LINE Seed JP', sans-serif` |
| `--font-display` | `'Cinzel Decorative', 'Hiragino Mincho ProN', 'Yu Mincho', serif` |
| `--font-mono` | `'IBM Plex Mono', monospace` |
| `--fs-display` | `28px` |
| `--fs-heading` | `20px` |
| `--fs-body` | `15px` |
| `--fs-label` | `13px` |
| `--fs-caption` | `12px`(基本 UI の下限。これ未満は使わない) |
| `--fs-timer` | `40px` |
| `--fs-code` | `32px` |

用途: `--font-body` は本文・通常 UI(可読性優先)。`--font-display` は儀式的場面(`.phase-header .phase-title` 等)のみ。`--font-mono` は 6 桁コード・タイマーなど tabular numeral が必要な箇所(`.code-input`, `.countdown`, `.waiting-count`)。

### 2.6 Spacing(4px 基準)

| Token | 値 |
|---|---|
| `--sp-1` | `4px` |
| `--sp-2` | `8px` |
| `--sp-3` | `12px` |
| `--sp-4` | `16px` |
| `--sp-5` | `20px` |
| `--sp-6` | `24px` |
| `--sp-8` | `32px` |
| `--sp-12` | `48px` |

### 2.7 Shape

| Token | 値 | 用途 |
|---|---|---|
| `--r-control` | `6px` | ボタン・入力・バッジ等の小型コントロール |
| `--r-sheet` | `12px` | bottom sheet・dialog・panel |
| `--r-card` | `16px` | RoleCard・night-panel(既存カード踏襲) |
| `--tap-min` | `44px` | タップ領域の最小値(幅・高さとも) |

### 2.8 Motion

| Token | 値 | 用途 |
|---|---|---|
| `--t-instant` | `120ms` | 押下フィードバック(`.btn:active` 等) |
| `--t-micro` | `200ms` | 状態・色・境界線の小さな遷移 |
| `--t-phase` | `600ms` | フェーズ切替のクロスフェード |
| `--t-cinematic` | `1200ms` | FullScreenReveal 等の演出 |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 標準イージング |

### 2.9 Texture

| Token | 値 | 制約 |
|---|---|---|
| `--texture-opacity` | `0.06` | 上限 0.08。古紙・金属質感は必ず overlay token 経由で、本文の背後に強く敷かない |

---

## 3. 命名規則

- `--p-*`(primitive): 生の値。色コード・px・ms などの実値そのもの。`:root` にのみ定義する。コンポーネント CSS から直接参照しない(例外: `.hold-to-reveal.revealed` 内の secret token 定義、`body` の fallback 値)。
- `--sem-*`(semantic): `[data-phase="..."]` セレクタの内側でのみ定義される、意味づけされたトークン。同じ `--sem-accent` でもフェーズによって指す primitive が変わる。コンポーネント CSS はこの層を参照する(`var(--sem-accent, var(--p-moonlight))` のように primitive を fallback に持たせる)。
- `--secret-*`(secret): `--secret-faction-color` / `--secret-role-accent`。`.hold-to-reveal` 内でのみ存在し、既定は `initial`。`.hold-to-reveal .revealed` / `.hold-to-reveal.revealed` の内側でのみ実値(`--p-werewolf` 等)を持つ。**`:root` や `--sem-*` からは絶対に参照しない。**
- component class: BEM 風の `.block`, `.block--variant`, `.is-state` を使う(例: `.btn`, `.btn--primary`, `.btn.is-loading`)。`--variant` は見た目のバリエーション、`.is-*` は動的な状態(`disabled` は属性セレクタ `[disabled]` を使う)。

---

## 4. コンポーネント一覧

用途・状態・do/don't。class 名は `design-system.css` と一致。

### Foundation

| Component(class) | 用途 | 状態 |
|---|---|---|
| `.app-shell` | 画面全体のルートコンテナ。`min-height:100dvh` | — |
| `.safe-frame` | safe-area を考慮した中央寄せコンテンツ枠(最大幅 480px) | — |
| `.phase-backdrop` | フェーズごとの淡いグロー背景 | フェーズ切替でクロスフェード |
| `.texture-overlay` | 紙質・刻印のノイズ表現 | opacity ≤ 0.08 固定 |
| `.engraved-rule` | 銅版画罫線風の区切り線 | — |

Do: `.phase-backdrop` は抽象的なグローに留め、役職の記号を作らない。
Don't: `.texture-overlay` を本文コンテナの直下に重ねて読みにくくしない。

### Actions

| Component(class) | 用途 | 状態 |
|---|---|---|
| `.btn` / `.btn--primary` / `.btn--secondary` / `.btn--quiet` / `.btn--danger` | 汎用ボタン | `[disabled]`, `.is-loading` |
| `.btn--hold` | 長押し確定ボタン(`--hold-progress` を JS で更新) | `.is-pressed` |
| `.seg-control` | セグメントコントロール(GM モード選択等) | `.is-selected`(子 button) |
| `.text-field` | テキスト入力(表示名等) | `.is-error` |
| `.code-input` | 6 桁コード入力(等幅・広い字間) | `.is-error` |
| `.ready-control` | 準備完了トグル | `.is-selected` |
| `.target-selector` / `.target-option` | 夜の対象・投票候補の選択 UI | `.target-option--selected` / `.is-selected`, `[disabled]` |
| `.vote-ballot` | 投票の確認パネル | — |

Do: `.btn` は必ず `min-height:var(--tap-min)` を満たす(44px)。確定後は `.is-loading` → `.is-completed`(下記 Information の `.status-badge` 併用)で重複送信を防ぐ。
Don't: `.target-option` の選択状態を色だけで表現しない(境界線 + 背景の変化を併用済みだが、テキストラベルを省略しない)。

### Information

| Component(class) | 用途 | 状態 |
|---|---|---|
| `.phase-header` | フェーズ名/すべきこと/残り時間/同期状態の 4 点を常時表示 | — |
| `.countdown` | タイマー数字(`--font-mono`, tabular) | `.is-error` |
| `.discussion-timer` | 議論タイマーのバー表示 | — |
| `.recorder-msg` | 記録者(GM AI)発話。テレタイプ体裁 | — |
| `.status-badge` | 状態バッジ | `.is-completed`, `.is-error`, `.is-offline` |
| `.conn-banner` | 接続バナー | `.is-offline`, `.is-reconnecting`, `.is-error` |
| `.sync-indicator` | 同期状態の小型インジケータ | `.is-offline`, `.is-reconnecting`, `.is-error` |
| `.waiting-count` | 「あと n 人」の待機表示(名前非公開) | — |
| `.inline-notice` | インライン通知 | `.is-error` |
| `.toast` | 一時的なトースト通知 | `.is-error` |
| `.recovery-panel` | エラー回復パネル | — |

Do: `.phase-header` は常にフェーズ名・すべきこと・残り時間・同期状態の 4 点を揃える。`.waiting-count` は人数のみ表示し、未入力者の名前は出さない。
Don't: `.recorder-msg` に原因不明の「エラーが発生しました」を入れない(6 節参照)。

### Game

| Component(class) | 用途 | 状態 |
|---|---|---|
| `.qr-panel` | QR コード表示(白地固定 + quiet zone 12px 以上) | — |
| `.room-code` | 6 桁ルームコード表示 | — |
| `.player-list` / `.player-row` | 参加者一覧 | `.is-selected`, `.is-offline`, `.is-completed` |
| `.privacy-cover` | 秘密情報の覆い(封蝋された機密記録の外観、全役職共通) | — |
| `.hold-to-reveal` / `.revealed` | 長押しでのみ秘密情報を開示するラッパー | `.revealed` |
| `.night-panel` | 夜の行動パネル | — |

Do: `.privacy-cover` の外観・文言は役職に関わらず共通にする(人狼だけ違う見た目にしない)。
Don't: `.night-panel` に `--secret-*` 系トークンを持ち込まない。夜の外観は全役職同一。

### Overlays

| Component(class) | 用途 | 状態 |
|---|---|---|
| `.bottom-sheet` | 下から出るシート | — |
| `.dialog` / `.dialog-panel` | モーダルダイアログ(誤操作の退出確認など) | — |
| `.fullscreen-reveal` | 処刑/勝敗などの演出用フルスクリーン | — |
| `.rules-drawer` | ルール参照用ドロワー(外部遷移なし) | — |
| `.reconnect-overlay` | 再接続オーバーレイ | `.is-reconnecting` |

Do: `.dialog` による確認は「退出」など不可逆操作にのみ使う。
Don't: 毎操作の確認に `.dialog` を出さない(記録者の文体ガイド・避ける例と同じ理由)。

---

## 5. Public / Private / Concealed コンテキスト規則

3 つのコンテキストを明確に分離する。

- **Public**: ロビー、昼、共通待機、結果公開。`--sem-*` トークンのみで構成する。`--secret-*` を一切参照しない。
- **Private**: 役職確認、夜の対象選択、自分の投票。本人の端末上でのみ秘密情報を表示する。`.hold-to-reveal.revealed` の内側に限定する。
- **Concealed**: `.privacy-cover`。周囲から覗き見られる可能性がある状態。役職に関わらず同一の外観(封蝋された機密記録)にし、長押し中だけ Private コンテキストへ遷移する。

### 秘密トークンのスコープ

`--secret-faction-color` / `--secret-role-accent` は次の 2 箇所以外で実値を持たない。

```css
.hold-to-reveal {
  --secret-faction-color: initial;
  --secret-role-accent: initial;
}
.hold-to-reveal .revealed,
.hold-to-reveal.revealed {
  --secret-role-accent: var(--p-moonlight);
}
/* 陣営色は revealed 状態 × 陣営 class の組み合わせでのみ解決される */
.hold-to-reveal.revealed.faction-citizen,
.hold-to-reveal .revealed.faction-citizen {
  --secret-faction-color: var(--p-citizen);
}
.hold-to-reveal.revealed.faction-werewolf,
.hold-to-reveal .revealed.faction-werewolf {
  --secret-faction-color: var(--p-werewolf);
}
.hold-to-reveal.revealed.faction-third,
.hold-to-reveal .revealed.faction-third {
  --secret-faction-color: var(--p-third);
}
```

陣営 class(`faction-citizen` / `faction-werewolf` / `faction-third`)は JS が役職確認画面のレンダリング時に付与する。covered 状態では class があっても値は解決されない(`.revealed` との組み合わせが必須)。なお `.privacy-cover` の再遮蔽(covered へ戻る方向)は `transition: none` で即時、開示方向のみ `--t-micro` のフェードとする。

`:root` や `[data-phase]` の semantic 層では定義しない。これにより、「秘密情報がどのタイミングで実値化されるか」を CSS の構造そのものが強制する(実装者が誤って `:root` に置いても、`.hold-to-reveal` 内で `initial` に上書きされるため露出しない)。

### アプリスイッチャー preview 対策(visibilitychange)

スマートフォンのアプリスイッチャー・OS のプレビュー機能は、タブを離れた瞬間の画面をスクリーンショットとして保持する。長押し中に秘密情報を表示したままアプリを切り替えると、そのプレビューから役職が漏れる。

これを防ぐため、実装(`mobile_app.html`)は次を必須とする。

- `document.addEventListener('visibilitychange', ...)` を監視し、`document.hidden === true` になった瞬間に、開いている `.hold-to-reveal` をすべて `.revealed` から外し `.privacy-cover` を再表示する(遅延なし・アニメーションを待たない)。
- 同様に `pointerup` / `pointercancel`(長押しの解除)でも即座(`--t-instant` 以内、目安 ≤120ms)に cover へ戻す。
- `blur` イベント(ウィンドウフォーカス喪失)でも同じ復帰処理を行うことを推奨する(ブラウザ実装差の保険)。

Do: 長押し以外の手段(タップだけで開いたまま放置できる UI)で秘密情報を出さない。
Don't: `visibilitychange` の処理を「アニメーションのフェードアウト後」に遅延させない。露出時間を最短にすることが目的のため、即時に DOM 状態を戻す。

---

## 6. 記録者の文体ガイド

記録者(GM AI)の人格: 静か・正確・中立・短文。プレイヤーを脅したり、怪しさを評価したりしない。

### 推奨例

- 「記録を確認してください。」
- 「対象を 1 人選んでください。」
- 「選択を記録しました。」
- 「あと 1 人の入力を待っています。」
- 「接続を復旧しています。」
- 「評議を開始します。」

### 避ける例

- 「あなたは本当に人間ですか？」を毎画面で繰り返す。
- 「AI があなたの嘘を見抜きます。」
- 原因や対処が分からない「エラーが発生しました。」
- 世界観のためだけに理解しにくい造語を使う。

### 補足ルール

- 重要な操作は普通の日本語を主表記にし、劇中用語は補助表記にする(例:「部屋をつくる — 区画名簿を開設」)。
- 中国語の語彙・漢字表現は一切使わない(簡体字混入チェックを静的テストで行う)。
- `.recorder-msg` は 1 メッセージにつき 1 用件。複数の指示を 1 文に詰め込まない。

---

## 7. アクセシビリティチェックリスト

- [ ] 本文コントラストが WCAG AA を満たす(`--sem-text` / `--sem-text-dim` と各フェーズの `--sem-bg` / `--sem-bg-elevated` の組み合わせで確認する)。
- [ ] すべてのタップ可能要素が `--tap-min`(44×44px)以上。
- [ ] `prefers-reduced-motion: reduce` で transition/animation が 1ms・opacity のみへ縮退する(`design-system.css` 5 節を参照)。
- [ ] 状態(選択・完了・エラー・オフライン等)を色だけで表現せず、ラベル・アイコン・形状を併用する。
- [ ] `--fs-caption`(12px)未満のテキストを基本 UI に使わない。
- [ ] 日本語の長い役職名・表示名が折り返しても崩れない(固定幅前提のレイアウトを避ける)。
- [ ] 200% テキストズームでもタップ領域・レイアウトが破綻しない(rem/px の固定値に依存しすぎない)。
- [ ] QR コード(`.qr-panel`)は白地固定 + quiet zone 12px 以上を維持する。
- [ ] 音声なしでも全操作が完結する(音・振動は補助情報のみ)。
- [ ] 秘密の役職・行動に固有の音・振動を割り当てない(共通フェーズ通知のみ)。
- [ ] キーボードフォーカス順序が操作順と一致する(`.text-field`, `.code-input`, `.seg-control` 等)。

---

## 8. Token schema 例(CSS → JSON 移植)

将来 Figma Variables や Style Dictionary へ移植する場合の JSON 構造例。`$type` / `$value` は W3C Design Tokens 形式に準拠する。primitive → semantic → secret の 3 層構造を保つ。**secret 層は公開ビルドの token バンドルに含めず、別ファイル(例: `tokens.secret.json`)として分離し、開示コンポーネントの実装からのみ import する。**

```json
{
  "p": {
    "soot": { "$type": "color", "$value": "#07080a" },
    "charcoal": { "$type": "color", "$value": "#0d0f12" },
    "surface": { "$type": "color", "$value": "#111317" },
    "ash": { "$type": "color", "$value": "#94a3b8" },
    "paper": { "$type": "color", "$value": "#e8e0cf" },
    "moonlight": { "$type": "color", "$value": "#9fb4c7" },
    "daylight": { "$type": "color", "$value": "#b7c3d0" },
    "ember": { "$type": "color", "$value": "#b97a3d" },
    "verdict-red": { "$type": "color", "$value": "#7a2226" },
    "success": { "$type": "color", "$value": "#4a7a5a" },
    "danger": { "$type": "color", "$value": "#a03a30" },
    "sp-4": { "$type": "dimension", "$value": "16px" },
    "r-card": { "$type": "dimension", "$value": "16px" },
    "tap-min": { "$type": "dimension", "$value": "44px" },
    "t-phase": { "$type": "duration", "$value": "600ms" }
  },
  "sem": {
    "night": {
      "bg": { "$type": "color", "$value": "{p.soot}" },
      "bg-elevated": { "$type": "color", "$value": "{p.charcoal}" },
      "text": { "$type": "color", "$value": "{p.text}" },
      "text-dim": { "$type": "color", "$value": "{p.oxidized}" },
      "accent": { "$type": "color", "$value": "{p.moonlight}" }
    },
    "verdict": {
      "bg": { "$type": "color", "$value": "{p.soot}" },
      "accent": { "$type": "color", "$value": "{p.verdict-red}" }
    }
  }
}
```

```json
// tokens.secret.json — 開示コンポーネント専用。公開バンドルへ含めない
{
  "secret": {
    "faction-color": {
      "werewolf": { "$type": "color", "$value": "{p.werewolf}" },
      "citizen": { "$type": "color", "$value": "{p.citizen}" },
      "third": { "$type": "color", "$value": "{p.third}" }
    },
    "role-accent": {
      "$type": "color",
      "$value": "{p.moonlight}"
    }
  }
}
```

移植時の注意:

- CSS の `var(--sem-accent, var(--p-moonlight))` のような fallback 構造は、JSON では「semantic トークンが未定義の場合に primitive を参照する」という参照解決順として実装する(Style Dictionary の alias 解決に相当)。
- `--secret-*` を通常の token パイプラインで自動生成しない。開示コンポーネントのビルド時にのみ `tokens.secret.json` を注入する仕組みにする(Web の `:root` 直書きを避けた設計思想を JSON 側でも踏襲する)。
