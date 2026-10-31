import { BOARD_SIZE, PROFESSOR_VISION } from '../constants.js';

const ENCOUNTER_STEPS = ['catch', 'catch-failed'];

// สำเนาสถานะสำหรับผู้เล่น viewerId: ซ่อนโปเกม่อนบนช่อง wild ทุกช่อง (dexId: null) ยกเว้น
// (ก) ช่องที่เจ้าของตายืนอยู่ระหว่างจับ (ทุกคนเห็น) (ข) ถ้าผู้ดูเป็น professor
// ช่องข้างหน้า 1..PROFESSOR_VISION ช่องจากตำแหน่งผู้ดูเอง วนรอบกระดาน
export function viewFor(state, viewerId) {
  const view = structuredClone(state);
  const visible = new Set();

  if (ENCOUNTER_STEPS.includes(state.turn.step)) {
    const owner = state.players.find(p => p.id === state.turn.playerId);
    visible.add(owner.position);
  }
  const viewer = state.players.find(p => p.id === viewerId);
  if (viewer?.cls === 'professor') {
    for (let d = 1; d <= PROFESSOR_VISION; d++) visible.add((viewer.position + d) % BOARD_SIZE);
  }

  for (const tile of view.board) {
    if (tile.type === 'wild' && !visible.has(tile.index)) tile.dexId = null;
  }
  return view;
}
