import { GameError } from './errors.js';

export const noUses = () => new GameError('NO_USES', 'ใช้ความสามารถนี้ไม่ได้ เพราะหมดแล้วหรือคลาส/ตัวเริ่มต้นไม่ตรง');

export function hasStarterUse(player, starter) {
  return player.starter === starter && !player.starterUsed;
}

export function hasClassUse(player, cls) {
  return player.cls === cls && player.classUses > 0;
}

export function requireStarter(player, starter) {
  if (!hasStarterUse(player, starter)) throw noUses();
}

export function requireClassUse(player, cls) {
  if (!hasClassUse(player, cls)) throw noUses();
}
