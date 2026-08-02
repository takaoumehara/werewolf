# Handoff — 2026-08-02(2) 2大ブロッカーを外した。次は実鍵での1卓とルールの穴

**Passphrase**: `鍵が無くても最後まで回る。あとはルールの穴`

## Objective

前回カプセル（`2026-08-02-playable.md`）の Immediate Next Steps 1〜3 を**全て解決**した。
作業ブランチ: `claude/werewolf-solo-ai-fix-zc4emn`（**draft PR #1** · HEAD `661491a`）。push 済み。

| # | 前回の宿題 | 結論 |
|---|---|---|
| ① | AIが喋らない（鍵未設定） | 鍵が無くても**ローカル発話で卓が最後まで回る**。簡易モードは画面に出す |
| ② | ルーム番号 TTL 5分 | **二択を捨てた**。合言葉（新規参加・12h・卓が waiting の間だけ）と復帰（`resumeRoom`・uid・寿命無し）を別の道に |
| ③ | チャットにAIが反応しない | 発言ログを渡し、**人間の発言に返す「第二波」**を足した（最大3波・返すのは最大2体） |

## Verified State

`game-engine` 80/80 · **`functions/ai` 64/64**（39→+25）· **`tests/solo_loop_test.mjs`（新規）6/6** ·
`live_selection` 121/121 · `viewport_fit` 21/21×2 · `ui_regressions` pass（6→7項目）·
`mobile_app` · `design_system` pass。**上3つは Sonnet 5 に切り替えた後に再実行して一致を確認済み。**
UI回帰の新2項目は**壊して落ちることを確認済み**（`#resumeCard` 改名 + `requestAiReplyWave` 除去で 2件 FAIL）。

**完成度の自己評価: 84/100**（前回74）。内訳は `docs/2026-08-02-solo-blockers.md` §5。

**測れていないこと**: 実鍵での生成（`speechMode:"llm"` はモックのみ。到達性は
偽鍵の 401 で実測）· Firebase を通した復帰（エミュレータが動かない）。

## docs/

`docs/` の**全ファイル**。Status と Last updated は各ファイルの見出しから写した。

| File | Status | Last updated | Open questions |
|---|---|---|---|
| superforge.md | 言語設定・pinned | 2026-08-02 | **会話も docs も日本語**。サブエージェント禁止の運用 |
| **2026-08-02-solo-blockers.md** | **今回の正本** | 2026-08-02 | none |
| 2026-08-02-playability-ux.md | 前回の正本（§6/§7 に解決済の追記）| 2026-08-02 | none |
| promo-video-plan.md | 台本として完成（A）| 2026-08-02 | 生成はユーザーがブラウザで実行する |
| deploy.md | agreed。§2 に**鍵の切り分け手順**を追加 | 2026-08-02 | 実鍵の登録はユーザーの端末 |
| 2026-07-28-mobile-desktop-audit.md | 追補表 J-1…J-11 が正本 | 2026-07-29 | I-2（原画のサムネ流用）だけ未対応 |
| firebase-live-access-key.md | reference（入域鍵の接続契約）| 2026-07-28 | none |
| integration-roadmap.html | reference | 2026-07-28 | none |
| superpowers/plans/*.md（9件）| 実装済み | 2026-07-19〜07-26 | none |
| superpowers/specs/*.md（7件）| 設計正本 | 2026-07-19〜07-23 | none |
| audit-evidence/（PNG 1枚）| 証跡 | 2026-07-28 | none |
| verification.md / security.md / ship-readiness.md / failforward.md | — | — | **not run yet** |

**Running processes / ports**: 常駐なし。テストは自前で `python3 -m http.server`（8908 / 8912）を起動して落とす。

## Immediate Next Steps

1. **実鍵で1卓回す**（ユーザーの端末）。デプロイ前に鍵だけ試せる:
   `ANTHROPIC_API_KEY='sk-ant-...' node functions/scripts/check-anthropic-key.mjs`
   OK が出たら `firebase functions:secrets:set ANTHROPIC_API_KEY --project jinro-bb5a5`
   → **`firebase deploy --only functions`（登録だけでは反映されない）**
2. **決選投票**（いまは同数なら処刑なし）— **ルールの決定が先**
3. `ghost_wolf` を配れるようにする（図鑑と画像にはあるが `rolesData` / `ROLE_IDS` に無い）
4. AIペルソナの顔（絵札の流用か別途生成かの方針決定が先）
5. 監査 F（`index.html` と `mobile_app.html` のどちらを正本にするか）

## 未決 / 既知の穴

- ローカル発話の文型は**12通り**しかない。長い卓では繰り返しが見える
- 復帰は**タップ1回**要る（タイトル → 部屋選び →「前の卓に戻る」）。自動復帰にしなかったのは、
  新しく遊びたい人を引き戻す事故の方が重いから。プライベート閲覧では控えが残らず戻れない
- 監査 I-2（カード原画をサムネイルに使っている箇所）は画像の再エンコードが要る

## Files to Read First

1. `docs/2026-08-02-solo-blockers.md` — **今回の正本。§1 の TTL の判断から読む**
2. `functions/ai/orchestrator.mjs` — 波・ローカル退避・`speechMode` が全部ここ
3. `functions/ai/fallback.mjs` — 鍵なし発話。LLM と同じ制約を守る純関数
4. `tests/solo_loop_test.mjs` — メモリ上の卓で通しを回す。**穴はここで見つかる**
5. `functions/index.js` — `CODE_TTL_MS` / `resumeRoom` / `advanceAiTurn` の `wave`
6. `mobile_app.html` — 本体。`public/index.html` は `bash tools/build-public.sh` の**生成物**（直接編集しない）

## 決めたこと（今回追加分）

- **合言葉と復帰は別のもの**。合言葉=「まだ入っていない人」の鍵、復帰=「既に席がある人」を戻す。
  **新規参加の締切は時計ではなく卓の状態**（`meta.status === 'waiting'` の間だけ）。TTL 12h は占有上限にすぎない
- **既に一員なら、寿命も卓の状態も問わず合言葉を通す**（復帰導線を知らない人の保険）
- **「鍵が無い」は失敗ではなく設定状態**。`errors` に数えず `speechMode:"local"` で表す
- **埋め合わせても失敗の事実は消さない**。`source:"local"` を chat に残し、生成失敗は `errors` に出す
- **発話は波に分ける**。1波目=全員の第一声、2波目以降=人間への返し。上限3波は**サーバー側で強制**（課金暴走の防止）
- **死亡者の発言はプロンプトに載せない**（名簿にない人物への言及を誘発するため）
- ローカル発話は**決定論**（`Math.random` 不使用）。同じ卓・同じラウンドなら同じ文

## 前回から引き継いだ決定（変更なし）

役職構成は全員に公開・`roleId` 昇順 · 間の画面は自動で進めない · 読み返しは記録に残す ·
44pt のタップ下限は削らない · 雰囲気の演出に動画を足さない · 札のアニメーションは枠に当てる ·
ハンターの道連れは夜のうちに · 妖狐の耐性表示は騎士と同じ · スパイの `relay` は演出専用 ·
読み上げ(TTS)は消音に連動 · 画像は二段構え（`thumbs/`400px · `cards/`1200px · 原画は配信しない）
