import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCESS_KEY_STYLE_VERSION,
  ACCESS_KEY_TEMPLATE_IDS,
  buildInviteUrl,
  deriveAccessKey,
  renderAccessKeyQr,
} from '../live_access_key.mjs';

test('same Firebase invite token always restores the same access-key design', () => {
  const first = deriveAccessKey('K7M2Q9', ACCESS_KEY_STYLE_VERSION);
  const second = deriveAccessKey('K7M2Q9', ACCESS_KEY_STYLE_VERSION);

  assert.deepEqual(second, first);
  assert.ok(ACCESS_KEY_TEMPLATE_IDS.includes(first.templateId));
  assert.equal(first.styleVersion, ACCESS_KEY_STYLE_VERSION);
  assert.equal(first.inviteToken, 'K7M2Q9');
  assert.equal(first.teeth.length, 5);
});

test('different Firebase invite tokens produce distinct serialized access keys', () => {
  const first = deriveAccessKey('K7M2Q9', ACCESS_KEY_STYLE_VERSION);
  const second = deriveAccessKey('R4X8DV', ACCESS_KEY_STYLE_VERSION);

  assert.notEqual(first.serial, second.serial);
  assert.notDeepEqual(first, second);
});

test('the template archive has a deterministic reachable token for every safe silhouette', () => {
  const fixtures = {
    'forge-key': 'AAAAAB',
    'keyhole-relay': 'AAAAAE',
    'lunar-seal': 'AAAAAA',
    'wolf-ward': 'AAAAAG',
    'archive-tablet': 'AAAAAC',
  };

  for (const [templateId, inviteToken] of Object.entries(fixtures)) {
    assert.equal(deriveAccessKey(inviteToken).templateId, templateId);
  }
});

test('invite URL carries only the short opaque pairing token', () => {
  const url = buildInviteUrl('https://werewolf-gilt.vercel.app', 'K7M2Q9');

  assert.equal(url, 'https://werewolf-gilt.vercel.app/i/K7M2Q9');
});

test('invalid invite tokens are rejected before a QR is rendered', () => {
  assert.throws(() => deriveAccessKey('wolf/secret', ACCESS_KEY_STYLE_VERSION));
  assert.throws(() => buildInviteUrl('https://werewolf-gilt.vercel.app', 'x'));
});

test('access-key QR renderer uses the browser qrcode-generator at high error correction', async () => {
  const fills = [];
  const calls = [];
  const previousGenerator = globalThis.qrcode;
  globalThis.qrcode = (typeNumber, errorCorrectionLevel) => {
    calls.push({ typeNumber, errorCorrectionLevel });
    return {
      addData: (payload) => calls.push({ payload }),
      make: () => calls.push({ made: true }),
      getModuleCount: () => 2,
      isDark: (row, column) => row === column,
    };
  };

  const canvas = {
    tagName: 'CANVAS',
    setAttribute: () => {},
    getContext: () => ({
      set fillStyle(value) { fills.push(value); },
      fillRect: (...args) => fills.push(args),
    }),
  };

  try {
    await renderAccessKeyQr(canvas, 'https://werewolf-gilt.vercel.app/i/K7M2Q9', deriveAccessKey('K7M2Q9'));
    assert.deepEqual(calls[0], { typeNumber: 0, errorCorrectionLevel: 'H' });
    assert.equal(calls[1].payload, 'https://werewolf-gilt.vercel.app/i/K7M2Q9');
    assert.ok(fills.length >= 5);
  } finally {
    globalThis.qrcode = previousGenerator;
  }
});
