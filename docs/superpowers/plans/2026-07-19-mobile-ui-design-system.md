# Mobile UI + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存カードデザインを主役にした、スマホ完結の対面人狼ゲームのデザインシステムとモバイル UI プロトタイプを実装する。

**Architecture:** バニラ HTML/CSS/JS(既存リポジトリの流儀)。`design-system.css` に 3 層トークン+共通コンポーネント、`mobile_app.html` に app shell + 全 20 フロー画面を 1 ファイルで実装。カード表現は `card_viewer.html` の DOM/CSS/データを移植して使う(改変禁止)。file:// で直接開ける。

**Tech Stack:** Vanilla HTML/CSS/JS、Google Fonts(LINE Seed JP 400/700、Cinzel Decorative 900、IBM Plex Mono 400/600)、mermaid 不要(spec 側)、テストは bash 静的チェック(既存 `tests/*.sh` の流儀)。

## Global Constraints

- カードのタイトル・ルビ・位置・文字サイズ・`REFINED_POSITIONS`・`rolesData` は `card_viewer.html` からそのまま移植し、独自に書き換えない(`design/current-card-design.md` 正本)。
- アセット規則: キャラ `00_transparent-illustrations-72-a-refined/{id}_ver_a.png`、背景 `backgrounds-72/{id}_bg.png`、例外 `magician_c` → `magician_ver_c.png` + `magician_bg.png`。陣営アイコン `gz/{citizen|werewolf|neutral}.png`。
- 基準ビューポート 390×844、範囲 360–430px、portrait のみ。タップ領域最低 44×44px。基本 UI に 12px 未満禁止。
- 夜画面・待機画面の外観は全役職共通。役職色 (`--faction-*`, `--role-accent`) は秘密コンテキスト(HoldToReveal 内部)でのみ参照。人狼だけ異なる色・光・motion を絶対に出さない。
- `prefers-reduced-motion` で phase/cinematic モーションをクロスフェードへ縮退。
- 記録者の文体: 静か・正確・中立・短文。「対象を 1 人選んでください。」「選択を記録しました。」「あと n 人の入力を待っています。」「接続を復旧しています。」等。中国語禁止、UI 文言は日本語主表記。
- 重要操作は普通の日本語を主表記、劇中用語は補助表記。
- 出力は UTF-8。コミットは各タスク末で行う。

## Model Assignment(orchestrator 向け)

| Task | モデル | 理由 |
|---|---|---|
| Task 1 (design-system.css) | sonnet | 仕様確定済みの実装 |
| Task 2 (design-system.md 文書) | sonnet | 文書化作業 |
| Task 3 (mobile_app.html) | sonnet | 詳細仕様に基づく実装(最重量) |
| Task 4 (最終監査・修正) | メインループ (fable) | 設計品質判断 |

---

### Task 1: design-system.css(3層トークン + コンポーネント CSS)

**Files:**
- Create: `design-system.css`
- Test: `tests/design_system_test.sh`

**Interfaces:**
- Produces: CSS custom properties(下記命名)と class 群。Task 3 が `<link rel="stylesheet" href="design-system.css">` で消費する。
- ルート: `:root` に primitive(`--p-*`)、`[data-phase="..."]` に phase 別 semantic(`--sem-*`)、component 層は class 内で `--sem-*` を参照。
- Phase 切替: `<body data-phase="day|night|dawn|verdict|finished">`。

**必須トークン(正確な値):**

```css
/* primitive: color */
--p-soot:#07080a; --p-charcoal:#0d0f12; --p-surface:#111317;
--p-ash:#94a3b8; --p-paper:#e8e0cf; --p-oxidized:#8a8f98;
--p-line:rgba(255,255,255,0.08); --p-text:#f1f5f9;
--p-moonlight:#9fb4c7; --p-daylight:#b7c3d0; --p-ember:#b97a3d;
--p-verdict-red:#7a2226;
/* primitive: faction(秘密コンテキスト限定) */
--p-citizen:#4a6a5f; --p-werewolf:#8f1d22; --p-third:#5f8f7a;
/* primitive: semantic-status */
--p-success:#4a7a5a; --p-warning:#b08a3d; --p-danger:#a03a30;
--p-info:#5a7a9a; --p-offline:#6a6a72;
/* type */
--font-body:'LINE Seed JP',sans-serif;
--font-display:'Cinzel Decorative',serif;
--font-mono:'IBM Plex Mono',monospace;
--fs-display:28px; --fs-heading:20px; --fs-body:15px; --fs-label:13px;
--fs-caption:12px; --fs-timer:40px; --fs-code:32px;
/* spacing 4px scale */
--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px;
--sp-6:24px; --sp-8:32px; --sp-12:48px;
/* shape */
--r-control:6px; --r-sheet:12px; --r-card:16px;
--tap-min:44px;
/* motion */
--t-instant:120ms; --t-micro:200ms; --t-phase:600ms; --t-cinematic:1200ms;
```

Semantic 層(各 `data-phase` で `--sem-bg / --sem-bg-elevated / --sem-text / --sem-text-dim / --sem-line / --sem-accent / --sem-glow` を定義。night は soot+moonlight、day は charcoal+daylight、dawn は ember、verdict は verdict-red accent、finished は paper 系)。公開/秘密の分離: `--secret-faction-color` と `--secret-role-accent` は `.hold-to-reveal .revealed` スコープでのみ実値を持ち、それ以外では `initial`。

**必須コンポーネント class(Task 3 が参照する契約):**
`.app-shell` `.safe-frame` `.phase-backdrop` `.texture-overlay` `.engraved-rule` `.btn` `.btn--primary` `.btn--secondary` `.btn--quiet` `.btn--danger` `.btn--hold` `.seg-control` `.text-field` `.code-input` `.ready-control` `.target-selector` `.target-option` `.target-option--selected` `.vote-ballot` `.phase-header` `.countdown` `.recorder-msg` `.status-badge` `.conn-banner` `.sync-indicator` `.waiting-count` `.inline-notice` `.toast` `.recovery-panel` `.qr-panel` `.room-code` `.player-list` `.player-row` `.privacy-cover` `.hold-to-reveal` `.night-panel` `.discussion-timer` `.vote-result` `.bottom-sheet` `.dialog` `.fullscreen-reveal` `.rules-drawer` `.reconnect-overlay`

状態は `[disabled]` `.is-loading` `.is-error` `.is-offline` `.is-reconnecting` `.is-completed` `.is-selected` `.is-pressed` を必要な component にのみ定義。`.btn` は最低 `min-height:var(--tap-min)`。`@media (prefers-reduced-motion: reduce)` で transition/animation を 1ms・クロスフェードのみに縮退。QR パネルは白地 `#ffffff` + 最低 12px quiet zone。

- [ ] **Step 1: テストを書く**

```bash
#!/bin/bash
# tests/design_system_test.sh — design-system.css static checks
set -u
cd "$(dirname "$0")/.."
FAIL=0
check() { # $1=pattern $2=desc
  if ! grep -q -- "$1" design-system.css; then echo "FAIL: $2 ($1)"; FAIL=1; fi
}
[ -f design-system.css ] || { echo "FAIL: design-system.css missing"; exit 1; }
for t in --p-soot --p-charcoal --p-moonlight --p-werewolf --sp-1 --r-card --tap-min --t-phase --font-mono --fs-timer; do
  check "$t" "token $t"
done
for ph in day night dawn verdict finished; do
  check "data-phase=\"$ph\"" "phase $ph"
done
for c in .btn--hold .privacy-cover .hold-to-reveal .phase-header .conn-banner .reconnect-overlay .qr-panel .code-input .waiting-count; do
  check "$c" "component $c"
done
check "prefers-reduced-motion" "reduced motion support"
# 秘密トークンが公開スコープ(:root)に居ないこと
if grep -A40 '^:root' design-system.css | grep -q 'secret-faction'; then
  echo "FAIL: secret token leaked into :root"; FAIL=1
fi
[ $FAIL -eq 0 ] && echo "OK: design_system_test passed"
exit $FAIL
```

- [ ] **Step 2: 実行して FAIL を確認** — Run: `bash tests/design_system_test.sh` → Expected: `FAIL: design-system.css missing`
- [ ] **Step 3: design-system.css を実装**(上記トークン値・class 契約・phase 定義をすべて含める。コメントで primitive/semantic/component の 3 層を区切る。世界観: 枠・刻印・鍵穴は控えめに、texture は overlay token として opacity ≤ 0.08)
- [ ] **Step 4: テストが通ることを確認** — Run: `bash tests/design_system_test.sh` → Expected: `OK: design_system_test passed`
- [ ] **Step 5: Commit** — `git add design-system.css tests/design_system_test.sh && git commit -m "Add design system tokens and component CSS"`

---

### Task 2: design/design-system.md(デザインシステム文書)

**Files:**
- Create: `design/design-system.md`
- Modify: `design/README.md`(「読む順番」に design-system.md を追記)

**Interfaces:**
- Consumes: Task 1 の `design-system.css`(トークン名・値を文書へ転記)
- Produces: デザイン正本文書。コードからは参照されない。

**内容(全節必須):** 1) 5 原則(Ritual/Legibility/Secrecy/Recoverability/Restraint)と判断例 2) トークン表(色/文字/spacing/shape/motion — design-system.css の実値と一致させる)3) 命名規則(`--p-*`/`--sem-*`/component class)4) コンポーネント一覧と用途・状態・do/don't 5) Public/Private/Concealed コンテキスト規則(秘密トークンのスコープ、アプリスイッチャー preview 対策 = visibilitychange で cover 復帰)6) 記録者の文体ガイド(推奨/禁止例)7) アクセシビリティチェックリスト 8) CSS→JSON 移植を想定した token schema 例。

- [ ] **Step 1: design/design-system.md を書く**(上記 8 節。値は design-system.css から grep で転記し、手で創作しない)
- [ ] **Step 2: design/README.md の「読む順番」リストに `design-system.md` を 3 番目として追記**
- [ ] **Step 3: 検証** — Run: `grep -c '^## ' design/design-system.md` → Expected: 8 以上。`grep design-system.md design/README.md` → Expected: ヒット。
- [ ] **Step 4: Commit** — `git add design/design-system.md design/README.md && git commit -m "Add design system documentation"`

---

### Task 3: mobile_app.html(モバイル UI プロトタイプ)

**Files:**
- Create: `mobile_app.html`
- Test: `tests/mobile_app_test.sh`

**Interfaces:**
- Consumes: `design-system.css`(link)、`card_viewer.html` の `rolesData` / `REFINED_POSITIONS` / カード CSS(`.role-name-japanese` 等)を script/style としてコピー移植、Refined アセット群。
- Produces: 単独で開けるプロトタイプ。`<section class="screen" id="s01">`〜`id="s20"` + `showScreen(id)` 関数。

**画面契約(id / 内容):**
- s01 起動: ロゴ域(`logos/concept-v2/recorder_a.png`)+「部屋をつくる」「部屋に入る」への導線
- s02 つくる/入る選択(補助表記「区画名簿を開設 / 名簿に加わる」)
- s03 参加: QRJoinPanel(白地 SVG プレースホルダ QR + quiet zone)、RoomCode 6 桁(`--font-mono`, `--fs-code`)、共有リンクボタン、参加人数がライブで増える演出(モック)
- s04 表示名入力(TextField、キーボード考慮で下部余白)
- s05 ロビー: PlayerList(参加者 7 人モック)、ReadyControl、ホスト視点は開始ボタン
- s06 GM モード選択: コンピューター GM「記録者」/ 人間 GM(SegmentedControl + 説明)
- s07 役職構成: 人数 7 人時の推奨構成(人狼2/予言者1/騎士団1/市民3)+ 編集 UI
- s08 準備確認: WaitingCount「あと n 人の入力を待っています。」名前は出さない
- s09 役職確認: PrivacyCover(封蝋の機密記録、全役職共通外観)→ HoldToReveal 長押し中のみ RoleCard(card_viewer 移植、360×640 を scale で内接)+ 役職名・陣営・能力・勝利条件 → 「確認して閉じる」。閉じた後も安全な再確認導線(長押し)
- s10 一斉暗転: phase transition(day→night、全員共通)
- s11 夜の行動: NightActionPanel、対象は表示名+状態で選ぶ target list、選択→確定の 2 段階、確定後「選択を記録しました。」+ SyncIndicator。変更不可を明記。行動なし役職にも同じ長さの待機体験
- s12 共通待機: 全員同一画面「記録網が夜を記録しています。」+ WaitingCount
- s13 朝の発表: EliminationReveal(全員同時、犠牲者名)
- s14 昼の議論: DiscussionTimer(`--fs-timer`、tabular)、PhaseHeader に「すべきこと」
- s15 投票: VoteBallot(生存者のみ、自票不可 disabled、選択→確認→確定)、確定後 completed 状態で重複送信不可
- s16 同票: 決選投票の案内
- s17 処刑結果: verdict phase
- s18 勝敗+全役職公開: VictoryReveal + RoleRosterReveal(カード縮小一覧)
- s19 再戦: RematchPanel(同じメンバーで再戦)
- s20 再接続: ReconnectOverlay(「接続を復旧しています。」+ 最後に確認した状態 + 再試行)任意画面上に重ねる

**共通シェル:** PhaseHeader(フェーズ名/すべきこと/残り時間/同期状態の 4 点)、ConnectionBanner、RulesDrawer(外部遷移なしのルール参照)。dev drawer: 画面右上を 600ms 長押し → 画面一覧・phase 切替・役職切替・視点(ホスト/プレイヤー/人間GM)切替・reconnect 発火。戻る誤爆対策: `beforeunload` は使わず、dev drawer 内の「退出」だけに確認 Dialog。

**JS 契約:**
```js
function showScreen(id /* 's01'..'s20' */) {}
const appState = { phase:'day', role:'prophet', view:'player', screen:'s01' };
function setPhase(p){ document.body.dataset.phase = p; }
// HoldToReveal: pointerdown→400ms後表示 / pointerup·pointercancel→即cover
// visibilitychange で必ず cover へ戻す(アプリスイッチャー対策)
```

- [ ] **Step 1: テストを書く**

```bash
#!/bin/bash
# tests/mobile_app_test.sh — mobile_app.html static checks
set -u
cd "$(dirname "$0")/.."
FAIL=0
check() { if ! grep -q -- "$1" mobile_app.html; then echo "FAIL: $2 ($1)"; FAIL=1; fi }
[ -f mobile_app.html ] || { echo "FAIL: mobile_app.html missing"; exit 1; }
check 'design-system.css' "links design system"
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20; do
  check "id=\"s$i\"" "screen s$i"
done
for s in 'REFINED_POSITIONS' 'rolesData' 'role-name-japanese' 'Cinzel Decorative' 'LINE Seed JP'; do
  check "$s" "card fidelity: $s"
done
check '00_transparent-illustrations-72-a-refined' "refined char assets"
check 'backgrounds-72' "bg assets"
check 'magician_ver_c.png' "magician_c exception"
check 'visibilitychange' "app-switcher privacy"
check 'prefers-reduced-motion' "reduced motion"
check '接続を復旧しています' "recorder reconnect copy"
check '選択を記録しました' "recorder sync copy"
check 'あと' "waiting count copy"
# 中国語簡体字の混入チェック(代表字)
if grep -qE '[们你请确认设置说]' mobile_app.html; then echo "FAIL: Chinese chars found"; FAIL=1; fi
[ $FAIL -eq 0 ] && echo "OK: mobile_app_test passed"
exit $FAIL
```

- [ ] **Step 2: 実行して FAIL を確認** — Run: `bash tests/mobile_app_test.sh` → Expected: `FAIL: mobile_app.html missing`
- [ ] **Step 3: mobile_app.html を実装**(画面契約・JS 契約・Global Constraints をすべて満たす。カード部は card_viewer.html の該当 CSS/データをコピーし、値を 1 つも変えない)
- [ ] **Step 4: テストが通ることを確認** — Run: `bash tests/mobile_app_test.sh` → Expected: `OK: mobile_app_test passed`
- [ ] **Step 5: Commit** — `git add mobile_app.html tests/mobile_app_test.sh && git commit -m "Add mobile UI prototype with 20 screens"`

---

### Task 4: 最終監査(fable / メインループ)

**Files:**
- Modify: `mobile_app.html` / `design-system.css`(監査で見つけた問題の修正)
- Modify: `design/design-system.md`(監査結果の反映)

- [ ] **Step 1: 02/03 プロンプト末尾の自己レビュー項目を実施**(秘密の覗き見耐性 / 人狼判別不能性 / 再接続復帰 / 初見理解 / 議論への回帰 / 360px / 200% 拡大 / semantic と faction の混同 / カード主役性)
- [ ] **Step 2: ブラウザ実機確認**(`open mobile_app.html` で目視、スクリーンショット確認)
- [ ] **Step 3: 問題を修正し、全テスト再実行** — Run: `bash tests/design_system_test.sh && bash tests/mobile_app_test.sh` → Expected: 両方 OK
- [ ] **Step 4: Commit** — `git add -A の対象は今回作成ファイルのみ`、`git commit -m "Polish mobile UI after design audit"`
