import { LEGENDARY_IDS, ZONE_VALUE } from './constants.js';

// โซนปกติ = คีย์ตัวเลขของ ZONE_VALUE (ไม่รวม legendary)
const ZONES = Object.keys(ZONE_VALUE).filter(k => k !== 'legendary').map(Number);

// แบ่งโปเกม่อนที่ไม่ใช่ตัวตำนานเป็น 5 โซนตาม BST (น้อย -> มาก, เท่ากันเรียงตาม id)
// ขนาดกลุ่มแบ่งเท่าๆ กัน ส่วนที่เหลือจากการหารลงที่โซนแรกๆ (146 ตัว -> 30/29/29/29/29)
export function buildPools(pokedex) {
  const legendary = LEGENDARY_IDS.slice().sort((a, b) => a - b);
  const sorted = pokedex
    .filter(p => !LEGENDARY_IDS.includes(p.id))
    .sort((a, b) => a.bst - b.bst || a.id - b.id);

  const base = Math.floor(sorted.length / ZONES.length);
  const extra = sorted.length % ZONES.length;
  const pools = { legendary };
  let start = 0;
  ZONES.forEach((zone, i) => {
    const size = base + (i < extra ? 1 : 0);
    pools[zone] = sorted.slice(start, start + size).map(p => p.id);
    start += size;
  });
  return pools;
}

export function zoneOfDex(pools, dexId) {
  if (pools.legendary.includes(dexId)) return 'legendary';
  for (const zone of ZONES) if (pools[zone].includes(dexId)) return zone;
  throw new Error(`ไม่พบโปเกม่อนหมายเลข ${dexId} ในโซนใดเลย`);
}
