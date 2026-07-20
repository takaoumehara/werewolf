# 4a「刻印の台帳 / Quiet Ledger」実装レポート

対象ブランチ: `mobile-ui-design-system`
編集ファイル: `design-system.css`, `mobile_app.html`
参照元: `claude-design/IMPLEMENT-4a.md`, `claude-design/project/UI Screens 4a.dc.html`(s01–s20)

## ステータス

**DONE**

## テスト結果

```
$ bash tests/design_system_test.sh
OK: design_system_test passed

$ bash tests/mobile_app_test.sh
OK: mobile_app_test passed
```

`node --check` で `<script>` 全体の構文も確認済み(エラーなし)。div の開閉タグ数も一致(121/121)。

## design-system.css の変更点

- `@import`: LINE Seed JP(400/700/800)、Cinzel Decorative(700/900)、**Cinzel(600/700)追加**、IBM Plex Mono(400/500/600)、**Zen Kaku Gothic New(400/500/700)追加**、**Zen Antique Soft 追加**。
- `:root` プリミティブ: `--p-soot`〜`--p-offline` まで、仕様書の対応表どおりに **名前を維持して値のみ** 4a へ差し替え。
- 追加トークン: `--p-gold` `--p-gold-hi` `--p-morning` `--font-heading`(LINE Seed JP) `--font-eyebrow`(Cinzel)。`--font-body` を Zen Kaku Gothic New に変更。
- 5つの `data-phase` セマンティックブロック(day/night/dawn/verdict/finished)を仕様の bg/elevated/text/dim/line/accent/glow 値で再定義。day・verdict・finished は金 `#C9A84C`、night は月光 `#9FB4CE`、dawn は淡金 `#D9C7A0`。
- コンポーネント層:
  - `.btn--primary`(生成りボタン、54px、radius 12px、文字 `#14100A`)/`.btn--secondary`(透明+枠)を再定義。
  - 新規ユーティリティ `.diamond` `.diamond--outline` `.diamond--sm` `.diamond--xs`、`.brand-eyebrow`、`.btn.rules-link`、`.screen-title` `.screen-sub` を追加。
  - `.recorder-msg`(枠なし・中央寄せ・アイブロウ「記録者」)、`.waiting-count`(40px mono アクセント数字)、`.discussion-timer .countdown`(56px 金)+ `.track`(2px)、`.target-option`/`.target-option.is-selected`(枠なしのledger行 + 内側box-shadow)、`.player-row`(border-bottomのledger行)、`.status-badge`(ピル廃止・素のテキスト)、`.qr-panel`(`#F2EDE0` 生成り地)、`.room-code`(枠なしmono金文字)を4aへ再スキン。
  - `.phase-header .phase-title` / `.countdown` を LINE Seed JP・金へ変更。
- `secret-faction` は引き続き `:root` に出現しない(hold-to-reveal スコープ内のみ)。トークン名/クラス名は全て維持。

## mobile_app.html の変更点

### 共通シェル
- top-bar を英字アイブロウ(`Kirokumō`, Cinzel 10px letter-spacing .4em)+「ルール」リンクへ再スキン。
- splash(s01/s08/s10/s12/s16/s19)共通の `.recorder-msg`/`.center-note`/`.waiting-count` をアイブロウ・生成り文字で統一。
- `.roster-grid` を3列→**4列**、ミニカード枠を radius 8px / `--p-surface` 地へ(s18仕様)。
- `.card-slot--hero` を 300px→**252px** へ(s09仕様)。
- 役職構成ステッパーは既存の `min-width/height:44px` を維持(4aモックの40pxより広く、ハード制約どおり44px以上を確保)。

### 画面ごと(s01–s20)
- **s01**: ひし形マーク + 「記録網」(LINE Seed JP 800/36px) + 「Kirokumō」(Cinzel Decorative)+ サブコピー + `はじめる` プライマリボタン + `REC. 0.4.1` フッター。
- **s02**: `.screen-title`/`.screen-sub` 追加。「部屋をつくる」(塗りひし形)/「部屋に入る」(枠ひし形)を台帳風の `.option-row`(枠1px、chevron付き)へ差し替え(旧 `.option-card` 廃止)。
- **s03**: `renderS03()` を更新。QRパネルを生成り地に、合言葉をラベル+monoの素のテキストへ、共有ボタンを46px、参加人数を金mono数字の `.waiting-count` へ。host/joinの見出しサブテキストを動的設定する `#s03Sub` を追加。
- **s04**: 見出し/サブコピー位置をモックに合わせて並び替え。
- **s05**: `renderS05()` を更新。台帳行に mono連番(`01`〜`08`)+ ひし形状態マーカーを追加、合言葉表示・参加/準備カウント行を追加。
- **s06**: `.screen-title`/`.screen-sub` 追加のみ(GM選択パネルはセグメントコントロールのまま、モックのカード選択UIとは簡略化した対応 — 下記「逸脱」参照)。
- **s07**: `renderComposition()` を更新。ledger行(border-bottom区切り、mono数値、±ボタン10px radius)、合計行を「合計 N 人 / 参加 8 人」形式に変更。
- **s08**: 文言をモックに合わせ整理、3つの静的ひし形インジケータ `.waiting-diamonds` を追加。
- **s09**: 見出し/サブコピーを追加、カードヒーローを252pxへ、確認ボタン後の注記位置をモックに合わせ移動。`.role-secret-info` は border-left陣営色 + `rgba(paper,0.04)` 地の勝利条件ストリップへ再スキン。
- **s10**: 改行を持つ3行メッセージ、上部にひし形マークを追加。
- **s11**: `renderS11()` を更新。ヘッダー(`.screen-title`/`.screen-sub`)、区切り線、記録者アイブロウ + 問いかけ文、ledger化した `.target-selector`、フッター注記を追加。`.night-panel` の箱型スタイルは廃止し等幅リストの直置きレイアウトへ。
- **s12**: s08と同様に静的ひし形を追加。
- **s13/s17**: 「朝の記録」「評決の記録」アイブロウ + 見出し + 44px罫線 + 結果テキスト(アクセント色太字)+ 説明文の順にモック準拠で再構成。
- **s14**: ヘッダー追加、タイマー56px金、進捗バー2px、「残り時間 / 3:00」注記、前夜情報を左ボーダー付きの引用ブロックへ。
- **s15**: ヘッダー追加、投票リストをledger化(`renderS15` のマークアップは既存のままCSSで台帳行に統一)。
- **s16**: 改行位置調整のみ。
- **s18**: 「終幕の記録」アイブロウ、4列ロースター、`renderS18()` はそのまま(CSSでミニカード外観を変更)。
- **s19**: `.recovery-panel` 箱型 → `.splash` 中央寄せへ変更、モックの中央レイアウトに合わせた。
- **s20**: `.recovery-panel` を「最後に確認した状態」情報ボックスとして再利用し、ひし形インジケータ + アイブロウ文言を追加。

### JS(値のみ変更、ロジック/ID/関数名は不変)
- `buildFakeQrSvg()`: 塗り色を `#0d0f12` → `#171310` に変更(視覚のみ)。
- `renderS03`/`renderS05`/`renderComposition`/`renderS11` の innerHTML テンプレートを上記の通り更新。ID・クラス・イベントハンドラ名(`selectNightTarget` 等)は維持。
- ブランド表示名は仕様書の既定値に合わせ、UI上のブランド表記(splash・top-bar)を「記録網 / Kirokumō」に変更。ゲームルール文脈(ルールドロワー、役職名など)は従来どおり「人狼」表記を維持。

## 必須文言・アセットの確認

- `接続を復旧しています` `選択を記録しました` `あと` — 維持(grep確認済み)。
- `backgrounds-72/{id}_bg.png` / `00_transparent-illustrations-72-a-refined/{id}_ver_a.png` / `magician_ver_c.png` 例外 — 未変更。
- `buildCardWrapper` のマークアップ、`.card-*` / `.role-name-*` / `.card-description-band` / `.camp-*` / `.description-text` の CSS 値 — 未変更。
- `visibilitychange`、`prefers-reduced-motion`、dev drawer、長押し開示(HoldToReveal)、s01–s20 全20画面 — 維持。
- 中国語混入なし(`tests/mobile_app_test.sh` の python3 チェックで確認済み)。

## モックからの逸脱と理由

1. **グローバル top-bar / globalPhaseHeader の常時表示**: モックでは画面ごとに右上の表示(「ルール」/「第◯夜」/「二日目 朝」/「評決」/「終幕」など)が切り替わるが、既存実装ではこの top-bar が全画面共通の固定要素として先に存在し、さらに `#globalPhaseHeader` という別のフェーズ表示コンポーネントが一部画面(s08,s09,s11–s17)に重ねて表示される設計になっていた。この二重ヘッダー構造自体は本タスク以前からの既存アーキテクチャであり、JS変更なしでは大幅な再設計になるため、色/フォントのみ4aへ揃え、表示ロジック(どの画面で何を出すか)は変更していない。
2. **`.splash` の中央揃えレイアウト**: モックは「中央に主文言、下部固定にボタン」という上下分離レイアウトだが、既存の `.splash` ユーティリティは6画面(s01/s08/s10/s12/s16/s19)で共有される単一の中央揃えflexカラムとして実装されている。JS/構造を壊さない範囲で改修すると全画面共通ユーティリティの大改造になるため、今回は「全体を中央揃え」のまま据え置いた(視覚的には十分近いが、ボタンが画面最下部に張り付かない点がモックと異なる)。
3. **s06(進行役の選択)**: モックはカード風の選択パネル(選ばれている方が金の内枠+太字)だが、既存はセグメントコントロール(`#gmSeg` のタブ切替)。JSの `data-gm` / `renderS06` 挙動を保つため、見た目のトークン(タブ選択時 `--sem-accent` 背景など)のみ4a配色に追従させ、コンポーネント自体の作り替えは行っていない。
4. **s14の残り時間表記**: モックは「残り時間 / 3:00」の固定表記(実際のタイマーはJSで動く)。実装もJSの `discussionSecondsLeft` ロジックは変更せず、静的ラベルのみモックに合わせて追加した。
5. **s11の「第二夜」タイマー表示**: モックには右上に「第二夜」+ `01:24` の静的タイマーがあるが、既存JSに夜の残り時間を管理する状態がないため、追加しなかった(既存の `#globalPhaseHeader` が代わりに「夜」の状態を示す)。

## 自己レビュー

各画面で「英字アイブロウ or ブランド」「画面タイトル(LINE Seed JP 800/24px)」「生成りプライマリボタン」「ひし形モチーフ」「フェーズアクセント(day/verdict/finished=金、night=月光、dawn=淡金)」「記録者ブロック」の有無を確認し、全20画面に反映済み。カード内部(`buildCardWrapper`/`.card-*`)・アセットパス・JS関数群・ID/data属性は変更していない。

---

## Gap-closing パス(2回目)

1回目パスで残っていた「中央寄せ画面のボタン位置」「s06パネル」「装飾タイマー」のギャップを、モック(`UI Screens 4a.dc.html` s01–s20)と再照合して閉じた。JSの関数名・ID・data属性・データフローは変更していない(`#s03Body`/`#s03Title`/`#s03Sub`/`#gmSeg`/`#gmDesc`/`data-gm`/`is-selected`/`renderS03`/`renderS06`/`renderS11` は維持、値のみ更新)。

### 1. ボトム固定ボタン(中央寄せ画面)

`.screen` は `display:flex;flex-direction:column;flex:1;` なので、`.splash`(既に `flex:1` + 中央寄せ)を「本文のみ」で閉じ、ボタン・下部注記を `.splash` の**外**(`.screen` の直接の兄弟要素)に出すだけで、`.splash` が残りの高さを吸収してボタン群が画面下端(`.safe-frame` の `padding-bottom: 24px` 相当)に自然に張り付くようにした。

- **s01**: `.stack`(はじめるボタン + `REC. 0.4.1`)を `.splash` の外へ。
- **s03**: `#s03Body` に `class="splash"` を付与して本文(QR/コード入力)を中央寄せ `flex:1` に。参加人数行(`#s03CountLine`)と「次へ」ボタンを新設の `#s03Footer` へ分離。`renderS03()` を更新し、参加人数行を `.waiting-count`(40px巨大数字)から、モック実値どおりの小さい `.center-note`(11px、mono金のインライン数字)へ変更、出力先を `#s03CountLine` に変更。
- **s04**: 「この名前で進む」ボタンに `style="margin-top:auto;"` を付与し、`.screen` の直接子として下端に押し出す(モックと同じ手法)。旧 `padding-bottom:var(--sp-8)` の力技は撤去。
- **s06**: 下記4参照。「次へ」ボタンに同じく `margin-top:auto` を付与。
- **s08 / s12**(指示どおり中央寄せのまま、下部注記のみ分離): 「そろい次第、自動で役職確認へ進みます。」「端末を伏せてお待ちください。」を `.splash` の外へ。ボタンは中央寄せブロック内に残置(モックにボタンが無い=デコレーション扱いのため)。
- **s10**: 「記録者の合図で、自動で進みます。」を `.splash` の外へ。
- **s13 / s17**: `.fullscreen-reveal` に `flex:1` を追加(元は position:relative オーバーライドのみで高さが縮んでいた)。「議論へ」「次へ」ボタンを `.fullscreen-reveal` の外に出し、画面下端へ。
- **s16**: 「決選投票へ」ボタンを `.splash` の外へ。モックにある得票数ピル(下記4参照)も追加。
- **s19**: 「同じメンバーで再戦」「ロビーに戻る」の `.stack` を `.splash` の外へ。
- **s20**: `.reconnect-overlay` に `flex:1` を追加。「復旧して合流する」ボタン+下部注記を `.reconnect-overlay` の外の `.stack` へ分離。

### 2. s06 進行役の選択 → 積み重ねカードパネル

`.seg-control` タブ切替を廃止し、モックどおり「1つの枠付き角丸コンテナに2行を縦積み」する `.gm-panel` / `.gm-row` を新設(`mobile_app.html` ローカル `<style>` に追加、他画面で使わないため design-system.css には置かない)。

- `#gmSeg` id・`data-gm="ai"/"human"`・`is-selected` トグルはそのまま維持。DOMContentLoaded の `seg.querySelectorAll('button')` クリックハンドラも無変更で動作(構造は変わったが `#gmSeg > button` である点は同じ)。
- 選択中行: `background:rgba(201,168,76,0.08); box-shadow:inset 0 0 0 1px rgba(201,168,76,0.55)`。ひし形(`.gm-row-diamond`)は `.gm-row.is-selected` 修飾で塗り/枠を切り替えるので、どちらを選んでも見た目が追従する(JS変更不要)。
- 説明文(「進行・判定・夜の記録をすべて担います。」等)は各行内にモック文言で静的に埋め込み。`renderS06()` が書き込む `#gmDesc` はハードコンストレイントに従い DOM に残しつつ `u-hidden` で非表示化(エラーは出ない)。
- 各行 `min-height: var(--tap-min)`(44px)以上を確保。

### 3. 装飾フェーズタイマー

- **s11**(`renderS11()`): タイトル行を `justify-content:space-between;align-items:flex-end` の2カラムにし、右側に静的 `01:24`(`.countdown` 流用、18px、色 `var(--p-moonlight)`)を追加。JS配線なし、`aria-hidden="true"`。
- **s15**: 同様にタイトル行右側へ静的 `00:48`(18px、既定の金アクセント色)を追加。加えてモックに合わせ、タイトル行の下に `.engraved-rule` の罫線と、投票ボタン手前に静的「投票済み 3 / 7」の注記を追加(いずれも装飾・非配線)。

### 4. その他の細部整合

- **s16**: 「対象: 沙耶 / アキラ」のプレーンテキストを廃し、モックどおりの得票数ピル(`.vote-pill` × 2、金枠+mono金の票数)に変更。
- 上記以外(s02, s05, s07, s09, s14, s18 など)はモックと突き合わせて確認済みで、既存実装のまま(タスク指示どおり「正しければそのまま」)。

### 既知の残差(意図的な逸脱、変更なし)

1回目レポートに記載の「グローバル top-bar が画面ごとのフェーズ文言(第二夜/評決/終幕など)に切り替わらない」「s09の勝利条件ストリップは長押し中のみ開示(モックは常時表示に見えるが、秘匿要件を優先して既存の hold-to-reveal 範囲内に維持)」は、JS/アーキテクチャ変更を伴うため今回も未着手。s18 のロースターグリッド(4列・8px gap・radius 8px)は既にモックと一致していたため変更なし。
