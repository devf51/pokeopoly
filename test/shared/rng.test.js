import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollD6, pick, shuffle } from '../../shared/rng.js';
import { die, fixedRng } from '../helpers.js';

test('rollD6 maps rng to 1..6', () => {
  assert.equal(rollD6(() => 0), 1);
  assert.equal(rollD6(() => 0.9999), 6);
  for (let n = 1; n <= 6; n++) assert.equal(rollD6(() => die(n)), n);
});

test('shuffle keeps all elements and does not mutate input', () => {
  const a = [1, 2, 3, 4];
  assert.deepEqual(shuffle(a, () => 0.3).sort(), [1, 2, 3, 4]);
  assert.deepEqual(a, [1, 2, 3, 4]);
});

test('pick chooses by rng and stays in range', () => {
  const a = ['a', 'b', 'c'];
  assert.equal(pick(a, () => 0), 'a');
  assert.equal(pick(a, () => 0.5), 'b');
  assert.equal(pick(a, () => 0.9999), 'c');
});

test('fixedRng yields values in order and throws when exhausted', () => {
  const r = fixedRng([0.1, 0.2]);
  assert.equal(r(), 0.1);
  assert.equal(r(), 0.2);
  assert.throws(() => r(), /rng exhausted/);
});

test('die(n) is (n - 0.5) / 6', () => {
  assert.equal(die(1), 0.5 / 6);
  assert.equal(die(6), 5.5 / 6);
});
