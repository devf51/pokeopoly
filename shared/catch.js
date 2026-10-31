import { BALLS, ZONE_TARGET, CATCHER_BONUS } from './constants.js';

export function catchTarget(zone) {
  return ZONE_TARGET[zone];
}

export function catchTotal(roll, ball, cls) {
  return roll + BALLS[ball].bonus + (cls === 'catcher' ? CATCHER_BONUS : 0);
}

export function isCaught(total, zone) {
  return total >= catchTarget(zone);
}
