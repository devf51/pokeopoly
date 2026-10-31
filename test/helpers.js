// ตัวช่วยเทสต์: rng ที่กำหนดค่าได้เพื่อให้ผลแน่นอน

// ค่า rng ที่ทำให้ rollD6 ได้ n (1..6)
export function die(n) {
  return (n - 0.5) / 6;
}

// คืนค่าตามลำดับ ถ้าหมดให้ throw
export function fixedRng(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++];
  };
}
