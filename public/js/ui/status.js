// ข้อความสถานะของผู้เล่นสำหรับแผงข้อมูล — ฟังก์ชันบริสุทธิ์ ไม่แตะ DOM
import { CLASS_USES, LAPS_TO_FINISH } from '../../../shared/constants.js';
import { finalTotals } from '../../../shared/economy.js';
import { STARTER_INFO } from './info.js';

// คลาสที่ความสามารถเป็นแบบ "ติดตัว" ไม่จำกัดครั้ง
const PASSIVE = new Set(['catcher', 'merchant']);

// บรรทัดความสามารถที่เหลือ เช่น ['Ranger เหลือ 2/2 ครั้ง', 'Pikachu พร้อมใช้']
export function abilityLines(player) {
  const cls = player.cls.charAt(0).toUpperCase() + player.cls.slice(1);
  const classLine = PASSIVE.has(player.cls)
    ? `${cls} ใช้ได้ตลอดเกม`
    : `${cls} เหลือ ${player.classUses}/${CLASS_USES} ครั้ง`;
  const starter = STARTER_INFO[player.starter]?.name ?? player.starter;
  return [classLine, `${starter} ${player.starterUsed ? 'ใช้ความสามารถแล้ว' : 'พร้อมใช้'}`];
}

export function lapText(player) {
  return player.finished ? 'เข้าเส้นชัยแล้ว' : `เดินแล้ว ${player.laps}/${LAPS_TO_FINISH} รอบ`;
}

// มูลค่าโปเกม่อนที่ยังสู้ได้ ตอนนี้ (ตัวเริ่มต้นและตัวที่หมดสภาพนับ 0) — ใช้แสดงเท่านั้น ผลจบเกมจริงมาจากเซิร์ฟเวอร์
export function currentMonValue(player) {
  return finalTotals(player).monValue;
}

// อันดับสำหรับตารางผลการแข่ง: ผู้ที่คะแนนเท่ากันได้อันดับเดียวกัน (ลำดับในตารางมาจากเซิร์ฟเวอร์)
export function rankLabels(ranking) {
  return ranking.map(r => 1 + ranking.filter(o => o.total > r.total).length);
}
