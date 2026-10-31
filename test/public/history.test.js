import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, newGame, pokedex } from '../helpers.js';
import {
  HISTORY_LIMIT, appendHistory, describeEvent, describeEvents, orderEvents,
} from '../../public/js/ui/history.js';
import { abilityLines, currentMonValue, lapText, rankLabels } from '../../public/js/ui/status.js';

const byId = new Map(pokedex.map(p => [p.id, p]));
const names = {
  player: id => ({ p1: 'Ash', p2: 'Misty' })[id] ?? '?',
  mon: dexId => byId.get(dexId)?.name ?? '?',
  ball: ball => ({ poke: 'Poké Ball', great: 'Great Ball', ultra: 'Ultra Ball' })[ball],
};

test('caught / fled lines carry roll, bonus and target (example from the brief)', () => {
  assert.equal(
    describeEvent({ type: 'caught', playerId: 'p1', dexId: 16, roll: 4, total: 4, target: 3 }, names),
    'Ash จับ Pidgey ได้! (ทอย 4 + 0 ≥ 3)',
  );
  assert.equal(
    describeEvent({ type: 'caught', playerId: 'p1', dexId: 16, roll: 2, total: 4, target: 3 }, names),
    'Ash จับ Pidgey ได้! (ทอย 2 + 2 ≥ 3)',
  );
  assert.equal(
    describeEvent({ type: 'fled', playerId: 'p2', dexId: 16, roll: 1, total: 2, target: 3 }, names),
    'Misty จับ Pidgey ไม่ได้ Pidgey หนีไป (ทอย 1 + 1 < 3)',
  );
});

test('Bulbasaur catch (null roll/total) never prints null/NaN', () => {
  const caught = describeEvent({ type: 'caught', playerId: 'p1', dexId: 16, roll: null, total: null, target: 3 }, names);
  assert.equal(caught, 'Ash จับ Pidgey ได้! (จับสำเร็จแน่นอน)');
  const fled = describeEvent({ type: 'fled', playerId: 'p1', dexId: 16, roll: null, total: null, target: 3 }, names);
  assert.doesNotMatch(fled, /null|NaN|undefined/);
});

test('every event type has a Thai line; unknown types are skipped', () => {
  const events = [
    { type: 'rolled', playerId: 'p1', value: 4, source: 'roll' },
    { type: 'rolled', playerId: 'p1', value: 2, source: 'catch' },
    { type: 'rolled', playerId: 'p1', value: 5, source: 'ranger' },
    { type: 'rolled', playerId: 'p1', value: 5, source: 'professor' },
    { type: 'rolled', playerId: 'p1', value: 5, source: 'pikachu' },
    { type: 'moved', playerId: 'p1', from: 30, to: 2, steps: 4 },
    { type: 'salary', playerId: 'p1', amount: 200 },
    { type: 'finished', playerId: 'p1', bonus: 300 },
    { type: 'finished', playerId: 'p2', bonus: 0 },
    { type: 'ability', playerId: 'p1', name: 'ranger' },
    { type: 'bought', playerId: 'p1', ball: 'great', qty: 2, cost: 240 },
    { type: 'sold', playerId: 'p1', dexId: 16, amount: 50 },
    { type: 'healed', playerId: 'p1', dexId: 16, cost: 10 },
    { type: 'healed', playerId: 'p1', dexId: 1, cost: 0 },
    { type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: 5, defenderTotal: 3, winnerId: 'p1', penalty: 40 },
    { type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: 3, defenderTotal: 3, winnerId: null, penalty: 0 },
    { type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: null, defenderTotal: null, winnerId: 'p2', penalty: 10 },
    { type: 'turn', playerId: 'p2' },
    { type: 'gameOver', result: {} },
  ];
  for (const ev of events) {
    const line = describeEvent(ev, names);
    assert.equal(typeof line, 'string', ev.type);
    assert.doesNotMatch(line, /null|NaN|undefined|\?/, line);
  }
  assert.equal(describeEvent({ type: 'mystery' }, names), null);
  assert.equal(describeEvent({ type: 'moved', playerId: 'p1', from: 30, to: 2, steps: 4 }, names), 'Ash เดิน 4 ก้าว จากช่อง 31 ไปช่อง 3');
  assert.equal(describeEvent({ type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: 5, defenderTotal: 3, winnerId: 'p1', penalty: 40 }, names),
    'Ash ชนะ Misty (Ash 5 : 3 Misty) Misty จ่ายค่าปรับ 40');
  assert.match(describeEvent({ type: 'battle', attackerId: 'p1', defenderId: 'p2', attackerTotal: null, defenderTotal: null, winnerId: 'p2', penalty: 10 }, names), /Charmander/);
});

test('moved comes before the salary/finished it produced', () => {
  const events = [
    { type: 'salary', playerId: 'p1', amount: 200 },
    { type: 'finished', playerId: 'p1', bonus: 0 },
    { type: 'moved', playerId: 'p1', from: 30, to: 0, steps: 2 },
    { type: 'turn', playerId: 'p2' },
  ];
  assert.deepEqual(orderEvents(events).map(e => e.type), ['moved', 'salary', 'finished', 'turn']);
  const lines = describeEvents(events, names);
  assert.match(lines[0], /เดิน 2 ก้าว/);
  assert.match(lines[1], /เงินเดือน/);
});

test('appendHistory keeps the newest HISTORY_LIMIT (10) lines', () => {
  assert.equal(HISTORY_LIMIT, 10);
  let history = [];
  for (let i = 1; i <= 15; i++) history = appendHistory(history, [{ type: 'rolled', playerId: 'p1', value: (i % 6) + 1, source: 'roll' }], names);
  assert.equal(history.length, 10);
  assert.match(history.at(-1), /ทอยลูกเต๋าได้ 4/); // i = 15 -> 15 % 6 + 1
  assert.equal(appendHistory(['x'], [], names).length, 1);
});

test('lines built from real engine events', () => {
  const { state, ctx } = newGame();
  const r = act(state, ctx, 'p1', { type: 'ROLL' }, [(4 - 0.5) / 6]);
  assert.deepEqual(describeEvents(r.events, names), ['Ash ทอยลูกเต๋าได้ 4']);
  const m = act(r.state, ctx, 'p1', { type: 'CONFIRM_MOVE' });
  assert.match(describeEvents(m.events, names)[0], /^Ash เดิน 4 ก้าว จากช่อง 1 ไปช่อง 5/);
});

test('status helpers: abilities, laps, tie-aware ranks, mon value', () => {
  const player = { cls: 'ranger', classUses: 1, starter: 'pikachu', starterUsed: true, laps: 1, finished: false, mons: [
    { starter: true, fainted: false, zone: null }, { starter: false, fainted: false, zone: 2 }, { starter: false, fainted: true, zone: 5 },
  ] };
  assert.deepEqual(abilityLines(player), ['Ranger เหลือ 1/2 ครั้ง', 'Pikachu ใช้ความสามารถแล้ว']);
  assert.deepEqual(abilityLines({ ...player, cls: 'catcher', starterUsed: false }), ['Catcher ใช้ได้ตลอดเกม', 'Pikachu พร้อมใช้']);
  assert.equal(lapText(player), 'เดินแล้ว 1/2 รอบ');
  assert.equal(lapText({ ...player, finished: true }), 'เข้าเส้นชัยแล้ว');
  assert.equal(currentMonValue(player), 100); // ตัวเริ่มต้นและตัวที่หมดสภาพนับ 0
  assert.deepEqual(rankLabels([{ total: 900 }, { total: 900 }, { total: 500 }]), [1, 1, 3]);
});
