import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, pokedex } from '../helpers.js';
import { viewFor } from '../../shared/engine/view.js';
import { buildActionModel } from '../../public/js/ui/action-model.js';
import { splitActionSections } from '../../public/js/ui/action-layout.js';

const pokedexById = new Map(pokedex.map(p => [p.id, p]));
const PLAYERS = [
  { id: 'p1', name: 'Ash', cls: 'catcher', starter: 'bulbasaur' },
  { id: 'p2', name: 'Misty', cls: 'merchant', starter: 'charmander' },
];

// สร้างเกมแล้วจัดสถานะให้อยู่ใน step ที่ต้องการ (แบบเดียวกับ action-model.test.js)
function setup({ players = PLAYERS, step, position = 1, tweak } = {}) {
  const { state, ctx } = newGame({ players });
  state.turn.step = step;
  state.players[0].position = position;
  tweak?.(state);
  return { state, ctx };
}

const model = (state, id = 'p1', ui) => buildActionModel(viewFor(state, id), id, pokedexById, ui);

// สถานะเดียวกับเทสต์ 'every step shows exactly the actions…' ใน action-model.test.js
function stateFor(step) {
  return setup({
    step,
    position: step === 'shop' ? 0 : step === 'center' ? 11 : 1,
    tweak(s) {
      s.turn.roll = 3;
      s.turn.ball = 'poke';
      s.players[1].position = s.players[0].position;
      s.players[0].mons.push({ uid: 90, dexId: 16, zone: 1, starter: false, fainted: step === 'center' });
      if (step === 'defend') s.turn.battle = { attackerId: 'p1', defenderId: 'p2', attackerUid: 1, attackerCharmander: false };
    },
  }).state;
}

test('splitActionSections keeps order and routes footer ids', () => {
  const s = id => ({ kind: 'buttons', id, items: [] });
  const enc = { kind: 'encounter' };
  const { body, footer } = splitActionSections([enc, s('throw'), s('other')]);
  assert.deepEqual(body, [enc, s('other')]);
  assert.deepEqual(footer, [s('throw')]);
});

test('a pick/toggle section never goes to the footer', () => {
  const { footer } = splitActionSections([{ kind: 'pick', id: 'main' }, { kind: 'toggle', id: 'main' }]);
  assert.deepEqual(footer, []);
});

test('every step the actor sees has a primary button in the footer', () => {
  for (const step of ['roll', 'move', 'catch', 'catch-failed', 'shop', 'center', 'challenge', 'defend']) {
    const m = model(stateFor(step), step === 'defend' ? 'p2' : 'p1');
    const { footer } = splitActionSections(m.sections);
    assert.ok(footer.flatMap(s => s.items).some(i => i.variant === 'primary'), step);
  }
});
