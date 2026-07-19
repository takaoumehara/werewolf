import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPositionMap,
  resetPosition,
  serializePositions,
  updatePosition
} from '../card_position_editor.mjs';

test('creates independent baseline transforms for every role', () => {
  const positions = createPositionMap(['knights', 'werewolf']);

  assert.deepEqual(positions, {
    knights: { scale: 1, x: 0, y: 0 },
    werewolf: { scale: 1, x: 0, y: 0 }
  });
  assert.notEqual(positions.knights, positions.werewolf);
});

test('normalizes transform values and does not mutate the input map', () => {
  const initial = createPositionMap(['knights']);
  const updated = updatePosition(initial, 'knights', {
    scale: 3,
    x: -120.555,
    y: 4.444
  });

  assert.deepEqual(initial.knights, { scale: 1, x: 0, y: 0 });
  assert.deepEqual(updated.knights, { scale: 2.5, x: -100, y: 4.44 });
});

test('resets one role and serializes roles in gallery order', () => {
  const moved = updatePosition(
    createPositionMap(['b', 'a']),
    'b',
    { scale: 1.08, x: -3, y: 2 }
  );

  assert.deepEqual(resetPosition(moved, 'b').b, { scale: 1, x: 0, y: 0 });
  assert.equal(serializePositions(moved, ['b', 'a']), `{
  "b": { "scale": 1.08, "x": -3, "y": 2 },
  "a": { "scale": 1, "x": 0, "y": 0 }
}`);
});

test('rejects updates for unknown roles', () => {
  assert.throws(
    () => updatePosition(createPositionMap(['knights']), 'werewolf', { x: 1 }),
    /Unknown role: werewolf/
  );
});
