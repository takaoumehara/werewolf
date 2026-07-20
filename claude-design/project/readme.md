# 記録網 (Kirokumō) Design System

対面プレイ用モバイル人狼ゲームのデザインシステム。5〜10人が同じ場所に集まり、各自のスマートフォンから QR / 短いコードで参加する。画面は世界内では旧世界の「記録網」へ接続する個人端末であり、GM は中立的な都市記録 AI「記録者」。

世界観: ポストアポカリプス・ダークファンタジー × レトロフューチャー中世。Gothic graphic novel / 木版画・銅版画の細密線画。装飾的 fantasy UI ではなく「厳しい状況でも誤操作しない明確な道具」。

## カード正本仕様 (2026-07-19 確定)
役職カードは `guidelines/card-design-spec.md` (= ユーザーの current-card-design.md) が正本。360×640、Refined 透過人物 + 役職別背景の合成。JP タイトルは左上縦書き LINE Seed JP Bold 38px 字間6px + ルビ、EN は右上 Cinzel Decorative Black (22/26/32px)。**タイトルの書体・サイズ・位置を画面ごとに書き換えない。** RoleCard コンポーネントがこの仕様を実装している。透過人物レイヤーと役職別背景の実ファイルは未提供 (ユーザーのローカル)。

## Sources
- 世界観・美術設定指示書 (ユーザー提供テキスト, 2026-07-18)
- デザインシステム要件プロンプト (ユーザー提供テキスト)
- 役職イラスト 20点: `assets/roles/role-01..20.png` (コンタクトシートから切出し)
- 背景 9点: `assets/backgrounds/bg-01..09.png`
- 参考サイト: https://werewolf-gilt.vercel.app/card_gallery.html (JP/EN切替・陣営フィルタ付きカードギャラリー)
- 原本はユーザーのローカル: `~/Documents/00_Product_Develpment/Game/人狼ゲーム/` (world-theme.md, raw-illustrations-transparent-72/, backgrounds-72/, card_viewer.html, logos/)

**ロゴは未提供。** ロゴが必要な場所では `Kirokumō` / `記録網` をプレーンな型 (Cinzel Decorative 900 / LINE Seed 800) で置く。ロゴを勝手に描かない。

## Design Principles (すべての判断をここへ紐づける)
1. **Ritual** — 参加・役職確認・夜・投票・結果に儀式的な区切り。長い motion と display 書体はここだけ。
2. **Legibility** — 暗所・小画面・緊張状態で読める。本文 15px/1.75、12px 未満禁止、AA コントラスト。
3. **Secrecy** — 端末の外観から役職が漏れない。faction 色は Private/Reveal 限定。夜は全員同一トーン。
4. **Recoverability** — 切断・誤操作・離脱から戻れる。破壊的操作は hold-to-confirm、状態は常に復元可能に表示。
5. **Restraint** — カードイラストが主役。UI は無彩色基調、装飾は刻印線と phase accent のみ。

## Content Fundamentals — 「記録者」の文体
- 静か・正確・中立・短い。命令ではなく手続きの提示。敬体 (です・ます)。
- 例: 「記録を確認してください。」「対象を 1 人選んでください。」「選択を記録しました。」「あと 1 人の入力を待っています。」「接続を復旧しています。」「評議を開始します。」
- 禁止: 脅し・怪しさの評価 (「AI があなたの嘘を見抜きます」)、原因不明の「エラーが発生しました」、理解しにくい造語の乱用。
- エラーは常に「何が起きたか + 次にできること」。例: 「接続が切れました。再接続すると評議へ戻れます。」
- 英字見出しは **Title Case** (Cinzel Decorative)。**ALL CAPS 禁止**。絵文字は使わない。
- **i18n**: 全コンポーネントは JP/EN 両対応。言語はプレイヤー端末ごとにいつでも切替可 (ゲーム状態と独立)。文字列は `{jp, en}` ペアで持つ。

## Visual Foundations
- **色**: 煤 (#0B0A0E〜) と古紙 (#EFE7D3〜) の低彩度二極。既定は night (暗)。phase (day/night/dawn/verdict/finished) が `data-phase` 属性で surface/ink/accent を切替える。accent は「光源に理由のある色」— 月光・ランタン・鈍い金。彩度の高い色はステータスと役職カードのみ。
- **文字**: LINE Seed JP (UI, 400/700/800) + Cinzel Decorative (英字 display, 700/900, Title Case のみ) + IBM Plex Mono (コード・タイマー, tabular)。
- **背景**: 単色 surface が基本。イラスト背景 (`assets/backgrounds/`) はフェーズ転換・reveal などの儀式画面のみ、上に `--overlay-scrim` を敷いて本文コントラストを守る。texture overlay は opacity ≤ 0.12。
- **枠と線**: 「刻印」— 1px の暗線 + 直下の内側ハイライト (`--engraved-rule`)。すべてをカードで囲わない。radius は 4/8/12/14。
- **影**: 外影は控えめ (`--shadow-raised`)、モーダルのみ強い (`--shadow-modal`)。内側 1px ハイライトで金属感。
- **motion**: instant 80ms / micro 180ms / phase 640ms / reveal 1400ms。hover は明度 +4%、press は明度 -4% + scale(0.98)。ローディングは終わりの見える表現 (「あと N 人」)。`prefers-reduced-motion` で全て 0ms。
- **transparency/blur**: scrim のみ。秘密情報の上の cover は**完全不透明** (`--overlay-privacy`)。blur は秘匿に使わない (透ける)。

## Privacy Contexts (component 共通仕様)
- **Public** (ロビー・昼・結果): faction 色・役職名・役職イラスト禁止。全プレイヤーの画面が同一に見えてよい情報のみ。
- **Private** (役職確認・夜の対象選択・自分の投票): role accent とイラスト使用可。ただし画面遷移で即座に消す。
- **Concealed** (覗き見られうる状態): `PrivacyCover` で全面被覆。開示は `HoldToReveal` (長押し中のみ表示)。離すと即 cover。visibilitychange / blur イベントで自動 cover。アプリスイッチャー preview に秘密を残さない。
- 夜の入力 UI は役職に関わらず同一の外観骨格 (同じ配色・同じ motion・同じ所要操作数) を使う。

## Iconography
- 専用アイコンフォントなし。**Lucide** (CDN: unpkg lucide@latest) を line-icon として使用 — 木版線画と相性の良い 1.5px stroke。サイズ 20/24px、色は currentColor。
- 意味は必ずラベル併記 (アイコン単独は IconButton の aria-label 必須ケースのみ)。
- 絵文字・手描き SVG は使わない。役職の象徴はイラストカード側が担う。

## Tokens
`styles.css` → `tokens/*.css`。命名: `--km-*` (primitive) / `--surface-* --ink-* --accent* --status-* --faction-* --overlay-*` (semantic) / component 内は semantic のみ参照。Figma Variables modes = data-phase の 5 モード。JSON 移植はこの CSS が単一ソース。

## Index
- `tokens/` — colors, typography, spacing, shape, motion, phases
- `guidelines/` — foundation specimen cards (Design System タブに表示)
- `components/actions|information|game|overlays/` — JSX + d.ts + prompt.md
- `ui_kits/mobile/` — reference screens: Join / Role / Night / Day / Reconnect / Victory (interactive index.html)
- `assets/roles/`, `assets/backgrounds/`
- `fallback.js` — `_ds_bundle.js` が未生成の間だけ働く開発用ローダ (バンドル生成後は自動的に無効)
- `SKILL.md` — Claude Code 用スキル

## Intentional additions
- Lucide アイコン (ソースにアイコンセットが無いため。stroke 系で世界観に整合)
- IBM Plex Mono (tabular numeral 要件のため。LINE Seed に等幅数字がない)

## Full component inventory (要件側の一覧)
Foundation: AppShell, SafeAreaFrame, PhaseBackdrop, TextureOverlay, EngravedRule, Icon, Typography primitives — token + card で表現。
Actions: Button (primary/secondary/quiet/danger/hold-to-confirm), IconButton, SegmentedControl, TextField, CodeInput, ReadyControl, PlayerTargetSelector, VoteBallot — 実装済。
Information: PhaseHeader, CountdownTimer, RecorderMessage, StatusBadge, ConnectionBanner, SyncIndicator, WaitingCount, InlineNotice, Toast, ErrorRecoveryPanel — 実装済 (SyncIndicator=ConnectionBanner の compact variant, ErrorRecoveryPanel=InlineNotice の recovery variant)。
Game: QRJoinPanel, RoomCode, PlayerList/PlayerRow, RoleCard, RoleSummary, PrivacyCover, HoldToReveal, NightActionPanel, DiscussionTimer, VoteResult, EliminationReveal, VictoryReveal, RoleRosterReveal, RematchPanel — コアを実装、reveal 系は ui_kits/mobile の画面が仕様。
Overlays: BottomSheet, Dialog, FullScreenReveal, RulesDrawer, ReconnectOverlay — 実装済 (RulesDrawer=BottomSheet の scroll variant)。
