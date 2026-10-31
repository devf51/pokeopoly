import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, die } from '../helpers.js';
import { LEGENDARY_IDS, STARTING_MONEY } from '../../shared/constants.js';

const P = (id, cls, starter) => ({ id, name: id, cls, starter });
const two = (cls1, starter1, cls2 = 'merchant', starter2 = 'charmander') => ({
  players: [P('p1', cls1, starter1), P('p2', cls2, starter2)],
});

// ไม่ใช้เลขกติกา: หาช่อง wild แรกของโซนจากกระดานเอง
function atWild(zone, dexId, opts) {
  const game = newGame(opts);
  const { state, ctx } = game;
  const tile = state.board.find(t => t.type === 'wild' && t.zone === zone);
  state.players[0].position = tile.index - 1;
  if (dexId !== undefined) tile.dexId = dexId;
  let s = state;
  ({ state: s } = act(s, ctx, 'p1', { type: 'ROLL' }, [die(1)]));
  ({ state: s } = act(s, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(s.turn.step, 'catch');
  assert.equal(s.players[0].position, tile.index);
  return { state: s, ctx, tile };
}

// ช่อง mart / center / start: วางผู้เล่นแล้วเดินเข้าไปด้วย ROLL + CONFIRM_MOVE
function atTile(type, who = 'p1', opts) {
  const game = newGame(opts);
  const { state, ctx } = game;
  const tile = state.board.find(t => t.type === type);
  const idx = state.players.findIndex(p => p.id === who);
  state.turn.playerId = who;
  state.turnIndex = state.order.indexOf(who);
  state.players[idx].position = (tile.index + state.board.length - 1) % state.board.length;
  let s = state;
  ({ state: s } = act(s, ctx, who, { type: 'ROLL' }, [die(1)]));
  ({ state: s } = act(s, ctx, who, { type: 'CONFIRM_MOVE' }));
  return { state: s, ctx, tile };
}

const mon = (uid, dexId, zone, extra = {}) => ({ uid, dexId, zone, starter: false, fainted: false, ...extra });

// ---------------- catch ----------------

test('successful throw adds the mon, uses a ball and respawns the tile', () => {
  const { state: s0, ctx, tile } = atWild(2, undefined, two('ranger', 'bulbasaur'));
  const dex = ctx.pools[2][5];
  s0.board[tile.index].dexId = dex;
  const before = structuredClone(s0);
  const { state, events } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(3), 0]);
  const p = state.players[0];
  assert.equal(p.mons.length, 2);
  assert.deepEqual(p.mons[1], { uid: 3, dexId: dex, zone: 2, starter: false, fainted: false });
  assert.equal(state.nextUid, 4);
  assert.equal(p.balls.poke, 4);
  assert.equal(state.board[tile.index].dexId, ctx.pools[2][0]);
  assert.notEqual(state.board[tile.index].dexId, dex);
  assert.deepEqual(events.find(e => e.type === 'caught'), {
    type: 'caught', playerId: 'p1', dexId: dex, roll: 3, total: 3, target: 3,
  });
  assert.ok(!events.some(e => e.type === 'fled'));
  assert.equal(state.turn.playerId, 'p2');
  assert.equal(state.turn.step, 'roll');
  assert.deepEqual(s0, before);
});

test('failed throw without reroll ability flees', () => {
  const { state: s0, ctx, tile } = atWild(2, undefined, two('ranger', 'bulbasaur'));
  const dex = s0.board[tile.index].dexId;
  const { state, events } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(2), 0]);
  const p = state.players[0];
  assert.equal(p.mons.length, 1);
  assert.equal(p.balls.poke, 4);
  assert.deepEqual(events.find(e => e.type === 'fled'), {
    type: 'fled', playerId: 'p1', dexId: dex, roll: 2, total: 2, target: 3,
  });
  assert.ok(!events.some(e => e.type === 'caught'));
  assert.equal(state.board[tile.index].dexId, ctx.pools[2][0]);
  assert.equal(state.turn.playerId, 'p2');
});

test('throw without that ball is rejected', () => {
  const { state, ctx } = atWild(2);
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'THROW', ball: 'ultra' }, [die(6)]), { code: 'NO_BALL' });
  assert.deepEqual(state, before);
  state.players[0].balls.poke = 0;
  const before2 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(6)]), { code: 'NO_BALL' });
  assert.deepEqual(state, before2);
});

test('throw with an unknown ball is rejected', () => {
  const { state, ctx } = atWild(2);
  const before = structuredClone(state);
  for (const ball of ['master', undefined, 'toString', '__proto__']) {
    assert.throws(() => act(state, ctx, 'p1', { type: 'THROW', ball }, [die(6)]), { code: 'INVALID_ACTION' });
  }
  assert.deepEqual(state, before);
});

test('catcher gets +1', () => {
  const { state: s0, ctx } = atWild(2); // p1 เป็น catcher
  const { state, events } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(2), 0]);
  assert.equal(state.players[0].mons.length, 2);
  assert.equal(events.find(e => e.type === 'caught').total, 3);
});

test('better balls add their bonus', () => {
  const { state: s0, ctx } = atWild(2, undefined, two('ranger', 'bulbasaur'));
  s0.players[0].balls.great = 1;
  const { state } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'great' }, [die(2), 0]);
  assert.equal(state.players[0].mons.length, 2);
  assert.deepEqual([state.players[0].balls.great, state.players[0].balls.poke], [0, 5]);
});

test('legendary needs 7', () => {
  const legend = LEGENDARY_IDS[0];
  const { state: s0, ctx, tile } = atWild(5, legend, two('ranger', 'bulbasaur'));
  const { state: fled, events: e1 } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(6), 0.5, 0]);
  assert.ok(e1.some(e => e.type === 'fled' && e.target === 7 && e.dexId === legend));
  assert.equal(fled.players[0].mons.length, 1);
  assert.deepEqual(fled.caughtLegendaries, []);
  assert.equal(fled.board[tile.index].dexId, ctx.pools[5][0]);

  s0.players[0].balls.great = 1;
  const { state: caught, events: e2 } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'great' }, [die(6), 0.5, 0]);
  assert.ok(e2.some(e => e.type === 'caught' && e.total === 7 && e.target === 7));
  assert.deepEqual(caught.caughtLegendaries, [legend]);
  assert.deepEqual(caught.players[0].mons[1], { uid: 3, dexId: legend, zone: 'legendary', starter: false, fainted: false });
  assert.equal(caught.players[0].balls.great, 0);
  // ตัวตำนานที่ถูกจับแล้วต้องไม่ออกซ้ำแม้ rng ต่ำสุด
  assert.notEqual(caught.board[tile.index].dexId, legend);
});

test('bulbasaur guarantees a non-legendary catch once', () => {
  const { state: s0, ctx, tile } = atWild(2);
  const dex = s0.board[tile.index].dexId;
  const { state, events } = act(s0, ctx, 'p1', { type: 'BULBASAUR_CATCH' }, [0]);
  const p = state.players[0];
  assert.equal(p.balls.poke, 5);
  assert.equal(p.starterUsed, true);
  assert.deepEqual(p.mons[1], { uid: 3, dexId: dex, zone: 2, starter: false, fainted: false });
  assert.ok(events.some(e => e.type === 'ability' && e.name === 'bulbasaur'));
  assert.ok(events.some(e => e.type === 'caught' && e.dexId === dex && e.target === 3));
  assert.equal(state.turn.playerId, 'p2');

  // ใช้ได้ครั้งเดียว
  const again = structuredClone(s0);
  again.players[0].starterUsed = true;
  assert.throws(() => act(again, ctx, 'p1', { type: 'BULBASAUR_CATCH' }, [0]), { code: 'NO_USES' });
});

test('bulbasaur cannot catch a legendary and nothing changes', () => {
  const { state, ctx } = atWild(5, LEGENDARY_IDS[1]);
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'BULBASAUR_CATCH' }, [0]), { code: 'LEGENDARY' });
  assert.deepEqual(state, before);
  assert.equal(state.players[0].starterUsed, false);
});

test('bulbasaur ability is rejected for other starters', () => {
  const { state, ctx } = atWild(2, undefined, two('catcher', 'pikachu'));
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'BULBASAUR_CATCH' }, [0]), { code: 'NO_USES' });
  assert.deepEqual(state, before);
});

test('skipping a wild tile ends the turn without changes', () => {
  const { state: s0, ctx, tile } = atWild(2);
  const dex = s0.board[tile.index].dexId;
  const { state } = act(s0, ctx, 'p1', { type: 'SKIP' });
  assert.equal(state.board[tile.index].dexId, dex);
  assert.equal(state.players[0].balls.poke, 5);
  assert.equal(state.turn.playerId, 'p2');
});

test('professor reroll keeps the same ball and costs a use', () => {
  const { state: s0, ctx, tile } = atWild(5, undefined, two('professor', 'charmander'));
  const dex = s0.board[tile.index].dexId;
  const { state: s1, events: e1 } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1)]);
  assert.equal(s1.turn.step, 'catch-failed');
  assert.equal(s1.turn.ball, 'poke');
  assert.equal(s1.turn.playerId, 'p1');
  assert.equal(s1.players[0].balls.poke, 4);
  assert.equal(s1.board[tile.index].dexId, dex);
  assert.ok(!e1.some(e => e.type === 'fled' || e.type === 'caught'));
  assert.ok(e1.some(e => e.type === 'rolled' && e.value === 1 && e.source === 'catch'));

  const { state: s2, events: e2 } = act(s1, ctx, 'p1', { type: 'PROFESSOR_REROLL' }, [die(6), 0.5, 0]);
  const p = s2.players[0];
  assert.equal(p.mons.length, 2);
  assert.equal(p.mons[1].dexId, dex);
  assert.equal(p.balls.poke, 4);
  assert.equal(p.classUses, 1);
  assert.ok(e2.some(e => e.type === 'caught' && e.roll === 6));
  assert.equal(s2.turn.playerId, 'p2');
  assert.equal(s2.turn.ball, null);
});

test('professor can reroll again until uses run out, then the mon flees', () => {
  const { state: s0, ctx, tile } = atWild(5, undefined, two('professor', 'charmander'));
  const dex = s0.board[tile.index].dexId;
  let { state } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1)]);
  ({ state } = act(state, ctx, 'p1', { type: 'PROFESSOR_REROLL' }, [die(1)]));
  assert.equal(state.turn.step, 'catch-failed');
  assert.equal(state.players[0].classUses, 1);
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'PROFESSOR_REROLL' }, [die(2), 0.5, 0]));
  assert.equal(state.players[0].classUses, 0);
  assert.equal(state.players[0].mons.length, 1);
  assert.ok(events.some(e => e.type === 'fled' && e.dexId === dex && e.roll === 2));
  assert.equal(state.turn.playerId, 'p2');
  assert.equal(state.players[0].balls.poke, 4);
});

test('professor with no uses left flees at once on a miss', () => {
  const { state: s0, ctx } = atWild(5, undefined, two('professor', 'charmander'));
  s0.players[0].classUses = 0;
  const { state, events } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1), 0.5, 0]);
  assert.ok(events.some(e => e.type === 'fled'));
  assert.equal(state.turn.playerId, 'p2');
});

test('pikachu reroll after a miss uses the starter ability and the same ball', () => {
  const { state: s0, ctx } = atWild(2, undefined, two('ranger', 'pikachu'));
  s0.players[0].balls.great = 1;
  let { state } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'great' }, [die(1)]);
  assert.equal(state.turn.step, 'catch-failed');
  assert.equal(state.turn.ball, 'great');
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'PIKACHU_REROLL' }, [die(5), 0]));
  const p = state.players[0];
  assert.equal(p.starterUsed, true);
  assert.equal(p.balls.great, 0);
  assert.equal(p.mons.length, 2);
  assert.ok(events.some(e => e.type === 'ability' && e.name === 'pikachu'));
});

test('rerolls in catch-failed are rejected without the ability and leave state alone', () => {
  const { state: s0, ctx } = atWild(5, undefined, two('professor', 'pikachu'));
  let { state } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1)]);
  state.players[0].classUses = 0; // ยังมีสิทธิ์จาก Pikachu
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'PROFESSOR_REROLL' }, [die(6)]), { code: 'NO_USES' });
  assert.deepEqual(state, before);

  state.players[0].classUses = 2;
  state.players[0].starterUsed = true;
  const before2 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'PIKACHU_REROLL' }, [die(6)]), { code: 'NO_USES' });
  assert.deepEqual(state, before2);

  const { state: other, ctx: ctx2 } = atWild(5, undefined, two('catcher', 'bulbasaur'));
  other.turn.step = 'catch-failed';
  other.turn.ball = 'poke';
  assert.throws(() => act(other, ctx2, 'p1', { type: 'PROFESSOR_REROLL' }, [die(6)]), { code: 'NO_USES' });
});

test('accepting a failed catch flees', () => {
  const { state: s0, ctx, tile } = atWild(5, undefined, two('professor', 'charmander'));
  const dex = s0.board[tile.index].dexId;
  let { state } = act(s0, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1)]);
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'ACCEPT' }, [0.5, 0]));
  assert.deepEqual(events.find(e => e.type === 'fled'), {
    type: 'fled', playerId: 'p1', dexId: dex, roll: 1, total: 1, target: 6,
  });
  const p = state.players[0];
  assert.deepEqual([p.mons.length, p.classUses, p.balls.poke], [1, 2, 4]);
  assert.equal(state.board[tile.index].dexId, ctx.pools[5][0]);
  assert.equal(state.turn.playerId, 'p2');
  assert.equal(state.turn.step, 'roll');
});

test('catch step rejects actions of other steps', () => {
  const { state, ctx } = atWild(2);
  for (const type of ['ACCEPT', 'PROFESSOR_REROLL', 'BUY', 'HEAL', 'DONE']) {
    assert.throws(() => act(state, ctx, 'p1', { type }), { code: 'INVALID_ACTION' });
  }
  assert.throws(() => act(state, ctx, 'p2', { type: 'SKIP' }), { code: 'NOT_YOUR_TURN' });
});

// ---------------- shop ----------------

test('buy respects merchant price and money', () => {
  const { state: s0, ctx } = atTile('mart', 'p2');
  assert.equal(s0.turn.step, 'shop');
  const before = structuredClone(s0);
  const { state, events } = act(s0, ctx, 'p2', { type: 'BUY', ball: 'great', qty: 2 });
  const p2 = state.players[1];
  assert.equal(p2.money, STARTING_MONEY - 168);
  assert.equal(p2.balls.great, 2);
  assert.equal(state.turn.step, 'shop');
  assert.equal(state.turn.playerId, 'p2');
  assert.deepEqual(events, [{ type: 'bought', playerId: 'p2', ball: 'great', qty: 2, cost: 168 }]);
  assert.deepEqual(s0, before);

  const before2 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p2', { type: 'BUY', ball: 'ultra', qty: 3 }), { code: 'NOT_ENOUGH_MONEY' });
  assert.deepEqual(state, before2);
});

test('non-merchants pay full price and can spend exactly all their money', () => {
  const { state: s0, ctx } = atTile('mart', 'p1');
  s0.players[0].money = 250;
  const { state } = act(s0, ctx, 'p1', { type: 'BUY', ball: 'ultra', qty: 1 });
  assert.deepEqual([state.players[0].money, state.players[0].balls.ultra], [0, 1]);
  assert.throws(() => act(state, ctx, 'p1', { type: 'BUY', ball: 'poke', qty: 1 }), { code: 'NOT_ENOUGH_MONEY' });
});

test('buy rejects bad quantities and unknown balls without changing state', () => {
  const { state, ctx } = atTile('mart', 'p1');
  const before = structuredClone(state);
  for (const qty of [0, -1, 1.5, '2', NaN, Infinity, null, undefined]) {
    assert.throws(() => act(state, ctx, 'p1', { type: 'BUY', ball: 'poke', qty }), { code: 'INVALID_ACTION' }, `qty ${qty}`);
  }
  for (const ball of ['master', undefined, 'toString']) {
    assert.throws(() => act(state, ctx, 'p1', { type: 'BUY', ball, qty: 1 }), { code: 'INVALID_ACTION' });
  }
  assert.deepEqual(state, before);
});

test('shop DONE ends the turn', () => {
  const { state: s0, ctx } = atTile('mart', 'p1');
  const { state } = act(s0, ctx, 'p1', { type: 'DONE' });
  assert.equal(state.turn.playerId, 'p2');
});

test('sell only at start and only healthy non-starter mons', () => {
  const { state: s0, ctx } = atTile('start', 'p1');
  assert.equal(s0.turn.step, 'shop');
  const p = s0.players[0];
  p.mons.push(mon(10, 50, 3), mon(11, 51, 3, { fainted: true }));
  p.mons[0].fainted = true; // ตัวเริ่มต้นหมดสภาพ ก็ยังขายไม่ได้
  const before = structuredClone(s0);

  const { state, events } = act(s0, ctx, 'p1', { type: 'SELL', uid: 10 });
  assert.equal(state.players[0].money, p.money + 200);
  assert.ok(!state.players[0].mons.some(m => m.uid === 10));
  assert.equal(state.players[0].mons.length, 2);
  assert.equal(state.turn.step, 'shop');
  assert.deepEqual(events, [{ type: 'sold', playerId: 'p1', dexId: 50, amount: 200 }]);
  assert.deepEqual(s0, before);

  for (const uid of [p.mons[0].uid, 11, 999, undefined, '10']) {
    assert.throws(() => act(state, ctx, 'p1', { type: 'SELL', uid }), { code: 'BAD_TARGET' }, `uid ${uid}`);
  }
  const before2 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'SELL', uid: 10 }), { code: 'BAD_TARGET' });
  assert.deepEqual(state, before2);

  // ขายตัวเริ่มต้นที่ยังสู้ได้ก็ไม่ได้
  state.players[0].mons[0].fainted = false;
  assert.throws(() => act(state, ctx, 'p1', { type: 'SELL', uid: state.players[0].mons[0].uid }), { code: 'BAD_TARGET' });
});

test('selling a legendary pays its value and keeps it counted as caught', () => {
  const { state: s0, ctx } = atTile('start', 'p1');
  const legend = LEGENDARY_IDS[0];
  s0.players[0].mons.push(mon(10, legend, 'legendary'));
  s0.caughtLegendaries.push(legend);
  const { state } = act(s0, ctx, 'p1', { type: 'SELL', uid: 10 });
  assert.equal(state.players[0].money, s0.players[0].money + 2000);
  assert.deepEqual(state.caughtLegendaries, [legend]);
});

test('selling is rejected at a mart', () => {
  const { state, ctx } = atTile('mart', 'p1');
  state.players[0].mons.push(mon(10, 50, 3));
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'SELL', uid: 10 }), { code: 'INVALID_ACTION' });
  assert.deepEqual(state, before);
});

// ---------------- center ----------------

test('heal fainted mons at the center', () => {
  const { state: s0, ctx } = atTile('center', 'p1');
  assert.equal(s0.turn.step, 'center');
  const p = s0.players[0];
  p.mons.push(mon(10, 50, 3, { fainted: true }), mon(11, 51, 3), mon(12, LEGENDARY_IDS[0], 'legendary', { fainted: true }));
  p.mons[0].fainted = true;
  const before = structuredClone(s0);

  let { state, events } = act(s0, ctx, 'p1', { type: 'HEAL', uid: 10 });
  assert.equal(state.players[0].money, STARTING_MONEY - 40);
  assert.equal(state.players[0].mons.find(m => m.uid === 10).fainted, false);
  assert.equal(state.turn.step, 'center');
  assert.deepEqual(events, [{ type: 'healed', playerId: 'p1', dexId: 50, cost: 40 }]);
  assert.deepEqual(s0, before);

  // ตัวเริ่มต้นฟรี
  ({ state, events } = act(state, ctx, 'p1', { type: 'HEAL', uid: p.mons[0].uid }));
  assert.equal(state.players[0].money, STARTING_MONEY - 40);
  assert.equal(state.players[0].mons[0].fainted, false);
  assert.equal(events[0].cost, 0);

  // ตัวที่ยังสู้ได้ / ไม่มีตัวนั้น
  const before2 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'HEAL', uid: 11 }), { code: 'BAD_TARGET' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'HEAL', uid: 10 }), { code: 'BAD_TARGET' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'HEAL', uid: 999 }), { code: 'BAD_TARGET' });
  assert.deepEqual(state, before2);

  // เงินไม่พอรักษาตัวตำนาน
  state.players[0].money = 10;
  const before3 = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'HEAL', uid: 12 }), { code: 'NOT_ENOUGH_MONEY' });
  assert.deepEqual(state, before3);
  assert.equal(state.players[0].money, 10);
});

test('heal can take the last coin and DONE ends the turn', () => {
  const { state: s0, ctx } = atTile('center', 'p1');
  s0.players[0].mons.push(mon(10, 50, 3, { fainted: true }));
  s0.players[0].money = 40;
  let { state } = act(s0, ctx, 'p1', { type: 'HEAL', uid: 10 });
  assert.equal(state.players[0].money, 0);
  ({ state } = act(state, ctx, 'p1', { type: 'DONE' }));
  assert.equal(state.turn.playerId, 'p2');
});
