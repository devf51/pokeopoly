import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard } from '../../shared/board.js';

test('board has 32 tiles with the right type counts', () => {
  const b = buildBoard();
  const count = t => b.filter(x => x.type === t).length;
  assert.equal(b.length, 32);
  assert.equal(b[0].type, 'start');
  assert.deepEqual([count('start'), count('mart'), count('center'), count('wild')], [1, 2, 2, 27]);
  assert.deepEqual([b[4].type, b[20].type, b[11].type, b[26].type], ['mart', 'mart', 'center', 'center']);
});

test('wild zones never decrease along the path and have sizes 6/6/5/5/5', () => {
  const zones = buildBoard().filter(t => t.type === 'wild').map(t => t.zone);
  assert.deepEqual(zones, [...zones].sort((a, b) => a - b));
  assert.deepEqual([1, 2, 3, 4, 5].map(z => zones.filter(x => x === z).length), [6, 6, 5, 5, 5]);
});

test('tiles carry index, null zone for non-wild, and null dexId everywhere', () => {
  const b = buildBoard();
  b.forEach((t, i) => {
    assert.equal(t.index, i);
    assert.equal(t.dexId, null);
    if (t.type !== 'wild') assert.equal(t.zone, null);
  });
});

test('buildBoard returns a fresh board each call', () => {
  const a = buildBoard();
  a[1].dexId = 25;
  assert.equal(buildBoard()[1].dexId, null);
});
