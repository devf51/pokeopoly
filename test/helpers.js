// ตัวช่วยเทสต์: rng ที่กำหนดค่าได้เพื่อให้ผลแน่นอน
import { readFileSync } from 'node:fs';
import { makeContext } from '../shared/engine/context.js';
import { createGame } from '../shared/engine/state.js';
import { applyAction } from '../shared/engine/index.js';

// ค่า rng ที่ทำให้ rollD6 ได้ n (1..6)
export function die(n) {
  return (n - 0.5) / 6;
}

// คืนค่าตามลำดับ ถ้าหมดให้ throw
export function fixedRng(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++];
  };
}

export const pokedex = JSON.parse(
  readFileSync(new URL('../data/pokedex.json', import.meta.url), 'utf8'),
);

// rng แบบกำหนดผลได้ (LCG) ใช้ตอนสร้างเกมถ้าไม่ได้ระบุ rngValues
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Ash', cls: 'catcher', starter: 'bulbasaur' },
  { id: 'p2', name: 'Misty', cls: 'merchant', starter: 'charmander' },
];

// สร้างเกมพร้อมบังคับลำดับตาเป็นลำดับผู้เล่นที่ส่งมา
// หลังสร้างเสร็จ ctx.rng จะ throw ถ้าถูกเรียกโดยไม่ผ่าน act (กันการสุ่มที่ไม่ได้ตั้งใจ)
export function newGame({ players = DEFAULT_PLAYERS, rngValues } = {}) {
  const ctx = makeContext(pokedex, rngValues ? fixedRng(rngValues) : seededRng(1));
  const state = createGame(players, ctx);
  state.order = players.map(p => p.id);
  state.turnIndex = 0;
  state.turn.playerId = state.order[0];
  ctx.rng = fixedRng([]);
  return { state, ctx };
}

// เรียก applyAction โดยตั้ง rng เป็นค่าที่กำหนด
export function act(state, ctx, actorId, action, rngValues = []) {
  ctx.rng = fixedRng(rngValues);
  return applyAction(state, actorId, action, ctx);
}
