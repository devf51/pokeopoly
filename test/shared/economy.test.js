import test from 'node:test';
import assert from 'node:assert/strict';
import { ballPrice, salaryFor, monValue, healCost, finalTotals } from '../../shared/economy.js';

const mon = (zone, extra = {}) => ({ uid: 1, dexId: 1, zone, starter: false, fainted: false, ...extra });

test('prices and salary', () => {
  assert.deepEqual(['poke', 'great', 'ultra'].map(b => ballPrice(b, 'merchant')), [35, 84, 175]);
  assert.equal(ballPrice('great', 'catcher'), 120);
  assert.equal(salaryFor('merchant'), 300);
  assert.equal(salaryFor('professor'), 200);
});

test('values and heal cost', () => {
  assert.equal(monValue(mon(3)), 200);
  assert.equal(monValue(mon('legendary')), 2000);
  assert.equal(monValue(mon(null, { starter: true })), 0);
  assert.equal(healCost(mon(3)), 40);
  assert.equal(healCost(mon('legendary')), 400);
  assert.equal(healCost(mon(null, { starter: true })), 0);
});

test('final totals skip fainted and starter', () => {
  const p = { money: 300, mons: [mon(null, { starter: true }), mon(5), mon(4, { fainted: true })] };
  assert.deepEqual(finalTotals(p), { money: 300, monValue: 800, total: 1100 });
});
