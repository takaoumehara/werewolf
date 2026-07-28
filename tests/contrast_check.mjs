// design-system.css の前景色トークンのコントラストを WCAG で検査する。
// design-system.css を実際に読み込み、対象セレクタの rgba(...) 不透明度を
// 抽出して背景(--sem-bg 最暗 = night)に合成 → コントラスト比を計算する。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "design-system.css");
const css = readFileSync(cssPath, "utf8");

const BG = "#0B0A10"; // 最暗 phase(night) の --sem-bg を代表背景に
const PAPER = [237, 233, 220]; // EDE9DC

function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function overBg(rgb, a) { const bg = hexRgb(BG); return rgb.map((c, i) => Math.round(c * a + bg[i] * (1 - a))); }
function ratio(fg) { const L1 = lum(fg), L2 = lum(hexRgb(BG)); const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]; return (hi + 0.05) / (lo + 0.05); }

// セレクタのルールブロックから rgba(237, 233, 220, X) の不透明度 X を抽出する。
function opacityInRule(selector) {
  const escaped = selector.replace(/[.[\]]/g, (m) => "\\" + m);
  const re = new RegExp(escaped.replace(/\s+/g, "\\s+") + "\\s*\\{[^}]*\\}");
  const block = css.match(re);
  if (!block) throw new Error(`selector not found in design-system.css: ${selector}`);
  const m = block[0].match(/rgba\(\s*237,\s*233,\s*220,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`rgba(237,233,220,X) not found in rule: ${selector}`);
  return parseFloat(m[1]);
}

// --sem-text-dim は body[data-phase=...] ブロックごとに5回定義される。
// 全フェーズ分を抽出し、最悪値(最小不透明度)で判定する。
function allSemTextDimOpacities() {
  const re = /--sem-text-dim:\s*rgba\(\s*237,\s*233,\s*220,\s*([\d.]+)\s*\)/g;
  const vals = [];
  let m;
  while ((m = re.exec(css))) vals.push(parseFloat(m[1]));
  if (vals.length === 0) throw new Error("--sem-text-dim not found in design-system.css");
  return vals;
}

// 検査対象: 「本文相当」は 4.5:1 必須。paper色を各不透明度で合成して判定。
const semTextDimOpacities = allSemTextDimOpacities();
const semTextDimMin = Math.min(...semTextDimOpacities);

const checks = [
  { label: ".brand-eyebrow", a: opacityInRule(".brand-eyebrow"), min: 4.5 },
  { label: ".btn.rules-link", a: opacityInRule(".btn.rules-link"), min: 4.5 },
  { label: ".player-row .idx [UI 3:1]", a: opacityInRule(".player-row .idx"), min: 3.0 },
  { label: "--sem-text-dim (全5フェーズ中最小)", a: semTextDimMin, min: 4.5 },
  { label: ".target-option .vote-num", a: opacityInRule(".target-option .vote-num"), min: 4.5 },
  { label: ".target-option .vote-mark [UI 3:1]", a: opacityInRule(".target-option .vote-mark"), min: 3.0 },
];

const fails = [];
for (const c of checks) {
  const r = ratio(overBg(PAPER, c.a));
  if (r < c.min) fails.push(`${c.label}(${c.a}): ${r.toFixed(2)}:1 < ${c.min}:1`);
}
if (fails.length) {
  console.error("CONTRAST FAIL:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("OK: contrast_check passed");
