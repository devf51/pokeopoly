import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTypeAdvantage, resolveBattle, battlePenalty } from '../../shared/battle.js';
import { SUPER_EFFECTIVE } from '../../shared/types.js';
import { TYPE_ADVANTAGE_BONUS } from '../../shared/constants.js';

test('type advantage', () => {
  assert.equal(hasTypeAdvantage(['fire'], ['grass']), true);
  assert.equal(hasTypeAdvantage(['grass'], ['fire']), false);
  assert.equal(hasTypeAdvantage(['water', 'ground'], ['fire', 'flying']), true);
  assert.equal(hasTypeAdvantage(['normal'], ['ghost']), false);
  // ได้เปรียบทั้งสองฝ่าย
  assert.equal(hasTypeAdvantage(['fire', 'ground'], ['water', 'rock']), true);
  assert.equal(hasTypeAdvantage(['water', 'rock'], ['fire', 'ground']), true);
});

const base = { attackerTypes: ['normal'], defenderTypes: ['normal'], attackerCharmander: false, defenderCharmander: false };

test('higher total wins, equal is draw, advantage adds 1 once', () => {
  assert.equal(resolveBattle({ ...base, attackerRoll: 5, defenderRoll: 3 }).winner, 'attacker');
  assert.equal(resolveBattle({ ...base, attackerRoll: 2, defenderRoll: 2 }).winner, 'draw');
  const r = resolveBattle({ ...base, attackerTypes: ['fire', 'ice'], defenderTypes: ['grass', 'flying'], attackerRoll: 3, defenderRoll: 4 });
  assert.deepEqual([r.attackerTotal, r.defenderTotal, r.winner], [4, 4, 'draw']);
});

test('advantage bonus comes from constants and can apply to both sides', () => {
  assert.equal(TYPE_ADVANTAGE_BONUS, 1);
  const r = resolveBattle({ ...base, attackerTypes: ['fire'], defenderTypes: ['water', 'grass'], attackerRoll: 2, defenderRoll: 2 });
  assert.deepEqual([r.attackerTotal, r.defenderTotal], [3, 3]);
  const one = resolveBattle({ ...base, attackerTypes: ['water'], defenderTypes: ['normal'], attackerRoll: 2, defenderRoll: 2 });
  assert.deepEqual([one.attackerTotal, one.defenderTotal, one.winner], [2, 2, 'draw']);
  const def = resolveBattle({ ...base, attackerTypes: ['normal'], defenderTypes: ['fighting'], attackerRoll: 3, defenderRoll: 3 });
  assert.deepEqual([def.attackerTotal, def.defenderTotal, def.winner], [3, 4, 'defender']);
});

test('charmander wins outright unless both use it', () => {
  assert.equal(resolveBattle({ ...base, attackerRoll: 1, defenderRoll: 6, attackerCharmander: true }).winner, 'attacker');
  assert.equal(resolveBattle({ ...base, attackerRoll: 1, defenderRoll: 6, attackerCharmander: true, defenderCharmander: true }).winner, 'defender');
  const c = resolveBattle({ ...base, attackerRoll: 1, defenderRoll: 6, defenderCharmander: true });
  assert.deepEqual([c.winner, c.attackerTotal, c.defenderTotal], ['defender', null, null]);
});

test('penalty is floor 10% and never negative', () => {
  assert.equal(battlePenalty(155), 15);
  assert.equal(battlePenalty(0), 0);
  assert.equal(battlePenalty(9), 0);
});

test('type chart only references known types', () => {
  const known = new Set(Object.keys(SUPER_EFFECTIVE));
  for (const list of Object.values(SUPER_EFFECTIVE)) for (const t of list) assert.ok(known.has(t), t);
});
