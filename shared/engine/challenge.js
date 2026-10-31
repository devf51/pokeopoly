import { battlePenalty, resolveBattle } from '../battle.js';
import { rollD6 } from '../rng.js';
import { requireStarter } from './abilities.js';
import { GameError } from './errors.js';
import { endTurn } from './turn.js';

const isHealthy = mon => !mon.fainted;
const hasHealthyMon = player => player.mons.some(isHealthy);

// ผู้เล่นที่ท้าได้: คนอื่นที่อยู่ช่องเดียวกัน ยังไม่ finished และมี Mon ที่ยังสู้ได้
// ถ้าผู้ท้าเองเข้าเส้นชัยแล้วหรือหมดสภาพทุกตัว ท้าใครไม่ได้ (Plan Decisions ข้อ 9, Review Focus ข้อ 3)
export function challengeTargets(state, player) {
  if (player.finished || !hasHealthyMon(player)) return [];
  return state.players.filter(other =>
    other.id !== player.id
    && other.position === player.position
    && !other.finished
    && hasHealthyMon(other));
}

function requireFighter(player, uid) {
  const mon = player.mons.find(m => m.uid === uid);
  if (!mon || mon.fainted) throw new GameError('BAD_TARGET', 'เลือกโปเกม่อนที่ยังสู้ได้ของคุณเท่านั้น');
  return mon;
}

// charmander ต้องเป็น boolean (หรือไม่ส่ง) และใช้ได้เมื่อตัวเริ่มต้นเป็น charmander ที่ยังไม่ใช้
function readCharmander(player, action) {
  const { charmander = false } = action;
  if (typeof charmander !== 'boolean') throw new GameError('INVALID_ACTION', 'ค่า charmander ต้องเป็น true หรือ false');
  if (charmander) requireStarter(player, 'charmander');
  return charmander;
}

function challenge(state, player, action) {
  const target = challengeTargets(state, player).find(p => p.id === action.targetId);
  if (!target) throw new GameError('BAD_TARGET', 'ท้าผู้เล่นคนนี้ไม่ได้');
  requireFighter(player, action.uid);
  const attackerCharmander = readCharmander(player, action);
  state.turn.step = 'defend';
  state.turn.battle = {
    attackerId: player.id,
    defenderId: target.id,
    attackerUid: action.uid,
    attackerCharmander,
  };
}

function skipChallenge(state, player, action, events) {
  endTurn(state, events);
}

function defend(state, player, action, events, ctx) {
  const battle = state.turn.battle;
  const attacker = state.players.find(p => p.id === battle.attackerId);
  const defender = player;
  const defenderMon = requireFighter(defender, action.uid);
  const defenderCharmander = readCharmander(defender, action);
  const attackerMon = attacker.mons.find(m => m.uid === battle.attackerUid);
  const attackerCharmander = battle.attackerCharmander;

  // Charmander ฝ่ายเดียวชนะทันทีโดยไม่ทอย ถ้าใช้ทั้งคู่หักล้างกันและทอยตามปกติ
  const decidedByCharmander = attackerCharmander !== defenderCharmander;
  const attackerRoll = decidedByCharmander ? null : rollD6(ctx.rng);
  const defenderRoll = decidedByCharmander ? null : rollD6(ctx.rng);
  const result = resolveBattle({
    attackerRoll,
    defenderRoll,
    attackerTypes: ctx.byId.get(attackerMon.dexId).types,
    defenderTypes: ctx.byId.get(defenderMon.dexId).types,
    attackerCharmander,
    defenderCharmander,
  });

  if (attackerCharmander) attacker.starterUsed = true;
  if (defenderCharmander) defender.starterUsed = true;

  let winner = null;
  let loser = null;
  let loserMon = null;
  if (result.winner === 'attacker') [winner, loser, loserMon] = [attacker, defender, defenderMon];
  else if (result.winner === 'defender') [winner, loser, loserMon] = [defender, attacker, attackerMon];

  let penalty = 0;
  if (winner) {
    loserMon.fainted = true;
    penalty = battlePenalty(loser.money);
    loser.money -= penalty;
    winner.money += penalty;
  }
  events.push({
    type: 'battle',
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerTotal: result.attackerTotal,
    defenderTotal: result.defenderTotal,
    winnerId: winner ? winner.id : null,
    penalty,
  });
  endTurn(state, events);
}

export const CHALLENGE_HANDLERS = { CHALLENGE: challenge, SKIP: skipChallenge };
export const DEFEND_HANDLERS = { DEFEND: defend };
