/**
 * Deterministic access-key metadata for Firebase-backed rooms.
 *
 * Firebase owns the opaque invite token. This module only turns that token
 * into presentation metadata, so clients cannot influence room membership.
 */
export const ACCESS_KEY_STYLE_VERSION = 1;

export const ACCESS_KEY_TEMPLATE_IDS = Object.freeze([
  'forge-key',
  'keyhole-relay',
  'lunar-seal',
  'wolf-ward',
  'archive-tablet',
]);

const PALETTES = Object.freeze([
  Object.freeze({ metal: '#a96b39', edge: '#d6a567', ink: '#171611', paper: '#f0e7d0', name: 'copper' }),
  Object.freeze({ metal: '#5e7b71', edge: '#9ab6aa', ink: '#17201d', paper: '#e6e4d2', name: 'verdigris' }),
  Object.freeze({ metal: '#93443b', edge: '#d07c65', ink: '#211312', paper: '#efe1ce', name: 'iron-red' }),
  Object.freeze({ metal: '#85754e', edge: '#c2b07a', ink: '#1b1a13', paper: '#ece4c6', name: 'old-gold' }),
  Object.freeze({ metal: '#545e76', edge: '#9faed0', ink: '#151820', paper: '#e3e6e7', name: 'moon-steel' }),
]);

const INVITE_TOKEN_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,24}$/;
const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const HASH_MASK = 0xffffffffffffffffn;

function normalizeInviteToken(inviteToken) {
  const normalized = String(inviteToken ?? '').trim().toUpperCase();
  if (!INVITE_TOKEN_PATTERN.test(normalized)) {
    throw new TypeError('Invite token must use 6–24 font-safe uppercase characters.');
  }
  return normalized;
}

function fnv1a64(value) {
  let hash = FNV64_OFFSET;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = (hash * FNV64_PRIME) & HASH_MASK;
  }
  return hash;
}

function pick(hash, offset, size) {
  return Number((hash >> BigInt(offset)) % BigInt(size));
}

function serialFromHash(hash) {
  return hash.toString(16).toUpperCase().padStart(16, '0').slice(-8);
}

/**
 * Creates deterministic visual metadata from an invite token.
 * Store the returned object under rooms/{roomId}/meta/accessKey at room creation.
 */
export function deriveAccessKey(inviteToken, styleVersion = ACCESS_KEY_STYLE_VERSION) {
  const normalizedToken = normalizeInviteToken(inviteToken);
  if (styleVersion !== ACCESS_KEY_STYLE_VERSION) {
    throw new RangeError(`Unsupported access-key style version: ${styleVersion}`);
  }

  const hash = fnv1a64(`werewolf-access-key/v${styleVersion}/${normalizedToken}`);
  const templateId = ACCESS_KEY_TEMPLATE_IDS[pick(hash, 0, ACCESS_KEY_TEMPLATE_IDS.length)];
  const palette = PALETTES[pick(hash, 9, PALETTES.length)];
  const teeth = Object.freeze(Array.from({ length: 5 }, (_, index) => 1 + pick(hash, 18 + index * 3, 3)));
  const runes = Object.freeze(Array.from({ length: 4 }, (_, index) => pick(hash, 38 + index * 5, 32).toString(32).toUpperCase()));

  return Object.freeze({
    styleVersion,
    inviteToken: normalizedToken,
    templateId,
    palette,
    teeth,
    runes,
    serial: serialFromHash(hash),
  });
}

/**
 * Payload for the QR. Keep the address short; Firebase resolves the token server-side.
 */
export function buildInviteUrl(origin, inviteToken) {
  const normalizedToken = normalizeInviteToken(inviteToken);
  const base = new URL(origin);
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new TypeError('Invite origin must be an http(s) URL.');
  }
  return new URL(`/i/${normalizedToken}`, base).toString();
}

export function generateDemoInviteToken(length = 8) {
  if (!Number.isInteger(length) || length < 6 || length > 24) {
    throw new RangeError('Demo invite token length must be between 6 and 24.');
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random values are required to create an invite token.');
  }

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

/**
 * Produces the safe shell around a QR canvas. Nothing is drawn over the QR itself.
 */
export function accessKeyMarkup(accessKey) {
  const teeth = accessKey.teeth.map((height, index) => (
    `<i class="access-key__tooth" style="--tooth-height:${height};--tooth-index:${index}" aria-hidden="true"></i>`
  )).join('');
  const runes = accessKey.runes.map((rune) => `<span>${escapeHtml(rune)}</span>`).join('');
  const { palette } = accessKey;

  return `
    <article class="access-key access-key--${escapeHtml(accessKey.templateId)}" style="--metal:${palette.metal};--edge:${palette.edge};--qr-ink:${palette.ink};--qr-paper:${palette.paper}" aria-label="${escapeHtml(accessKey.templateId)} 形式の入域鍵">
      <div class="access-key__catalog">RECORDER / ${escapeHtml(accessKey.serial)}</div>
      <div class="access-key__artifact" aria-hidden="true">
        <span class="access-key__moon"></span>
        <span class="access-key__ear access-key__ear--left"></span>
        <span class="access-key__ear access-key__ear--right"></span>
        <span class="access-key__gate-bar"></span>
        <span class="access-key__ring"></span>
        <span class="access-key__shaft"></span>
        <span class="access-key__teeth">${teeth}</span>
        <span class="access-key__runes">${runes}</span>
        <div class="access-key__qr-quiet-zone">
          <canvas class="access-key__qr" data-access-key-qr aria-label="城塞記録網へ接続するQRコード"></canvas>
        </div>
      </div>
      <footer class="access-key__footer">
        <span>入域鍵</span>
        <strong>${escapeHtml(accessKey.inviteToken)}</strong>
        <small>${escapeHtml(accessKey.templateId.replace('-', ' / '))}</small>
      </footer>
    </article>
  `;
}

async function waitForQrCodeGenerator() {
  if (typeof globalThis.qrcode === 'function') return globalThis.qrcode;
  if (!globalThis.document) {
    throw new Error('Load qrcode-generator before rendering an access key.');
  }

  const script = globalThis.document.querySelector('[data-qrcode-generator]');
  if (!script) {
    throw new Error('The qrcode-generator script tag is missing.');
  }

  await new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error('Timed out while loading qrcode-generator.'));
    }, 6000);
    script.addEventListener('load', () => {
      globalThis.clearTimeout(timeout);
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      globalThis.clearTimeout(timeout);
      reject(new Error('Could not load qrcode-generator.'));
    }, { once: true });
  });

  if (typeof globalThis.qrcode !== 'function') {
    throw new Error('qrcode-generator did not expose a browser encoder.');
  }
  return globalThis.qrcode;
}

/**
 * Renders a high-error-correction QR into an access-key shell.
 * The caller must load the `qrcode-generator` browser build as globalThis.qrcode.
 */
export async function renderAccessKeyQr(canvas, inviteUrl, accessKey) {
  if (!canvas || canvas.tagName !== 'CANVAS') {
    throw new TypeError('A QR canvas element is required.');
  }
  const createQr = await waitForQrCodeGenerator();
  const qr = createQr(0, 'H');
  qr.addData(inviteUrl);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const moduleSize = 16;
  const pixelSize = moduleCount * moduleSize;
  const context = canvas.getContext('2d');
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  context.fillStyle = accessKey.palette.paper;
  context.fillRect(0, 0, pixelSize, pixelSize);
  context.fillStyle = accessKey.palette.ink;
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.isDark(row, column)) {
        context.fillRect(column * moduleSize, row * moduleSize, moduleSize, moduleSize);
      }
    }
  }
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `入域コード ${accessKey.inviteToken} のQRコード`);
}
