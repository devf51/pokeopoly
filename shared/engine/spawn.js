import { LEGENDARY_CHANCE, LEGENDARY_IDS } from '../constants.js';
import { pick } from '../rng.js';

const LEGENDARY_ZONE = 5;

// ตัวตำนานที่ยังออกได้ = ยังไม่ถูกจับ และไม่ได้รออยู่บนช่องใดของกระดาน (Plan Decisions ข้อ 4)
function availableLegendaries(state) {
  const onBoard = new Set(state.board.map(t => t.dexId));
  return LEGENDARY_IDS.filter(id => !state.caughtLegendaries.includes(id) && !onBoard.has(id));
}

// สุ่มโปเกม่อน 1 ตัวสำหรับช่องโซน zone
// โซน 5 ทอย ctx.rng() < LEGENDARY_CHANCE ก่อน ถ้าถึงเกณฑ์และยังมีตัวตำนานเหลือจึงเลือกตัวตำนาน
// ถ้าไม่เหลือสักตัว ให้สุ่มตัวปกติจากโซนแทน
export function spawnFor(zone, state, ctx) {
  if (zone === LEGENDARY_ZONE && ctx.rng() < LEGENDARY_CHANCE) {
    const available = availableLegendaries(state);
    if (available.length > 0) return pick(available, ctx.rng);
  }
  return pick(ctx.pools[zone], ctx.rng);
}
