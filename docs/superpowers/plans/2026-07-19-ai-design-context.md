# AI Design Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codex、Claude、Geminiを含む新しいAIセッションが、リポジトリ作業開始時に共通のデザイン正本へ到達できる入口と自動検証を追加する。

**Architecture:** リポジトリ直下の `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` は、詳細なカード値を持たず `AI_CONTEXT.md` へ誘導する薄いアダプターにする。`AI_CONTEXT.md` から `design/README.md`、そこからカード仕様、25役職の配置JSON、デザインシステム、世界観へ進む一方向の参照構造を維持し、シェルテストで入口、リンク、最終カード条件、JSON構造を検証する。

**Tech Stack:** Markdown、JSON、Bash、ripgrep (`rg`)、Node.js

## Global Constraints

- `design/` を唯一のデザイン正本とし、AI別入口ファイルへカード値やデザイントークンを複製しない。
- 最終カードは `Refined / Transparent / Background ON` を使う。
- 人物アセットは `00_transparent-illustrations-72-a-refined`、背景は `backgrounds-72` を使う。
- 日本語と英語のタイトルは `card_viewer.html` を正本とし、人物配置は `design/refined-position-calibration.json` を使う。
- ユーザーの最新指示を常に最優先する。
- APIキー、アクセストークン、Firebaseの秘密情報をAI入口または `design/` に保存しない。
- 既存のユーザー作業中ファイル、画像、UI実装には触れない。

---

### Task 1: AI自動読込入口とデザイン正本の検証

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `GEMINI.md`
- Modify: `design/README.md`
- Test: `tests/design_source_of_truth_test.sh`

**Interfaces:**
- Consumes: `AI_CONTEXT.md` が提供するリポジトリ共通入口、`design/README.md` が提供する資料目次、`design/refined-position-calibration.json` が提供する `{ [roleId]: { scale, x, y } }` 形式の25役職設定。
- Produces: 3つのAI別入口から `AI_CONTEXT.md` へ到達する共通参照契約と、その契約を検証する `tests/design_source_of_truth_test.sh`。

- [ ] **Step 1: AI入口と最終カード条件を要求する失敗テストを書く**

`tests/design_source_of_truth_test.sh` を次の内容に置き換える。

```bash
#!/usr/bin/env bash

set -euo pipefail

for entrypoint in AGENTS.md CLAUDE.md GEMINI.md; do
  test -f "$entrypoint"
  rg -q 'AI_CONTEXT\.md' "$entrypoint"
  rg -q 'ユーザーの最新指示' "$entrypoint"
done

test -f AI_CONTEXT.md
test -f design/README.md
test -f design/current-card-design.md
test -f design/refined-position-calibration.json
test -f design/design-system.md
test -f world-theme.md

rg -q 'design/README\.md' AI_CONTEXT.md
rg -q 'current-card-design\.md' design/README.md
rg -q 'refined-position-calibration\.json' design/README.md
rg -q 'design-system\.md' design/README.md
rg -q 'world-theme\.md' design/README.md

rg -q 'Style: `Refined`' design/current-card-design.md
rg -q 'Mode: `Transparent`' design/current-card-design.md
rg -q 'Background: `ON`' design/current-card-design.md
rg -q '00_transparent-illustrations-72-a-refined' design/current-card-design.md
rg -q 'backgrounds-72' design/current-card-design.md
rg -q '日本語／英語を切り替え可能' design/current-card-design.md
rg -q 'card_viewer\.html' design/current-card-design.md
rg -q 'card_position_editor\.html' design/current-card-design.md

if rg -n --glob '*.md' --glob '*.json' '(AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' AGENTS.md CLAUDE.md GEMINI.md AI_CONTEXT.md design; then
  echo 'Potential secret found in AI/design documentation' >&2
  exit 1
fi

node <<'NODE'
const fs = require('fs');
const positions = JSON.parse(fs.readFileSync('design/refined-position-calibration.json', 'utf8'));
const ids = Object.keys(positions);
if (ids.length !== 25) throw new Error(`Expected 25 positions, found ${ids.length}`);
for (const [roleId, position] of Object.entries(positions)) {
  const keys = Object.keys(position).sort();
  if (keys.join(',') !== 'scale,x,y') {
    throw new Error(`${roleId} must contain exactly scale, x, and y`);
  }
  for (const key of keys) {
    if (typeof position[key] !== 'number' || !Number.isFinite(position[key])) {
      throw new Error(`${roleId}.${key} must be a finite number`);
    }
  }
}
console.log('design source-of-truth checks passed');
NODE
```

- [ ] **Step 2: テストを実行し、AI入口がないため失敗することを確認する**

Run:

```bash
bash tests/design_source_of_truth_test.sh
```

Expected: `AGENTS.md` の `test -f` で終了コード `1` になり、まだ入口ファイルが存在しないことを示す。

- [ ] **Step 3: 3つの薄いAI入口を作成する**

`AGENTS.md` を作成する。

```markdown
# Project Instructions

このリポジトリで作業を始める前に、必ず [`AI_CONTEXT.md`](AI_CONTEXT.md) を読むこと。カード、世界観、アセット、UI、デザインに関する作業では、そこから [`design/README.md`](design/README.md) と必要な正本を確認すること。

ユーザーの最新指示を最優先する。過去の案や生成途中の素材を最終デザインとして扱わず、APIキー、アクセストークン、Firebaseの秘密情報をAI向け資料または `design/` に保存しないこと。
```

`CLAUDE.md` を作成する。

```markdown
# Project Context

このリポジトリで作業を始める前に、必ず [`AI_CONTEXT.md`](AI_CONTEXT.md) を読むこと。カード、世界観、アセット、UI、デザインに関する作業では、そこから [`design/README.md`](design/README.md) と必要な正本を確認すること。

ユーザーの最新指示を最優先する。過去の案や生成途中の素材を最終デザインとして扱わず、APIキー、アクセストークン、Firebaseの秘密情報をAI向け資料または `design/` に保存しないこと。
```

`GEMINI.md` を作成する。

```markdown
# Project Context

このリポジトリで作業を始める前に、必ず [`AI_CONTEXT.md`](AI_CONTEXT.md) を読むこと。カード、世界観、アセット、UI、デザインに関する作業では、そこから [`design/README.md`](design/README.md) と必要な正本を確認すること。

ユーザーの最新指示を最優先する。過去の案や生成途中の素材を最終デザインとして扱わず、APIキー、アクセストークン、Firebaseの秘密情報をAI向け資料または `design/` に保存しないこと。
```

- [ ] **Step 4: デザイン目次にAIセッションの入口を明記する**

`design/README.md` の冒頭説明の直後へ次を追加する。

```markdown
## AIセッションの入口

Codex、Claude Code、Gemini CLIでは、リポジトリ直下の `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` から共通の [`AI_CONTEXT.md`](../AI_CONTEXT.md) を経由してこの目次へ到達する。AI別の入口へカード値やデザイントークンを複製せず、最新情報はこのフォルダの正本だけを更新する。
```

- [ ] **Step 5: 正本テストを実行して成功を確認する**

Run:

```bash
bash tests/design_source_of_truth_test.sh
```

Expected:

```text
design source-of-truth checks passed
```

- [ ] **Step 6: 関連する既存テストを実行する**

Run:

```bash
bash tests/card_position_editor_ui_test.sh
node --test tests/card_position_editor_core.test.mjs
bash tests/card_transparent_variants_test.sh
```

Expected: 3コマンドすべて終了コード `0`。Node.jsテストは全テストが `pass`、カードUIシェルテストは既存の成功メッセージを表示する。

- [ ] **Step 7: 変更範囲と秘密情報不在を確認する**

Run:

```bash
git diff --check
git status --short -- AGENTS.md CLAUDE.md GEMINI.md design/README.md tests/design_source_of_truth_test.sh
if rg -n --glob '*.md' --glob '*.json' '(AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' AGENTS.md CLAUDE.md GEMINI.md AI_CONTEXT.md design; then
  echo 'Potential secret found in AI/design documentation' >&2
  exit 1
fi
```

Expected: `git diff --check` は出力なし。指定した対象の状態一覧には `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`design/README.md`、`tests/design_source_of_truth_test.sh` だけが表示される。秘密情報検索は一致なしで終了コード `0`。

- [ ] **Step 8: AI入口とテストだけをコミットする**

```bash
git add AGENTS.md CLAUDE.md GEMINI.md design/README.md tests/design_source_of_truth_test.sh
git commit -m "docs: add shared AI design entrypoints"
```

Expected: 5ファイルだけを含む新しいコミットが作成される。既存の画像、UI、API関連ファイル、その他のユーザー作業はステージされない。
