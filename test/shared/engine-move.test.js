import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, die, pokedex } from '../helpers.js';
import { makeContext } from '../../shared/engine/context.js';
import { createGame } from '../../shared/engine/state.js';
import { GameError } from '../../shared/engine/errors.js';
import {
  BOARD_SIZE, STARTING_MONEY, STARTING_BALLS, STARTERS, LEGENDARY_IDS,
} from '../../shared/constants.js';

const P = (id, cls, starter) => ({ id, name: id, cls, starter });
const two = (cls1, starter1, cls2 = 'merchant', starter2 = 'charmander') => ({
  players: [P('p1', cls1, starter1), P('p2', cls2, starter2)],
});

test('createGame builds players, starter mons, shuffled order and a full board', () => {
  const ctx = makeContext(pokedex, () => 0);
  const players = [P('a', 'catcher', 'bulbasaur'), P('b', 'ranger', 'squirtle'), P('c', 'professor', 'pikachu')];
  const state = createGame(players, ctx);
  assert.equal(state.phase, 'playing');
  assert.deepEqual([...state.order].sort(), ['a', 'b', 'c']);
  assert.equal(state.turnIndex, 0);
  assert.deepEqual(state.turn, { playerId: state.order[0], step: 'roll', roll: null, ball: null, battle: null });
  assert.deepEqual(state.players.map(p => p.id), ['a', 'b', 'c']);
  const [a, b] = state.players;
  assert.equal(a.money, STARTING_MONEY);
  assert.deepEqual(a.balls, STARTING_BALLS);
  assert.notEqual(a.balls, STARTING_BALLS);
  assert.deepEqual([a.position, a.laps, a.finished, a.starterUsed], [0, 0, false, false]);
  assert.deepEqual(a.mons, [{ uid: 1, dexId: STARTERS.bulbasaur, zone: null, starter: true, fainted: false }]);
  assert.equal(b.mons[0].uid, 2);
  assert.equal(b.mons[0].dexId, STARTERS.squirtle);
  assert.equal(state.nextUid, 4);
  assert.deepEqual([state.caughtLegendaries, state.firstFinisherId, state.result], [[], null, null]);
  assert.equal(state.board.length, BOARD_SIZE);
  for (const t of state.board) {
    if (t.type === 'wild') assert.ok(Number.isInteger(t.dexId), `tile ${t.index} has a mon`);
    else assert.equal(t.dexId, null);
  }
});

test('createGame spawn respects zone pools and keeps legendaries unique', () => {
  // rng ต่ำสุดทุกครั้ง: ทุกการทอยโซน 5 ได้ตัวตำนานทันที แต่ต้องไม่ซ้ำ
  const ctx = makeContext(pokedex, () => 0);
  const state = createGame([P('a', 'catcher', 'bulbasaur'), P('b', 'catcher', 'bulbasaur')], ctx);
  const legendsOnBoard = state.board.map(t => t.dexId).filter(id => LEGENDARY_IDS.includes(id));
  assert.equal(new Set(legendsOnBoard).size, legendsOnBoard.length);
  assert.equal(legendsOnBoard.length, LEGENDARY_IDS.length);
  for (const t of state.board.filter(t => t.type === 'wild' && !LEGENDARY_IDS.includes(t.dexId))) {
    assert.ok(ctx.pools[t.zone].includes(t.dexId));
  }
});

test('ROLL then CONFIRM_MOVE moves and enters a wild tile', () => {
  let { state, ctx } = newGame();
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(3)]));
  assert.equal(state.turn.step, 'move');
  assert.equal(state.turn.roll, 3);
  assert.deepEqual(events, [{ type: 'rolled', playerId: 'p1', value: 3, source: 'roll' }]);
  ({ state, events } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(state.players[0].position, 3);
  assert.equal(state.turn.step, 'catch');
  assert.deepEqual(events, [{ type: 'moved', playerId: 'p1', from: 0, to: 3, steps: 3 }]);
});

test('passing start pays salary and counts a lap', () => {
  let { state, ctx } = newGame();
  state.players[0].position = 30;
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(4)]));
  const { state: s, events } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' });
  assert.deepEqual([s.players[0].position, s.players[0].laps, s.players[0].money], [2, 1, 700]);
  assert.ok(events.some(e => e.type === 'salary' && e.playerId === 'p1' && e.amount === 200));
  assert.equal(s.players[0].finished, false);
  assert.equal(s.turn.step, 'catch');
});

test('merchant salary is paid when passing start', () => {
  let { state, ctx } = newGame(two('catcher', 'bulbasaur', 'merchant', 'charmander'));
  state.turn.playerId = 'p2';
  state.players[1].position = 31;
  ({ state } = act(state, ctx, 'p2', { type: 'ROLL' }, [die(2)]));
  const { state: s, events } = act(state, ctx, 'p2', { type: 'CONFIRM_MOVE' });
  assert.equal(s.players[1].money, 800);
  assert.ok(events.some(e => e.type === 'salary' && e.amount === 300));
});

test('landing exactly on start opens the shop', () => {
  let { state, ctx } = newGame();
  state.players[0].position = 28;
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(4)]));
  const { state: s } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' });
  const p = s.players[0];
  assert.deepEqual([p.position, p.laps, p.money, p.finished], [0, 1, 700, false]);
  assert.equal(s.turn.step, 'shop');
});

test('walking onto a mart or center sets the matching step', () => {
  let { state, ctx } = newGame();
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(4)]));
  ({ state } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(state.players[0].position, 4);
  assert.equal(state.turn.step, 'shop');

  ({ state, ctx } = newGame());
  state.players[0].position = 8;
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(3)]));
  ({ state } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(state.players[0].position, 11);
  assert.equal(state.turn.step, 'center');
});

test('second lap stops at start, finishes, first finisher gets bonus once', () => {
  let { state, ctx } = newGame();
  Object.assign(state.players[0], { laps: 1, position: 30 });
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(6)]));
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  const p1 = state.players[0];
  assert.deepEqual([p1.position, p1.laps, p1.finished, p1.money], [0, 2, true, 1000]);
  assert.equal(state.turn.step, 'shop');
  assert.equal(state.firstFinisherId, 'p1');
  assert.ok(events.some(e => e.type === 'finished' && e.playerId === 'p1' && e.bonus === 300));
  assert.deepEqual(events.find(e => e.type === 'moved'), { type: 'moved', playerId: 'p1', from: 30, to: 0, steps: 2 });

  ({ state } = act(state, ctx, 'p1', { type: 'DONE' }));
  assert.equal(state.turn.playerId, 'p2');
  Object.assign(state.players[1], { laps: 1, position: 31 });
  ({ state } = act(state, ctx, 'p2', { type: 'ROLL' }, [die(5)]));
  ({ state, events } = act(state, ctx, 'p2', { type: 'CONFIRM_MOVE' }));
  const p2 = state.players[1];
  assert.deepEqual([p2.position, p2.laps, p2.finished, p2.money], [0, 2, true, 800]);
  assert.equal(state.firstFinisherId, 'p1');
  assert.ok(events.some(e => e.type === 'finished' && e.playerId === 'p2' && e.bonus === 0));
  assert.equal(state.turn.step, 'shop');
});

test('ranger adjust clamps to 1..7 and uses run out after two', () => {
  let { state, ctx } = newGame(two('ranger', 'bulbasaur'));
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(1)]));
  ({ state } = act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: -1 }));
  assert.deepEqual([state.turn.roll, state.players[0].classUses], [1, 1]);
  ({ state } = act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 1 }));
  assert.deepEqual([state.turn.roll, state.players[0].classUses], [2, 0]);
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 1 }), { code: 'NO_USES' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'RANGER_REROLL' }, [die(3)]), { code: 'NO_USES' });
  assert.deepEqual(state, before);
});

test('ranger adjust can reach 7 but not 8', () => {
  let { state, ctx } = newGame(two('ranger', 'bulbasaur'));
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(6)]));
  ({ state } = act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 1 }));
  assert.equal(state.turn.roll, 7);
  state.players[0].classUses = 1;
  ({ state } = act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 1 }));
  assert.equal(state.turn.roll, 7);
  const { state: s } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' });
  assert.equal(s.players[0].position, 7);
});

test('ranger reroll replaces the roll and shares the same quota', () => {
  let { state, ctx } = newGame(two('ranger', 'bulbasaur'));
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]));
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'RANGER_REROLL' }, [die(5)]));
  assert.deepEqual([state.turn.roll, state.players[0].classUses, state.turn.step], [5, 1, 'move']);
  assert.ok(events.some(e => e.type === 'rolled' && e.value === 5 && e.source === 'ranger'));
  assert.ok(events.some(e => e.type === 'ability' && e.playerId === 'p1'));
  ({ state } = act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: -1 }));
  assert.deepEqual([state.turn.roll, state.players[0].classUses], [4, 0]);
});

test('ranger abilities are rejected for other classes and bad deltas', () => {
  let { state, ctx } = newGame();
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]));
  assert.throws(() => act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 1 }), { code: 'NO_USES' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'RANGER_REROLL' }, [die(1)]), { code: 'NO_USES' });
  ({ state, ctx } = newGame(two('ranger', 'bulbasaur')));
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]));
  assert.throws(() => act(state, ctx, 'p1', { type: 'RANGER_ADJUST', delta: 2 }), { code: 'INVALID_ACTION' });
  assert.equal(state.turn.roll, 2);
});

test('pikachu reroll in move step uses the starter ability once', () => {
  let { state, ctx } = newGame(two('catcher', 'pikachu'));
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]));
  ({ state } = act(state, ctx, 'p1', { type: 'PIKACHU_REROLL' }, [die(6)]));
  assert.equal(state.turn.roll, 6);
  assert.equal(state.players[0].starterUsed, true);
  assert.equal(state.turn.step, 'move');
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'PIKACHU_REROLL' }, [die(1)]), { code: 'NO_USES' });
  assert.deepEqual(state, before);
});

test('pikachu reroll is rejected for other starters', () => {
  let { state, ctx } = newGame();
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]));
  assert.throws(() => act(state, ctx, 'p1', { type: 'PIKACHU_REROLL' }, [die(1)]), { code: 'NO_USES' });
});

test('squirtle warp replaces the roll', () => {
  let { state, ctx } = newGame(two('catcher', 'squirtle'));
  assert.throws(() => act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 7 }), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 0 }), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 2.5 }), { code: 'INVALID_ACTION' });
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 4 }));
  assert.equal(state.players[0].position, 4);
  assert.equal(state.players[0].starterUsed, true);
  assert.equal(state.turn.step, 'shop'); // tile 4 = Poké Mart
  assert.ok(events.some(e => e.type === 'moved' && e.to === 4 && e.steps === 4));
});

test('squirtle warp past start pays salary, and is rejected for others or when used', () => {
  let { state, ctx } = newGame(two('catcher', 'squirtle'));
  state.players[0].position = 30;
  ({ state } = act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 6 }));
  assert.deepEqual([state.players[0].position, state.players[0].laps, state.players[0].money], [4, 1, 700]);

  ({ state, ctx } = newGame(two('catcher', 'squirtle')));
  state.players[0].starterUsed = true;
  assert.throws(() => act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 3 }), { code: 'NO_USES' });
  ({ state, ctx } = newGame());
  assert.throws(() => act(state, ctx, 'p1', { type: 'SQUIRTLE_WARP', steps: 3 }), { code: 'NO_USES' });
});

test('wrong actor and wrong step are rejected without touching state', () => {
  const { state, ctx } = newGame();
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p2', { type: 'ROLL' }), { code: 'NOT_YOUR_TURN' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'NOPE' }), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'p1', null), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'ghost', { type: 'ROLL' }), { code: 'NOT_YOUR_TURN' });
  assert.deepEqual(state, before);
});

test('GameError carries a code and a Thai message', () => {
  const { state, ctx } = newGame();
  try {
    act(state, ctx, 'p2', { type: 'ROLL' });
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof GameError);
    assert.ok(e instanceof Error);
    assert.equal(e.code, 'NOT_YOUR_TURN');
    assert.match(e.message, /[฀-๿]/);
  }
});

test('applyAction does not mutate the passed-in state on success either', () => {
  const { state, ctx } = newGame();
  const before = structuredClone(state);
  const { state: next } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(2)]);
  assert.deepEqual(state, before);
  assert.notEqual(next, state);
});

test('turns skip finished players and game ends when all finish', () => {
  let { state, ctx } = newGame();
  Object.assign(state.players[1], { finished: true, laps: 2, position: 0 });
  state.turn.step = 'catch';
  let events;
  ({ state, events } = act(state, ctx, 'p1', { type: 'SKIP' }));
  assert.equal(state.turn.playerId, 'p1');
  assert.equal(state.turn.step, 'roll');
  assert.ok(events.some(e => e.type === 'turn' && e.playerId === 'p1'));
  assert.equal(state.phase, 'playing');

  // p2 มีโปเกม่อนโซน 3 (200) ส่วน p1 เข้าเส้นชัยเป็นคนแรกของฝั่งตัวเอง
  state.players[1].mons.push({ uid: 99, dexId: 10, zone: 3, starter: false, fainted: false });
  Object.assign(state.players[0], { laps: 1, position: 30 });
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(6)]));
  ({ state } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(state.players[0].finished, true);
  ({ state, events } = act(state, ctx, 'p1', { type: 'DONE' }));
  assert.equal(state.phase, 'ended');
  assert.equal(state.result.ranking.length, 2);
  assert.deepEqual(state.result.ranking[0], { playerId: 'p1', money: 1000, monValue: 0, total: 1000 });
  assert.deepEqual(state.result.ranking[1], { playerId: 'p2', money: 500, monValue: 200, total: 700 });
  assert.deepEqual(state.result.winnerIds, ['p1']);
  const over = events.find(e => e.type === 'gameOver');
  assert.ok(over);
  assert.deepEqual(over.result, state.result);

  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p1', { type: 'ROLL' }, [die(1)]), { code: 'INVALID_ACTION' });
  assert.deepEqual(state, before);
});

test('tied totals are shared winners', () => {
  let { state, ctx } = newGame();
  Object.assign(state.players[0], { finished: true, laps: 2 });
  Object.assign(state.players[1], { finished: true, laps: 2 });
  state.players[1].money = 500;
  state.turn.step = 'shop';
  ({ state } = act(state, ctx, 'p1', { type: 'DONE' }));
  assert.equal(state.phase, 'ended');
  assert.deepEqual(state.result.winnerIds, ['p1', 'p2']);
});

test('DONE works in shop and center only, SKIP only in catch', () => {
  let { state, ctx } = newGame();
  assert.throws(() => act(state, ctx, 'p1', { type: 'DONE' }), { code: 'INVALID_ACTION' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'SKIP' }), { code: 'INVALID_ACTION' });
  state.players[1].position = 1; // ไม่อยู่ช่องเดียวกับ p1 จะได้ไม่เข้า step 'challenge'
  state.turn.step = 'center';
  ({ state } = act(state, ctx, 'p1', { type: 'DONE' }));
  assert.equal(state.turn.playerId, 'p2');
  assert.equal(state.turn.step, 'roll');
});
