// ฟังก์ชันสุ่มทั้งหมดรับ rng: () => number ในช่วง [0, 1) เสมอ ห้ามเรียก Math.random() ที่นี่

const DIE_SIDES = 6;

export function rollD6(rng) {
  return 1 + Math.floor(rng() * DIE_SIDES);
}

export function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Fisher–Yates คืน array ใหม่ ไม่แก้ array เดิม
export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
