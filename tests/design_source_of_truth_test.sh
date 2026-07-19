#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

fixture_dir=$(mktemp -d)
trap 'rm -rf -- "$fixture_dir"' EXIT

fail() {
  echo "$1" >&2
  exit 1
}

secret_pattern='(AIza[0-9A-Za-z_-]{35}|sk-(proj-|svcacct-|admin-)?[0-9A-Za-z_-]{20,}|gh[pousr]_[0-9A-Za-z]{36,255}|github_pat_[0-9A-Za-z_]{50,255}|(AKIA|ASIA)[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{20,}|xapp-[0-9A-Za-z-]{20,}|GOCSPX-[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----)'
scan_matches="$fixture_dir/scan-matches"
scan_errors="$fixture_dir/scan-errors"

# Return 0 for clean input, 10 for a match, and 11 for an rg/search failure.
scan_for_secrets() {
  : > "$scan_matches"
  : > "$scan_errors"

  if rg --hidden --no-ignore -l -i -- "$secret_pattern" "$@" > "$scan_matches" 2> "$scan_errors"; then
    return 10
  else
    local rg_status=$?
  fi

  case "$rg_status" in
    1) return 0 ;;
    *) return 11 ;;
  esac
}

require_clean_secret_scan() {
  local label=$1
  shift
  local scan_status

  if scan_for_secrets "$@"; then
    return 0
  else
    scan_status=$?
  fi

  case "$scan_status" in
    10)
      echo "Potential secret detected in $label" >&2
      sed 's/^/  /' "$scan_matches" >&2
      ;;
    *)
      echo "Secret scan failed for $label" >&2
      ;;
  esac
  return 1
}

# Exercise match, no-match, and search-error paths without storing a fixed token.
mkdir -p "$fixture_dir/positive" "$fixture_dir/negative"
positive_token='AKIA'
for _ in {1..16}; do
  positive_token+='A'
done
printf '%s\n' "$positive_token" > "$fixture_dir/positive/.credentials.txt"
printf '%s\n' 'Examples such as AKIA_SHORT and sk-example are not credentials.' > "$fixture_dir/negative/example.txt"

if scan_for_secrets "$fixture_dir/positive"; then
  positive_status=0
else
  positive_status=$?
fi
test "$positive_status" -eq 10 || fail 'Secret scanner positive fixture was not detected'

if scan_for_secrets "$fixture_dir/negative"; then
  negative_status=0
else
  negative_status=$?
fi
test "$negative_status" -eq 0 || fail 'Secret scanner negative fixture was rejected'

if scan_for_secrets "$fixture_dir/missing-search-root"; then
  error_status=0
else
  error_status=$?
fi
test "$error_status" -eq 11 || fail 'Secret scanner search-error fixture did not fail closed'

if require_clean_secret_scan 'positive fixture' "$fixture_dir/positive" > /dev/null 2>&1; then
  fail 'Secret scanner allowed its positive fixture'
fi
if require_clean_secret_scan 'search-error fixture' "$fixture_dir/missing-search-root" > /dev/null 2>&1; then
  fail 'Secret scanner allowed its search-error fixture'
fi

for entrypoint in AGENTS.md CLAUDE.md GEMINI.md; do
  test -f "$entrypoint"
done

for source in \
  AI_CONTEXT.md \
  design/README.md \
  design/current-card-design.md \
  design/refined-position-calibration.json \
  design/design-system.md \
  world-theme.md \
  card_viewer.html \
  card_gallery.html; do
  test -f "$source"
done

rg -q 'Style: `Refined`' design/current-card-design.md
rg -q 'Mode: `Transparent`' design/current-card-design.md
rg -q 'Background: `ON`' design/current-card-design.md
rg -q '00_transparent-illustrations-72-a-refined' design/current-card-design.md
rg -q 'backgrounds-72' design/current-card-design.md
rg -q '日本語／英語を切り替え可能' design/current-card-design.md
rg -q 'card_viewer\.html' design/current-card-design.md
rg -q 'card_position_editor\.html' design/current-card-design.md

require_clean_secret_scan 'AI/design documentation' AGENTS.md CLAUDE.md GEMINI.md AI_CONTEXT.md design

node <<'NODE'
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function markdownLinks(source) {
  const links = [];
  const pattern = /\[[^\]\n]+\]\(([^\s)]+)(?:\s+["'][^)]*["'])?\)/g;
  for (const match of source.matchAll(pattern)) {
    links.push({ destination: match[1], index: match.index });
  }
  return links;
}

function requireMarkdownLink(sourceFile, targetFile, requirePositiveInstruction = false) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const sourceDir = path.dirname(path.resolve(sourceFile));
  const expected = path.resolve(targetFile);
  const link = markdownLinks(source).find(({ destination }) =>
    path.resolve(sourceDir, destination) === expected
  );

  assert(link, `${sourceFile} must contain a Markdown link to exactly ${targetFile}`);
  assert(fs.statSync(expected).isFile(), `${sourceFile} link target is not a file: ${targetFile}`);

  if (requirePositiveInstruction) {
    const lineStart = source.lastIndexOf('\n', link.index) + 1;
    const lineEnd = source.indexOf('\n', link.index);
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
    assert(/必ず/.test(line) && /(読む|確認する)/.test(line),
      `${sourceFile} must positively instruct the AI to read its required link`);
    assert(!/(読まない|読むな|確認しない|参照しない|不要)/.test(line),
      `${sourceFile} must not negate its required-link instruction`);
  }
}

for (const entrypoint of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
  requireMarkdownLink(entrypoint, 'AI_CONTEXT.md', true);
  const source = fs.readFileSync(entrypoint, 'utf8');
  for (const contract of [/ユーザーの最新指示/, /APIキー/, /アクセストークン/, /Firebase/, /秘密情報/, /保存しない/]) {
    assert(contract.test(source), `${entrypoint} is missing required instruction: ${contract}`);
  }

  const forbiddenCardDetails = [
    /\bRefined\b/i,
    /\bTransparent\b/i,
    /Background\s*:?\s*`?ON`?/i,
    /00_transparent-illustrations-72-a-refined/,
    /backgrounds-72/,
    /360\s*[×x]\s*640/i,
  ];
  for (const detail of forbiddenCardDetails) {
    assert(!detail.test(source), `${entrypoint} duplicates final-card detail: ${detail}`);
  }

  const designSystem = fs.readFileSync('design/design-system.md', 'utf8');
  const knownTokens = new Set([...designSystem.matchAll(/`(--[a-z][a-z0-9-]+)`/g)].map(match => match[1]));
  for (const token of knownTokens) {
    assert(!source.includes(token), `${entrypoint} duplicates design token ${token}`);
  }
}

requireMarkdownLink('AI_CONTEXT.md', 'design/README.md', true);
requireMarkdownLink('design/README.md', 'design/current-card-design.md');
requireMarkdownLink('design/README.md', 'design/refined-position-calibration.json');
requireMarkdownLink('design/README.md', 'design/design-system.md');
requireMarkdownLink('design/README.md', 'world-theme.md');

const positions = JSON.parse(fs.readFileSync('design/refined-position-calibration.json', 'utf8'));
const positionIds = Object.keys(positions);
assert(positionIds.length === 25, `Expected 25 positions, found ${positionIds.length}`);
for (const [roleId, position] of Object.entries(positions)) {
  const keys = Object.keys(position).sort();
  assert(keys.join(',') === 'scale,x,y', `${roleId} must contain exactly scale, x, and y`);
  for (const key of keys) {
    assert(typeof position[key] === 'number' && Number.isFinite(position[key]),
      `${roleId}.${key} must be a finite number`);
  }
}

function extractArrayInitializer(source, variableName) {
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${variableName}\\s*=\\s*\\[`).exec(source);
  assert(declaration, `Could not find ${variableName} array declaration`);
  const start = source.indexOf('[', declaration.index);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unterminated ${variableName} array declaration`);
}

const viewerSource = fs.readFileSync('card_viewer.html', 'utf8');
const rolesSource = extractArrayInitializer(viewerSource, 'rolesData');
const roles = vm.runInNewContext(`(${rolesSource})`, Object.create(null), { timeout: 1000 });
assert(Array.isArray(roles), 'card_viewer.html rolesData must be an array');
assert(roles.length === 25, `Expected 25 viewer roles, found ${roles.length}`);

const viewerIds = [];
for (const [index, role] of roles.entries()) {
  assert(role && typeof role === 'object' && !Array.isArray(role), `Viewer role ${index} must be an object`);
  for (const field of ['id', 'jp', 'en']) {
    assert(typeof role[field] === 'string' && role[field].trim(),
      `Viewer role ${index}.${field} must be a non-empty string`);
  }
  viewerIds.push(role.id);
}
assert(new Set(viewerIds).size === viewerIds.length, 'card_viewer.html contains duplicate role IDs');

const expectedIds = [...positionIds].sort();
const actualIds = [...viewerIds].sort();
assert(JSON.stringify(actualIds) === JSON.stringify(expectedIds),
  `Viewer/calibration role ID drift: viewer=${actualIds.join(',')} calibration=${expectedIds.join(',')}`);

const gallerySource = fs.readFileSync('card_gallery.html', 'utf8');
function requireInitialAssignment(name, expectedLiteral) {
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*${expectedLiteral}\\s*;`);
  assert(pattern.test(gallerySource), `card_gallery.html must initialize ${name} to ${expectedLiteral}`);
}
requireInitialAssignment('currentStyle', "['\"]refined['\"]");
requireInitialAssignment('currentMode', "['\"]trans['\"]");
requireInitialAssignment('bgEnabled', 'true');

const buttons = new Map();
for (const match of gallerySource.matchAll(/<button\b([^>]*)>/gi)) {
  const attributes = new Map();
  for (const attribute of match[1].matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
  }
  if (attributes.has('id')) buttons.set(attributes.get('id'), attributes);
}
function requireActiveButton(activeId, inactiveIds) {
  const active = buttons.get(activeId);
  assert(active, `Missing gallery button #${activeId}`);
  assert(active.get('class')?.split(/\s+/).includes('active'), `#${activeId} must initially be active`);
  for (const inactiveId of inactiveIds) {
    const inactive = buttons.get(inactiveId);
    assert(inactive, `Missing gallery button #${inactiveId}`);
    assert(!inactive.get('class')?.split(/\s+/).includes('active'), `#${inactiveId} must initially be inactive`);
  }
}
requireActiveButton('style-refined', ['style-a', 'style-lifelike']);
requireActiveButton('mode-trans', ['mode-flat']);
requireActiveButton('bg-on', ['bg-off']);

console.log('design source-of-truth checks passed');
NODE
