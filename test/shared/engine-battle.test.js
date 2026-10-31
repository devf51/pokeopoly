import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, die } from '../helpers.js';
import { challengeTargets } from '../../shared/engine/challenge.js';

const P = (id, cls, starter) => ({ id, name: id, cls, starter });
const TWO = (s1 = 'bulbasaur', s2 = 'charmander') => ({
  players: [P('p1', 'catcher', s1), P('p2', 'merchant', s2)],
});

const mon = (uid, dexId, extra = {}) => ({ uid, dexId, zone: 1, starter: false, fainted: false, ...extra });

// วางผู้เล่นทุกคนที่ไม่ใช่ attacker ไว้ช่องเดียวกับ attacker แล้วให้ attacker เดินเข้าช่อง wild
// ถึง step 'catch' ผ่าน ROLL + CONFIRM_MOVE ก่อนจะ SKIP; prep(state) ใช้แก้สถานะก่อน SKIP
function toChallenge({ attacker = 'p1', opts = TWO(), others = null, prep } = {}) {
  const { state, ctx } = newGame(opts);
  const tile = state.board.find(t => t.type === 'wild' && t.zone === 1);
  const idx = state.players.findIndex(p => p.id === attacker);
  state.turn.playerId = attacker;
  state.turnIndex = state.order.indexOf(attacker);
  for (const p of state.players) {
    if (p.id === attacker) p.position = tile.index - 1;
    else if (!others || others.includes(p.id)) p.position = tile.index;
  }
  let s = state;
  ({ state: s } = act(s, ctx, attacker, { type: 'ROLL' }, [die(1)]));
  ({ state: s } = act(s, ctx, attacker, { type: 'CONFIRM_MOVE' }));
  assert.equal(s.turn.step, 'catch');
  assert.equal(s.players[idx].position, tile.index);
  if (prep) prep(s);
  ({ state: s } = act(s, ctx, attacker, { type: 'SKIP' }));
  return { state: s, ctx, tile };
}

const player = (state, id) => state.players.find(p => p.id === id);

function toDefend(opts = {}) {
  const { attackerUid = 1, charmander = false, ...rest } = opts;
  const game = toChallenge(rest);
  const attacker = game.state.turn.playerId;
  const defender = game.state.players.find(p => p.id !== attacker && p.position === player(game.state, attacker).position);
  const { state } = act(game.state, game.ctx, attacker, {
    type: 'CHALLENGE', targetId: defender.id, uid: attackerUid, charmander,
  });
  return { ...game, state, attacker, defender: defender.id };
}

test('landing next to an eligible player offers a challenge', () => {
  const { state } = toChallenge();
  assert.equal(state.turn.step, 'challenge');
  assert.equal(state.turn.playerId, 'p1');
  assert.deepEqual(challengeTargets(state, player(state, 'p1')).map(p => p.id), ['p2']);
});

test('no challenge when target is all fainted, finished, or attacker has nothing healthy', () => {
  // เป้าหมายหมดสภาพทุกตัว → ไปผู้เล่นถัดไปเลย
  let g = toChallenge({ prep: s => { player(s, 'p2').mons[0].fainted = true; } });
  assert.equal(g.state.turn.playerId, 'p2');
  assert.equal(g.state.turn.step, 'roll');

  // ผู้ท้าไม่มีตัวที่สู้ได้
  g = toChallenge({ prep: s => { player(s, 'p1').mons[0].fainted = true; } });
  assert.equal(g.state.turn.playerId, 'p2');
  assert.equal(g.state.turn.step, 'roll');

  // เป้าหมายเข้าเส้นชัยแล้ว (3 คน: p2 ถูกข้าม, p3 ยืนอยู่ที่อื่น) → ไป p3
  const three = { players: [P('p1', 'catcher', 'bulbasaur'), P('p2', 'merchant', 'charmander'), P('p3', 'ranger', 'squirtle')] };
  g = toChallenge({ opts: three, others: ['p2'], prep: s => { player(s, 'p2').finished = true; } });
  assert.equal(g.state.turn.playerId, 'p3');
  assert.equal(g.state.turn.step, 'roll');
});

test('challengeTargets excludes self, other tiles, finished and fainted; empty for finished or unfit attacker', () => {
  const three = { players: [P('p1', 'catcher', 'bulbasaur'), P('p2', 'merchant', 'charmander'), P('p3', 'ranger', 'squirtle')] };
  const { state } = newGame({ players: three.players });
  const [p1, p2, p3] = state.players;
  p1.position = 5; p2.position = 5; p3.position = 5;
  assert.deepEqual(challengeTargets(state, p1).map(p => p.id), ['p2', 'p3']);
  p3.position = 6;
  assert.deepEqual(challengeTargets(state, p1).map(p => p.id), ['p2']);
  p3.position = 5;
  p3.finished = true;
  assert.deepEqual(challengeTargets(state, p1).map(p => p.id), ['p2']);
  p3.finished = false;
  p2.mons[0].fainted = true;
  assert.deepEqual(challengeTargets(state, p1).map(p => p.id), ['p3']);
  p1.finished = true;
  assert.deepEqual(challengeTargets(state, p1), []);
  p1.finished = false;
  p1.mons[0].fainted = true;
  assert.deepEqual(challengeTargets(state, p1), []);
});

test('challenge step clears stale catch roll and ball', () => {
  const opts = { players: [P('p1', 'professor', 'bulbasaur'), P('p2', 'merchant', 'charmander')] };
  const { state, ctx } = newGame(opts);
  const tile = state.board.find(t => t.type === 'wild' && t.zone === 1);
  state.players[0].position = tile.index - 1;
  state.players[1].position = tile.index;
  let s = state;
  ({ state: s } = act(s, ctx, 'p1', { type: 'ROLL' }, [die(1)]));
  ({ state: s } = act(s, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  ({ state: s } = act(s, ctx, 'p1', { type: 'THROW', ball: 'poke' }, [die(1)]));
  assert.equal(s.turn.step, 'catch-failed');
  assert.equal(s.turn.roll, 1);
  assert.equal(s.turn.ball, 'poke');
  ({ state: s } = act(s, ctx, 'p1', { type: 'ACCEPT' }, [0]));
  assert.equal(s.turn.step, 'challenge');
  assert.equal(s.turn.roll, null);
  assert.equal(s.turn.ball, null);
});

test('SKIP at challenge ends the turn', () => {
  const { state, ctx } = toChallenge();
  const { state: next, events } = act(state, ctx, 'p1', { type: 'SKIP' });
  assert.equal(next.turn.playerId, 'p2');
  assert.equal(next.turn.step, 'roll');
  assert.deepEqual(events, [{ type: 'turn', playerId: 'p2' }]);
});

test('only the defender may defend', () => {
  const { state, ctx } = toChallenge();
  const { state: s, events } = act(state, ctx, 'p1', { type: 'CHALLENGE', targetId: 'p2', uid: 1, charmander: false });
  assert.equal(s.turn.step, 'defend');
  assert.deepEqual(s.turn.battle, { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false });
  assert.deepEqual(events, []);
  const before = structuredClone(s);
  assert.throws(() => act(s, ctx, 'p1', { type: 'DEFEND', uid: 1, charmander: false }), { code: 'NOT_YOUR_TURN' });
  assert.throws(() => act(s, ctx, 'p2', { type: 'CHALLENGE', targetId: 'p1', uid: 2, charmander: false }), { code: 'INVALID_ACTION' });
  assert.deepEqual(s, before);
});

test('CHALLENGE rejects bad targets, bad mons and unusable Charmander without changing state', () => {
  const three = { players: [P('p1', 'catcher', 'bulbasaur'), P('p2', 'merchant', 'charmander'), P('p3', 'ranger', 'squirtle')] };
  const { state, ctx } = toChallenge({
    opts: three,
    others: ['p2'],
    prep: s => { player(s, 'p1').mons.push(mon(50, 19, { fainted: true })); },
  });
  assert.equal(state.turn.step, 'challenge');
  const before = structuredClone(state);
  const challenge = extra => act(state, ctx, 'p1', { type: 'CHALLENGE', targetId: 'p2', uid: 1, charmander: false, ...extra });
  assert.throws(() => challenge({ targetId: 'p3' }), { code: 'BAD_TARGET' }); // อยู่คนละช่อง
  assert.throws(() => challenge({ targetId: 'p1' }), { code: 'BAD_TARGET' }); // ท้าตัวเอง
  assert.throws(() => challenge({ targetId: 'nobody' }), { code: 'BAD_TARGET' });
  assert.throws(() => challenge({ uid: 2 }), { code: 'BAD_TARGET' }); // ของคนอื่น
  assert.throws(() => challenge({ uid: 50 }), { code: 'BAD_TARGET' }); // หมดสภาพ
  assert.throws(() => challenge({ uid: 999 }), { code: 'BAD_TARGET' });
  assert.throws(() => challenge({ charmander: true }), { code: 'NO_USES' }); // ตัวเริ่มต้นเป็น bulbasaur
  assert.throws(() => challenge({ charmander: 'yes' }), { code: 'INVALID_ACTION' });
  assert.deepEqual(state, before);
});

test('CHALLENGE refuses Charmander that is already used', () => {
  const { state, ctx } = toChallenge({
    opts: TWO('charmander', 'bulbasaur'),
    prep: s => { player(s, 'p1').starterUsed = true; },
  });
  const before = structuredClone(state);
  assert.throws(
    () => act(state, ctx, 'p1', { type: 'CHALLENGE', targetId: 'p2', uid: 1, charmander: true }),
    { code: 'NO_USES' },
  );
  assert.deepEqual(state, before);
});

test('DEFEND rejects bad mons and unusable Charmander without changing state', () => {
  const { state, ctx } = toDefend({
    prep: s => { player(s, 'p2').mons.push(mon(60, 19, { fainted: true })); },
  });
  const before = structuredClone(state);
  const defend = extra => act(state, ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: false, ...extra });
  assert.throws(() => defend({ uid: 1 }), { code: 'BAD_TARGET' }); // ของฝ่ายตรงข้าม
  assert.throws(() => defend({ uid: 60 }), { code: 'BAD_TARGET' }); // หมดสภาพ
  assert.throws(() => defend({ uid: 999 }), { code: 'BAD_TARGET' });
  const used = structuredClone(state);
  player(used, 'p2').starterUsed = true;
  assert.throws(() => act(used, ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: true }), { code: 'NO_USES' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'DEFEND', uid: 1, charmander: false }), { code: 'NOT_YOUR_TURN' });
  assert.deepEqual(state, before);
  // ตัวเริ่มต้นไม่ใช่ charmander
  const { state: s2, ctx: c2 } = toDefend({ opts: TWO('charmander', 'bulbasaur') });
  assert.throws(() => act(s2, c2, 'p2', { type: 'DEFEND', uid: 2, charmander: true }), { code: 'NO_USES' });
});

test('loser faints and pays 10% of their money', () => {
  const { state, ctx } = toDefend({ prep: s => { player(s, 'p2').money = 155; } });
  const { state: next, events } = act(state, ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: false }, [die(5), die(3)]);
  const p1 = player(next, 'p1');
  const p2 = player(next, 'p2');
  assert.equal(p2.mons[0].fainted, true);
  assert.equal(p1.mons[0].fainted, false);
  assert.equal(p2.money, 140);
  assert.equal(p1.money, 515);
  // Charmander (fire) ได้เปรียบ Bulbasaur (grass): ฝ่ายรับ 3+1
  assert.deepEqual(events[0], {
    type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: 5, defenderTotal: 4, winnerId: 'p1', penalty: 15,
  });
  assert.deepEqual(events[1], { type: 'turn', playerId: 'p2' });
  assert.equal(next.turn.playerId, 'p2');
  assert.equal(next.turn.step, 'roll');
  assert.equal(next.turn.battle, null);
});

test('defender can win and collect from the attacker', () => {
  const { state, ctx } = toDefend();
  const { state: next, events } = act(state, ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: false }, [die(1), die(1)]);
  assert.equal(player(next, 'p1').mons[0].fainted, true);
  assert.equal(player(next, 'p1').money, 450);
  assert.equal(player(next, 'p2').money, 550);
  assert.equal(events[0].winnerId, 'p2');
  assert.equal(events[0].penalty, 50);
});

test('penalty never makes money negative', () => {
  const { state, ctx } = toDefend({ prep: s => { player(s, 'p2').money = 0; } });
  const { state: next, events } = act(state, ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: false }, [die(6), die(1)]);
  assert.equal(player(next, 'p2').money, 0);
  assert.equal(player(next, 'p1').money, 500);
  assert.equal(events[0].penalty, 0);
  assert.equal(player(next, 'p2').mons[0].fainted, true);
});

test('draw changes nothing', () => {
  const { state, ctx } = toDefend({
    attackerUid: 10,
    prep: s => {
      player(s, 'p1').mons.push(mon(10, 19));
      player(s, 'p2').mons.push(mon(11, 19));
    },
  });
  const { state: next, events } = act(state, ctx, 'p2', { type: 'DEFEND', uid: 11, charmander: false }, [die(4), die(4)]);
  assert.deepEqual(events[0], {
    type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: 4, defenderTotal: 4, winnerId: null, penalty: 0,
  });
  for (const id of ['p1', 'p2']) {
    assert.ok(player(next, id).mons.every(m => !m.fainted));
    assert.equal(player(next, id).money, 500);
  }
  assert.equal(next.turn.playerId, 'p2');
});

test('type advantage adds one', () => {
  // p2 เป็นฝ่ายท้าด้วย Charmander (fire) ใส่ Bulbasaur (grass) ของ p1
  const { state, ctx } = toDefend({ attacker: 'p2', attackerUid: 2 });
  assert.equal(state.turn.battle.defenderId, 'p1');
  const { state: next, events } = act(state, ctx, 'p1', { type: 'DEFEND', uid: 1, charmander: false }, [die(3), die(4)]);
  assert.equal(events[0].attackerTotal, 4);
  assert.equal(events[0].defenderTotal, 4);
  assert.equal(events[0].winnerId, null);
  assert.ok(next.players.every(p => !p.mons[0].fainted));
  assert.equal(next.turn.playerId, 'p1'); // วนกลับไป p1
});

test('charmander wins without rolling; both cancel', () => {
  // ฝ่ายโจมตีใช้ charmander โดยไม่ใส่ค่า rng → ชนะ (rng ไม่ถูกเรียก)
  const a = toDefend({ opts: TWO('charmander', 'bulbasaur'), charmander: true });
  assert.equal(a.state.turn.battle.attackerCharmander, true);
  const { state, events } = act(a.state, a.ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: false }, []);
  assert.equal(player(state, 'p2').mons[0].fainted, true);
  assert.equal(player(state, 'p1').money, 550);
  assert.equal(player(state, 'p2').money, 450);
  assert.equal(player(state, 'p1').starterUsed, true);
  assert.equal(player(state, 'p2').starterUsed, false);
  assert.equal(events[0].winnerId, 'p1');
  assert.equal(events[0].attackerTotal, null);
  assert.equal(events[0].defenderTotal, null);

  // ฝ่ายรับใช้ฝ่ายเดียวก็ชนะทันที
  const d = toDefend({ opts: TWO('bulbasaur', 'charmander') });
  const r = act(d.state, d.ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: true }, []);
  assert.equal(r.events[0].winnerId, 'p2');
  assert.equal(player(r.state, 'p1').mons[0].fainted, true);
  assert.equal(player(r.state, 'p2').starterUsed, true);
  assert.equal(player(r.state, 'p1').starterUsed, false);

  // ทั้งสองฝ่ายใช้ → หักล้าง ทอยตามปกติ และใช้สิทธิ์ไปทั้งคู่
  const b = toDefend({ opts: TWO('charmander', 'charmander'), charmander: true });
  const both = act(b.state, b.ctx, 'p2', { type: 'DEFEND', uid: 2, charmander: true }, [die(5), die(3)]);
  assert.equal(both.events[0].attackerTotal, 5);
  assert.equal(both.events[0].defenderTotal, 3);
  assert.equal(both.events[0].winnerId, 'p1');
  assert.equal(player(both.state, 'p1').starterUsed, true);
  assert.equal(player(both.state, 'p2').starterUsed, true);
  assert.equal(player(both.state, 'p2').mons[0].fainted, true);
});
