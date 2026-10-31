import { MAX_PLAYERS, MIN_PLAYERS, CLASSES } from '/shared/constants.js';
import { h, rerender, sprite } from '../ui/dom.js';
import { CLASS_INFO, STARTER_DEX, STARTER_INFO } from '../ui/info.js';
import { playerColor } from '../ui/board.js';

// ล็อบบี้: รหัสห้อง รายชื่อผู้เล่น เลือกคลาส/ตัวเริ่มต้น และปุ่มเริ่มเกม (เฉพาะ host)
export function mountLobby(root, ctx) {
  let room = null;
  let pick = { cls: null, starter: null };
  let pickLoaded = false;
  let message = '';
  let copyTimer = null;
  const COPY_LABEL = 'คัดลอกรหัส';
  // ส่วนหัว (รหัสห้อง + ปุ่มคัดลอก) สร้างครั้งเดียวแล้วไม่ถูกแทนที่ เพื่อให้ข้อความที่เลือกไว้ไม่หาย
  const codeEl = h('strong', { class: 'room-code' });
  const copyBtn = h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: copyCode }, COPY_LABEL);
  const headEl = h('header', { class: 'lobby-head card' },
    h('div', { class: 'room-code-box' },
      h('span', { class: 'field-label' }, 'รหัสห้อง บอกเพื่อนให้พิมพ์เข้ามา'),
      codeEl),
    copyBtn);
  const bodyEl = h('div', { class: 'lobby-body' });
  root.replaceChildren(h('div', { class: 'lobby' }, headEl, bodyEl));

  const myId = () => ctx.getMyId();

  async function sendPick() {
    if (!pick.cls || !pick.starter) return;
    try {
      await ctx.request('lobby:choose', { ...pick });
      message = '';
    } catch (err) {
      message = err.message;
      render();
    }
  }

  function choose(patch) {
    pick = { ...pick, ...patch };
    message = '';
    render();
    sendPick();
  }

  async function start() {
    message = '';
    try {
      await ctx.request('lobby:start', {});
    } catch (err) {
      message = err.message;
      render();
    }
  }

  // คัดลอกรหัสห้อง: ใช้ clipboard API เมื่ออยู่บน https/localhost ส่วน http ผ่าน LAN ไม่มี API นี้
  // จึงถอยไปใช้ textarea ซ่อน + execCommand('copy') ไม่ render ล็อบบี้ใหม่ เพื่อไม่ให้ข้อความที่เลือกหาย
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch { /* ไปลองวิธีสำรอง */ }
    }
    const area = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', readonly: true, style: {
      position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px',
    } });
    area.value = text;
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch { /* คัดลอกไม่ได้ */ }
    area.remove();
    return done;
  }

  async function copyCode() {
    const code = codeEl.textContent; // ใช้รหัสที่แสดงอยู่ (ถ้ากดก่อน room:update แรกจะยังว่าง)
    if (!code) return;
    clearTimeout(copyTimer);
    const ok = await copyText(code);
    copyBtn.focus({ preventScroll: true }); // textarea ชั่วคราวชิงโฟกัสไปแล้ว คืนให้ปุ่ม
    copyBtn.textContent = ok ? 'คัดลอกแล้ว' : 'คัดลอกไม่ได้ ลองเลือกข้อความเอง';
    copyTimer = setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, 2000);
  }

  function leave() {
    ctx.leaveRoom();
  }

  function playerRow(p) {
    const isMe = p.id === myId();
    const cls = p.cls ? CLASS_INFO[p.cls] : null;
    const starterName = p.starter ? STARTER_INFO[p.starter].name : null;
    return h('li', { class: `lobby-player${p.connected ? '' : ' is-offline'}` },
      h('span', { class: 'color-dot', style: { '--c': playerColor(room, p.id) }, 'aria-hidden': 'true' }),
      h('span', { class: 'lp-main' },
        h('span', { class: 'lp-name' }, p.name,
          isMe && h('span', { class: 'tag tag-me' }, 'คุณ'),
          p.id === room.hostId && h('span', { class: 'tag tag-host' }, 'หัวหน้าห้อง')),
        h('span', { class: 'lp-choice' },
          cls ? `${cls.name} (${cls.en})` : 'ยังไม่เลือกคลาส',
          starterName ? ` · ${starterName}` : ' · ยังไม่เลือกตัวเริ่มต้น')),
      p.starter && sprite(ctx.pokedexById, STARTER_DEX[p.starter], 'lp-sprite'),
      h('span', { class: `status ${p.connected ? 'on' : 'off'}` },
        h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
        p.connected ? 'ออนไลน์' : 'หลุดการเชื่อมต่อ'));
  }

  function classCard(cls) {
    const info = CLASS_INFO[cls];
    const selected = pick.cls === cls;
    return h('button', {
      class: `choice${selected ? ' is-selected' : ''}`, type: 'button', role: 'radio',
      'aria-checked': String(selected), dataset: { key: `cls-${cls}` },
      onclick: () => choose({ cls }),
    },
    h('span', { class: 'choice-name' }, info.name, h('small', {}, info.en)),
    h('span', { class: 'choice-desc' }, info.desc));
  }

  function starterCard(key) {
    const info = STARTER_INFO[key];
    const selected = pick.starter === key;
    return h('button', {
      class: `choice choice-starter${selected ? ' is-selected' : ''}`, type: 'button', role: 'radio',
      'aria-checked': String(selected), dataset: { key: `starter-${key}` },
      onclick: () => choose({ starter: key }),
    },
    sprite(ctx.pokedexById, STARTER_DEX[key], 'choice-sprite'),
    h('span', { class: 'choice-name' }, info.name),
    h('span', { class: 'choice-desc' }, info.desc));
  }

  function startArea() {
    const isHost = room.hostId === myId();
    const everyoneReady = room.players.every(p => p.cls && p.starter);
    const enough = room.players.length >= MIN_PLAYERS;
    if (!isHost) {
      const host = room.players.find(p => p.id === room.hostId);
      return h('p', { class: 'wait-note' }, `รอ ${host?.name ?? 'หัวหน้าห้อง'} กดเริ่มเกม`);
    }
    const hint = !enough
      ? `ต้องมีผู้เล่นอย่างน้อย ${MIN_PLAYERS} คนจึงจะเริ่มได้ ส่งรหัสห้องให้เพื่อน`
      : !everyoneReady ? 'ทุกคนต้องเลือกคลาสและตัวเริ่มต้นก่อน' : '';
    return h('div', { class: 'start-area' },
      h('button', {
        class: 'btn btn-primary btn-big', type: 'button', disabled: !(enough && everyoneReady),
        dataset: { key: 'start' }, onclick: start,
      }, 'เริ่มเกม'),
      hint && h('p', { class: 'wait-note' }, hint));
  }

  function render() {
    if (!room) return;
    if (codeEl.textContent !== room.code) {
      codeEl.textContent = room.code;
      codeEl.setAttribute('aria-label', `รหัสห้อง ${room.code.split('').join(' ')}`);
    }
    rerender(bodyEl, () => h('div', { class: 'lobby-sections' },
      h('section', { class: 'card' },
        h('h2', { class: 'section-title' }, `ผู้เล่นในห้อง (${room.players.length}/${MAX_PLAYERS})`),
        h('ul', { class: 'lobby-players' }, room.players.map(playerRow))),
      h('section', { class: 'card' },
        h('h2', { class: 'section-title', id: 'cls-title' }, 'เลือกคลาสอาชีพ'),
        h('div', { class: 'choices', role: 'radiogroup', 'aria-labelledby': 'cls-title' }, CLASSES.map(classCard))),
      h('section', { class: 'card' },
        h('h2', { class: 'section-title', id: 'starter-title' }, 'เลือกโปเกม่อนตัวเริ่มต้น'),
        h('p', { class: 'section-note' }, 'ใช้ความสามารถพิเศษได้ครั้งเดียวต่อเกม สู้ได้ แต่ขายไม่ได้และไม่นับมูลค่าตอนจบ'),
        h('div', { class: 'choices choices-starters', role: 'radiogroup', 'aria-labelledby': 'starter-title' },
          Object.keys(STARTER_DEX).map(starterCard))),
      h('section', { class: 'lobby-foot' },
        message && h('p', { class: 'form-error', role: 'alert' }, message),
        startArea(),
        h('button', { class: 'btn-link', type: 'button', onclick: leave }, 'ออกจากห้อง'))));
  }

  return {
    update(nextRoom) {
      room = nextRoom;
      if (!pickLoaded) {
        const me = room.players.find(p => p.id === myId());
        pick = { cls: me?.cls ?? null, starter: me?.starter ?? null };
        pickLoaded = true;
      }
      render();
    },
    destroy() {},
  };
}
