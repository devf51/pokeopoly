// สร้าง DOM แบบสั้นๆ ข้อความทุกอย่างใส่ผ่าน textContent เพื่อไม่ให้ชื่อผู้เล่นฉีด HTML ได้
// h('button', { class: 'btn', onclick }, 'ข้อความ', childNode)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [name, v] of Object.entries(value)) {
        if (name.startsWith('--')) el.style.setProperty(name, v);
        else el.style[name] = v;
      }
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, value);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  el.replaceChildren();
}

// สร้างหน้าใหม่แล้วค่อยแทนของเก่า แต่คืนโฟกัสให้ปุ่มเดิม (ผู้ใช้คีย์บอร์ดไม่หลุดโฟกัสทุกครั้งที่มีอัปเดต)
export function rerender(root, build) {
  const key = document.activeElement?.dataset?.key;
  root.replaceChildren(...[].concat(build()));
  if (key) root.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}

// รูป sprite: ถ้าโหลดไม่ได้ให้ซ่อน (alt ยังอยู่ใน title ของพ่อแม่)
export function sprite(pokedexById, dexId, className = 'sprite') {
  const mon = pokedexById.get(dexId);
  if (!mon) return h('span', { class: `${className} sprite-missing`, 'aria-hidden': 'true' }, '?');
  const img = h('img', {
    class: className, src: mon.sprite, alt: mon.name, loading: 'lazy', decoding: 'async',
    width: 96, height: 96,
  });
  img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
  return img;
}
