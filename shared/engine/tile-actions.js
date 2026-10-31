import { BALLS, LEGENDARY_IDS } from '../constants.js';
import { catchTarget, catchTotal, isCaught } from '../catch.js';
import { ballPrice, healCost, monValue } from '../economy.js';
import { zoneOfDex } from '../pokedex.js';
import { rollD6 } from '../rng.js';
import { requireClassUse, requireStarter, hasClassUse, hasStarterUse } from './abilities.js';
import { GameError } from './errors.js';
import { spawnFor } from './spawn.js';
import { afterTile } from './turn.js';

const isBall = ball => typeof ball === 'string' && Object.hasOwn(BALLS, ball);
const isLegendary = dexId => LEGENDARY_IDS.includes(dexId);

const currentTile = (state, player) => state.board[player.position];
const findMon = (player, uid) => player.mons.find(m => m.uid === uid);

// ---------------- จับโปเกม่อน ----------------

// สุ่มตัวใหม่ลงช่อง ล้างช่องก่อน เพื่อให้ตัวตำนานที่หนีไปกลับเข้ากองสุ่มได้ (ไม่ถือว่ายังอยู่บนกระดาน)
function respawn(state, tile, ctx) {
  tile.dexId = null;
  tile.dexId = spawnFor(tile.zone, state, ctx);
}

// จบการจับ: เก็บผล สุ่มตัวใหม่ลงช่อง แล้วจบหน้าที่ของช่อง
function resolveCatch(state, player, outcome, events, ctx) {
  const { caught, roll, total, target } = outcome;
  const tile = currentTile(state, player);
  const { dexId } = tile;
  if (caught) {
    const zone = zoneOfDex(ctx.pools, dexId);
    player.mons.push({ uid: state.nextUid++, dexId, zone, starter: false, fainted: false });
    if (isLegendary(dexId)) state.caughtLegendaries.push(dexId);
    events.push({ type: 'caught', playerId: player.id, dexId, roll, total, target });
  } else {
    events.push({ type: 'fled', playerId: player.id, dexId, roll, total, target });
  }
  respawn(state, tile, ctx);
  afterTile(state, events);
}

// Professor ที่ยังมีสิทธิ์ หรือ Pikachu ที่ยังไม่ใช้ ทอยจับใหม่ได้
const canRerollCatch = player => hasClassUse(player, 'professor') || hasStarterUse(player, 'pikachu');

// ทอยจับ 1 ครั้งด้วยบอล ball (ไม่หักบอลที่นี่) พลาดแล้วยังมีสิทธิ์ทอยใหม่ → step 'catch-failed'
// เก็บแต้มที่พลาดไว้ใน turn.roll เพื่อให้ ACCEPT รายงานผลได้ตรง
function attemptCatch(state, player, ball, source, events, ctx) {
  const { dexId } = currentTile(state, player);
  const zone = zoneOfDex(ctx.pools, dexId);
  const target = catchTarget(zone);
  const roll = rollD6(ctx.rng);
  const total = catchTotal(roll, ball, player.cls);
  const outcome = { caught: isCaught(total, zone), roll, total, target };

  if (!outcome.caught && canRerollCatch(player)) {
    state.turn.step = 'catch-failed';
    state.turn.ball = ball;
    state.turn.roll = roll;
    events.push({ type: 'rolled', playerId: player.id, value: roll, source });
    return;
  }
  resolveCatch(state, player, outcome, events, ctx);
}

function throwBall(state, player, action, events, ctx) {
  const { ball } = action;
  if (!isBall(ball)) throw new GameError('INVALID_ACTION', 'ชนิดบอลไม่ถูกต้อง');
  if (player.balls[ball] < 1) throw new GameError('NO_BALL', 'ไม่มีบอลชนิดนี้เหลืออยู่');
  player.balls[ball]--;
  attemptCatch(state, player, ball, 'catch', events, ctx);
}

function bulbasaurCatch(state, player, action, events, ctx) {
  requireStarter(player, 'bulbasaur');
  const { dexId } = currentTile(state, player);
  if (isLegendary(dexId)) throw new GameError('LEGENDARY', 'Bulbasaur จับตัวตำนานแบบการันตีไม่ได้');
  player.starterUsed = true;
  events.push({ type: 'ability', playerId: player.id, name: 'bulbasaur' });
  const target = catchTarget(zoneOfDex(ctx.pools, dexId));
  resolveCatch(state, player, { caught: true, roll: null, total: null, target }, events, ctx);
}

function professorReroll(state, player, action, events, ctx) {
  requireClassUse(player, 'professor');
  player.classUses--;
  events.push({ type: 'ability', playerId: player.id, name: 'professor' });
  attemptCatch(state, player, state.turn.ball, 'professor', events, ctx);
}

function pikachuCatchReroll(state, player, action, events, ctx) {
  requireStarter(player, 'pikachu');
  player.starterUsed = true;
  events.push({ type: 'ability', playerId: player.id, name: 'pikachu' });
  attemptCatch(state, player, state.turn.ball, 'pikachu', events, ctx);
}

function acceptFailedCatch(state, player, action, events, ctx) {
  const { dexId } = currentTile(state, player);
  const target = catchTarget(zoneOfDex(ctx.pools, dexId));
  const roll = state.turn.roll;
  const total = catchTotal(roll, state.turn.ball, player.cls);
  resolveCatch(state, player, { caught: false, roll, total, target }, events, ctx);
}

// ---------------- ร้านค้า ----------------

function buy(state, player, action, events) {
  const { ball, qty } = action;
  if (!isBall(ball)) throw new GameError('INVALID_ACTION', 'ชนิดบอลไม่ถูกต้อง');
  if (!Number.isInteger(qty) || qty < 1) throw new GameError('INVALID_ACTION', 'จำนวนที่ซื้อต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  const cost = ballPrice(ball, player.cls) * qty;
  if (player.money < cost) throw new GameError('NOT_ENOUGH_MONEY', 'เงินไม่พอ');
  player.money -= cost;
  player.balls[ball] += qty;
  events.push({ type: 'bought', playerId: player.id, ball, qty, cost });
}

function sell(state, player, action, events) {
  if (currentTile(state, player).type !== 'start') {
    throw new GameError('INVALID_ACTION', 'ขายโปเกม่อนได้เฉพาะที่จุดเริ่มต้น');
  }
  const mon = findMon(player, action.uid);
  if (!mon) throw new GameError('BAD_TARGET', 'ไม่พบโปเกม่อนตัวนี้');
  if (mon.starter) throw new GameError('BAD_TARGET', 'ขายตัวเริ่มต้นไม่ได้');
  if (mon.fainted) throw new GameError('BAD_TARGET', 'ขายโปเกม่อนที่หมดสภาพไม่ได้');
  const amount = monValue(mon);
  player.money += amount;
  player.mons = player.mons.filter(m => m !== mon);
  events.push({ type: 'sold', playerId: player.id, dexId: mon.dexId, amount });
}

// ---------------- ศูนย์รักษา ----------------

function heal(state, player, action, events) {
  const mon = findMon(player, action.uid);
  if (!mon) throw new GameError('BAD_TARGET', 'ไม่พบโปเกม่อนตัวนี้');
  if (!mon.fainted) throw new GameError('BAD_TARGET', 'โปเกม่อนตัวนี้ยังสู้ได้อยู่ ไม่ต้องรักษา');
  const cost = healCost(mon);
  if (player.money < cost) throw new GameError('NOT_ENOUGH_MONEY', 'เงินไม่พอ');
  player.money -= cost;
  mon.fainted = false;
  events.push({ type: 'healed', playerId: player.id, dexId: mon.dexId, cost });
}

// ลงทะเบียนเข้า HANDLERS ใน index.js (SKIP ของ catch และ DONE ของ shop/center ใช้ finishTile ใน index.js)
export const CATCH_HANDLERS = {
  THROW: throwBall,
  BULBASAUR_CATCH: bulbasaurCatch,
};
export const CATCH_FAILED_HANDLERS = {
  PROFESSOR_REROLL: professorReroll,
  PIKACHU_REROLL: pikachuCatchReroll,
  ACCEPT: acceptFailedCatch,
};
export const SHOP_HANDLERS = { BUY: buy, SELL: sell };
export const CENTER_HANDLERS = { HEAL: heal };
