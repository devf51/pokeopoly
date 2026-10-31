// ตัวเลขกติกาทั้งหมดของเกมอยู่ที่นี่ ไฟล์อื่นห้ามเขียนตัวเลขกติกาตรงๆ

export const BOARD_SIZE = 32;
export const LAPS_TO_FINISH = 2;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const STARTING_MONEY = 500;
export const STARTING_BALLS = { poke: 5, great: 0, ultra: 0 };

export const SALARY = 200;
export const MERCHANT_SALARY = 300;
export const FIRST_FINISHER_BONUS = 300;

export const BALLS = {
  poke: { bonus: 0, price: 50 },
  great: { bonus: 1, price: 120 },
  ultra: { bonus: 2, price: 250 },
};
export const MERCHANT_DISCOUNT = 0.3;

export const ZONE_TARGET = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, legendary: 7 };
export const ZONE_VALUE = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 800, legendary: 2000 };

export const LEGENDARY_IDS = [144, 145, 146, 150, 151];
export const LEGENDARY_CHANCE = 0.05;

export const HEAL_RATE = 0.2;
export const BATTLE_PENALTY_RATE = 0.1;

export const CLASS_USES = 2;
export const PROFESSOR_VISION = 6;
export const SQUIRTLE_MAX_WARP = 6;

export const TURN_TIMEOUT_MS = 60000;
export const ROOM_IDLE_MS = 600000;

export const CLASSES = ['catcher', 'merchant', 'ranger', 'professor'];
// ชื่อตัวเริ่มต้น -> dexId
export const STARTERS = { bulbasaur: 1, charmander: 4, squirtle: 7, pikachu: 25 };
