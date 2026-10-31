import { BATTLE_PENALTY_RATE, TYPE_ADVANTAGE_BONUS } from './constants.js';
import { SUPER_EFFECTIVE } from './types.js';

// จริงเมื่อธาตุใดธาตุหนึ่งของฝ่ายโจมตีชนะทางธาตุใดธาตุหนึ่งของฝ่ายรับ
export function hasTypeAdvantage(attTypes, defTypes) {
  return attTypes.some((a) => (SUPER_EFFECTIVE[a] ?? []).some((d) => defTypes.includes(d)));
}

// ได้เปรียบธาตุ +1 สูงสุดต่อฝ่าย (ไม่บวกซ้อน) และอาจได้ทั้งสองฝ่าย
// Charmander ฝ่ายเดียวชนะทันที (total เป็น null) ถ้าใช้ทั้งคู่ก็ทอยตามปกติ
export function resolveBattle({
  attackerRoll, defenderRoll, attackerTypes, defenderTypes, attackerCharmander, defenderCharmander,
}) {
  if (attackerCharmander !== defenderCharmander) {
    return { winner: attackerCharmander ? 'attacker' : 'defender', attackerTotal: null, defenderTotal: null };
  }
  const attackerTotal = attackerRoll + (hasTypeAdvantage(attackerTypes, defenderTypes) ? TYPE_ADVANTAGE_BONUS : 0);
  const defenderTotal = defenderRoll + (hasTypeAdvantage(defenderTypes, attackerTypes) ? TYPE_ADVANTAGE_BONUS : 0);
  let winner = 'draw';
  if (attackerTotal > defenderTotal) winner = 'attacker';
  else if (defenderTotal > attackerTotal) winner = 'defender';
  return { winner, attackerTotal, defenderTotal };
}

export function battlePenalty(money) {
  return Math.max(0, Math.floor(money * BATTLE_PENALTY_RATE));
}
