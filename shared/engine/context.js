import { buildPools } from '../pokedex.js';

// ctx = สิ่งที่ engine ต้องใช้จากภายนอก: ข้อมูลโปเกเด็กซ์ และตัวสุ่ม (ความสุ่มทุกอย่างมาจาก ctx.rng เท่านั้น)
export function makeContext(pokedex, rng = Math.random) {
  return {
    pokedex,
    byId: new Map(pokedex.map(p => [p.id, p])),
    pools: buildPools(pokedex),
    rng,
  };
}
