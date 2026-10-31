import { BOARD_SIZE } from './constants.js';

// S = จุดเริ่มต้น, M = Poké Mart, C = Pokémon Center, ตัวเลข = โซนป่า (Plan Decisions ข้อ 2)
const LAYOUT = [
  'S', 1, 1, 1, 'M', 1, 1, 1, 2, 2, 2, 'C', 2, 2, 2,
  3, 3, 3, 3, 3, 'M', 4, 4, 4, 4, 4, 'C', 5, 5, 5, 5, 5,
];

if (LAYOUT.length !== BOARD_SIZE) throw new Error('board layout does not match BOARD_SIZE');

const SPECIAL = { S: 'start', M: 'mart', C: 'center' };

export function buildBoard() {
  return LAYOUT.map((cell, index) => {
    const special = SPECIAL[cell];
    return special
      ? { index, type: special, zone: null, dexId: null }
      : { index, type: 'wild', zone: cell, dexId: null };
  });
}
