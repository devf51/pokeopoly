import { h } from './dom.js';

// ลูกเต๋าสำหรับแสดงผลเท่านั้น: ค่าที่หยุดมาจากเซิร์ฟเวอร์ ระหว่างหมุนวนหน้าตามลำดับคงที่ (ไม่สุ่มเอง)
export const DICE_SPIN_MS = 600;
const SPIN_FRAME_MS = 70;
const SPIN_FACES = [3, 6, 2, 5, 1, 4];

// ตำแหน่งจุดบนตาราง 3x3 (1..9 ซ้ายบน -> ขวาล่าง)
const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createDie() {
  return h('div', { class: 'die', role: 'img', 'aria-label': 'ลูกเต๋า' });
}

// 1-6 วาดเป็นจุด ค่าอื่น (เช่น ผลรวมสู้ หรือ Ranger เดิน 7 ก้าว) แสดงเป็นตัวเลข
export function setDieValue(die, value) {
  die.dataset.value = String(value);
  die.setAttribute('aria-label', `ลูกเต๋า ${value}`);
  if (PIPS[value]) {
    die.classList.remove('is-number');
    die.replaceChildren(...PIPS[value].map(cell => h('i', { class: 'pip', style: { gridArea: `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}` } })));
  } else {
    die.classList.add('is-number');
    die.replaceChildren(h('span', { class: 'die-number' }, value == null ? '–' : String(value)));
  }
}

const running = new WeakMap();

// หมุนลูกเต๋าใน el ประมาณ DICE_SPIN_MS แล้วหยุดที่ value; คืน Promise ที่เสร็จตอนหยุด
// เรียกซ้ำบน el เดิม = จบอันเก่าทันที (หยุดที่ค่าของมัน) แล้วเริ่มอันใหม่
export function animateDice(el, value, { duration = DICE_SPIN_MS } = {}) {
  running.get(el)?.finish();
  let die = el.querySelector(':scope > .die');
  if (!die) {
    die = createDie();
    el.append(die);
  }
  if (prefersReducedMotion() || duration <= 0) {
    setDieValue(die, value);
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let frame = 0;
    let timer = null;
    let stop = null;
    const finish = () => {
      clearInterval(timer);
      clearTimeout(stop);
      running.delete(el);
      die.classList.remove('is-rolling');
      setDieValue(die, value);
      resolve();
    };
    running.set(el, { finish });
    die.classList.add('is-rolling');
    setDieValue(die, SPIN_FACES[0]);
    timer = setInterval(() => setDieValue(die, SPIN_FACES[++frame % SPIN_FACES.length]), SPIN_FRAME_MS);
    stop = setTimeout(finish, duration);
  });
}
