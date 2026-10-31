import { BALLS, LAPS_TO_FINISH, TURN_TIMEOUT_MS, ZONE_TARGET, ZONE_VALUE } from '/shared/constants.js';
import { h, sprite } from '../ui/dom.js';
import { renderBoard, playerColor } from '../ui/board.js';
import { BALL_INFO, CLASS_INFO, STARTER_INFO, STEP_LABEL } from '../ui/info.js';

// หน้าเกม: กระดานอยู่ซ้าย แผงข้อมูลอยู่ขวา (จอแคบกว่า 768px แผงลงไปอยู่ใต้กระดาน)
//
// จุดต่อสำหรับ Task 10 (คืนจาก mountGame ใน .slots):
//   slots.actions  = <div id="action-area"> ที่ว่างไว้วางปุ่ม action (อยู่ใต้ป้ายบอกตา)
//   slots.stage    = ช่องกลางกระดานสำหรับลูกเต๋า/แอนิเมชัน
//   slots.board    = element กระดาน (renderBoard อัปเดตในที่เดิม ตัวหมากย้ายด้วย appendChild)
// update(room, events) ถูกเรียกทุกครั้งที่ room:update มา พร้อม events ของ action นั้นๆ
export function mountGame(root, ctx) {
  const boardEl = h('div', { class: 'board' });
  const turnBanner = h('div', { class: 'turn-banner', role: 'status', 'aria-live': 'polite' });
  const timerEl = h('span', { class: 'timer' });
  const actionArea = h('div', { id: 'action-area', class: 'action-area', 'aria-label': 'ปุ่มคำสั่ง' });
  const playerList = h('ul', { class: 'players' });
  const legend = buildLegend();

  const panel = h('aside', { class: 'panel' },
    h('section', { class: 'card turn-card' }, turnBanner, timerEl),
    actionArea,
    h('section', { class: 'card' }, h('h2', { class: 'section-title' }, 'ผู้เล่น'), playerList),
    legend);

  root.replaceChildren(h('div', { class: 'game' },
    h('div', { class: 'board-wrap' }, boardEl),
    panel));

  let room = null;
  let deadline = null;
  const tick = setInterval(updateTimer, 500);

  function myId() {
    return ctx.getMyId();
  }

  // เวลาที่เหลือคิดจากนาฬิกาเซิร์ฟเวอร์ (ประมาณจากหัว Date) ไม่เชื่อนาฬิกาเครื่องเรา
  function updateTimer() {
    const playing = room?.game?.phase === 'playing' && deadline;
    timerEl.hidden = !playing;
    if (!playing) return;
    const left = Math.min(TURN_TIMEOUT_MS, Math.max(0, deadline - ctx.serverNow()));
    const secs = Math.ceil(left / 1000);
    timerEl.textContent = `เหลือเวลา ${secs} วินาที`;
    timerEl.classList.toggle('is-low', secs <= 10);
  }

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

  function renderPlayers() {
    const game = room.game;
    const order = game.order;
    playerList.replaceChildren(...game.players.map(p => {
      const info = room.players.find(r => r.id === p.id);
      const isMe = p.id === myId();
      const turnPos = order.indexOf(p.id) + 1;
      const active = game.phase === 'playing' && p.id === game.turn.playerId;
      const progress = p.finished ? 'เข้าเส้นชัยแล้ว' : `เดินแล้ว ${p.laps}/${LAPS_TO_FINISH} รอบ`;
      return h('li', { class: `player${active ? ' is-active' : ''}${info?.connected === false ? ' is-offline' : ''}` },
        h('div', { class: 'player-head' },
          h('span', { class: 'color-dot', style: { '--c': playerColor(room, p.id) }, 'aria-hidden': 'true' }),
          h('span', { class: 'player-name' }, p.name, isMe && h('span', { class: 'tag tag-me' }, 'คุณ')),
          h('span', { class: `status ${info?.connected === false ? 'off' : 'on'}` },
            h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
            info?.connected === false ? 'หลุด' : 'ออนไลน์')),
        h('div', { class: 'player-sub' },
          `${CLASS_INFO[p.cls]?.name ?? ''} · ${STARTER_INFO[p.starter]?.name ?? ''} · ลำดับเดินที่ ${turnPos}`),
        h('div', { class: 'player-stats' },
          h('span', { class: 'money' }, `เงิน ${p.money}`),
          h('span', {}, progress)),
        h('div', { class: 'balls' },
          Object.keys(BALLS).map(b => h('span', { class: `ball ball-${b}` }, `${BALL_INFO[b].name} ${p.balls[b]}`))),
        h('div', { class: 'mons', 'aria-label': `โปเกม่อนของ ${p.name}` },
          p.mons.length === 0 && h('span', { class: 'muted' }, 'ยังไม่มีโปเกม่อน'),
          p.mons.map(m => h('span', {
            class: `mon${m.fainted ? ' is-fainted' : ''}${m.starter ? ' is-starter' : ''}`,
            title: `${ctx.pokedexById.get(m.dexId)?.name ?? ''}${m.fainted ? ' (หมดสภาพ)' : ''}${m.starter ? ' (ตัวเริ่มต้น)' : ''}`,
          }, sprite(ctx.pokedexById, m.dexId, 'mon-sprite')))));
    }));
  }

  return {
    slots: { actions: actionArea, board: boardEl },
    update(nextRoom, events = []) {
      room = nextRoom;
      deadline = room.deadline;
      renderBoard(boardEl, room, ctx.pokedexById, myId());
      renderTurn();
      renderPlayers();
      updateTimer();
      this.slots.stage = boardEl.querySelector('[data-slot="stage"]');
      this.lastEvents = events;
    },
    destroy() {
      clearInterval(tick);
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
