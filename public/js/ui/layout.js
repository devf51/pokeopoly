// แปลง index ของช่อง (0-31) เป็นตำแหน่งในตาราง 9x9 (นับจาก 0) วนตามเข็มนาฬิกา
// เริ่มที่มุมขวาล่าง: แถวล่างไปทางซ้าย -> คอลัมน์ซ้ายขึ้นบน -> แถวบนไปทางขวา -> คอลัมน์ขวาลงล่าง
// ไม่มี DOM ในไฟล์นี้ เพื่อให้เทสต์ด้วย node ได้
export const GRID_SIZE = 9;
const LAST = GRID_SIZE - 1; // 8

export function cellFor(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LAST * 4) {
    throw new RangeError(`ช่องที่ ${index} ไม่อยู่บนกระดาน`);
  }
  if (index <= LAST) return { row: LAST, col: LAST - index }; // 0-8
  if (index <= LAST * 2) return { row: LAST * 2 - index, col: 0 }; // 9-16
  if (index <= LAST * 3) return { row: 0, col: index - LAST * 2 }; // 17-24
  return { row: index - LAST * 3, col: LAST }; // 25-31
}
