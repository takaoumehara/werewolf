# 人狼ゲーム — 対面スマホ人狼(記録網 / Kirokumō)

同じ場所に集まった 5〜10 人が、各自のスマホで QR / 合言葉から同じ部屋に入り、対面で会話しながら遊ぶ人狼ゲーム。役職の秘匿・夜の行動・投票・進行をサーバー権威(Cloud Functions + Realtime Database)で処理し、端末の外観から役職が漏れない設計。

## 構成

| 層 | 場所 | 説明 |
|---|---|---|
| ドメインエンジン | `game-engine/src/` | 決定論の reducer(`createGame`/`dispatch`/`toPublicView`/`toPlayerView`)。25役職・シード配布。Firebase 非依存。30 unit tests。 |
| アダプタ契約 | `game-engine/src/firebase-adapter-contract.mjs` | 冪等適用・公開/秘密/完全状態の分離。 |
| バックエンド | `functions/index.js` | Callable v2: `createSnapRoom`/`joinSnapRoom`/`startWerewolfGame`/`dispatchWerewolfCommand`。`actorId` は `auth.uid` から。esbuild でエンジンを bundle。 |
| セキュリティルール | `database.rules.json` | public/publicEvents=メンバー読取、privateViews=本人のみ、authoritative=サーバーのみ。 |
| クライアント | `game-client/firebase-game-client.mjs` | 匿名認証・callable・onValue 購読。 |
| UI | `mobile_app.html` + `design-system.css` | 4a「刻印の台帳」デザイン、全20画面。live/demo モード(`?demo=1`)。正本カードは `card_viewer.html` 準拠。 |

Firebase プロジェクト: `jinro-bb5a5`(RTDB=US / Blaze / 匿名認証)。

## ローカル開発(エミュレータ)

```bash
npm install --prefix functions
firebase emulators:start --only functions,database,auth   # 無料・課金不要
# アプリを ?emu=1 で開くとエミュレータに接続
```

## テスト

```bash
npm test --prefix game-engine            # エンジン 30/30
bash tests/design_system_test.sh         # デザイントークン静的チェック
bash tests/mobile_app_test.sh            # アプリ静的チェック
bash tests/functions_smoke_test.sh       # エミュレータでフルゲーム+再戦(勝者到達)
```

## デプロイ

```bash
firebase deploy --only database,functions --project jinro-bb5a5   # ルール+関数(反映済み)
bash scripts/build-hosting.sh                                     # public/ を組み立て
firebase deploy --only hosting --project jinro-bb5a5              # フロント公開 → https://jinro-bb5a5.web.app
```

- **バックエンド(ルール+関数)は本番反映済み**で、作成→参加→開始→夜→投票→結果→再戦を本番で通し検証済み(ホスト死亡でも進行、市民/人狼どちらの勝利にも到達)。
- **フロント(Hosting)は上記の1コマンドで公開**。公開後はバックエンド稼働中のため実機スマホで即プレイ可能。

## 遊び方

1. ホストがアプリを開き「部屋をつくる」→ 合言葉/QR を提示。
2. 参加者が同じアプリで「部屋に入る」→ 合言葉で参加。
3. ホストが人数分の役職構成を決めて開始。各自スマホで役職を長押し確認。
4. 夜=能力持ちが対象選択、昼=対面で議論しタイマー後に投票。記録者(コンピュータGM)が進行・判定。
5. 勝敗成立で全役職公開。「同じメンバーで再戦」可能。

## 運用メモ

- 公開後は誰でも URL で参加可能。招待範囲を絞るなら App Check の有効化を推奨(現状未強制)。
- 秘匿は「サーバーが役職を保持し、クライアントは自分の privateView しか読めない」ルールで担保。
- 詳細設計: `docs/integration-roadmap.html`、`docs/superpowers/`、`game-client/wiring-report.md`、`design/`(カード正本)。
