import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, die } from '../helpers.js';
import { applyAction } from '../../shared/engine/index.js';
import { autoAction } from '../../shared/engine/auto.js';
import { viewFor } from '../../shared/engine/view.js';
import { BOARD_SIZE, PROFESSOR_VISION } from '../../shared/constants.js';

const P = (id, cls, starter) => ({ id, name: id, cls, starter });
const TWO = (cls1 = 'catcher') => ({ players: [P('p1', cls1, 'bulbasaur'), P('p2', 'merchant', 'charmander')] });

test('autoAction maps every step', () => {
  const { state } = newGame(TWO());
  const expected = {
    roll: 'ROLL', move: 'CONFIRM_MOVE', catch: 'SKIP', 'catch-failed': 'ACCEPT',
    shop: 'DONE', center: 'DONE', challenge: 'SKIP',
  };
  for (const [step, type] of Object.entries(expected)) {
    state.turn.step = step;
    assert.deepEqual(autoAction(state), { actorId: 'p1', action: { type } }, step);
  }
});

test('autoAction defends with the first healthy mon on behalf of the defender', () => {
  const { state } = newGame(TWO());
  const p2 = state.players[1];
  p2.mons.unshift({ uid: 90, dexId: 19, zone: 1, starter: false, fainted: true });
  p2.mons.push({ uid: 91, dexId: 16, zone: 1, starter: false, fainted: false });
  state.turn.step = 'defend';
  state.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
  assert.deepEqual(autoAction(state), {
    actorId: 'p2',
    action: { type: 'DEFEND', uid: 2, charmander: false },
  });
});

test('autoAction returns null once the game has ended', () => {
  const { state } = newGame(TWO());
  state.phase = 'ended';
  assert.equal(autoAction(state), null);
});

test('autoAction covers every step and plays out a full turn', () => {
  const { state, ctx } = newGame(TWO());
  const tile = state.board.find(t => t.type === 'wild');
  state.players[0].position = tile.index - 1;
  state.players[1].position = tile.index; // ให้ผ่าน catch แล้วเจอ challenge
  ctx.rng = () => 0; // ทอยได้ 1 เสมอ
  let s = state;
  const seen = [];
  while (s.turn.playerId === 'p1') {
    seen.push(s.turn.step);
    const auto = autoAction(s);
    ({ state: s } = applyAction(s, auto.actorId, auto.action, ctx));
  }
  assert.deepEqual(seen, ['roll', 'move', 'catch', 'challenge']);
  assert.equal(s.players[0].mons.length, 1);
  assert.equal(s.turn.playerId, 'p2');
  assert.equal(s.turn.step, 'roll');
});

test('autoAction plays a defense through a forced battle', () => {
  const { state, ctx } = newGame(TWO());
  state.turn.step = 'defend';
  state.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
  const auto = autoAction(state);
  const { state: next, events } = act(state, ctx, auto.actorId, auto.action, [die(6), die(1)]);
  assert.equal(events[0].type, 'battle');
  assert.equal(next.turn.playerId, 'p2');
});

test('viewFor hides wild pokemon except current encounter', () => {
  const { state } = newGame(TWO());
  const wilds = state.board.filter(t => t.type === 'wild');
  assert.ok(wilds.every(t => t.dexId !== null));
  const before = structuredClone(state);

  const view = viewFor(state, 'p2');
  assert.ok(view.board.filter(t => t.type === 'wild').every(t => t.dexId === null));
  assert.deepEqual(state, before); // ไม่แก้ state เดิม
  assert.notEqual(view, state);

  // ระหว่าง step 'catch' ช่องของเจ้าของตายังเห็น dexId (ทุกคนที่ดูเห็น)
  const tile = wilds[0];
  state.players[0].position = tile.index;
  state.turn.step = 'catch';
  for (const viewer of ['p1', 'p2']) {
    const v = viewFor(state, viewer);
    for (const t of v.board.filter(x => x.type === 'wild')) {
      assert.equal(t.dexId, t.index === tile.index ? state.board[tile.index].dexId : null);
    }
  }
  state.turn.step = 'catch-failed';
  assert.equal(viewFor(state, 'p2').board[tile.index].dexId, state.board[tile.index].dexId);
  state.turn.step = 'challenge';
  assert.equal(viewFor(state, 'p2').board[tile.index].dexId, null);
});

test('professor sees six tiles ahead, wrapping past start', () => {
  const { state } = newGame(TWO('professor'));
  assert.equal(PROFESSOR_VISION, 6);
  state.players[0].position = BOARD_SIZE - 2; // 30
  const view = viewFor(state, 'p1');
  const hidden = i => view.board[i].dexId === null;
  const visible = i => view.board[i].dexId === state.board[i].dexId && state.board[i].dexId !== null;
  // 31, 0..4 อยู่ในระยะ: wild 31, 1, 2, 3 เห็น (0 เป็นจุดเริ่มต้น, 4 เป็น mart)
  for (const i of [31, 1, 2, 3]) assert.ok(visible(i), `tile ${i}`);
  assert.equal(view.board[0].type, 'start');
  assert.equal(view.board[4].type, 'mart');
  // นอกระยะ รวมถึงช่องที่ยืนอยู่และช่องข้างหลัง
  for (const i of [5, 6, 20, 29, 30]) assert.ok(hidden(i), `tile ${i}`);

  // ผู้ดูที่ไม่ใช่ professor ไม่เห็นอะไร และ professor คนอื่นดูตามตำแหน่งตัวเอง
  const other = viewFor(state, 'p2');
  assert.ok(other.board.every(t => t.dexId === null));
});
