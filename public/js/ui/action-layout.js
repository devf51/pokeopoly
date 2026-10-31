// แบ่ง section ของโมเดลปุ่ม (จาก action-model.js) เป็นสองส่วนของการ์ดคำสั่ง
// body = ตัวเลือกและรายละเอียด (เลื่อนได้ในการ์ด)
// footer = ปุ่มหลักของ step ที่ต้องเห็นเสมอ (ติดล่างการ์ด ไม่เลื่อนหายไป)
// ลำดับเดิมของ section คงไว้ทั้งสองฝั่ง
export const FOOTER_SECTION_IDS = ['main', 'throw', 'retry', 'done'];

export function splitActionSections(sections) {
  const body = [];
  const footer = [];
  for (const section of sections) {
    const pinned = section.kind === 'buttons' && FOOTER_SECTION_IDS.includes(section.id);
    (pinned ? footer : body).push(section);
  }
  return { body, footer };
}
