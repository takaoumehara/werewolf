# 月下ノ影 — モバイル/デスクトップ 全面監査レポート

作成日: 2026-07-28
対象: `mobile_app.html` (4692行) / `design-system.css` / `game-client/` / `functions/` / `game-engine/`
本番同一性: `public/index.html` は `mobile_app.html` と**バイト同一**（`cmp` で確認）。本レポートの指摘はすべて本番 https://jinro-bb5a5.web.app に存在する。

## 検証方法

推測を排し、次の2系統で裏を取った。

1. **静的解析** — 7方向の並列監査（タッチ入力 / ビューポート / オーバーレイ / アクセシビリティ / 死んだ配線 / 性能 / デスクトップ適応）。全所見に `file:line` と実コード引用を義務付けた。
2. **実測** — ローカルHTTPサーバ + headless Chrome で `window.showScreen()` を駆動し、21画面 × ビューポート高さ6段階の `getBoundingClientRect()` 計測、およびスクリーンショット撮影。計測ハーネスは `tmp/measure.html` / `tmp/shot.html`。

**headless の限界と補正**: headless Chrome は `env(safe-area-inset-*)` を 0 として扱う。実機 iPhone 15 Pro は上59pt（Dynamic Island）/ 下34pt（ホームインジケータ）。`.safe-frame` の padding は `max(16px, env(top))` / `max(24px, env(bottom))`（[design-system.css:196](../design-system.css#L196)、`--sp-4:16px` / `--sp-6:24px`）なので、**実機は headless 実測値より +53px 多く必要**。以下の数値はこの補正を明記して扱う。

---

## 総括 — 6つの構造的原因

個別のバグは50件超あるが、原因は6つに集約される。**1つの原因を直すと複数の症状が同時に消える**ため、この単位で着手するのが最も効率が良い。

| # | 構造的原因 | 症状の件数 | 影響 |
|---|---|---|---|
| **A** | 実効ビューポートの前提が誤っている | 7画面 | モバイルで主要ボタンが画面外 — **修正済み(2026-07-28)** |
| **B** | オーバーレイの共通基盤が無い | 10件以上 | 誤タップ・閉じられない・PCで枠外 — **修正済み(2026-07-28)** |
| **C** | 再描画が入力中の状態を破壊する | 2件 | **ソロで投票・夜行動が成立しない** — **修正済み(2026-07-28)** |
| **D** | HTMLのプレースホルダがJSと未結線 | 11箇所 | 表示される情報が嘘 — **修正済み(2026-07-28)** |
| **E** | ソロAI進行が例外に対して脆い | 5件 | ゲームが恒久停止する — **修正済み(2026-07-28)** |
| **F** | アプリファイルが2つに分岐している | 1件 | i18nが本番に載っていない |
| **I** | アセットが未最適化のまま配信されている | 9件 | 会場Wi-Fiで初回4.5MB／画像庫117MB — **P0/P1 修正済み(2026-07-28)** |

---

## A. 実効ビューポートの前提が誤っている

> **状態: 修正済み(2026-07-28)。** 690pt / 712pt の2つの高さで実測しながら詰め、
> 21画面すべてで主要ボタンが画面内に収まる状態にした。短いビューポート向けの
> 段階的な詰め(≤800px / ≤700px)、一覧側のスクロール化、上部バーの折り返し禁止、
> 44pt 未満のタップ対象の拡大、vh→dvh、横向きのデスクトップ誤判定、
> トーストの safe-area を含む。
> 回帰テスト: `tests/viewport_fit_test.sh`(主要ボタンの可視とタップ対象の大きさを実測)。

### 何が起きているか

**デザイン確認は852pt（iPhone 15 Pro 全画面）で行われ、実機の Safari は690〜712ptで動いている。** この差にsafe-areaの53pxが加わる。

21画面をビューポート高さ別に実測した結果（headless、safe-area=0の値）:

| 実効可視高さ | 溢れる画面 | 内訳 |
|---|---|---|
| 852pt（全画面・モック相当） | **0個** | ← ここで確認すると問題が見えない |
| 780pt | 1個 | s09 |
| 745pt | 2個 | s09, s18 |
| 712pt（Safari 通常） | 5個 | s05, s09, s14, s15, s18 |
| 690pt（Safari 初回・URLバー大） | **7個** | s02, s05, s09, s11, s14, s15, s18 |
| 667pt（iPhone SE） | 7個 | 同上 |

実機ではここにさらに +53px が乗るため、**実質的にほぼ全画面が余白ゼロ〜不足**の状態にある。

### A-1【P0】s09「役職の確認」の確定ボタンが実機で常に画面外

最重要画面が最悪の状態。headless実測で必要高さ **837pt**（top-bar含む）。852pt全画面ですら余白15pt、実機のsafe-area補正後は **852ptでも38px不足**。Safari通常時（712pt）では **178px不足**。

スクリーンショット `tmp/audit-shots/03-s09-roleconfirm-690.png` で、確定ボタンの上端だけが画面下端に覗いている状態を確認済み。

- **場所**: [mobile_app.html:1753-1770](../mobile_app.html#L1753-L1770)。カードは `.card-slot--hero { max-width:252px }` + `aspect-ratio:9/16` = 448px高。
- **直し方**: `max-width` を 220px に縮小（高さ 448→391px、57px削減）。加えて確定ボタン周辺の余白を詰める。

### A-2【P0】s02「部屋を選ぶ」の3枚目カードが切れる

ユーザー報告と一致。headless実測 788pt（top-bar含む）、実機補正後 **841pt**。Safari通常712ptに対し **129px不足**。

- **場所**: [mobile_app.html:1626-1646](../mobile_app.html#L1626-L1646) / `.opt-card` の `padding: 26px 24px`
- **直し方**（実測に基づく削減見積り、計96px）:
  - `.opt-card` padding `26px 24px` → `16px 20px` … 3枚で **60px**
  - カード間 gap `16px` → `10px` … **12px**
  - `.opt-cards` margin `4px 0 8px` → `2px 0 4px` … **6px**
  - カード内部 gap `13px` → `10px` … **18px**
  - さらに `.screen-sub` を1行に収める文言に短縮すると **+16px**

### A-3【P1】ゲーム中の上部バーが2行に折り返す

ユーザーの添付画像で「月下ノ／影」「進め／る」「ル／ー／ル」が縦に潰れている現象の原因。

393pt幅での `.top-bar` 実利用可能幅は `361 − 44（dev-hotspot用の padding-right）= 317px`。プレイヤー時は4ボタンで約314pxとぎりぎり収まるが、**進行役で「進める」が出ると5ボタンとなり必要幅383px** → 66px不足して折り返す。

- **場所**: [mobile_app.html:583-590](../mobile_app.html#L583-L590), [1583-1591](../mobile_app.html#L1583-L1591)
- **直し方**: `.top-bar-link` に `white-space: nowrap` を追加（現状 `♪` のみ個別指定）。根本的にはボタン数を減らす（後述の改善案参照）。

### A-4【P2】カード全画面表示だけ `vh` が残っている

アプリ全体は `100dvh` に統一済みなのに、[mobile_app.html:1515](../mobile_app.html#L1515) の `.card-fullscreen-slot { height: min(78vh, 760px) }` だけ静的 `vh`。iOS Safari でアドレスバーが伸縮するたびにカードサイズが変わり、`fitCardToSlot` の再計算とズレてガタつく。

- **直し方**: `78vh` → `78dvh`。[mobile_app.html:198](../mobile_app.html#L198) の `94vh` も同様。

### A-5【P2】iPhone Pro Max 横向きがデスクトップ扱いになる

Pro Max の横向き幅は **932pt** で、`@media (min-width: 860px)` のデスクトップ用ブレークポイント（[mobile_app.html:159](../mobile_app.html#L159)）に入ってしまう。結果 `.app-shell` が 402×404px の「疑似スマホ枠」に縮小され、s02 の3枚のカードは1枚目の途中までしか見えない。しかも `.safe-frame` は `scrollbar-width:none` でスクロールバーを消しているため、**スクロールできる手がかりが一切ない**。

- **直し方**: ブレークポイントに `and (pointer: fine)` を追加してタッチ端末を除外するか、`min-width: 1024px` に上げる。

### A-6【P3】画面下端固定のトーストだけ safe-area 未考慮

`.safe-frame` / `.rules-drawer` / `.bottom-sheet` は `env(safe-area-inset-bottom)` を正しく加算しているのに、`.toast`（[design-system.css:920](../design-system.css#L920)）は `bottom: 32px` 固定。ホームインジケータの34ptとわずかに重なる。

---

## B. オーバーレイの共通基盤が無い

> **状態: 修正済み(2026-07-28)。** 共通の暗転レイヤー(`#overlayScrim`)と
> 開閉ヘルパー(`pushOverlay` / `popOverlay`)を入れ、ドロワー・シート・
> ダイアログ・カード全画面をすべてそこに乗せた。暗転・背景スクロールロック・
> ESC/暗転タップで閉じる・フォーカスの移動と復帰・Tabの閉じ込め・
> 背後の `inert`/`aria-hidden`・z-index の統一・入れ子スクロールの遮断を含む。
> デスクトップの枠外飛び出し(B-9)は、端末フレームの実位置を JS が
> `--shell-*` に入れてオーバーレイをその中へ収める形で解消した。
> 開発者ホットスポット(B-4)はオーバーレイより後ろへ下げた。
> 回帰テスト: `tests/live_selection_test.sh`。

### 何が起きているか

「ルール&役職ガイド」ドロワー、「メイキング」モーダル、カード全画面、各種ダイアログが**それぞれ独立にバラバラの実装**をしている。共通の開閉ヘルパーが存在せず、`.dialog` だけが暗転レイヤーを持ち、他は持たない。**以下の10件はすべてこの1点に由来する。**

### B-1【P1】暗転レイヤー（スクリム）が存在しない ← ユーザー指摘の「コントラストが少なすぎる」の正体

`.bottom-sheet`（[design-system.css:1132](../design-system.css#L1132)）と `.rules-drawer`（[design-system.css:1188](../design-system.css#L1188)）には、`.dialog` が持つ `inset:0; background: rgba(7,8,10,0.75)` に相当する暗転レイヤーが**無い**。

前面パネル `--sem-bg-elevated`（`#14121A`）と背後のページ背景 `--sem-bg`（`#0E0C12`）の**WCAG相対輝度比は約1.05:1**（L=0.00656 vs 0.00400）。UI境界に求められる3:1を大きく下回り、知覚上ほぼ同一の黒。両者を分けているのは不透明度12%の1pxボーダーのみで、これ自体も背景比1.34:1しかない。

つまり「分かりにくい」という感覚は正しく、**数値で裏付けられる**。

- **直し方**: 共通スクリム要素（`inset:0; background: rgba(7,8,10,0.6〜0.75); backdrop-filter: blur(2px)`）を開閉に連動させる。

### B-2【P1】背景スクロールがロックされない

`document.body.style.overflow` を操作しているのはコード全体で `openCardFullscreen`/`closeCardFullscreen` だけ。ドロワー・モーダル・devドロワーは開いても背後がスクロールする。加えて `overscroll-behavior` の指定がリポジトリ全体で **0件**。

### B-3【P1】ドロワーを開いたまま背後の投票行をタップできる

`.rules-drawer` は `width: min(92vw, 420px)` なので390px幅では **左端に約31pxの隙間**が残る。スクリムが無いため、投票画面(s15)でルールを開いたまま左端に触れると、背後の `.target-option` に指が届く。**誤投票の経路が実在する。**

### B-4【P1】不可視の開発者ホットスポットが「閉じる」ボタンを奪う

`.dev-hotspot`（44×44px, `z-index:100`, [mobile_app.html:638](../mobile_app.html#L638)）は画面右上の safe-area 起点に固定。`.rules-drawer` は `right:0` で、その `rulesCloseBtn` も右上。**z-index 100 > ドロワーの 55** なので、重なった座標のタップは透明なホットスポットが先に奪う。単発タップでは何も起きないため「閉じるボタンの右側を押すと無反応」になる。

### B-5【P2】閉じる手段がボタン1つだけ

ESCキーは `closeCardFullscreen` にしか繋がっていない。背景タップはスクリムが無いので構造的に不可能。スワイプ検出も0件。**閉じるボタンを押し損ねると閉じる手立てが無い。**

### B-6【P2】「閉じる」ボタンだけ44px基準を下回る

[mobile_app.html:1972](../mobile_app.html#L1972) がインラインstyleで `min-height:36px` を指定し、`.btn` の `--tap-min`(44px) を上書きしている。同じドロワー内の他の閉じるボタンは44pxのまま。**最も押しにくい右上にあり、かつ B-4 の当たり判定とも重なる**、事故率が最も高い箇所。

私の実測でも44px未満は4件のみで、うち3件がトップバー（40px）とこの「閉じる」（36px）だった。他は基準を満たしている。

### B-7【P2】入れ子スクロールが外へ伝播する

`.rules-drawer` 自身と内部の `.rules-tab-panel` が両方 `overflow-y:auto`。`overscroll-behavior` が無いため、役職図鑑を最下部までスクロールすると外側→bodyへ連鎖する。

### B-8【P2】フォーカストラップとARIAがほぼ全滅

`role="dialog" aria-modal="true"` があるのは `cardFullscreen` だけ。`inert` の使用は0件。開いた時にフォーカスが中へ移らず、Tabで背後に抜け、閉じてもトリガーに戻らない。

### B-9【P1】デスクトップで「端末フレーム」の外に飛び出す

デスクトップ対応の設計思想自体は良い（860px/1180pxで実機フレーム+コンソール、2560pxでも本体は間延びしない）。**問題はフレーム導入時にオーバーレイ側の更新が漏れていること。**

`.rules-drawer` / `.bottom-sheet` / `.card-fullscreen` / `.toast` / `.dialog` はすべて `position:fixed` かつDOM上も `.app-shell` の外。1440pxで開くと:
- メイキングモーダルが**ブラウザ全幅1440px**に張り付き、見出しと閉じるボタンが約1300px離れて浮く
- ルールドロワーが実ブラウザ右端から出て**右サイドバーを覆う**
- カード全画面が**サイドバーごとページ全体を暗転**させ、フレームの縁取りが消える

- **直し方**: オーバーレイを `.app-shell` の子にして `position:absolute` に変えるか、≥860px時のみフレーム基準の座標に付け替える。**B-1〜B-9 は共通ヘルパー1つでまとめて解消できる。**

### B-10【P2】z-index が2つのスケールで混在

`design-system.css` 側は 50→55→60→70→80→90 の10刻みで一貫しているが、`mobile_app.html` のインラインCSSは 100 → 1200 → 99999 と別スケール。新しいオーバーレイを足すときの基準が無い。

---

## C. 再描画が入力中の状態を破壊する

**ソロAI対戦で投票と夜行動が成立しない、最も深刻な機能バグ。**

> **状態: 修正済み(2026-07-28)。** `renderS15Live()` / `renderS11Live()` を差分更新にした。
> 名簿シグネチャ（ラウンド・自分のid・各プレイヤーの並びと生死・記録済みか）が
> 変わったときだけ作り直し、それ以外は選択を維持したまま表示だけ整える。
> 選択を捨てるのはラウンドが変わったとき、および選んでいた相手が脱落したときだけ。
> 回帰テスト: `tests/live_selection_test.sh`（headless Chromium で実 DOM を検証）。

### C-1【P0】投票中、他人が投票するたび自分の選択が消える

- **場所**: [mobile_app.html:3976](../mobile_app.html#L3976)
```js
function renderS15Live() {
  liveVoteSelectedId = null;      // ← 先頭で選択を破棄
  ...
  list.innerHTML = '';            // ← is-selected も消える
```
- **経路（追跡済み）**: サーバの `CAST_VOTE` が `game.public` を書き換え → `revision` が変わるので `onValue` が必ず発火 → `client.onPublic` → `syncLiveScreen()` → [2747行](../mobile_app.html#L2747) `else renderS15Live()` → 選択リセット + ボタンが `disabled` に戻る。
- **ソロでの実害**: 投票フェーズ開始と同時にAI全員分の `CAST_VOTE` が連続で飛ぶため、**人間が選ぼうとしている最中に何度も選択が飛ぶ。**
- **直し方**: 差分更新にして `liveVoteSelectedId` を保持したまま再描画後に選択を復元する。

### C-2【P1】夜の行動でも同じ理由で選択が消える

- **場所**: [mobile_app.html:3696-3700](../mobile_app.html#L3696-L3700) の `renderS11Live()` が `liveNightSelected = []` + `panel.innerHTML` で全再生成。AI行動は `orchestrator.mjs:42` で1体ずつ適用されるのでAI人数ぶん発火する。
- **実害**: 人狼や予言者を引いたソロプレイヤーが「押しても選べない」状態に陥る。

---

## D. HTMLのプレースホルダがJSと未結線

> **状態: 修正済み(2026-07-28)。** 11箇所すべてを実データへ繋いだ。
> 公開ビューに `pendingActionCount` と `lastVote`(得票数・処刑者・同票か)を
> 足して、行動人数と同票の表示を実データで出せるようにしている。
> D-3(決選投票)はエンジンに存在しない機能なので、実装ではなく
> 「同数のため処刑を行わない」という事実に合わせて文言とボタンを訂正した。
> 回帰テスト: `tests/live_selection_test.sh`。

**`onclick` の `window` エクスポート漏れは全数照合の結果 0件**（過去に壊れた映像/制作ボタンは修正済み）。問題はこちらで、**11箇所**が一度も更新されない。ユーザーが見た「嘘の表示」はすべてここに由来する。

| 重大度 | 箇所 | 現象 |
|---|---|---|
| **P1** | [4411](../mobile_app.html#L4411) `state.myRole` | **「自分の役職」が誰でも必ず「市民」** |
| **P1** | [1859](../mobile_app.html#L1859) | **「投票済み 3 / 7」が完全な固定値** |
| **P1** | [1796](../mobile_app.html#L1796) `s12Waiting` | 「まだ5人が行動しています」が常に5人 |
| **P1** | [1875-1878](../mobile_app.html#L1875-L1878) | 同票時の得票者名・票数が架空（沙耶3/アキラ3） |
| **P1** | [1827](../mobile_app.html#L1827) `s14PrevRecord` | **誰が死んでも「健太 が失われた」** |
| P2 | [1824](../mobile_app.html#L1824) | 「残り時間 03:00」が止まったまま（大タイマーと矛盾） |
| P2 | [1853](../mobile_app.html#L1853) | 投票画面の「00:48」が固定 |
| P2 | [4392](../mobile_app.html#L4392) `phaseTitleText` | ルールの「現在の状況」が永久に初期文（**このIDはHTMLに存在しない**。正しくは `phTitle`） |
| P2 | [3390](../mobile_app.html#L3390) | 参加人数の分母がデモ配列由来の「8」固定 |
| P3 | [1936](../mobile_app.html#L1936), [2185](../mobile_app.html#L2185), [1746](../mobile_app.html#L1746), [1598-1603](../mobile_app.html#L1598-L1603) | 復帰状態・再接続文言・待ち人数・フェーズヘッダ（いずれも非表示または到達困難） |

### D-1 特に重要 —「自分の役職」が常に市民になる仕組み

```js
if (typeof state !== 'undefined' && state.myRole) {   // ← 4411行
```
`state` という変数は**このファイルに存在しない**（4637行の `const state` は `cycleConnBanner` 内のローカルで別スコープ）。よって条件は常に偽で、役職名・英名・説明・アドバイス・陣営の5ラベルが一度も書き換わらない。

**これは、疑問視されていた「立ち回りのワンポイント」の内容が、実際の役職のアドバイスですらなかったことを意味する。** HTMLに直書きされた市民用の固定文が表示されていただけ。正しい役職IDは `currentSelfRoleId()` で取得できるのに使われていない。

- **直し方**: 条件を `const roleId = currentSelfRoleId(); if (roleId) {...}` に置き換える。

### D-2【P1】「共有リンクをコピー」が到達不能なURLを配る

[mobile_app.html:3392-3395](../mobile_app.html#L3392-L3395) がクリップボードに書くのは `https://example.invalid/join/XXXXXX`。**LINE等で配ると全員入室できない。** 同じ画面のQRコードは `origin + pathname + '?room=' + code` という正しいURLを生成しており、正解がすぐ隣にあるのにコピー側だけ直し忘れている。

### D-3【P1】s16「決選投票」はエンジンに存在しない機能

同票時に「決選投票へ」ボタンが出るが、押しても議論画面(s14)に戻る。エンジンの `RESOLVE_VOTE` は同票時 `executedPlayerId = null` で `phase = "day"` にするだけで、決選投票フェーズもコマンドも存在しない。さらに訂正文を差し込もうとする `renderS16Live()` のセレクタ `#s16 .recorder-msg` は**DOMに存在しない**ため、訂正すら効いていない。

---

## E. ソロAI進行が例外に対して脆い

> **状態: 修正済み(2026-07-28)。** 内訳は下記の各項に追記。
> 回帰テスト: `functions/ai/orchestrator.test.mjs`（隔離・並列・投稿順）、
> `functions/ai/turn-policy.test.mjs`（フェーズ長・二重実行の判定）、
> `tests/live_selection_test.sh`（クライアント側の打ち切りと二重発火）。
> エミュレータ実測は `tests/ai_functions_smoke.sh` に追加済み（ホスト限定・二度目は skip）。

### E-1【P1】AI処理が1回失敗するとゲームが恒久停止し、毎秒リトライし続ける

- **場所**: [mobile_app.html:2650-2665](../mobile_app.html#L2650-L2665), [2602-2622](../mobile_app.html#L2602-L2622)
- `runAiPhase` は各AIの処理を try/catch で包んでいない（`orchestrator.mjs:42/47/68`）。API エラーや後述のタイムアウトで全体が reject し、**途中のAIまでしか行動していない状態で中断**する。
- クライアント側は `aiTurnDone[round:phase]` が永久に立たないため `RESOLVE_NIGHT` / `RESOLVE_VOTE` が二度と送られず、**夜または投票で完全停止**。「進める」ボタンも同じガードの下にあるので**手動でも復旧できない**。
- 同時に `aiTurnKey = null` により1秒ごとに再送され、dayフェーズならLLM呼び出しが1秒間隔で走り続ける。

### E-2【P2】60秒タイムアウトに対しAI処理が逐次実行

`orchestrator.mjs:35` の `for (const aiId of ids)` は直列、`:67` のリトライも直列。`setGlobalOptions` に `timeoutSeconds` の指定が無いため v2 onCall の既定60秒。**AI11体では最大22回の逐次API呼び出し**となり、タイムアウト → E-1 の停止に直結する。

- **直し方**: `Promise.all` で並列化し、`timeoutSeconds` を明示。各AIを try/catch で包む。

### E-3【P2】ソロなのに夜90秒・昼180秒を必ず待たされる

`startWerewolfGame`（[functions/index.js:169](../functions/index.js#L169)）は `createGame` に `phaseDurations` を渡していないため既定値（夜90秒/昼180秒/投票60秒）が使われる。ソロではAIは即座に行動を終えるのに、**締切到達だけが解決条件**なので1ラウンド最短5.5分の空白が生まれる。

ユーザーが見た「03:00 のカウントダウンで誰も喋らない」画面はこれ。

### E-4【P2】投票解決後にAI発話がもう一度発火する

`aiTurnKey` は `R:night → R:day → R:vote → R:day` と遷移し、最後の `R:day` が直前の `R:vote` と異なるため**2回目の発火**をする。生成された発言は夜に入ってからチャットに流れ込み、AI人数ぶんのLLM呼び出しが余分に走る。

### E-5【P2】`advanceAiTurn` に呼び出し制限が無い

[functions/index.js:330](../functions/index.js#L330) はルームメンバーであることしか確認しない。共有卓の任意の参加者が任意回数呼べる = **LLM課金を誘発できる**。

### 「AIが喋らない」の結論

**修正の内訳（2026-07-28）**

| 項 | 直した場所 | 内容 |
|---|---|---|
| E-1 | `functions/ai/orchestrator.mjs` | 各AIを try/catch で隔離し、戻り値に `errors` を追加。1体の失敗が全体を巻き込まない |
| E-1 | `mobile_app.html` `hostDriverTick()` | 再試行を3回・バックオフ付きに制限し、打ち切り時は `aiTurnDone` を立てて進行を再開する。トーストで通知 |
| E-2 | `functions/ai/orchestrator.mjs` | 発話生成を `Promise.all` で並列化（投稿は id 順に直列のまま）。夜/投票の `applyCommand` は `game` ノード全体の transaction なので直列を維持 |
| E-2 | `functions/index.js` | `advanceAiTurn` に `timeoutSeconds: 180` を明示 |
| E-3 | `functions/index.js` / `functions/ai/turn-policy.mjs` | AIが1体でも居る卓は夜30秒/昼90秒/投票30秒で開始する |
| E-4 | `mobile_app.html` `hostDriverTick()` | 発火判定を `aiTurnKey` から `aiTurnDone` に変更。`R:vote → R:day` の復帰で二度目の発話が走らない |
| E-4/E-5 | `functions/index.js` | `advanceAiTurn` をホスト限定にし、`game/aiTurns/{round}_{phase}` の claim で (round, phase) ごとに1回だけ通す。フェーズ不一致も拒否 |

チャットの配線自体は**サーバからクライアントまで完全に繋がっている**（RPC → orchestrator → `rooms/{id}/game/chat` → `onChat` 購読 → `renderChatLog` → `#chatLog`。RTDBの読み取り権限も含めて全段照合済み）。したがって原因は購読の断線ではなく、**E-1（例外による停止）・E-2（タイムアウト）・E-3（180秒の空白）の複合**。

なお「怪しい」ボタンは、[mobile_app.html:3956](../mobile_app.html#L3956) が「生存かつ自分以外の**最初の1人**」を機械的に選ぶだけで議論の文脈と無関係。「送信」は空文字でも `postChat` を呼び、`postChat` 側が黙って捨てるため**フィードバックが何も無い**。

---

## F. アプリファイルが2つに分岐している

**日英の言語トグルは本番に載っていない。**

| | root `index.html` | `mobile_app.html`（= 本番） |
|---|---|---|
| 画面数 | 20 | 21 |
| `data-i18n` | 177箇所 | 0 |
| 言語トグル | あり（`langToggle` / `currentLang`） | **無し** |
| デプロイ | されていない | `public/index.html` としてバイト同一 |

i18nコミット `e35d03f` は root `index.html` だけを変更している（`git show --stat` で確認）。作業ブランチ `mobile-ui-design-system` は `main` から2コミット遅れており（分岐点 `bfd6a73`）、`main` にあって本番に無いのは `e35d03f`(i18n) と `018c08a`(applyServerCommand)。**本番はこの未マージ枝から直接デプロイされている。**

---

## G. アクセシビリティ（すでに担保されている項目を除く）

> **状態: P0/P1 修正済み(2026-07-28)。** 画面遷移でフォーカスを新しい画面へ移し、
> 投票・夜行動の対象行を `role="button"` + `tabindex` + Enter/Space で操作可能にし
> (選択状態は `aria-pressed` にも出る)、トーストと接続バナーに `aria-live`、
> 表示名・役職検索・発言の各入力に `aria-label` を付けた。
> オーバーレイのフォーカス移動・復帰・Tabの閉じ込めはB章の共通基盤で解消済み。
> 残るP2(タブの選択状態のARIA、テキスト入力のフォーカスリング)は未着手。

過去の対応で担保済みと確認できた領域: 非表示画面のフォーカス除外（`display:none`）、`prefers-reduced-motion`（グローバル縮退 + オープニング動画の専用フォールバック）、ピンチズーム禁止していない、カウントダウンの `aria-hidden` による読み上げ騒音回避、陣営・生存状態のテキスト併記。

残る主な欠落:

- **【P0】画面遷移でフォーカスが移らない** — `showScreen()`（[3092](../mobile_app.html#L3092)）に `.focus()` が無く、`display:none` で祖先ごと消えるためフォーカスが `<body>` に落ちる。全遷移で毎回Tabのやり直しになり、「今何が起きたか」も伝わらない。
- **【P0】投票・夜行動の対象選択がキーボードで操作不能** — `<div onclick>` で構築され `tabindex` もキーイベントも無い。決定ボタンは選択するまで `disabled` なので**この画面から一歩も進めない**。`design-system.css:431` に `.target-option:focus-visible` のスタイルがあるのに `tabindex` が無く発火しない死んだCSS。同ファイルの `buildRosterCell` は `tabIndex=0` + `role="button"` + `keydown` を正しく実装しており、実装パターンは既にある。
- **【P1】トースト・接続状態に `aria-live` が無い** — 「投票を記録できませんでした」等がスクリーンリーダーに一切通知されない。
- **【P1】表示名入力・役職検索欄にラベルが無い** — `<label>` と `for` はファイル全体で0件。
- **【P2】タブ・フィルタの選択状態がARIA非公開** — `is-active` / `is-selected` のCSSクラスのみ。
- **【P2】テキスト入力のフォーカスリングだけ弱い** — 合言葉入力を含む3セレクタが `outline:none` + ボーダー色変化のみ。

---

## H. 入力・その他

- **【P1】長押し開示に `user-select` / `-webkit-touch-callout` が無い** — `-webkit-touch-callout` はリポジトリ全体で0件。iOS の長押しでテキスト選択メニューが出て、**アプリ最重要の秘匿ギミックがOSに主導権を奪われうる**。
- **【P3】長押しハンドラが二重に配線されている** — `#myroleCoverArea` は `.hold-to-reveal` クラスを持つため、専用ハンドラ（[4368](../mobile_app.html#L4368)）と汎用の `setupHoldToReveal`（[4591](../mobile_app.html#L4591)）が両方付く。結果、**ルールドロワーでカードを長押しすると s09 のカードを一度も見ていないのに「確認して閉じる」が有効化される**。
- **【P2】主要ボタンに hover が無い** — `.btn` / `.btn--primary` / `.btn--secondary` に `:hover` 定義なし。デスクトップでほぼ全CTAが無反応に見える。
- **【P2】s09 の文言がデスクトップ/ソロで意味をなさない** — 「画面を伏せると、記録は自動で隠されます」はスマホを裏返す物理操作の指示。ルールドロワー側は既に `appState.solo` で分岐済みなのに、**本流の s09 だけ直し漏れている**。
- **【P2】s04 の「目印」選択が完全な飾り** — 選んだ値はDOMのクラスに付くだけでサーバにも送られず他画面でも使われない。
- **【P2】接続監視が一切配線されていない** — `onDisconnect` / `.info/connected` の使用が0件。誰かが落ちても永久に「参加中」のまま。
- **【P2】s07 の役職構成が後から人が増えても再計算されない** — `onPlayers` が s03/s05 しか再描画対象にしていない。
- **【P3】ソロ選択後に共有卓へ戻っても `appState.solo` が `true` のまま** — `handleChooseHost`/`handleChoosePlayer` にリセットが無い。

---

## I. アセットが未最適化のまま配信されている

パーティー会場では**複数人が同時に同じURLへアクセスする**という前提が効いてくる領域。すべて本番へ実際にcurlして採った実測値。

### I-1【P0】オープニング動画4.16MBが、見ない人にも無条件で降ってくる ✅ 修正済み(`preload="none"`。再生する分岐でのみ `load()`)

`<video>` は `preload="auto"`([mobile_app.html:1541](../mobile_app.html#L1541))。そして `#opening-overlay.hidden` は `opacity:0; visibility:hidden` であって **`display:none` ではない**([mobile_app.html:25-29](../mobile_app.html#L25-L29))。

つまりQRコードから `?room=CODE` で参加してオープニングを即座に隠すパスでも、**HTMLパーサーが `<video>` タグに到達した時点（JS実行前）で取得が始まる**。

- 動画 3,936,240 B（1080×1916, h264, 7.04秒, 4.47Mbps）+ ポスター 224,030 B = **4,160,270 B**
- 会場Wi-Fi/4Gが実効1Mbpsまで落ちると、動画だけで**約33秒**
- N人が同時参加すれば N×4.16MB が同時に走る

- **直し方**: `preload="none"` にし、`video.play()` を呼ぶ分岐でのみ `load()` する。実測で720p/crf28/音声なしに再エンコードすると 865,080 B（**78%減**）、ポスターも720幅q80で 91,799 B（59%減）。QR参加者は動画取得を**ゼロ**にできる。

### I-2【P0】カード原画をそのままサムネイルに使っている

- キャラ原画: 1568×2744px、**平均3.24MB/枚**、27枚で **85MB**
- 背景: 720×1280px、平均1.34MB/枚、24枚で **32MB**
- 合計 **117MB**

一方、リザルト画面のロースターセルの表示サイズは **123×172 CSS px**（390px幅3列）。しかも `.roster-bg` は `style="background-image:url(...)"` のCSS背景なので **`loading="lazy"` を付けられない**（[mobile_app.html:4149-4166](../mobile_app.html#L4149-L4166)）。

ゲーム最大の見せ場である結果発表で、10人卓なら座席数ぶんの画像が一斉に発火する。

- **実測での削減幅**: `werewolf_ver_a.png` 5,771,022 B → 同解像度WebP q80で 353,514 B（94%減）→ 表示サイズ(370px幅)まで縮めると **19,702 B（99.66%減、293倍）**
- 全体では 116.9MB → 同解像度WebP一括変換で 15.15MB（87%減）、用途別リサイズまで行えば数MB台
- **直し方**: サムネイル専用の縮小WebP派生を用意し `srcset`/`sizes` で出し分ける。

### I-3【P1】Google Fonts が1.27MB、うち1ファミリーは完全に未使用 ✅ 修正済み(未使用ファミリー削除 + preconnect と link での並列取得)

[design-system.css:12](../design-system.css#L12) の `@import` を iPhone Safari UA で実取得したところ **1,273,632 B（gzip換算331,743 B）**、8ファミリー・**1,383個の `@font-face`**。

うち **Zen Antique Soft（122件）はコードのどこからも参照されていない** — 全体の8.8%が丸ごと無駄。

加えて `@import` はCSS内にあるため、`design-system.css` の取得・解析が終わるまで発見されない。`preconnect` も0件。「CSS取得 → 解析 → @import発見 → Fonts CSS取得 → woff2取得」という直列ウォーターフォールになっている。

- **直し方**: 未使用ファミリー削除だけで約29KB(gzip)減。`@import` を `<link rel="preconnect">` + `<link rel="stylesheet">` に置き換えて並列発見させる。

### I-4【P2】117MBの画像が1時間しかキャッシュされない ✅ 修正済み(`firebase.json` の `hosting.headers`)

`firebase.json` に `headers` 設定が無いため、本番の全アセットが `cache-control: max-age=3600`。**5.77MBのカード画像1枚もHTML本体と同じ1時間扱い**（curlで確認）。

パーティーが1時間を超える、あるいは翌週また遊ぶと、変化していない数十MBを丸ごと再ダウンロードする。

- **直し方**: `hosting.headers` で画像・動画ディレクトリに `Cache-Control: public, max-age=31536000, immutable` を設定し、HTML本体だけ短いままにする。

### I-5【P2】音がバックグラウンドでも止まらない ✅ 修正済み(`visibilitychange` / `pagehide` で `ctx.suspend()`)

`sound-engine.js` に `visibilitychange` / `pagehide` / `ctx.suspend` が **0件**。音をONにしたまま画面ロックすると、3本のオシレータ + 4秒ごとのLFO更新 + シマー/鼓動の `setTimeout` チェーンが動き続け、発熱とバッテリー消耗の一因になる。既定はミュートなので影響はオプトイン時のみ。

- **直し方**: `visibilitychange` で `ctx.suspend()` / `resume()` を呼ぶ数行。

### I-6【P2】議論タイマーのバーが毎秒レイアウトを起こす ✅ 修正済み(`transform: scaleX()` へ)

[design-system.css:774](../design-system.css#L774) の `transition: width`。180秒間、毎秒 `style.width` が書き換わりリフローが走る。

- **直し方**: `transform: scaleX()` + `transform-origin: left` に置き換える（見た目は同一、合成レイヤーのみで完結）。

### I-7【P3】単一HTMLファイル4692行は**このままでよい**

本番へbrotliで実測した転送量は **39,149 B**。動画(3.94MB)や画像庫(117MB)の1000分の1以下で、実害が小さい。むしろ全画面が起動時にDOMへ入りきり、`showScreen()` は `classList.toggle` だけで `innerHTML` 再構築をしないため画面遷移が軽い。**分割によるリクエスト増のデメリットの方が大きい。削減対象は動画・画像・フォントであり、ファイル分割ではない。**

### I-8【P3】その他

- `sound-engine.js` の `<script>` に `defer` が無く、後続2472行の解析をブロックする（[mobile_app.html:2193](../mobile_app.html#L2193)）。`qrcode-generator` は正しく `defer` 済み。
- `public/` に未参照の孤立アセット約3.1MB（`gz/` の3ファイルは `icons/camp/` とバイト完全一致、`recorder_a.png` 1.59MB、`ghost_wolf_ver_a_original_1024.png` 1.14MB）。配信はされないがデプロイ対象を膨らませる。

### 削減サマリ

| 資産 | Before(実測) | After(実測) | 削減 |
|---|---|---|---|
| index.html (brotli) | 39,149 B | 39,149 B | — |
| design-system.css (brotli) | 7,594 B | 7,594 B | — |
| Google Fonts CSS (gzip換算) | 331,743 B | 約303,000 B | 8.8% |
| sound-engine.js (brotli) | 5,732 B | 5,732 B | — |
| opening_gekka.mp4 | 3,936,240 B | 865,080 B | 78.0% |
| opening_poster.jpg | 224,030 B | 91,799 B | 59.0% |
| **通常訪問 合計** | **約4.54 MB** | **約1.25 MB** | **約71%** |
| **QR参加ゲスト 合計** | 約4.54 MB | **約347 KB** | **約92%** |

---

## 秘匿設計についての確認事項

「自分の役職」を長押しでしか見せないのは**意図的な設計**である。[design/design-system.md:285-293](../design/design-system.md) に、アプリスイッチャーのプレビューから役職が漏れるため「タップで開いたまま放置できるUIで秘密情報を出さない」ことが **Don't として文書化**されている。

ただし**ソロAI対戦には覗き見リスクが無い**ため、そこだけ別扱いにする余地がある（コード上すでに `appState.solo` で分岐する仕組みは存在する）。カードビジュアルを大きく見せたいという要望は、この分岐の上でなら設計方針と衝突しない。

---

## 推奨する着手順

| 順 | 対象 | 理由 |
|---|---|---|
| ~~1~~ | ~~**C（再描画が状態を破壊）+ E（ソロ進行の脆さ）**~~ | **完了(2026-07-28)** |
| ~~2~~ | ~~**D（プレースホルダ11箇所）**~~ | **完了(2026-07-28)** |
| ~~3~~ | ~~**A（ビューポート）**~~ | **完了(2026-07-28)** |
| ~~4~~ | ~~**B（オーバーレイ共通基盤）**~~ | **完了(2026-07-28)** |
| 5 | **I（アセット最適化のP0 2件）** | 動画 `preload="none"` とキャッシュヘッダは**設定変更だけ**で初回4.5MB→1.25MB |
| 6 | **G（アクセシビリティのP0 2件）** | フォーカス移動と対象選択のキーボード対応 |
| 7 | **F（ファイル分岐の解消）** | 先に方針決定が要る。技術的難度より判断の問題 |

**費用対効果が突出して高い3つ**（いずれも数行〜設定ファイルのみ）:
1. `<video preload="auto">` → `preload="none"` … QR参加者の転送量が4.5MB→347KB
2. `firebase.json` に `Cache-Control: immutable` を追加 … 再訪時の数十MB再取得が消える
3. [mobile_app.html:4411](../mobile_app.html#L4411) の `state` → `currentSelfRoleId()` … 「自分の役職」が正しく出る

---

## 検証に使ったファイル

- `tmp/measure.html` — 21画面 × ビューポート高さの一括計測ハーネス
- `tmp/shot.html` — `showScreen()` 駆動 + オープニング自動スキップの撮影ハーネス
- `tmp/audit-shots/` — 撮影結果
- `tests/live-selection-harness.html` / `tests/live_selection_test.sh` — C/E の修正に伴い追加した
  実ブラウザの回帰テスト。`mobile_app.html` を iframe に読み込み、`window.__liveRenderTestHooks`
  経由で公開状態を差し替えながら描画と進行ドライバを叩く（`bash tests/live_selection_test.sh`）

再現手順: `python3 -m http.server 8899` をリポジトリ直下で起動し、`http://localhost:8899/tmp/measure.html?w=393&h=712` を headless Chrome の `--dump-dom` で取得する。


---

## 追補 — 2026-07-28 の作業で分かった、監査に無かった問題

監査は「表示と進行」を見たもので、**遊べる役職の範囲**は対象外だった。
C+E の修正後に全面のブラッシュアップへ入った際、次が判明した。

| # | 内容 | 状態 |
|---|---|---|
| J-1 | **実際に配れる役職は4つだけだった**（人狼/予言者/騎士団/市民）。構成UIがこの4行に固定されており、ソロはさらに3つへ絞られていた。エンジンは25役職、絵札は24枚あるのに使われていなかった | 修正済み |
| J-2 | 真因は **AIブレインの夜行動が werewolf と prophet の2種類しか無かった**こと。他の役職は `null` を返すのでAIが何もせず、ソロで配れなかった | 修正済み |
| J-3 | **奇術師のAIはコマンド自体が通らなかった**。`swap` は2人目が要るのに orchestrator が `secondTargetId` を載せていなかった | 修正済み |
| J-4 | **AIが人間より広い情報を持っていた**。内通者・スパイ・一匹狼が人狼陣営の仲間を知っていた（`toPlayerView` では知らないのに、AI側の入力生成が同陣営を一律で仲間扱いしていた） | 修正済み |
| J-5 | **ハンターの能力がエンジンに無かった**。`death_shot` はコマンドとして存在せず、道連れが発生しない | 修正済み |
| J-6 | **妖狐が人狼の襲撃で死んでいた**。カード記載の「襲撃では死なない」が実装されていない | 修正済み |
| J-7 | **人狼の子どもの怒りが実装されていなかった**。襲撃の解決が単発前提で、2件目が常に捨てられていた | 修正済み |
| J-8 | 人狼の子どもの説明文に**簡体字「给」が混入**していた。簡体字チェックの対象字が少なく検出できていなかった（かつ、日本語でも使う「置」が誤って対象に入っていた） | 修正済み |
| J-9 | **人間+AIの混合卓を作る手段が無かった**。AIを着席させられるのは「ひとりで遊ぶ」からだけで、共有卓に人が足りなくてもAIを混ぜられなかった | 修正済み |
| J-10 | `seatAiPlayers` が**AIを減らせなかった**。呼ぶたびに上書きするだけで、前回より少ない人数を指定しても余分なAIが席に残った | 修正済み |
| J-11 | **記録者の読み上げ(TTS)が1行も無かった**。設計書に「音声は雰囲気モード」として計画されながらMVP1でスコープ外にされたまま | 実装済み |

### 残っている作業

| 章 | 内容 | 理由 |
|---|---|---|
| **I-2** | カード原画(5.77MB/枚)をそのままサムネイルに使っている | 画像の再エンコードが要る。コード変更では終わらない |
| **G(P2)** | タブ・フィルタの選択状態のARIA、テキスト入力のフォーカスリング | 影響が小さい |
| **F** | root `index.html`(i18nあり)と `mobile_app.html`(本番)の分岐解消 | どちらを正本にするかの**方針決定が先**。いまは `public/index.html` が `mobile_app.html` と一致することを `tests/mobile_app_test.sh` が保証している |
| **H** | 接続監視(`onDisconnect`)、長押しの `-webkit-touch-callout` | 実機での確認が要る |
| **決選投票** | エンジンに存在しない。いまは「同数のため処刑を行わない」と表示する形に合わせてある | ルールの決定が先 |
