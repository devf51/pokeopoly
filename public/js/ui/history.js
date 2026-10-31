// แปลง event จากเซิร์ฟเวอร์เป็นบรรทัดประวัติภาษาไทย — ฟังก์ชันบริสุทธิ์ ไม่แตะ DOM ไม่ import อะไร
// names = { player(id) -> ชื่อผู้เล่น, mon(dexId) -> ชื่อโปเกม่อน, ball(ball) -> ชื่อบอล }
// ทุกตัวเลขในบรรทัดมาจาก event (ผลที่เซิร์ฟเวอร์ตัดสินแล้ว) ที่นี่ไม่คำนวณผลใหม่

export const HISTORY_LIMIT = 10;

const cap = text => text.charAt(0).toUpperCase() + text.slice(1);

// ผลต่างระหว่างแต้มรวมกับแต้มลูกเต๋า = โบนัสบอล/คลาส ที่เซิร์ฟเวอร์บวกให้แล้ว (ใช้แสดงว่า "ทอย 4 + 0")
function catchDetail({ roll, total, target }, comparator) {
  return `ทอย ${roll} + ${total - roll} ${comparator} ${target}`;
}

export function describeEvent(ev, names) {
  const who = id => names.player(id);
  switch (ev.type) {
    case 'rolled': {
      const p = who(ev.playerId);
      if (ev.source === 'roll') return `${p} ทอยลูกเต๋าได้ ${ev.value}`;
      if (ev.source === 'catch') return `${p} ทอยจับได้ ${ev.value}`;
      if (ev.source === 'ranger') return `${p} เดินได้ ${ev.value} ก้าว`;
      if (ev.source === 'professor') return `${p} ทอยจับใหม่ได้ ${ev.value}`;
      return `${p} ทอยใหม่ได้ ${ev.value}`;
    }
    case 'moved':
      return `${who(ev.playerId)} เดิน ${ev.steps} ก้าว จากช่อง ${ev.from + 1} ไปช่อง ${ev.to + 1}`;
    case 'salary':
      return `${who(ev.playerId)} ผ่านจุดเริ่มต้น ได้เงินเดือน ${ev.amount}`;
    case 'finished':
      return `${who(ev.playerId)} เข้าเส้นชัยแล้ว${ev.bonus > 0 ? ` ได้โบนัสคนแรก ${ev.bonus}` : ''}`;
    case 'ability':
      return `${who(ev.playerId)} ใช้ความสามารถ ${cap(ev.name)}`;
    case 'caught': {
      const p = who(ev.playerId);
      const mon = names.mon(ev.dexId);
      // Bulbasaur จับแน่นอน: เซิร์ฟเวอร์ส่ง roll/total เป็น null
      if (ev.roll == null || ev.total == null) return `${p} จับ ${mon} ได้! (จับสำเร็จแน่นอน)`;
      return `${p} จับ ${mon} ได้! (${catchDetail(ev, '≥')})`;
    }
    case 'fled': {
      const p = who(ev.playerId);
      const mon = names.mon(ev.dexId);
      if (ev.roll == null || ev.total == null) return `${p} จับ ${mon} ไม่ได้ ${mon} หนีไป`;
      return `${p} จับ ${mon} ไม่ได้ ${mon} หนีไป (${catchDetail(ev, '<')})`;
    }
    case 'bought':
      return `${who(ev.playerId)} ซื้อ ${names.ball(ev.ball)} ${ev.qty} ลูก (จ่าย ${ev.cost})`;
    case 'sold':
      return `${who(ev.playerId)} ขาย ${names.mon(ev.dexId)} ได้เงิน ${ev.amount}`;
    case 'healed':
      return `${who(ev.playerId)} รักษา ${names.mon(ev.dexId)} ${ev.cost > 0 ? `(จ่าย ${ev.cost})` : '(ฟรี)'}`;
    case 'battle': {
      const a = who(ev.attackerId);
      const d = who(ev.defenderId);
      const totals = ev.attackerTotal == null || ev.defenderTotal == null
        ? 'ด้วยความสามารถ Charmander'
        : `(${a} ${ev.attackerTotal} : ${ev.defenderTotal} ${d})`;
      if (!ev.winnerId) return `${a} ท้าสู้ ${d} เสมอกัน ${totals}`;
      const winner = who(ev.winnerId);
      const loser = ev.winnerId === ev.attackerId ? d : a;
      return `${winner} ชนะ ${loser} ${totals} ${loser} จ่ายค่าปรับ ${ev.penalty}`;
    }
    case 'turn':
      return `ถึงตาของ ${who(ev.playerId)}`;
    case 'gameOver':
      return 'เกมจบแล้ว';
    default:
      return null;
  }
}

// moved ต้องมาก่อน salary/finished ที่เกิดระหว่างทาง (เซิร์ฟเวอร์ push salary ก่อน moved)
// ทั้งตัวหมากและประวัติจึงเล่าเรื่องเดียวกัน: เดินก่อน แล้วค่อยรับเงินเดือน
export function orderEvents(events) {
  const out = [];
  let pending = [];
  for (const ev of events) {
    if (ev.type === 'salary' || ev.type === 'finished') {
      pending.push(ev);
    } else if (ev.type === 'moved') {
      out.push(ev, ...pending);
      pending = [];
    } else {
      out.push(...pending, ev);
      pending = [];
    }
  }
  out.push(...pending);
  return out;
}

export function describeEvents(events, names) {
  return orderEvents(events).map(ev => describeEvent(ev, names)).filter(Boolean);
}

// เพิ่มบรรทัดใหม่ต่อท้ายประวัติเดิม เหลือล่าสุด limit บรรทัด (บรรทัดใหม่สุดอยู่ท้าย)
export function appendHistory(history, events, names, limit = HISTORY_LIMIT) {
  return [...history, ...describeEvents(events, names)].slice(-limit);
}
