// 人狼ゲーム — Firebase Web クライアント設定
//
// これらの値は「秘密」ではなく公開してよい識別子です(apiKey も含む)。
// 守りは Realtime Database のセキュリティルールと App Check で担保します。
// projectId: jinro-bb5a5 / app: werewolf
//
// databaseURL は Realtime Database をクラウドで有効化すると発行されます
// (通常 https://jinro-bb5a5-default-rtdb.firebaseio.com、リージョンにより変わる)。
// エミュレータ接続時は connectDatabaseEmulator(db, "127.0.0.1", 9000) を使います。

export const firebaseConfig = {
  apiKey: "AIzaSyBV5hlun9bQj3x-cEaN4FWVmc-rvBhX4zc",
  authDomain: "jinro-bb5a5.firebaseapp.com",
  projectId: "jinro-bb5a5",
  storageBucket: "jinro-bb5a5.firebasestorage.app",
  messagingSenderId: "495471575660",
  appId: "1:495471575660:web:cf4f48fd14ebd5a9c6ce49",
  measurementId: "G-F4WPSKT6HM",
  databaseURL: "https://jinro-bb5a5-default-rtdb.firebaseio.com", // RTDB: US (us-central1)
};

// エミュレータのポート(firebase.json と一致)
export const EMULATOR_PORTS = { auth: 9099, functions: 5001, database: 9000 };
