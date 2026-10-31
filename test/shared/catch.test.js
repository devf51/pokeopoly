import test from 'node:test';
import assert from 'node:assert/strict';
import { catchTarget, catchTotal, isCaught } from '../../shared/catch.js';
import { CATCHER_BONUS } from '../../shared/constants.js';

test('catch targets and totals', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 'legendary'].map(catchTarget), [2, 3, 4, 5, 6, 7]);
  assert.equal(catchTotal(6, 'poke', 'catcher'), 7);
  assert.equal(catchTotal(5, 'ultra', 'ranger'), 7);
  assert.equal(catchTotal(5, 'great', 'catcher'), 5 + 1 + CATCHER_BONUS);
  assert.equal(isCaught(6, 'legendary'), false);
  assert.equal(isCaught(7, 'legendary'), true);
  assert.equal(isCaught(1, 1), false);
  assert.equal(isCaught(2, 1), true);
});
