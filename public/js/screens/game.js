import { BOARD_SIZE, ZONE_TARGET, ZONE_VALUE } from '/shared/constants.js';
import { h, sprite } from '../ui/dom.js';
import { renderBoard, placeToken, playerColor } from '../ui/board.js';
import { BALL_INFO, STEP_LABEL } from '../ui/info.js';
import { renderPanel, renderTimer } from '../ui/panel.js';
import { redrawActions, renderActions } from '../ui/actions.js';
import { renderResults } from '../ui/results.js';
import { animateDice, prefersReducedMotion } from '../ui/dice.js';
import { appendHistory, describeEvent, orderEvents } from '../ui/history.js';

// ระยะเวลาแอนิเมชัน (มิลลิวินาที): ตัวหมากเดินช่องละ 150 ลูกเต๋าหมุน ~600 (อยู่ใน dice.js)
const STEP_MS = 150;
const HOLD_MS = { roll: 250, note: 550, result: 1000, battle: 1300 };

// หน้าเกม: กระดานอยู่ซ้าย แผงข้อมูลอยู่ขวา (จอแคบกว่า 768px แผงลงไปอยู่ใต้กระดาน)
//
// slots (คืนจาก mountGame): actions = ที่วางปุ่ม action, board = element กระดาน, stage = กลางกระดาน (ลูกเต๋า/ผลลัพธ์)
// update(room, events) ถูกเรียกทุกครั้งที่ room:update มา: เล่นแอนิเมชันจาก events ก่อน แล้วค่อยวาดสถานะใหม่
// ถ้ามี update ตามมาติดๆ จะต่อคิว (อันที่ไม่ใช่อันสุดท้ายข้ามแอนิเมชัน) จึงไม่มีสถานะค้างครึ่งๆ กลางๆ
export function mountGame(root, ctx) {
  const boardEl = h('div', { class: 'board' });
  const turnBanner = h('div', { class: 'turn-banner', role: 'status', 'aria-live': 'polite' });
  const timerEl = h('span', { class: 'timer' });
  const actionArea = h('div', { id: 'action-area', class: 'action-area', 'aria-label': 'ปุ่มคำสั่ง' });
  const resultsSlot = h('div', { class: 'results-slot' });
  const historyList = h('ol', { class: 'history' });
  const playersSlot = h('div', { class: 'panel-players' });
  const legend = buildLegend();

  const panel = h('aside', { class: 'panel' },
    h('section', { class: 'card turn-card' }, turnBanner, timerEl),
    resultsSlot,
    actionArea,
    h('section', { class: 'card history-card' },
      h('h2', { class: 'section-title' }, 'เกิดอะไรขึ้นบ้าง'),
      historyList),
    playersSlot,
    legend);

  root.replaceChildren(h('div', { class: 'game' },
    h('div', { class: 'board-wrap' }, boardEl),
    panel));

  let room = null; // สถานะที่แสดงอยู่ตอนนี้
  let destroyed = false;
  let history = [];
  let resultsShown = false;
  let stage = null;
  const queue = [];
  let pumping = false;
  const tick = setInterval(() => renderTimer(timerEl, room, ctx.serverNow), 500);
  // จอกว้าง: การ์ดคำสั่งอยู่กลางกระดานใต้ลูกเต๋า; จอแคบ: อยู่ในแผงตำแหน่งเดิม
  // ย้าย element เดิม (ไม่สร้างใหม่) ค่าที่เลือกค้างใน actions.js จึงยังอยู่
  const desktop = matchMedia('(min-width: 768px)');
  const myId = () => ctx.getMyId();
  const send = action => ctx.request('game:action', { action });

  desktop.addEventListener('change', placeActions);

  const sleep = ms => (prefersReducedMotion() || ms <= 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, ms)));

  const namesOf = r => ({
    player: id => r.game.players.find(p => p.id === id)?.name ?? '',
    mon: dexId => ctx.pokedexById.get(dexId)?.name ?? '?',
    ball: ball => BALL_INFO[ball]?.name ?? ball,
  });

  // ---------- ช่องกลางกระดาน ----------

  function placeActions() {
    const center = boardEl.querySelector('.board-center');
    if (desktop.matches && center) {
      if (actionArea.parentElement === center) return;
      center.append(actionArea);
    } else {
      if (actionArea.previousElementSibling === resultsSlot) return;
      resultsSlot.after(actionArea);
    }
    redrawActions(actionArea);
  }

  function ensureStage() {
    if (stage) return stage;
    const slot = boardEl.querySelector('[data-slot="stage"]');
    if (!slot) return null;
    slot.setAttribute('aria-hidden', 'true');
    const dieA = h('div', { class: 'stage-die' });
    const dieB = h('div', { class: 'stage-die' });
    const labelA = h('span', { class: 'die-label' });
    const labelB = h('span', { class: 'die-label' });
    const dice = h('div', { class: 'stage-dice' },
      h('div', { class: 'stage-die-box' }, dieA, labelA),
      h('div', { class: 'stage-die-box' }, dieB, labelB));
    const mon = h('div', { class: 'stage-mon' });
    const caption = h('p', { class: 'stage-caption' });
    slot.replaceChildren(dice, mon, caption);
    stage = { slot, dice, dieA, dieB, labelA, labelB, boxB: dieB.parentElement, mon, caption };
    return stage;
  }

  // dice = [{ value, label? }] (ว่าง = ไม่แสดงลูกเต๋า); monDex = โปเกม่อนที่จะโชว์; คืน Promise ที่เสร็จเมื่อลูกเต๋าหยุด
  function setStage({ caption = '', dice = [], monDex = null }) {
    const st = ensureStage();
    if (!st) return Promise.resolve();
    st.caption.textContent = caption;
    st.dice.hidden = dice.length === 0;
    st.boxB.hidden = dice.length < 2;
    st.labelA.textContent = dice[0]?.label ?? '';
    st.labelB.textContent = dice[1]?.label ?? '';
    st.mon.replaceChildren(...(monDex ? [sprite(ctx.pokedexById, monDex, 'stage-sprite')] : []));
    st.mon.hidden = !monDex;
    return Promise.all(dice.map((d, i) => animateDice(i === 0 ? st.dieA : st.dieB, d.value)));
  }

  // เปลี่ยนแค่ข้อความใต้ลูกเต๋า (ไม่หมุนลูกเต๋าซ้ำ)
  function setCaption(text) {
    const st = ensureStage();
    if (st) st.caption.textContent = text;
  }

  function idleStage(r) {
    const { game } = r;
    if (game.phase === 'ended') {
      const names = game.result.winnerIds.map(id => namesOf(r).player(id)).join(', ');
      setStage({ caption: `เกมจบแล้ว ผู้ชนะ ${names}` });
      return;
    }
    const actorId = game.turn.step === 'defend' ? game.turn.battle?.defenderId : game.turn.playerId;
    setStage({ caption: `ตาของ ${namesOf(r).player(actorId)}` });
  }

  // ---------- แอนิเมชันจาก events ----------

  async function walk(ev) {
    for (let k = 1; k <= ev.steps; k++) {
      if (destroyed) return;
      const token = placeToken(boardEl, ev.playerId, (ev.from + k) % BOARD_SIZE);
      if (token && !prefersReducedMotion() && token.animate) {
        token.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-45%)' }, { transform: 'translateY(0)' }], { duration: STEP_MS, easing: 'ease-out' });
      }
      await sleep(STEP_MS);
    }
  }

  async function playEvents(events, nextRoom) {
    const names = namesOf(nextRoom);
    for (const ev of orderEvents(events)) {
      if (destroyed) return;
      const line = describeEvent(ev, names);
      switch (ev.type) {
        case 'rolled':
          await setStage({ caption: `${names.player(ev.playerId)} กำลังทอย…`, dice: [{ value: ev.value }] });
          setCaption(line);
          await sleep(HOLD_MS.roll);
          break;
        case 'moved':
          await walk(ev);
          break;
        case 'caught':
        case 'fled': {
          const dice = ev.roll == null ? [] : [{ value: ev.roll }];
          await setStage({ caption: `${names.player(ev.playerId)} โยนบอลใส่ ${names.mon(ev.dexId)}…`, dice, monDex: ev.dexId });
          setCaption(line);
          await sleep(HOLD_MS.result);
          break;
        }
        case 'battle': {
          const noDice = ev.attackerTotal == null || ev.defenderTotal == null;
          const dice = noDice ? [] : [
            { value: ev.attackerTotal, label: names.player(ev.attackerId) },
            { value: ev.defenderTotal, label: names.player(ev.defenderId) },
          ];
          await setStage({ caption: `${names.player(ev.attackerId)} สู้กับ ${names.player(ev.defenderId)}…`, dice });
          setCaption(line);
          await sleep(HOLD_MS.battle);
          break;
        }
        case 'salary':
        case 'finished':
        case 'ability':
          setStage({ caption: line });
          await sleep(HOLD_MS.note);
          break;
        default:
          break; // ซื้อ/ขาย/รักษา/เปลี่ยนตา: ไม่ต้องหน่วง แสดงในประวัติและสถานะใหม่เลย
      }
    }
  }

  // ---------- วาดสถานะ ----------

  function renderTurn() {
    const game = room.game;
    if (game.phase === 'ended') {
      turnBanner.replaceChildren(h('strong', {}, 'เกมจบแล้ว'));
      return;
    }
    const { turn } = game;
    const defending = turn.step === 'defend';
    const actorId = defending ? turn.battle?.defenderId : turn.playerId;
    const actor = game.players.find(p => p.id === actorId);
    const mine = actorId === myId();
    const who = mine ? 'ตาของคุณ' : `ตาของ ${actor?.name ?? ''}`;
    turnBanner.replaceChildren(
      h('strong', { class: mine ? 'is-mine' : '' }, defending && !mine ? `${actor?.name ?? ''} กำลังถูกท้าสู้` : who),
      h('span', { class: 'turn-step' }, STEP_LABEL[turn.step] ?? ''));
  }

  function renderHistory() {
    historyList.replaceChildren(...(history.length === 0
      ? [h('li', { class: 'muted' }, 'ยังไม่มีเหตุการณ์')]
      : [...history].reverse().map(line => h('li', {}, line))));
  }

  function applyState(next, events) {
    const first = room === null;
    room = next;
    renderBoard(boardEl, room, ctx.pokedexById, myId());
    placeActions();
    actionArea.hidden = false;
    renderTurn();
    renderPanel(playersSlot, room, ctx.pokedexById, myId());
    renderTimer(timerEl, room, ctx.serverNow);
    history = appendHistory(history, events, namesOf(room));
    renderHistory();
    renderActions(actionArea, room, myId(), send, ctx.pokedexById);
    if (first || room.game.phase === 'ended' || events.some(e => e.type === 'turn')) idleStage(room);

    if (room.game.phase === 'ended' && room.game.result && !resultsShown) {
      resultsShown = true;
      const players = room.game.players.map(p => ({ id: p.id, name: p.name, color: playerColor(room, p.id) }));
      renderResults(resultsSlot, room.game.result, players, ctx.leaveRoom);
      const title = resultsSlot.querySelector('#results-title');
      resultsSlot.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      title?.focus({ preventScroll: true });
    }
  }

  // คิว: ทีละ update; ถ้ามีอันถัดไปรออยู่แล้วให้ข้ามแอนิเมชันของอันนี้ (วาดสถานะอย่างเดียว)
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length && !destroyed) {
        const item = queue.shift();
        const animate = room !== null && queue.length === 0 && item.events.length > 0 && !document.hidden;
        if (animate) {
          // กลางกระดาน: ซ่อนการ์ดคำสั่งระหว่างแอนิเมชัน ไม่ให้บังลูกเต๋า (applyState แสดงคืน)
          if (actionArea.closest('.board-center')) actionArea.hidden = true;
          await playEvents(item.events, item.room);
        }
        if (destroyed) return;
        applyState(item.room, item.events);
      }
    } finally {
      pumping = false;
    }
  }

  return {
    slots: { actions: actionArea, board: boardEl, get stage() { return stage?.slot ?? null; } },
    update(nextRoom, events = []) {
      queue.push({ room: nextRoom, events });
      pump();
    },
    destroy() {
      destroyed = true;
      clearInterval(tick);
      desktop.removeEventListener('change', placeActions);
    },
  };
}

function buildLegend() {
  const zones = Object.keys(ZONE_VALUE).filter(z => z !== 'legendary');
  return h('details', { class: 'card legend' },
    h('summary', {}, 'สีของช่องบนกระดาน'),
    h('ul', { class: 'legend-list' },
      h('li', {}, h('i', { class: 'swatch t-start' }), 'จุดเริ่มต้น รับเงินเดือน ซื้อบอล ขายโปเกม่อน'),
      h('li', {}, h('i', { class: 'swatch t-mart' }), 'Poké Mart ซื้อบอล'),
      h('li', {}, h('i', { class: 'swatch t-center' }), 'Pokémon Center รักษาโปเกม่อน'),
      zones.map(z => h('li', {}, h('i', { class: `swatch z${z}` }),
        `โซน ${z} ต้องทอยจับ ${ZONE_TARGET[z]}+ มูลค่า ${ZONE_VALUE[z]}`))));
}
