# Firebase: ライブ入域鍵の接続契約

`live_access_key.mjs` は、Firebase のルーム作成時に発行される招待トークンを、再現可能な入域鍵の見た目へ変換する。見た目はゲームの権限ではない。トークンの解決、参加人数、メンバーシップの作成は必ず Cloud Function が担当する。

## Cloud Function の作成時処理

`createSnapRoom` のサーバー側で、ルームIDと招待トークンを生成した直後に次を行う。

```ts
import { randomInt, randomUUID } from 'node:crypto';
import { deriveAccessKey } from '../../live_access_key.mjs';

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createInviteToken(length = 8) {
  return Array.from(
    { length },
    () => PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)],
  ).join('');
}

// auth と入力値の検証後。ルーム作成はクライアントでは行わない。
const roomId = randomUUID();
const inviteToken = createInviteToken();
const accessKey = deriveAccessKey(inviteToken);
const now = Date.now();

await admin.database().ref().update({
  [`rooms/${roomId}/meta`]: {
    hostId: context.auth.uid,
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
    participantCount: 1,
    maxPlayers,
    accessKey,
  },
  [`rooms/${roomId}/players/${context.auth.uid}`]: {
    id: context.auth.uid,
    role: 'host',
    connected: true,
    joinedAt: now,
    lastSeenAt: now,
  },
  [`roomMembers/${roomId}/${context.auth.uid}`]: true,
  [`pairingCodes/${inviteToken}`]: {
    roomId,
    hostId: context.auth.uid,
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000,
    maxPlayers,
  },
});

return {
  roomId,
  inviteToken,
  accessKey,
  inviteUrl: `https://<your-domain>/i/${inviteToken}`,
};
```

`pairingCodes` は作成前にサーバー側で未使用を確認し、衝突した場合はトークンを作り直す。これにより、同時に有効な招待トークンは一意になる。TTL、参加人数の原子的な更新、App Check、参加処理の権限検証は `snap-pair` の通常実装へ従う。このコードは見た目のメタデータを追加する部分だけを示している。

## ホスト画面の描画

Cloud Function の戻り値、またはメンバーシップ確認後に購読した `rooms/{roomId}/meta/accessKey` を使う。

```ts
const accessKey = room.meta.accessKey;
preview.innerHTML = accessKeyMarkup(accessKey);
await renderAccessKeyQr(
  preview.querySelector('[data-access-key-qr]'),
  inviteUrl,
  accessKey,
);
```

同じ `inviteToken` と `styleVersion` なら、再接続・別ブラウザ・再レンダリングでも同じテンプレート、配色、鍵の歯、刻印になる。異なる招待トークンは異なるQR内容を持ち、入域鍵のシリアルも異なる。

## 更新時のルール

- `accessKey` は Cloud Function だけが作成・更新する。クライアントは書き換えない。
- テンプレートを追加・変更するときは `ACCESS_KEY_STYLE_VERSION` を上げ、既存ルームの保存済み値はそのまま描画する。
- QR本体の上にイラスト、走査線、中央ロゴを重ねない。装飾は `.access-key__qr-quiet-zone` の外側へ限定する。
- `inviteToken` はランダムな不透明値として扱い、ルームIDやホストIDをQRへ直接含めない。
