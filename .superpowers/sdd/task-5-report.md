# Task 5 Report: Mobile Firebase client contract

更新日: 2026-07-19

## RED

- production実装より先に `game-client/test/firebase-game-client.test.mjs` を作成した。
- Node `v20.20.2` で `npx --yes node@20 --test game-client/test/firebase-game-client.test.mjs` を実行した。
- `ERR_MODULE_NOT_FOUND`（`game-client/firebase-game-client.mjs` 未作成）で期待どおり失敗した。
- failure testはauth 3件、Callable/public API 4件、subscription/path/cleanup 7件、presence 7件の計21件を固定した。

## GREEN

- Firebase modular Web SDKのAuth、Functions、Realtime Databaseをdefault adapterとして直接importした。
- `dependencies.sdk`で同じSDK関数境界を注入できるfactoryにし、live FirebaseなしでNode unit test可能にした。
- 初回GREEN試行は18/21だった。原因はtest harnessが`currentUser: null`をnullish coalescingでdefault userへ置換していたfixture不備で、`Object.hasOwn`により「省略」と「明示null」を区別して修正した。
- 修正後、Node 20で21/21 PASSを確認した。
- `game-client/package.json`と`package-lock.json`へFirebase `11.10.0`を再現可能に固定し、`npm ci --prefix game-client`は85 packages、脆弱性0件だった。

## 自己レビュー

- Auth: 既存userを再利用し、同時sign-inを1 promiseへdedupeし、成功・失敗後にin-flight状態を解除する。
- Callable: `createSnapRoom` / `joinSnapRoom` / `startWerewolfGame` / `dispatchWerewolfCommand`だけを使用する。許可されたown fieldだけを新しいplain objectへcopyし、responseの`data`を返し、Firebase errorは変更せず伝播する。dispatchへ`actorId`、uid、時刻をcopyしない。
- Subscription: roomIdと現在uidをRTDB-safe keyとして検証後、meta / players / public / publicEvents / self privateの正確な5 pathだけを`onValue`購読する。snapshotは`.val()`へ変換し、各value/error callbackへ渡す。
- Cleanup: room-local unsubscribeは他roomを巻き込まず冪等。`dispose`は残る全roomとpresence hookを冪等にcleanupする。個別unsubscribe/cancel失敗を収集し、残りcleanupを続行してから`AggregateError`にする。
- Presence: 本人player pathだけを使い、`connected`と`lastSeenAt`だけを`update`する。onlineはdisconnect update登録をawaitした後にonline updateし、online失敗時はhookをcancelする。同room再登録と明示offlineは古いhookを先にcancelし、時刻は常に`serverTimestamp()`を使う。入力uidは無視し、他人pathを構築しない。
- Public API: 正本の8メソッドだけを公開し、任意Callable、任意path subscriber、generic writerは公開しない。
- Scope: `game-client/`と本reportだけを変更し、既存mobile UI/assets、backend/rules/docs、live Firebase、秘密情報には触れていない。

## Fresh verification

- `npx --yes node@20 --test game-client/test/firebase-game-client.test.mjs`: 21 pass / 0 fail
- `npx --yes node@20 --test firebase-backend/test/fake-rtdb.test.mjs firebase-backend/test/functions-contract.test.mjs firebase-backend/test/game-session-service.test.mjs firebase-backend/test/room-domain.test.mjs`: 55 pass / 0 fail
- `npm --prefix firebase-backend run test:rules`: 96 pass / 0 fail
- `npm --prefix firebase-backend run build`: exit 0 (`lib/index.mjs`, 56.3kb)
- `npx --yes node@20 --test game-engine/test/*.test.mjs`: 32 pass / 0 fail

## 懸念・注意

- `subscribeRoom`は同期的に本人private pathを組み立てるため、先に`ensureAnonymousAuth()`を完了して`auth.currentUser`が存在する必要がある。
- `dispose()`はFirebase `onDisconnect().cancel()`を待つためPromiseを返す。完全cleanupの完了やcleanup errorを扱う呼び出し側は`await client.dispose()`を使う。
- SDK adapter unit testはlive Firebaseへ接続しない。Firebase Emulatorとの実接続は後続のUI統合段階で確認する。
