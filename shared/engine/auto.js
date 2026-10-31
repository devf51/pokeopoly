import { actorOf } from './index.js';

// action ที่ระบบเล่นแทนเมื่อผู้เล่นหมดเวลา/หลุด เลือกทางที่ไม่เสี่ยงและไม่ใช้ความสามารถ
const AUTO_TYPE = {
  roll: 'ROLL',
  move: 'CONFIRM_MOVE',
  catch: 'SKIP',
  'catch-failed': 'ACCEPT',
  shop: 'DONE',
  center: 'DONE',
  challenge: 'SKIP',
};

// คืน { actorId, action } ของ step ปัจจุบัน หรือ null ถ้าเกมจบแล้ว
export function autoAction(state) {
  if (state.phase !== 'playing') return null;
  const { step } = state.turn;
  const actorId = actorOf(state);
  if (step === 'defend') {
    const defender = state.players.find(p => p.id === actorId);
    const mon = defender.mons.find(m => !m.fainted);
    return { actorId, action: { type: 'DEFEND', uid: mon.uid, charmander: false } };
  }
  return { actorId, action: { type: AUTO_TYPE[step] } };
}
