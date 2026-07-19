# 人狼ゲーム・ゲームエンジン

`src/engine.mjs` はFirebaseや画面から独立した決定論的なドメインエンジンです。
Firebase SDKをエンジンへimportせず、Cloud Functionsなどのサーバーアダプターから
コマンドを渡して状態遷移を保存します。

## Firebaseアダプターの契約

`src/firebase-adapter-contract.mjs` は、次の3つの境界関数を提供します。

### `createCommandEnvelope(input)`

クライアントから受けた値をサーバー側で検証し、保存可能なコマンドへ正規化します。

```js
const command = createCommandEnvelope({
  id: request.commandId,             // 再送を識別する一意なID
  actorId: authenticatedPlayerId,
  type: "CAST_VOTE",
  payload: { targetId: "player-2" },
  expectedRevision: authoritative.revision,
  now: serverTimestampMs,            // クライアント時刻ではない
});
```

`id`、`actorId`、`type` は空でない文字列、`expectedRevision` は0以上の整数、
`now` は0以上の安全な整数タイムスタンプでなければなりません。`payload` は
プレーンオブジェクトで、省略時は空オブジェクトになります。

### `applyCommandOnce(options)`

処理済みコマンド台帳を使って、同じ `command.id` の再送を一度だけ適用します。
台帳はFirebaseからtransaction内で読み込んだrecord、またはテスト用の `Map` を
渡せます。初回だけ `dispatch(state, command)` が呼ばれ、返却された
`{ state, events }` が台帳へ保存されます。再送時は保存済み結果を返すため、
投票・夜行動・進行コマンドが二重適用されません。

```js
const result = applyCommandOnce({
  state: transaction.authoritative,
  command,
  dispatch,
  processedCommands: transaction.processedCommands,
});
```

`processedCommands` には「IDだけ」のフラグではなく、再送時に返す完全な
`{ state, events }` 結果を保存してください。Firebaseで保存する場合は、権威状態、
処理済みID、イベント、ビューの書き込みと競合検出を同じtransaction境界で扱います。

### `buildPersistencePatch(options)`

完全状態を公開領域へ渡さないため、保存先を4つに分離したplain objectを返します。

```js
const patch = buildPersistencePatch({
  state: result.state,
  events: result.events,
  toPublicView,
  toPlayerView,
});

// patch.public
// patch.privateViews[playerId]
// patch.authoritative
// patch.events
// patch.publicEvents // room-wide subscriptionに使える安全なイベントだけ
```

`public` は全員へ配信するビュー、`privateViews[playerId]` は該当プレイヤーだけの
秘密ビュー、`authoritative` はCloud Functionsだけが読める完全状態、`events` は
サーバー専用の完全イベントです。room-wide subscriptionへ渡すのは `publicEvents` だけに
してください。`publicEvents` は夜行動の種類・対象、秘密結果、内部死亡原因を除去します。
全てdeep cloneして返すため、ビューや保存層が別の領域を後から変更しても相互に参照が
漏れません。

`toPublicView` と `toPlayerView` はドメインエンジンのビュー関数を渡します。公開
ビューに役職・夜行動・未公開投票が含まれないことは、ビュー関数側の契約として
テストで固定してください。

## Cloud Functions側の接続例（概念コード）

このリポジトリのエンジン本体にはFirebase SDKを追加しません。SDKのtransaction API
はアダプター側で呼び、以下の順序を守ります。

```js
// Firebase SDKのimportはCloud Functions側だけに置く。
// import { runTransaction } from "firebase-admin/database";

async function dispatchCommandInRoom(roomId, request, authenticatedPlayerId) {
  return runRoomTransaction(roomId, (transaction) => {
    const command = createCommandEnvelope({
      id: request.commandId,
      actorId: authenticatedPlayerId,
      type: request.type,
      payload: request.payload,
      expectedRevision: transaction.authoritative.revision,
      now: transaction.serverNow,
    });

    const result = applyCommandOnce({
      state: transaction.authoritative,
      command,
      dispatch,
      processedCommands: transaction.processedCommands,
    });
    const patch = buildPersistencePatch({
      state: result.state,
      events: result.events,
      toPublicView,
      toPlayerView,
    });

    return {
      ...transaction,
      authoritative: patch.authoritative,
      public: patch.public,
      privateViews: patch.privateViews,
      events: appendEvents(transaction.events, patch.events),
      publicEvents: appendPublicEvents(transaction.publicEvents, patch.publicEvents),
      processedCommands: transaction.processedCommands,
    };
  });
}
```

実際のFirebaseルールでは、クライアントに `authoritative` と
`processedCommands` の書き込み権限を与えません。認証、App Check、ルームメンバー
シップ、レート制限はこのアダプターの外側で検証し、秘密ビューも本人のパスだけを
読めるようにします。

## テスト

```bash
npm test --prefix game-engine
```

アダプター契約テストはFirebase SDKを起動せず、コマンドの冪等性と公開／個人／完全
状態の分離をNode.js標準テストランナーで検証します。
