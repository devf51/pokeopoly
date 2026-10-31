import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, fixedRng } from '../helpers.js';
import { spawnFor } from '../../shared/engine/spawn.js';
import { LEGENDARY_IDS } from '../../shared/constants.js';

function clearBoard(state) {
  for (const t of state.board) t.dexId = null;
}

test('zone pools are respected', () => {
  const { state, ctx } = newGame();
  ctx.rng = fixedRng([0.3]);
  const id = spawnFor(2, state, ctx);
  assert.ok(ctx.pools[2].includes(id));
});

test('zones below 5 never roll for legendary', () => {
  const { state, ctx } = newGame();
  clearBoard(state);
  ctx.rng = fixedRng([0.0]); // ถ้าทอยตัวตำนานจะ throw เพราะ rng หมด
  const id = spawnFor(1, state, ctx);
  assert.ok(ctx.pools[1].includes(id));
});

test('zone 5 may spawn a legendary at 5% chance', () => {
  const { state, ctx } = newGame();
  clearBoard(state);
  ctx.rng = fixedRng([0.01, 0]);
  assert.equal(spawnFor(5, state, ctx), LEGENDARY_IDS[0]);
  ctx.rng = fixedRng([0.5, 0]);
  assert.ok(ctx.pools[5].includes(spawnFor(5, state, ctx)));
});

test('legendaries are unique per game', () => {
  const { state, ctx } = newGame();
  clearBoard(state);
  state.caughtLegendaries = [144, 145, 146, 150];
  state.board.find(t => t.type === 'wild').dexId = 151;
  ctx.rng = fixedRng([0.01, 0]);
  assert.ok(ctx.pools[5].includes(spawnFor(5, state, ctx)));
});

test('a legendary already on the board is skipped but others remain', () => {
  const { state, ctx } = newGame();
  clearBoard(state);
  state.board.find(t => t.type === 'wild').dexId = LEGENDARY_IDS[0];
  ctx.rng = fixedRng([0.01, 0]);
  assert.equal(spawnFor(5, state, ctx), LEGENDARY_IDS[1]);
});
