import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, newGame, pokedex } from '../helpers.js';
import { HANDLERS, applyAction } from '../../shared/engine/index.js';
import { viewFor } from '../../shared/engine/view.js';
import { moveBy } from '../../shared/engine/turn.js';
import { LEGENDARY_IDS } from '../../shared/constants.js';
import { QTY_OPTIONS, actionTypes, buildActionModel, destinationIndex } from '../../public/js/ui/action-model.js';

const pokedexById = new Map(pokedex.map(p => [p.id, p]));
const PLAYERS = [
  { id: 'p1', name: 'Ash', cls: 'catcher', starter: 'bulbasaur' },
  { id: 'p2', name: 'Misty', cls: 'merchant', starter: 'charmander' },
];

// สร้างเกมแล้วจัดสถานะให้อยู่ใน step ที่ต้องการ (state เป็น object ธรรมดา) แล้วดูผ่านมุมมองของผู้เล่น
function setup({ players = PLAYERS, step, position = 1, tweak } = {}) {
  const { state, ctx } = newGame({ players });
  state.turn.step = step;
  state.players[0].position = position;
  tweak?.(state);
  return { state, ctx };
}

const model = (state, id = 'p1', ui) => buildActionModel(viewFor(state, id), id, pokedexById, ui);
const controls = m => m.sections.filter(s => s.kind === 'buttons').flatMap(s => s.items);
const byType = (m, type) => controls(m).filter(c => c.action.type === type);
const one = (m, type) => {
  const found = byType(m, type);
  assert.equal(found.length, 1, `${type} x${found.length}`);
  return found[0];
};
const wildTile = state => state.board.find(t => t.type === 'wild');

test('every step shows exactly the actions of the Actions-per-step table', () => {
  const expected = {
    roll: ['ROLL', 'SQUIRTLE_WARP'],
    move: ['CONFIRM_MOVE', 'RANGER_REROLL', 'RANGER_ADJUST', 'PIKACHU_REROLL'],
    catch: ['THROW', 'BULBASAUR_CATCH', 'SKIP'],
    'catch-failed': ['PROFESSOR_REROLL', 'PIKACHU_REROLL', 'ACCEPT'],
    shop: ['BUY', 'SELL', 'DONE'],
    center: ['HEAL', 'DONE'],
    challenge: ['CHALLENGE', 'SKIP'],
    defend: ['DEFEND'],
  };
  // ตารางต้องตรงกับ HANDLERS จริงของ engine ด้วย
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(HANDLERS).sort());
  for (const [step, types] of Object.entries(expected)) {
    assert.deepEqual([...new Set(Object.keys(HANDLERS[step]))].sort(), [...types].sort(), `engine handlers of ${step}`);
  }

  // ความสามารถแสดงเฉพาะของคลาส/ตัวเริ่มต้นของตัวเอง จึงรวมปุ่มจาก 4 ชุดผู้เล่นให้ครอบคลุมทุกความสามารถ
  const CONFIGS = [['ranger', 'squirtle'], ['professor', 'pikachu'], ['catcher', 'bulbasaur'], ['merchant', 'charmander']];
  for (const step of Object.keys(expected)) {
    const seen = new Set();
    for (const [cls, starter] of CONFIGS) {
    const { state } = setup({
      step,
      players: [{ ...PLAYERS[0], cls, starter }, PLAYERS[1]],
      position: step === 'shop' ? 0 : step === 'center' ? 11 : 1,
      tweak(s) {
        s.turn.roll = 3;
        s.turn.ball = 'poke';
        s.players[1].position = s.players[0].position;
        s.players[0].mons.push({ uid: 90, dexId: 16, zone: 1, starter: false, fainted: step === 'center' });
        if (step === 'defend') s.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
      },
    });
    const actorId = step === 'defend' ? 'p2' : 'p1';
    const m = model(state, actorId);
    assert.equal(m.mine, true, step);
    actionTypes(m).forEach(t => seen.add(t));
    }
    assert.deepEqual([...seen].sort(), [...expected[step]].sort(), `buttons of ${step}`);
  }
});

test('buttons only for the actor; the defender (not the attacker) gets DEFEND', () => {
  const { state } = setup({
    step: 'defend',
    tweak(s) {
      s.players[1].position = 1;
      s.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
    },
  });
  const attacker = model(state, 'p1');
  assert.equal(attacker.mine, false);
  assert.deepEqual(attacker.sections, []);
  assert.match(attacker.summary[0], /Misty/);
  const defender = model(state, 'p2');
  assert.equal(defender.mine, true);
  assert.deepEqual(actionTypes(defender), ['DEFEND']);

  const roll = setup({ step: 'roll' });
  assert.equal(model(roll.state, 'p2').mine, false);
  assert.deepEqual(model(roll.state, 'p2').sections, []);
});

test('no model when the game is over or missing', () => {
  const { state } = setup({ step: 'roll' });
  state.phase = 'ended';
  assert.equal(buildActionModel(state, 'p1', pokedexById), null);
  assert.equal(buildActionModel(null, 'p1', pokedexById), null);
});

test('a control is disabled exactly when the engine would refuse it (or documented UI-only hints)', () => {
  // ทุกปุ่มที่ไม่ disabled ต้องผ่าน applyAction; ปุ่มที่ disabled ด้วยเหตุผลความสามารถ/ของ/เงินต้องถูก engine ปฏิเสธ
  const scenarios = [
    { step: 'roll' },
    { step: 'roll', players: [{ ...PLAYERS[0], starter: 'squirtle' }, PLAYERS[1]] },
    { step: 'move', players: [{ ...PLAYERS[0], cls: 'ranger', starter: 'pikachu' }, PLAYERS[1]], tweak: s => { s.turn.roll = 3; } },
    { step: 'move', tweak: s => { s.turn.roll = 3; } },
    { step: 'catch' },
    { step: 'catch', tweak: s => { s.players[0].balls = { poke: 0, great: 1, ultra: 0 }; } },
    { step: 'catch-failed', players: [{ ...PLAYERS[0], cls: 'professor', starter: 'pikachu' }, PLAYERS[1]], tweak: s => { s.turn.ball = 'poke'; s.turn.roll = 1; } },
    { step: 'shop', position: 4, tweak: s => { s.players[0].money = 100; } },
    { step: 'shop', position: 0, tweak: s => { s.players[0].mons.push({ uid: 9, dexId: 16, zone: 2, starter: false, fainted: false }); } },
    { step: 'center', position: 11, tweak: s => { s.players[0].money = 30; s.players[0].mons.push({ uid: 9, dexId: 16, zone: 2, starter: false, fainted: true }); } },
    { step: 'center', position: 11 },
    { step: 'challenge', tweak: s => { s.players[1].position = 1; } },
  ];
  for (const sc of scenarios) {
    const { state, ctx } = setup(sc);
    // ให้ช่องปัจจุบันมีตัวโปเกม่อนที่รู้ว่าเป็นโซนอะไร (step catch ต้องการ pools จาก ctx)
    const m = model(state);
    for (const c of controls(m)) {
      if (c.action.type === 'RANGER_ADJUST' && c.disabled) continue; // UI เข้มกว่า: ขอบเขตก้าว ไม่ใช่การปฏิเสธของ engine
      if (c.action.type === 'BULBASAUR_CATCH' || c.action.type === 'CHALLENGE') { /* ตรวจด้านล่างแบบเฉพาะ */ }
      let error = null;
      try {
        act(state, ctx, 'p1', c.action, [0.5, 0.5, 0.5, 0.5]);
      } catch (e) {
        error = e;
      }
      const label = `${sc.step}:${c.key}`;
      if (c.disabled) assert.ok(error, `${label} disabled but engine accepted it`);
      else assert.equal(error, null, `${label} enabled but engine refused: ${error?.message}`);
    }
  }
});

test('catch step: encounter info, target and ball buttons', () => {
  const { state } = setup({ step: 'catch', position: 1, tweak: s => { s.players[0].balls = { poke: 0, great: 2, ultra: 0 }; } });
  const tile = state.board[1];
  const m = model(state);
  const encounter = m.sections.find(s => s.kind === 'encounter');
  assert.equal(encounter.name, pokedexById.get(tile.dexId).name);
  assert.equal(encounter.dexId, tile.dexId);
  assert.equal(encounter.target, 2); // โซน 1
  assert.equal(encounter.value, 50);
  const poke = byType(m, 'THROW').find(c => c.action.ball === 'poke');
  assert.equal(poke.disabled, true);
  assert.match(poke.reason, /Poké Ball/);
  const great = byType(m, 'THROW').find(c => c.action.ball === 'great');
  assert.equal(great.disabled, false);
  assert.match(m.summary.join(' '), /Catcher/);
});

test('catch step with a legendary: Bulbasaur is disabled with a Thai reason; other starters do not see it', () => {
  const legendary = LEGENDARY_IDS[0];
  const { state } = setup({ step: 'catch', position: 29, tweak: s => { s.board[29].dexId = legendary; } });
  const bulb = one(model(state), 'BULBASAUR_CATCH');
  assert.equal(bulb.disabled, true);
  assert.match(bulb.reason, /ตัวตำนาน/);
  const m = model(state);
  assert.equal(m.sections.find(s => s.kind === 'encounter').target, 7);
  assert.equal(m.sections.find(s => s.kind === 'encounter').legendary, true);

  // ไม่ใช่ Bulbasaur / ใช้ไปแล้ว
  const other = setup({ step: 'catch', players: [{ ...PLAYERS[0], starter: 'pikachu' }, PLAYERS[1]] });
  assert.equal(byType(model(other.state), 'BULBASAUR_CATCH').length, 0);
  const used = setup({ step: 'catch', tweak: s => { s.players[0].starterUsed = true; } });
  assert.match(one(model(used.state), 'BULBASAUR_CATCH').reason, /ไปแล้ว/);
});

test('roll step: Squirtle warp 1-6 with destinations; hidden for other starters', () => {
  const sq = setup({ step: 'roll', players: [{ ...PLAYERS[0], starter: 'squirtle' }, PLAYERS[1]] });
  const warps = byType(model(sq.state), 'SQUIRTLE_WARP');
  assert.deepEqual(warps.map(w => w.action.steps), [1, 2, 3, 4, 5, 6]);
  assert.ok(warps.every(w => !w.disabled && /^ไปช่อง \d+/.test(w.detail)));
  assert.match(warps[3].detail, /ไปช่อง 6 /); // จากช่อง 2 (index 1) ไป 4 ช่อง = index 5

  const other = setup({ step: 'roll' });
  const m = model(other.state);
  assert.equal(byType(m, 'SQUIRTLE_WARP').length, 0);
  assert.equal(m.sections.find(s => s.id === 'warp'), undefined);
  assert.equal(one(m, 'ROLL').disabled, false);
});

test('move step: confirm shows the pending steps; Ranger bounds; no Ranger/Pikachu buttons for others', () => {
  const rg = setup({ step: 'move', players: [{ ...PLAYERS[0], cls: 'ranger' }, PLAYERS[1]], tweak: s => { s.turn.roll = 7; } });
  let m = model(rg.state);
  assert.equal(one(m, 'CONFIRM_MOVE').label, 'เดิน 7 ก้าว');
  const up = byType(m, 'RANGER_ADJUST').find(c => c.action.delta === 1);
  const down = byType(m, 'RANGER_ADJUST').find(c => c.action.delta === -1);
  assert.equal(up.disabled, true);
  assert.equal(down.disabled, false);

  const low = setup({ step: 'move', players: [{ ...PLAYERS[0], cls: 'ranger' }, PLAYERS[1]], tweak: s => { s.turn.roll = 1; } });
  m = model(low.state);
  assert.equal(byType(m, 'RANGER_ADJUST').find(c => c.action.delta === -1).disabled, true);

  const spent = setup({ step: 'move', players: [{ ...PLAYERS[0], cls: 'ranger' }, PLAYERS[1]], tweak: s => { s.turn.roll = 3; s.players[0].classUses = 0; } });
  assert.ok(byType(model(spent.state), 'RANGER_REROLL').every(c => c.disabled && /ครบ/.test(c.reason)));

  const catcher = setup({ step: 'move', tweak: s => { s.turn.roll = 3; } });
  m = model(catcher.state);
  assert.equal(byType(m, 'RANGER_REROLL').length, 0);
  assert.equal(byType(m, 'RANGER_ADJUST').length, 0);
  assert.equal(byType(m, 'PIKACHU_REROLL').length, 0);
});

test('catch-failed step: shows the missed roll and ball, abilities by class/starter', () => {
  const { state } = setup({
    step: 'catch-failed', players: [{ ...PLAYERS[0], cls: 'professor', starter: 'pikachu' }, PLAYERS[1]],
    tweak: s => { s.turn.ball = 'great'; s.turn.roll = 2; },
  });
  const m = model(state);
  assert.match(m.summary[0], /ทอยได้ 2/);
  assert.match(m.summary[0], /Great Ball/);
  assert.equal(one(m, 'PROFESSOR_REROLL').disabled, false);
  assert.equal(one(m, 'PIKACHU_REROLL').disabled, false);
  assert.equal(one(m, 'ACCEPT').disabled, false);
  const plain = model(setup({ step: 'catch-failed', tweak: s => { s.turn.ball = 'poke'; s.turn.roll = 2; } }).state);
  assert.deepEqual(actionTypes(plain), ['ACCEPT']);
});

test('shop: prices (Merchant discount), quantity, money and the start-only sell rule', () => {
  const mart = setup({ step: 'shop', position: 4, tweak: s => { s.players[0].money = 150; } });
  let m = model(mart.state, 'p1', { qty: 1 });
  const buys = byType(m, 'BUY');
  assert.deepEqual(buys.map(b => b.disabled), [false, false, true]); // 50, 120, 250
  assert.match(buys[2].reason, /เงินไม่พอ/);
  m = model(mart.state, 'p1', { qty: 3 });
  assert.deepEqual(byType(m, 'BUY').map(b => b.action.qty), [3, 3, 3]);
  assert.deepEqual(byType(m, 'BUY').map(b => b.disabled), [false, true, true]); // 150 พอสำหรับ Poké Ball x3 เท่านั้น
  assert.equal(one(m, 'SELL').disabled, true);
  assert.match(one(m, 'SELL').reason, /จุดเริ่มต้น/);

  // Merchant: 35 / 84 / 175
  const merchant = setup({ step: 'shop', position: 4, players: [PLAYERS[1], PLAYERS[0]], tweak: s => { s.turn.playerId = 'p2'; } });
  const mm = buildActionModel(viewFor(merchant.state, 'p2'), 'p2', pokedexById, { qty: 1 });
  assert.match(byType(mm, 'BUY')[0].detail, /\b35\b/);
  assert.match(byType(mm, 'BUY')[1].detail, /\b84\b/);
  assert.match(byType(mm, 'BUY')[2].detail, /\b175\b/);

  assert.deepEqual(QTY_OPTIONS.includes(m.selection.qty), true);
  assert.equal(model(mart.state, 'p1', { qty: 999 }).selection.qty, QTY_OPTIONS[0]);
});

test('shop at the start tile: sell buttons for sellable mons only; none -> disabled with reason', () => {
  const none = setup({ step: 'shop', position: 0 });
  const sell = one(model(none.state), 'SELL');
  assert.equal(sell.disabled, true);
  assert.match(sell.reason, /ไม่มีโปเกม่อนให้ขาย/);

  const some = setup({
    step: 'shop', position: 0,
    tweak: s => {
      s.players[0].mons.push({ uid: 20, dexId: 16, zone: 2, starter: false, fainted: false });
      s.players[0].mons.push({ uid: 21, dexId: 19, zone: 1, starter: false, fainted: true });
    },
  });
  const sells = byType(model(some.state), 'SELL');
  assert.deepEqual(sells.map(s => s.action.uid), [20]);
  assert.match(sells[0].detail, /100/);
  assert.equal(sells[0].dexId, 16);
});

test('center: lists fainted mons with cost; starter is free; no fainted -> disabled', () => {
  const none = setup({ step: 'center', position: 11 });
  assert.equal(one(model(none.state), 'HEAL').disabled, true);

  const { state } = setup({
    step: 'center', position: 11,
    tweak: s => {
      s.players[0].money = 10;
      s.players[0].mons[0].fainted = true; // ตัวเริ่มต้น
      s.players[0].mons.push({ uid: 30, dexId: 16, zone: 3, starter: false, fainted: true }); // 200 -> ค่ารักษา 40
    },
  });
  const heals = byType(model(state), 'HEAL');
  assert.equal(heals.length, 2);
  assert.equal(heals[0].detail, 'ฟรี');
  assert.equal(heals[0].disabled, false);
  assert.match(heals[1].detail, /40/);
  assert.equal(heals[1].disabled, true);
  assert.match(heals[1].reason, /เงินไม่พอ/);
});

test('challenge: targets, fighters, Charmander toggle and the resulting action', () => {
  const players = [PLAYERS[0], PLAYERS[1], { id: 'p3', name: 'Brock', cls: 'ranger', starter: 'squirtle' }];
  const { state } = setup({
    step: 'challenge', players,
    tweak: s => { s.players[1].position = 1; s.players[2].position = 1; s.players[0].mons.push({ uid: 50, dexId: 16, zone: 1, starter: false, fainted: false }); },
  });
  let m = model(state);
  const pickTarget = m.sections.find(s => s.field === 'targetId');
  assert.deepEqual(pickTarget.options.map(o => o.value), ['p2', 'p3']);
  assert.equal(pickTarget.selected, 'p2');
  const challenge = one(m, 'CHALLENGE');
  assert.deepEqual(challenge.action, { type: 'CHALLENGE', targetId: 'p2', uid: 1, charmander: false });
  assert.equal(challenge.disabled, false);
  assert.equal(m.sections.find(s => s.kind === 'toggle'), undefined); // Ash เป็น Bulbasaur ไม่เห็นตัวเลือก Charmander

  m = model(state, 'p1', { targetId: 'p3', uid: 50, charmander: true });
  assert.deepEqual(one(m, 'CHALLENGE').action, { type: 'CHALLENGE', targetId: 'p3', uid: 50, charmander: false });
  // ค่าที่เลือกไว้แต่ใช้ไม่ได้แล้วถูกปรับกลับเป็นค่าเริ่มต้น
  m = model(state, 'p1', { targetId: 'nobody', uid: 999 });
  assert.deepEqual(m.selection, { qty: 1, targetId: 'p2', uid: 1, charmander: false });
});

test('challenge with Charmander available sends charmander:true once toggled', () => {
  const players = [{ ...PLAYERS[0], starter: 'charmander' }, PLAYERS[1]];
  const { state, ctx } = setup({ step: 'challenge', players, tweak: s => { s.players[1].position = 1; } });
  const m = model(state, 'p1', { charmander: true });
  assert.equal(m.sections.find(s => s.kind === 'toggle').reason, null);
  const action = one(m, 'CHALLENGE').action;
  assert.equal(action.charmander, true);
  assert.doesNotThrow(() => act(state, ctx, 'p1', action));
});

test('defend: the defender picks among healthy mons; sees the attacker mon; fainted-only -> disabled', () => {
  const { state, ctx } = setup({
    step: 'defend',
    tweak: s => {
      s.players[1].position = 1;
      s.players[1].mons.push({ uid: 60, dexId: 25, zone: 1, starter: false, fainted: true });
      s.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
    },
  });
  const m = model(state, 'p2');
  assert.match(m.summary[0], /Ash.*Bulbasaur/);
  const pick = m.sections.find(s => s.field === 'uid');
  assert.deepEqual(pick.options.map(o => o.label), ['Charmander']); // ตัวที่หมดสภาพไม่มีให้เลือก
  assert.deepEqual(one(m, 'DEFEND').action, { type: 'DEFEND', uid: pick.selected, charmander: false });
  assert.doesNotThrow(() => act(state, ctx, 'p2', one(m, 'DEFEND').action, [0.5, 0.5]));

  state.players[1].mons.forEach(mon => { mon.fainted = true; });
  const none = model(state, 'p2');
  assert.equal(one(none, 'DEFEND').disabled, true);
  assert.match(one(none, 'DEFEND').reason, /หมดสภาพ/);
});

test('abilities of other classes and starters are hidden', () => {
  const mc = [{ ...PLAYERS[0], cls: 'merchant', starter: 'charmander' }, PLAYERS[1]];
  const roll = model(setup({ step: 'roll', players: mc }).state);
  assert.equal(byType(roll, 'SQUIRTLE_WARP').length, 0);
  const move = model(setup({ step: 'move', players: mc, tweak: s => { s.turn.roll = 3; } }).state);
  assert.deepEqual(actionTypes(move), ['CONFIRM_MOVE']);
  assert.equal(move.sections.find(s => s.title === 'ความสามารถพิเศษ'), undefined);
  const caught = model(setup({ step: 'catch', players: mc }).state);
  assert.equal(byType(caught, 'BULBASAUR_CATCH').length, 0);
  const failed = model(setup({ step: 'catch-failed', players: mc, tweak: s => { s.turn.ball = 'poke'; s.turn.roll = 1; } }).state);
  assert.deepEqual(actionTypes(failed), ['ACCEPT']);

  const bulb = [{ ...PLAYERS[0], cls: 'merchant', starter: 'bulbasaur' }, PLAYERS[1]];
  const ch = model(setup({ step: 'challenge', players: bulb, tweak: s => { s.players[1].position = 1; } }).state);
  assert.equal(ch.sections.find(s => s.kind === 'toggle'), undefined);
  const df = setup({
    step: 'defend', players: [PLAYERS[0], { ...PLAYERS[1], starter: 'squirtle' }],
    tweak: s => { s.players[1].position = 1; s.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false }; },
  });
  assert.equal(model(df.state, 'p2').sections.find(s => s.kind === 'toggle'), undefined);
});

test('own abilities that are used up stay visible and disabled', () => {
  const sq = setup({ step: 'roll', players: [{ ...PLAYERS[0], starter: 'squirtle' }, PLAYERS[1]], tweak: s => { s.players[0].starterUsed = true; } });
  const m = model(sq.state);
  const warps = byType(m, 'SQUIRTLE_WARP');
  assert.equal(warps.length, 6);
  assert.ok(warps.every(w => w.disabled));
  const warp = m.sections.find(s => s.id === 'warp');
  assert.equal(warp.noteIsReason, true);
  assert.match(warp.note, /ไปแล้ว/);

  const rg = setup({ step: 'move', players: [{ ...PLAYERS[0], cls: 'ranger' }, PLAYERS[1]], tweak: s => { s.turn.roll = 3; s.players[0].classUses = 0; } });
  const ranger = controls(model(rg.state)).filter(c => c.key.startsWith('ranger-'));
  assert.equal(ranger.length, 3);
  assert.ok(ranger.every(c => c.disabled && c.reason === 'ใช้ความสามารถครบ 2 ครั้งแล้ว'));
});

test('skip sits with the throw buttons; ball buttons explain the bonus', () => {
  const m = model(setup({ step: 'catch' }).state);
  const throwSection = m.sections.find(s => s.id === 'throw');
  assert.deepEqual(throwSection.items.map(i => i.action.type), ['THROW', 'THROW', 'THROW', 'SKIP']);
  assert.equal(throwSection.items[3].label, 'ไม่จับ ข้ามไป');
  assert.ok(throwSection.items.find(i => i.key === 'throw-great').detail.endsWith('เพิ่มโอกาสจับ (+1 แต้มตอนทอยจับ)'));

  const shop = model(setup({ step: 'shop', position: 4 }).state, 'p1', { qty: 1 });
  const buy = key => controls(shop).find(c => c.key === key).detail;
  assert.ok(buy('buy-ultra').startsWith('เพิ่มโอกาสจับมากขึ้น (+2 แต้มตอนทอยจับ)'));
  assert.ok(buy('buy-great').startsWith('เพิ่มโอกาสจับ (+1 แต้มตอนทอยจับ)'));
  assert.ok(buy('buy-poke').startsWith('บอลธรรมดา'));
});

test('destinationIndex matches what the engine moveBy does', () => {
  for (const laps of [0, 1]) {
    for (let position = 0; position < 32; position++) {
      for (let steps = 1; steps <= 6; steps++) {
        const { state } = newGame({ players: PLAYERS });
        const p = state.players[0];
        Object.assign(p, { position, laps });
        const before = { ...p };
        moveBy(state, p, steps, []);
        assert.equal(p.position, destinationIndex(before, steps), `pos ${position} laps ${laps} steps ${steps}`);
      }
    }
  }
});

test('applyAction really is untouched by the model (engine import sanity)', () => {
  const { state, ctx } = setup({ step: 'roll' });
  ctx.rng = () => 0.5;
  assert.equal(applyAction(state, 'p1', { type: 'ROLL' }, ctx).state.turn.step, 'move');
});
