import { h, rerender, sprite } from './dom.js';
import { buildActionModel } from './action-model.js';

// วาดปุ่ม action ตามโมเดลจาก action-model.js (ปุ่มตรงกับตาราง "Actions ต่อ step")
// แสดงปุ่มเฉพาะเมื่อ actorOf เป็นเรา; ปุ่มที่ใช้ไม่ได้ disabled พร้อมเหตุผลภาษาไทย
// หน้านี้ไม่ตัดสินผลใดๆ: กดแล้วส่ง action ผ่าน send(action) แล้วรอ room:update จากเซิร์ฟเวอร์
//
// send(action) -> Promise (reject ด้วย Error ที่ message เป็นภาษาไทยจากเซิร์ฟเวอร์)
const BUSY_FAILSAFE_MS = 5000;

// สถานะของ el แต่ละอัน: ค่าที่เลือกค้าง, กำลังรอเซิร์ฟเวอร์, ข้อความ error
const states = new WeakMap();

function stateOf(el) {
  let st = states.get(el);
  if (!st) {
    st = { key: null, selection: {}, busy: false, error: '', sentRoom: null, failsafe: null, last: null };
    states.set(el, st);
  }
  return st;
}

export function renderActions(el, room, myId, send, pokedexById) {
  const st = stateOf(el);
  st.last = { room, myId, send, pokedexById };
  // room ใหม่มาถึง = เซิร์ฟเวอร์ตอบแล้ว ปลดสถานะรอ และล้าง error เก่า
  if (st.sentRoom && st.sentRoom !== room) {
    st.busy = false;
    st.sentRoom = null;
    clearTimeout(st.failsafe);
  }
  draw(el, st, st.sentRoom === room ? null : room);
}

function draw(el, st, freshRoom) {
  const { room, myId, send, pokedexById } = st.last;
  if (freshRoom) st.error = '';
  const model = buildActionModel(room.game, myId, pokedexById, st.selection);
  if (!model) {
    el.replaceChildren();
    return;
  }
  if (st.key !== model.key) {
    // ขั้นตอนใหม่: เริ่มเลือกใหม่ (ค่าเดิมอาจไม่ตรงกับตัวเลือกของ step นี้)
    st.key = model.key;
    st.selection = {};
    st.error = '';
    return draw(el, st, null);
  }
  st.selection = model.selection;

  const redraw = () => draw(el, st, null);
  const run = action => submit(el, st, action);
  rerender(el, () => buildCard(model, st, { run, redraw, pokedexById }));
}

async function submit(el, st, action) {
  const { send, room } = st.last;
  if (st.busy) return;
  st.busy = true;
  st.sentRoom = room;
  st.error = '';
  draw(el, st, null);
  clearTimeout(st.failsafe);
  // ถ้า room:update ไม่มา (เช่น ack สำเร็จแต่หลุดการเชื่อมต่อ) อย่าปล่อยให้ปุ่มค้างตลอดไป
  st.failsafe = setTimeout(() => {
    if (!st.busy) return;
    st.busy = false;
    st.sentRoom = null;
    draw(el, st, null);
  }, BUSY_FAILSAFE_MS);
  try {
    await send(action);
  } catch (err) {
    clearTimeout(st.failsafe);
    st.busy = false;
    st.sentRoom = null;
    st.error = err?.message || 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง';
    draw(el, st, null);
  }
}

// ---------- DOM ----------

function buildCard(model, st, ctx) {
  if (!model.mine) {
    return [h('section', { class: 'card wait-card', role: 'status' }, h('p', {}, model.summary[0]))];
  }
  return [h('section', { class: 'card actions-card is-mine', 'aria-busy': st.busy ? 'true' : undefined, 'aria-labelledby': 'actions-title' },
    h('h2', { id: 'actions-title', class: 'section-title' }, model.title),
    model.summary.map(line => h('p', { class: 'action-summary' }, line)),
    st.error && h('p', { class: 'form-error', role: 'alert' }, st.error),
    model.sections.map(section => buildSection(section, model, st, ctx)))];
}

function buildSection(section, model, st, ctx) {
  switch (section.kind) {
    case 'encounter': return buildEncounter(section, ctx);
    case 'foe': return buildFoe(section, ctx);
    case 'buttons': return buildButtons(section, st, ctx);
    case 'qty': return buildQty(section, st, ctx);
    case 'pick': return buildPick(section, st, ctx);
    case 'toggle': return buildToggle(section, st, ctx);
    default: return null;
  }
}

function buildEncounter(s, { pokedexById }) {
  return h('div', { class: `encounter${s.legendary ? ' is-legendary' : ''}` },
    sprite(pokedexById, s.dexId, 'encounter-sprite'),
    h('div', { class: 'encounter-info' },
      h('strong', { class: 'encounter-name' }, s.name),
      h('span', {}, `${s.zoneText} · ต้องทอยให้ได้ ${s.target}+ · มูลค่า ${s.value}`),
      s.legendary && h('span', { class: 'muted' }, 'ตัวตำนานจับยาก ต้องมีโบนัสบอลช่วย')));
}

function buildFoe(s, { pokedexById }) {
  return h('div', { class: 'encounter' },
    sprite(pokedexById, s.dexId, 'encounter-sprite'),
    h('div', { class: 'encounter-info' },
      h('span', { class: 'muted' }, 'โปเกม่อนของคนท้า'),
      h('strong', { class: 'encounter-name' }, s.name),
      h('span', {}, s.detail)));
}

function buildButtons(section, st, { run, pokedexById }) {
  const list = h('div', { class: `act-grid act-${section.layout ?? 'row'}` },
    section.items.map(item => buildControl(item, st, run, pokedexById)));
  return h('div', { class: 'act-group' },
    section.title && h('h3', { class: 'group-title' }, section.title),
    section.note && h('p', { class: section.noteIsReason ? 'reason' : 'section-note' }, section.note),
    list);
}

function buildControl(item, st, run, pokedexById) {
  const reasonId = item.disabled && item.reason && item.showReason ? `why-${item.key}` : undefined;
  const button = h('button', {
    class: `btn act-btn ${item.variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`,
    type: 'button',
    disabled: item.disabled || st.busy,
    'aria-describedby': reasonId,
    dataset: { key: item.key },
    onclick: () => run(item.action),
  },
  item.dexId && sprite(pokedexById, item.dexId, 'act-sprite'),
  h('span', { class: 'act-text' },
    h('span', { class: 'act-label' }, item.label),
    item.detail && h('span', { class: 'act-detail' }, item.detail)));
  return h('div', { class: `act${item.disabled ? ' is-disabled' : ''}` },
    button,
    reasonId && h('p', { class: 'reason', id: reasonId }, item.reason));
}

// ปุ่มเลือก (radio) ที่เก็บค่าไว้ใน st.selection แล้ววาดใหม่ ไม่ส่งอะไรไปเซิร์ฟเวอร์
function chip(label, detail, selected, onpick, { dexId, pokedexById, disabled, key }) {
  return h('button', {
    class: `chip${selected ? ' is-selected' : ''}`,
    type: 'button',
    role: 'radio',
    'aria-checked': selected ? 'true' : 'false',
    disabled,
    dataset: { key },
    onclick: onpick,
  },
  dexId && sprite(pokedexById, dexId, 'chip-sprite'),
  h('span', { class: 'act-text' },
    h('span', { class: 'act-label' }, label),
    detail && h('span', { class: 'act-detail' }, detail)));
}

function buildQty(section, st, { redraw, pokedexById }) {
  const pick = n => () => {
    st.selection = { ...st.selection, qty: n };
    redraw();
  };
  return h('div', { class: 'act-group' },
    h('h3', { class: 'group-title' }, section.title),
    h('div', { class: 'chips chips-qty', role: 'radiogroup', 'aria-label': section.title },
      section.options.map(n => chip(`${n} ลูก`, null, n === section.selected, pick(n), { key: `qty-${n}`, disabled: st.busy, pokedexById }))));
}

function buildPick(section, st, { redraw, pokedexById }) {
  const pick = value => () => {
    st.selection = { ...st.selection, [section.field]: value };
    redraw();
  };
  return h('div', { class: 'act-group' },
    h('h3', { class: 'group-title' }, section.title),
    section.options.length === 0
      ? h('p', { class: 'reason' }, 'ไม่มีตัวเลือก')
      : h('div', { class: 'chips', role: 'radiogroup', 'aria-label': section.title },
        section.options.map(o => chip(o.label, o.detail, o.value === section.selected, pick(o.value), {
          key: `${section.field}-${o.value}`, dexId: o.dexId, pokedexById, disabled: st.busy,
        }))));
}

function buildToggle(section, st, { redraw }) {
  const disabled = Boolean(section.reason) || st.busy;
  const id = `toggle-${section.field}`;
  const input = h('input', {
    id, type: 'checkbox', checked: section.checked ? true : undefined, disabled,
    'aria-describedby': section.reason ? `${id}-why` : undefined,
    dataset: { key: id },
    onchange: event => {
      st.selection = { ...st.selection, [section.field]: event.target.checked };
      redraw();
    },
  });
  // checked ตั้งผ่าน property เพื่อให้ตรงกับสถานะล่าสุดเสมอ
  input.checked = Boolean(section.checked);
  return h('div', { class: `act toggle${section.reason ? ' is-disabled' : ''}` },
    h('label', { class: 'toggle-label', for: id }, input, h('span', {}, section.label)),
    section.reason && h('p', { class: 'reason', id: `${id}-why` }, section.reason));
}
