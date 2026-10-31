import { MAX_NAME_LENGTH } from '/shared/constants.js';
import { h, sprite } from '../ui/dom.js';
import { STARTER_DEX } from '../ui/info.js';

const CODE_LENGTH = 4;

// หน้าแรก: กรอกชื่อเล่น แล้วสร้างห้องหรือเข้าห้อง ผลจริงมาจาก room:update (main.js สลับหน้าให้)
export function mountHome(root, ctx, { notice = '', initialName = '' } = {}) {
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: notice ? undefined : true }, notice);
  const nameInput = h('input', {
    id: 'name', class: 'input', type: 'text', maxlength: MAX_NAME_LENGTH, value: initialName,
    autocomplete: 'nickname', autocapitalize: 'words', enterkeyhint: 'next', required: true,
  });
  const codeInput = h('input', {
    id: 'code', class: 'input input-code', type: 'text', maxlength: CODE_LENGTH,
    autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    placeholder: 'ABCD', enterkeyhint: 'go',
  });
  const createBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'สร้างห้อง');
  const joinBtn = h('button', { class: 'btn btn-secondary', type: 'submit' }, 'เข้าห้อง');

  const showError = message => {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  };
  const setBusy = busy => {
    for (const el of [createBtn, joinBtn, nameInput, codeInput]) el.disabled = busy;
  };

  async function submit(event, payload) {
    showError('');
    const name = nameInput.value.trim();
    if (!name) {
      showError('กรุณาใส่ชื่อเล่นก่อน');
      nameInput.focus();
      return;
    }
    if (event === 'room:join' && !payload.code) {
      showError('กรุณาใส่รหัสห้อง 4 ตัวอักษร');
      codeInput.focus();
      return;
    }
    setBusy(true);
    try {
      await ctx.request(event, { ...payload, name });
      // สำเร็จแล้วรอ room:update ซึ่ง main.js จะเปลี่ยนเป็นหน้าล็อบบี้ให้
    } catch (err) {
      showError(err.message);
      setBusy(false);
    }
  }

  createBtn.addEventListener('click', () => submit('room:create', {}));
  // กด Enter ในช่องชื่อ: ถ้ายังไม่ได้กรอกรหัสห้อง = สร้างห้อง, ถ้ากรอกรหัสแล้ว = เข้าห้องนั้น
  nameInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    submit(code ? 'room:join' : 'room:create', code ? { code } : {});
  });
  const joinForm = h('form', { class: 'join-form', novalidate: true,
    onsubmit: e => {
      e.preventDefault();
      submit('room:join', { code: codeInput.value.trim().toUpperCase() });
    } },
  h('label', { class: 'field-label', for: 'code' }, 'รหัสห้องจากเพื่อน'),
  h('div', { class: 'join-row' }, codeInput, joinBtn));

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase();
  });

  const starters = h('div', { class: 'hero-starters', 'aria-hidden': 'true' },
    ...Object.values(STARTER_DEX).map((dexId, i) =>
      h('span', { class: 'hero-mon', style: { '--i': i } }, sprite(ctx.pokedexById, dexId, 'hero-sprite'))));

  const card = h('section', { class: 'home-card card' },
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'name' }, 'ชื่อเล่นของคุณ'),
      nameInput),
    createBtn,
    h('p', { class: 'divider' }, 'หรือเข้าห้องของเพื่อน'),
    joinForm,
    errorBox);

  const page = h('div', { class: 'home' },
    h('header', { class: 'hero' },
      starters,
      h('h1', { class: 'hero-title' }, h('span', {}, 'เศรษฐี'), h('span', {}, 'โปเกม่อน')),
      h('p', { class: 'hero-sub' }, 'ทอยเต๋า เดินรอบกระดาน จับโปเกม่อน แล้วท้าเพื่อนสู้')),
    card);
  root.replaceChildren(page);
  (initialName ? codeInput : nameInput).focus({ preventScroll: true });

  return { update() {}, destroy() {} };
}
