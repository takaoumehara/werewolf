# デプロイ手順（月下ノ影 / jinro-bb5a5）

最終確認: 2026-07-29 / 対象コミット `aaff02f`（main）

## 前提の確認結果

このリポジトリのデプロイに必要なものを実際に検証した。**コードとビルドは準備完了で、
足りないのは認証情報だけ**。

| 項目 | 状態 |
|---|---|
| `firebase-tools` | ✅ 15.24.0 で動作確認 |
| `functions` の依存と esbuild ビルド | ✅ `npm --prefix functions run build` が通る（`lib/index.mjs` 60.4KB） |
| Hosting の配信物 `public/` | ✅ 127MB（画像庫を含む）。`public/index.html` は `mobile_app.html` と一致 |
| Google API への到達 | ✅ hosting / cloudfunctions / cloudbuild / artifactregistry / oauth2 すべて到達可 |
| **認証情報** | ❌ **無い**。`firebase login` は対話ブラウザが必要 |
| **`*.firebaseio.com` への到達** | ❌ **組織の外向き通信ポリシーが 403 で遮断**（下記） |

## 必要なもの

### 1. 認証情報（必須）

次のいずれか。

| 方法 | 手順 | 備考 |
|---|---|---|
| **A. 自分の端末で実行**（推奨） | `firebase login` してから下記のデプロイコマンド | 資格情報がどこにも残らない。最も安全 |
| B. サービスアカウント | JSON 鍵を置き `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json` | CI 向け。鍵の管理が要る |
| C. CI トークン | 自分の端末で `firebase login:ci` → `FIREBASE_TOKEN=...` | **有効期限の長い資格情報**。チャットや共有環境に貼らないこと |

サービスアカウントに要る権限: Firebase Hosting 管理者 / Cloud Functions 管理者 /
サービス アカウント ユーザー / Firebase Rules 管理者（database を出す場合）。

### 2. Anthropic の APIキー（functions を出す場合）

`advanceAiTurn` は `ANTHROPIC_API_KEY` シークレットに束縛されている。未登録なら一度だけ:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

**リポジトリにキーを置かないこと。** `functions/.secret.local` はエミュレータ専用の
ダミー置き場で、gitignore 済み。

### 3. 料金プラン

Cloud Functions は Blaze プラン必須（既にデプロイ実績があるので恐らく設定済み）。

## デプロイコマンド

**`--project jinro-bb5a5` を必ず付けること。** 理由は下の「よくある事故」を参照。

```bash
# 出す前に必ず全テストを通す
bash tests/mobile_app_test.sh        # public/index.html の同期もここで検証される
bash tests/live_selection_test.sh
bash tests/viewport_fit_test.sh
bash tests/design_system_test.sh
(cd game-engine && npm test)
node --test functions/ai/*.test.mjs

# 出す先を固定する（一度やれば以後このディレクトリでは覚える）
firebase use jinro-bb5a5

# 画面だけ出す（いちばん安全。AIの挙動を変えていないときはこれで足りる）
firebase deploy --only hosting --project jinro-bb5a5

# サーバ側も出す
firebase deploy --only functions --project jinro-bb5a5

# データベースのルール（下記の遮断に注意）
firebase deploy --only database --project jinro-bb5a5
```

### よくある事故 — 別プロジェクトへ出そうとして失敗する

`firebase deploy` は `.firebaserc` の default より、**CLI が端末ごとに覚えている
「使用中プロジェクト」を優先する**（過去に別のディレクトリで `firebase use` を
実行していると、それが残る）。実際に次のエラーが出た:

```
Error: Failed to get Firebase project snap-pair-f2b1d.
Error: Missing permissions ... snap-pair-f2b1d@appspot.gserviceaccount.com
```

`.firebaserc` は `jinro-bb5a5` を指しているのに、まったく別のプロジェクトへ
出そうとしていた。**`--project jinro-bb5a5` を明示すれば、この記憶に関係なく
正しい先へ出る。** いま出そうとしている先は次で確認できる:

```bash
firebase use              # 使用中プロジェクトを表示
```

### 認証まわりのつまずき

| 症状 | 原因と対処 |
|---|---|
| `Already logged in` と出るのに `credentials are no longer valid` | 認証の許可が取り消されている。`firebase login --reauth` |
| `projects:list` に `jinro-bb5a5` が出ない | そのアカウントに権限が無い。`firebase login:add` で別アカウントを足し、`--account` で指定する |
| `firebase logout --token <token>` を実行した | **そのアカウントの Firebase CLI の認証がすべて無効になる**（端末のログインも切れる）。`firebase login --reauth` で復帰 |

初回は `public/` の 127MB がまるごと上がる。会場の回線では時間がかかる。

## 既知の制約

### `*.firebaseio.com` が組織ポリシーで遮断されている

このエージェント環境からは、次のホストへの CONNECT が 403 で拒否される。

- `firebase-public.firebaseio.com:443`
- `jinro-bb5a5-default-rtdb.firebaseio.com:443`

影響:

- **`firebase deploy --only database`（RTDBルールの反映）はこの環境からは実行できない。**
  ルールを変えたときは、ポリシーの制限がない環境から出すこと。
- **`firebase emulators:*` を使うテストもこの環境では動かない**
  （`tests/functions_smoke_test.sh` / `tests/ai_functions_smoke.sh`）。
  Database エミュレータが起動時に `firebase-public.firebaseio.com` を見に行き、
  プロキシの拒否本文をルールとして読んで落ちる。
  エラー文（`database.rules.json:Unable to parse JSON: ... "denied by "...`）は
  ファイルが壊れているように見えるが、**`database.rules.json` 自体は正しい JSON**。

hosting と functions のデプロイに必要なホストはすべて到達可能なので、
この2つは認証さえあれば出せる。

## 出したあとの確認

```bash
curl -sI https://jinro-bb5a5.web.app/ | head -5
# 画像に immutable のキャッシュが付いているか（今回 firebase.json に追加した設定）
curl -sI https://jinro-bb5a5.web.app/design-system.css | grep -i cache-control
```

ブラウザでは、ひとりで遊ぶ → AIを着席 → 夜/昼/投票が1周することを見る。
記録者の読み上げは初回のタップ後から鳴る（ブラウザの自動再生制限のため）。
