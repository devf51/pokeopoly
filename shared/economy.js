import { BALLS, MERCHANT_DISCOUNT, SALARY, MERCHANT_SALARY, ZONE_VALUE, HEAL_RATE } from './constants.js';

export function ballPrice(ball, cls) {
  const price = BALLS[ball].price;
  return cls === 'merchant' ? Math.round(price * (1 - MERCHANT_DISCOUNT)) : price;
}

export function salaryFor(cls) {
  return cls === 'merchant' ? MERCHANT_SALARY : SALARY;
}

export function monValue(mon) {
  if (mon.starter) return 0;
  return ZONE_VALUE[mon.zone] ?? 0;
}

export function healCost(mon) {
  return Math.floor(monValue(mon) * HEAL_RATE);
}

export function finalTotals(player) {
  const value = player.mons
    .filter(m => !m.fainted)
    .reduce((sum, m) => sum + monValue(m), 0);
  return { money: player.money, monValue: value, total: player.money + value };
}
