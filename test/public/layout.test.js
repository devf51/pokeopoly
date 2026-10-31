import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellFor } from '../../public/js/ui/layout.js';

test('cellFor walks the 9x9 perimeter once', () => {
  assert.deepEqual(cellFor(0), { row: 8, col: 8 });
  assert.deepEqual(cellFor(8), { row: 8, col: 0 });
  assert.deepEqual(cellFor(16), { row: 0, col: 0 });
  assert.deepEqual(cellFor(24), { row: 0, col: 8 });
  assert.deepEqual(cellFor(31), { row: 7, col: 8 });
  const keys = new Set(Array.from({ length: 32 }, (_, i) => JSON.stringify(cellFor(i))));
  assert.equal(keys.size, 32);
});

test('cellFor keeps every step adjacent to the previous one and stays on the edge', () => {
  for (let i = 0; i < 32; i++) {
    const { row, col } = cellFor(i);
    assert.ok(row === 0 || row === 8 || col === 0 || col === 8, `cell ${i} is on the perimeter`);
    const next = cellFor((i + 1) % 32);
    assert.equal(Math.abs(next.row - row) + Math.abs(next.col - col), 1, `cell ${i} -> ${(i + 1) % 32}`);
  }
});
