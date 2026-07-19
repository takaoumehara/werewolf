# Claude Design 用プロンプト: デザインシステム

以下をそのまま Claude Design に渡してください。ロゴとモバイル UI が先に作成済みなら、それらも参照資料として追加してください。

---

```text
あなたは、モバイルゲームとリアルタイム Web アプリのデザインシステムを専門とする Principal Product Designer / Design Systems Lead です。以下の人狼ゲーム向けに、ブランド表現、アクセシビリティ、秘密情報の保護、リアルタイム状態を一貫して扱えるデザインシステムを設計してください。

## 最初に確認する資料

- 世界観: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/world-theme.md
- 役職イラスト: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72/
- 背景: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72/
- 既存カード表示: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/card_viewer.html
- ロゴ資料: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/logos/
- ロゴ設計プロンプト: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/prompts/claude-design/01-logo-design-prompt.md
- モバイル UI 設計プロンプト: /Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/prompts/claude-design/02-mobile-ui-design-prompt.md

ロゴ案やモバイル UI が別途生成済みの場合は、それらを優先的に監査し、矛盾を解消してからシステム化してください。

## プロダクト概要

同じ場所に集まった 5〜10 人が、各自のスマートフォンで QR コードまたは短いコードから参加し、対面で会話しながら遊ぶ人狼ゲームです。パソコンや専用アプリは使いません。

画面は、秘密の役職、夜の能力、投票、進行、接続状態を扱います。コンピューター GM「記録者」は会話を録音・分析せず、決定論的なルールに基づいてゲームを進めます。

## 世界観

ポストアポカリプス・ダークファンタジーとレトロフューチャー中世の融合です。旧文明の巨大都市を城壁として使う最後の居住圏で、人々は失われた科学を魔術や神託と呼びます。

UI は旧世界の「記録網」へ接続する個人端末として見せます。ただし、装飾的な fantasy UI ではなく、厳しい状況でも誤操作しない明確な道具として設計してください。

## システム原則

デザイン判断を次の 5 原則へ紐づけてください。

1. Ritual: 参加、役職確認、夜、投票、結果に儀式的な区切りがある。
2. Legibility: 暗い環境、小さな画面、緊張した状態でも読める。
3. Secrecy: 端末の外観から秘密の役職や行動が漏れない。
4. Recoverability: 通信切断、誤操作、画面離脱から安全に戻れる。
5. Restraint: カードイラストを主役にし、装飾を必要な場所だけに使う。

## デザイントークン

次の token architecture を設計し、primitive、semantic、component の 3 層に分けてください。

### Color

- Neutral: soot、charcoal、ash、old paper、oxidized silver。
- Phase: day、night、dawn、verdict、finished。
- Semantic: success、warning、danger、info、offline、reconnecting、disabled。
- Faction: citizen、werewolf、third faction。
- Role accent: 各役職固有色を追加できる拡張構造。
- Overlay: privacy cover、scrim、modal、secret reveal。

陣営色は常時表示しないでください。公開情報の UI と秘密情報の UI を token 上でも分離し、夜の外観から役職が推測できない構造にしてください。色だけに意味を依存させず、ラベル、形、アイコンを併用します。

### Typography

- 日本語本文の可読性を最優先する UI 書体。
- 見出しや儀式的な場面だけに使う display 書体。
- 数字、6 桁コード、タイマーの判別に強い tabular numeral。
- 12 px 未満を基本 UI に使わない。
- 日本語、英数字、長い役職名、動的文字サイズに対応する。

書体名を選ぶだけでなく、display、heading、body、label、caption、code、timer の type scale、line-height、weight、letter spacing を定義してください。

### Layout

- 4 px 基準の spacing scale。
- safe area とブラウザ UI を考慮した mobile viewport。
- 360、390、430 px 幅の breakpoint / fluid behavior。
- touch target は最低 44 × 44 px。
- portrait を主対象とし、desktop dashboard は対象外。
- 情報密度を上げるために小さくするのではなく、progressive disclosure を使う。

### Shape and surface

- 枠、角、罫線、刻印、鍵穴、回路の表現ルール。
- radius、border width、divider、shadow、inner highlight。
- 古紙や金属の texture は独立した overlay token とし、本文の背後へ強く敷かない。
- すべてを装飾カードで囲わない。

### Motion

- instant feedback、micro transition、phase transition、cinematic reveal の 4 段階。
- 通常操作は短く、フェーズ演出だけに長い motion を許す。
- loading と同期状態は、終わりのない派手なアニメーションにしない。
- `prefers-reduced-motion` 用の代替を必ず定義する。
- 人狼だけ異なる外向き motion を使わない。

### Sound and haptics

- 音声なしでもすべて理解できること。
- Web の vibration 対応を前提にしないこと。
- 秘密の役職や行動に固有の音・振動を割り当てないこと。
- 共通フェーズ通知だけに任意の sound cue を定義すること。

## コンポーネント

最低限、次の components と variants / states を設計してください。

### Foundation

- AppShell
- SafeAreaFrame
- PhaseBackdrop
- TextureOverlay
- Divider / EngravedRule
- Icon
- Typography primitives

### Actions

- Button: primary、secondary、quiet、danger、hold-to-confirm。
- IconButton
- SegmentedControl
- TextField
- CodeInput
- Checkbox / ReadyControl
- PlayerTargetSelector
- VoteBallot

### Information

- PhaseHeader
- CountdownTimer
- RecorderMessage
- StatusBadge
- ConnectionBanner
- SyncIndicator
- Progress / WaitingCount
- InlineNotice
- Toast
- ErrorRecoveryPanel

### Game

- QRJoinPanel
- RoomCode
- PlayerList / PlayerRow
- RoleCard
- RoleSummary
- PrivacyCover
- HoldToReveal
- NightActionPanel
- DiscussionTimer
- VoteResult
- EliminationReveal
- VictoryReveal
- RoleRosterReveal
- RematchPanel

### Overlays

- BottomSheet
- Dialog
- FullScreenReveal
- RulesDrawer
- ReconnectOverlay

各 component に、default、pressed、focused、selected、disabled、loading、success、error、offline、reconnecting、completed のうち必要な状態を定義してください。存在しない状態を機械的に増やさず、必要性も説明してください。

## Privacy context

同じ component でも、公開コンテキストと秘密コンテキストを明確に分けてください。

- Public: ロビー、昼、共通待機、結果公開。
- Private: 役職確認、夜の対象選択、自分の投票。
- Concealed: 周囲から見られる可能性がある privacy cover。

秘密コンテキストから離れた瞬間に、役職色、役職名、固有イラストが残らないルールを定義してください。アプリスイッチャーの preview や画面復帰時にも secret content を直接表示しない設計にしてください。

## Content design

「記録者」の文体は、静か、正確、中立、短いものとします。人格はあるが、プレイヤーを脅したり、怪しさを評価したりしません。

推奨例:

- 「記録を確認してください。」
- 「対象を 1 人選んでください。」
- 「選択を記録しました。」
- 「あと 1 人の入力を待っています。」
- 「接続を復旧しています。」
- 「評議を開始します。」

避ける例:

- 「あなたは本当に人間ですか？」を毎画面で繰り返す。
- 「AI があなたの嘘を見抜きます。」
- 原因や対処が分からない「エラーが発生しました」。
- 世界観のためだけに理解しにくい造語を使う。

## Accessibility requirements

- WCAG AA contrast。
- keyboard focus と screen reader label を定義する。
- 色だけで状態を伝えない。
- 44 × 44 px 以上の touch target。
- dynamic type と 200% text zoom に耐える。
- reduced motion、sound off、high contrast を考慮する。
- 日本語名の折り返し、長いプレイヤー名、絵文字を安全に処理する。
- QR コードの quiet zone と読み取りコントラストを守る。

## 成果物

1. Design principles と判断例。
2. Token architecture と命名規則。
3. 色、文字、spacing、shape、elevation、texture、motion、sound の token tables。
4. Figma Variables を想定した mode 設計。
5. CSS custom properties / JSON に移植できる token schema。
6. 全 component inventory と anatomy。
7. component の variants、states、usage、do / don't。
8. 公開・秘密・concealed context の仕様。
9. day / night / reconnect / victory を使った reference screens。
10. accessibility checklist。
11. デザイナーと実装者向けの handoff guidance。
12. 既存カード画像とロゴを使った visual regression examples。

## 最終監査

提出前に次を自己監査し、問題があれば修正してください。

- 役職カードが主役で、UI 装飾が競合していないか。
- 人狼の画面だけ外から判別できないか。
- semantic color と faction color が混同されていないか。
- 暗い背景でも本文が読めるか。
- 360 px 幅と日本語 200% 拡大で破綻しないか。
- offline / reconnecting / duplicate submission を表現できるか。
- 生成した token と component が、モバイル UI の全フローを実際に支えられるか。
```
