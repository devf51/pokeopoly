import { MIN_STEPS, RANGER_MAX_STEPS, SQUIRTLE_MAX_WARP } from '../constants.js';
import { rollD6 } from '../rng.js';
import { GameError } from './errors.js';
import { requireClassUse, requireStarter } from './abilities.js';
import { CATCH_FAILED_HANDLERS, CATCH_HANDLERS, CENTER_HANDLERS, SHOP_HANDLERS } from './tile-actions.js';
import { afterTile, enterTile, moveBy } from './turn.js';

function setRoll(state, player, value, source, events) {
  state.turn.roll = value;
  events.push({ type: 'rolled', playerId: player.id, value, source });
}

function walk(state, player, steps, events, ctx) {
  moveBy(state, player, steps, events);
  enterTile(state, events, ctx);
}

// ---- step: roll ----
function roll(state, player, action, events, ctx) {
  setRoll(state, player, rollD6(ctx.rng), 'roll', events);
  state.turn.step = 'move';
}

function squirtleWarp(state, player, action, events, ctx) {
  const { steps } = action;
  if (!Number.isInteger(steps) || steps < MIN_STEPS || steps > SQUIRTLE_MAX_WARP) {
    throw new GameError('INVALID_ACTION', 'วาร์ปได้เฉพาะจำนวนช่องที่กติกากำหนดเท่านั้น');
  }
  requireStarter(player, 'squirtle');
  player.starterUsed = true;
  events.push({ type: 'ability', playerId: player.id, name: 'squirtle' });
  walk(state, player, steps, events, ctx);
}

// ---- step: move ----
function confirmMove(state, player, action, events, ctx) {
  walk(state, player, state.turn.roll, events, ctx);
}

function rangerReroll(state, player, action, events, ctx) {
  requireClassUse(player, 'ranger');
  player.classUses--;
  events.push({ type: 'ability', playerId: player.id, name: 'ranger' });
  setRoll(state, player, rollD6(ctx.rng), 'ranger', events);
}

function rangerAdjust(state, player, action, events) {
  const { delta } = action;
  if (delta !== 1 && delta !== -1) {
    throw new GameError('INVALID_ACTION', 'Ranger ขยับได้เฉพาะ +1 หรือ -1 ช่อง');
  }
  requireClassUse(player, 'ranger');
  player.classUses--;
  events.push({ type: 'ability', playerId: player.id, name: 'ranger' });
  const steps = Math.min(RANGER_MAX_STEPS, Math.max(MIN_STEPS, state.turn.roll + delta));
  setRoll(state, player, steps, 'ranger', events);
}

function pikachuReroll(state, player, action, events, ctx) {
  requireStarter(player, 'pikachu');
  player.starterUsed = true;
  events.push({ type: 'ability', playerId: player.id, name: 'pikachu' });
  setRoll(state, player, rollD6(ctx.rng), 'pikachu', events);
}

// ---- จบหน้าที่ของช่อง ----
function finishTile(state, player, action, events) {
  afterTile(state, events);
}

// handler: (state, player, action, events, ctx) แก้ state ที่ clone มาแล้วได้ตามสบาย
// Task หลังเพิ่ม step/action ใหม่ได้โดยเพิ่มคีย์ในแมปนี้
export const HANDLERS = {
  roll: { ROLL: roll, SQUIRTLE_WARP: squirtleWarp },
  move: {
    CONFIRM_MOVE: confirmMove,
    RANGER_REROLL: rangerReroll,
    RANGER_ADJUST: rangerAdjust,
    PIKACHU_REROLL: pikachuReroll,
  },
  catch: { ...CATCH_HANDLERS, SKIP: finishTile },
  'catch-failed': CATCH_FAILED_HANDLERS,
  shop: { ...SHOP_HANDLERS, DONE: finishTile },
  center: { ...CENTER_HANDLERS, DONE: finishTile },
};

// ผู้ที่ต้องเป็นฝ่ายทำ action ของ step นั้น (ปกติเจ้าของตา; step 'defend' ของ Task 7 เป็นฝ่ายถูกท้า)
function expectedActor(state) {
  if (state.turn.step === 'defend') return state.turn.battle?.defenderId;
  return state.turn.playerId;
}

// ทางเดียวที่เปลี่ยนสถานะเกม: clone ก่อนแก้ ถ้าผิดกติกาโยน GameError และ state เดิมไม่ถูกแตะ
export function applyAction(state, actorId, action, ctx) {
  if (state.phase !== 'playing') throw new GameError('INVALID_ACTION', 'เกมจบแล้ว');
  if (actorId !== expectedActor(state)) throw new GameError('NOT_YOUR_TURN', 'ยังไม่ถึงตาของคุณ');
  const handlers = HANDLERS[state.turn.step] ?? {};
  const type = action?.type;
  if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
    throw new GameError('INVALID_ACTION', 'ทำสิ่งนี้ไม่ได้ในขั้นตอนปัจจุบัน');
  }

  const next = structuredClone(state);
  const events = [];
  const player = next.players.find(p => p.id === actorId);
  handlers[type](next, player, action, events, ctx);
  return { state: next, events };
}
