// ข้อมูลสำหรับแสดงผล (ชื่อไทย คำอธิบาย) ตัวเลขดึงจาก shared/constants.js ไม่เขียนซ้ำ
// import แบบ relative (../../../shared) ได้ URL เดียวกับ /shared ในเบราว์เซอร์ และ Node ใช้เทสต์โมดูลนี้ได้
import {
  CATCHER_BONUS, CLASS_USES, MERCHANT_DISCOUNT, MERCHANT_SALARY, PROFESSOR_VISION,
  SQUIRTLE_MAX_WARP, STARTERS,
} from '../../../shared/constants.js';

const discountPercent = Math.round(MERCHANT_DISCOUNT * 100);

export const CLASS_INFO = {
  catcher: {
    name: 'นักจับ', en: 'Catcher',
    desc: `ทอยจับโปเกม่อนได้ +${CATCHER_BONUS} เสมอ`,
  },
  merchant: {
    name: 'พ่อค้า', en: 'Merchant',
    desc: `ซื้อบอลลดราคา ${discountPercent}% และได้เงินเดือน ${MERCHANT_SALARY} ทุกครั้งที่ผ่านจุดเริ่มต้น`,
  },
  ranger: {
    name: 'นักเดินทาง', en: 'Ranger',
    desc: `ทอยเดินใหม่ หรือขยับบวกลบ 1 ช่อง รวม ${CLASS_USES} ครั้งต่อเกม (ใช้โควตาร่วมกัน)`,
  },
  professor: {
    name: 'นักวิจัย', en: 'Professor',
    desc: `เห็นโปเกม่อนใน ${PROFESSOR_VISION} ช่องข้างหน้าตลอดเกม และทอยจับใหม่ได้ ${CLASS_USES} ครั้งต่อเกม`,
  },
};

export const STARTER_INFO = {
  bulbasaur: { name: 'Bulbasaur', desc: 'จับสำเร็จแน่นอน 1 ครั้ง (ยกเว้นตัวตำนาน)' },
  charmander: { name: 'Charmander', desc: 'ชนะการต่อสู้อัตโนมัติ 1 ครั้ง' },
  squirtle: { name: 'Squirtle', desc: `วาร์ปไปช่องไหนก็ได้ภายใน ${SQUIRTLE_MAX_WARP} ช่องข้างหน้า` },
  pikachu: { name: 'Pikachu', desc: 'ทอยเต๋าเดินหรือทอยจับใหม่ 1 ครั้ง' },
};

export const STARTER_DEX = STARTERS;

export const BALL_INFO = {
  poke: { name: 'Poké Ball' },
  great: { name: 'Great Ball' },
  ultra: { name: 'Ultra Ball' },
};

// ข้อความของแต่ละ step (ตาราง Actions ต่อ step)
export const STEP_LABEL = {
  roll: 'ทอยลูกเต๋าเดินหมาก',
  move: 'ยืนยันการเดิน',
  catch: 'จับโปเกม่อน',
  'catch-failed': 'จับไม่สำเร็จ',
  shop: 'ร้านค้า',
  center: 'ศูนย์รักษา',
  challenge: 'เลือกคนที่จะท้าสู้',
  defend: 'ถูกท้าสู้ เลือกโปเกม่อนที่จะสู้',
};

// ชื่อธาตุ (ข้อมูลใน pokedex.json เป็นภาษาอังกฤษตัวเล็ก) แสดงเป็นไทย
export const TYPE_NAME = {
  normal: 'ปกติ', fire: 'ไฟ', water: 'น้ำ', electric: 'ไฟฟ้า', grass: 'หญ้า', ice: 'น้ำแข็ง',
  fighting: 'ต่อสู้', poison: 'พิษ', ground: 'ดิน', flying: 'บิน', psychic: 'พลังจิต',
  bug: 'แมลง', rock: 'หิน', ghost: 'ผี', dragon: 'มังกร',
};

export const TILE_NAME = { start: 'จุดเริ่มต้น', mart: 'Poké Mart', center: 'Pokémon Center' };

export const className = cls => `${CLASS_INFO[cls]?.name ?? ''} (${CLASS_INFO[cls]?.en ?? ''})`;
