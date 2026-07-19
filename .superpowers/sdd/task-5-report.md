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

## Review fix: subscription rollback and presence lifecycle

### RED

- 3番目の`ref`失敗時に先行2 subscriptionが解除されず、3番目の`onValue`失敗とrollback失敗も集約されないことを再現した。
- 同roomのA registration遅延中にB offlineが先行し、direct writeが`false`→`true`へ逆転することを再現した。
- A online write遅延中にB onlineが新hookを登録でき、A失敗cleanupが旧hookを2回cancelしてBのcurrent recordを消すことを再現した。
- disconnect registration待ち／online write待ちの`dispose()`がin-flightを待たず、online stateまたはhookをcleanup後に復活させることを再現した。
- manual offlineがdirect offline writeより先にhookをcancelし、write失敗時にdisconnect safetyを失うことを再現した。

### GREEN・自己レビュー

- subscription setupをtransactionalにし、5件すべて成功するまでglobal setへpublishしない。setup失敗時は取得済みunsubscribeをすべて一度だけ試行し、rollbackも失敗した場合はsetup errorを先頭にした`AggregateError`を返す。
- roomごとのPromise tail queueでpresenceを直列化する。前operationの成功・失敗にかかわらず次を開始し、異なるroomは相互に待たない。
- current hookをroomごとのrecordとして保持し、record identityが一致する場合だけdelete/cancelする。stale operationは後続hookを変更しない。
- `dispose()`は最初にdisposed flagを立てて新規presenceを拒否し、全room queue tailのsettleを待つ。その後current recordへ`connected: false`と`serverTimestamp()`を書き、成功後だけrecordを削除してhookをcancelする。
- dispose offline write失敗時はrecord/hookを維持し、残りroomのcleanupを継続して`AggregateError`を返す。後続`dispose()`は失敗recordを再試行できる。
- manual offlineもdirect offline write成功後だけcurrent hookをcancel/deleteし、write失敗時はhookを維持して再試行可能にする。
- public API、5 exact subscription paths、auth dedupe、4 fixed Callable、allowed payload contractは変更していない。

### Fresh verification after review fix

- `npm ci --prefix game-client`: 85 packages、0 vulnerabilities
- `npx --yes node@20 --test game-client/test/firebase-game-client.test.mjs`: 29 pass / 0 fail
- `npx --yes node@20 --test firebase-backend/test/fake-rtdb.test.mjs firebase-backend/test/functions-contract.test.mjs firebase-backend/test/game-session-service.test.mjs firebase-backend/test/room-domain.test.mjs`: 55 pass / 0 fail
- `npm --prefix firebase-backend run test:rules`: 96 pass / 0 fail
- `npm --prefix firebase-backend run build`: exit 0 (`lib/index.mjs`, 56.3kb)
- `npx --yes node@20 --test game-engine/test/*.test.mjs`: 32 pass / 0 fail

### 残る注意

- `dispose()`開始後、未開始のqueued presenceと新規presenceはdisposed errorでrejectされる。呼び出し側は画面破棄時の想定されたrejectを処理する。
- SDK adapter testはOnDisconnectを同path予約として扱う順序を固定するが、ネットワーク切断を含む実SDKの挙動確認は後続Emulator/UI統合で行う。
