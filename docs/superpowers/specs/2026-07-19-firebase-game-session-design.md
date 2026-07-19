# Firebase Game Session Design

更新日: 2026-07-19

## 目的

既存の決定論的ゲームエンジンをFirebaseへ接続し、パソコンなしで複数の携帯電話が
QRコードまたは6文字コードから同じ部屋へ参加し、秘密役職を漏らさずゲームを進行できる
サーバー権威のセッション基盤を作る。

## 採用構成

- Firebase Anonymous Authentication
- Callable Cloud Functions v2
- Firebase Realtime Database
- Firebase App Check（本番ではFunctions側で強制）
- `game-engine/` の決定論的コマンド／イベント処理
- クライアントは公開ビューと自分専用ビューだけを購読

`snap-pair-workshop` の `workshopRooms` は利用しない。公開読み書き可能な共有バックエンドは、
秘密役職・夜行動・未公開投票を扱う本作の要件を満たさない。

## データ構造

```text
pairingCodes/{code}
  roomId
  hostId
  createdAt
  expiresAt
  maxPlayers

roomMembers/{roomId}/{uid}: true

rooms/{roomId}/meta
  hostId
  status: waiting | playing | finished | abandoned
  createdAt
  updatedAt
  participantCount
  maxPlayers

rooms/{roomId}/players/{uid}
  id
  name
  role: host | participant
  connected
  joinedAt
  lastSeenAt

rooms/{roomId}/joinState
  count
  members/{uid}: true

rooms/{roomId}/game/public
  revision
  phase
  round
  deadlineAt
  players
  winner

rooms/{roomId}/game/publicEvents/{eventId}

rooms/{roomId}/game/privateViews/{uid}

rooms/{roomId}/game/authoritative
rooms/{roomId}/game/events/{eventId}
rooms/{roomId}/game/processedCommands/{commandId}
```

`authoritative`、完全イベント、処理済みコマンド、`joinState`、`pairingCodes` はAdmin SDKだけが
読み書きする。クライアントへ部屋親パスのreadを与えない。

Firebaseへ保存するgame subtreeは再帰的にJSON互換へ正規化する。plain object、array、string、
boolean、finite number、`null` だけを許可し、object内の`undefined`は省略、array内の
`undefined`は`null`へ変換する。非有限数、BigInt、Date、function、symbol、循環参照などは
保存前に拒否する。

Realtime Databaseは空object、空array、`null`のchildを保存後のsnapshotから省くため、command
処理前にserver-only `authoritative`をdomain stateへhydrateする。`createGame` schemaの必須map、
array、nullable fieldと各playerの`flags` / `death`をown propertyだけから復元し、通常commandと
duplicate再送の両方で同じ境界を通す。duplicate時の公開・個人viewも復元した現在stateから再生成する。

`CAST_VOTE`の公開commandは`targetId: null`または省略を棄権として受け付ける。authoritative内部では、
RTDBにvoter keyを残すため棄権を空文字列で保存する。player IDはnon-emptyなので衝突せず、
pending vote countには含めるが得票集計からは除外する。処刑なしの`VOTE_RESOLVED` eventは、RTDB
往復後にnullable payloadが省略されてもevent自体の`id` / `type` / `at`を維持し、同じ意味として扱う。

`events`と`publicEvents`はevent IDをkeyにしたrecordとして保存し、commandごとのdeltaを既存logへ
追記する。既存eventの上書き、重複ID、Realtime Databaseで不正なkeyは拒否する。公開版の
`DAY_STARTED`は`round`だけを含み、襲撃対象や護衛成否は完全eventと`authoritative`だけに残す。

## Callable Functions

### `createSnapRoom`

- 匿名認証を含む `auth.uid` を必須とする。
- `crypto.randomUUID()` でroom IDを作る。
- `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` から6文字のコードを作り、衝突時は再生成する。
- 招待コードTTLは5分、最大人数は4〜30人に制限する。
- メタ、ホストプレイヤー、メンバーシップ、joinState、pairing codeをサーバー側で作る。
- 同一uidの短時間大量作成はレート制限台帳で拒否する。

### `joinSnapRoom`

- コードを大文字英数字6文字へ正規化する。
- 未存在、期限切れ、終了、満員を拒否する。
- `rooms/{roomId}/joinState` のtransactionで人数とuidを原子的に更新する。
- 同じuidの再参加は人数を増やさず成功する。
- transaction成功後にplayerとroomMembersを復元可能なmulti-location updateで書く。

### `startWerewolfGame`

- 呼び出しuidがroom hostであることを検証する。
- waiting状態、参加人数、role ID数、全員がroom memberであることを検証する。
- 暗号学的に生成したseedをゲームエンジンへ渡す。
- `createGame` と `START_GAME` を実行する。
- `buildPersistencePatch` で公開、個人、完全状態、イベントを分離して保存する。
- room statusをplayingへ変更する。

### `dispatchWerewolfCommand`

- 呼び出しuidがroom memberであることを検証する。
- `actorId` はリクエスト本文から受け取らず、`auth.uid` を使用する。
- サーバー時刻、command ID、expected revisionを検証する。
- `rooms/{roomId}/game` のtransaction内で `processedCommands` のreceiptを確認してからdispatchする。
- 初回処理では `{ revision, phase }` だけをreceiptとして保存し、完全な権威状態やイベントをcommandごとに複製しない。
- 保存済みreceiptに旧形式の余分なkeyがあっても、次回保存時に正確な `{ revision, phase }` へ正規化する。
- 同じcommand IDの再送は保存済みの初回応答を返すが、transactionの現在状態は変更しない。後続command後の再送でも状態を過去へ戻さない。
- 公開イベントと完全イベントを別パスへ保存する。
- メンバー判定は`privateViews`自身のpropertyだけを対象にし、prototype由来の名前をmemberとして扱わない。
- RTDB往復で消えたempty/null schemaを復元してからdispatchし、保存前snapshotをmutationしない。
- 棄権投票はAPIでは`null`/省略、server-only pending voteではRTDB-safeな空文字列として保持する。

## Realtime Databaseルール

- `pairingCodes`、`roomMembers`、`joinState` はクライアントread/write禁止。
- `meta` と `players` はroom memberだけがread可能。
- `players/{uid}/name`, `connected`, `lastSeenAt` だけ本人がwrite可能。
- `game/public` と `game/publicEvents` はroom memberだけがread可能、write禁止。
- `game/privateViews/{uid}` は本人だけがread可能、write禁止。
- `game/authoritative`, `game/events`, `game/processedCommands` はクライアントread/write禁止。
- room親パスへread/writeを与えない。

## クライアント契約

`game-client/firebase-game-client.mjs` は次を公開する。

```js
createFirebaseGameClient({ app, auth, database, functions })
  .ensureAnonymousAuth()
  .createRoom({ name, maxPlayers })
  .joinRoom({ code, name })
  .subscribeRoom(roomId, callbacks)
  .startGame({ roomId, roleIds, gmMode })
  .dispatchCommand({ roomId, commandId, type, payload, expectedRevision })
  .setPresence({ roomId, connected })
  .dispose()
```

購読は `meta`、`players`、`game/public`、`game/publicEvents`、自分の
`game/privateViews/{uid}` を別々に行う。部屋親パスは購読しない。presenceは
`onDisconnect` を登録してから `connected: true` を書く。

## ビルドとデプロイ

Functions sourceは `firebase-backend/`。`esbuild` で既存game-engineをbundleへ含め、
Firebase SDK依存だけをexternalにする。これによりFunctionsのdeploy packageが巨大な
画像フォルダを含まず、`game-engine/` のコードも確実に同梱される。

Firebase project IDやクライアントconfigはリポジトリへ実値を固定せず、
`.firebaserc` と公開可能なクライアントconfigをデプロイ環境で設定する。

## テスト

- room domain unit tests: コード正規化、TTL、人数、再参加、満員、衝突
- game session unit tests: host検証、member検証、秘密分離、冪等性、revision競合
- rules emulator tests: member/public read、self/private read、他人/private拒否、server-only拒否
- client contract tests: auth待機、Callable引数、購読パス、presence順序、unsubscribe
- engine regression tests: `npm test --prefix game-engine`

Firebase Emulator Suiteは `firebase-backend` のdevDependency `firebase-tools` を通して起動し、
グローバルCLIの有無に依存しない。

## 非目標

- `workshopRooms` へのクライアント直書き
- AIによる勝敗・役職・死亡判定
- Firebase projectの自動作成や課金設定
- この段階での完成モバイル画面デザイン
- 音声収録、会話分析、秘密チャット内容のAI解析
