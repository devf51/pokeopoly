import { BALLS, TURN_TIMEOUT_MS } from '/shared/constants.js';
import { monValue } from '/shared/economy.js';
import { h, sprite } from './dom.js';
import { playerColor } from './board.js';
import { BALL_INFO, CLASS_INFO, STARTER_INFO } from './info.js';
import { abilityLines, currentMonValue, lapText } from './status.js';

// แผงข้อมูลผู้เล่น: การ์ดผู้เล่นทุกคน + กล่องโปเกม่อนของเราเอง
// วาดใหม่ทั้งก้อนทุกครั้งที่ room:update มา (ข้อมูลน้อย ไม่มีปุ่มให้เสียโฟกัส)
export function renderPanel(el, room, pokedexById, myId) {
  const game = room.game;
  if (!game) {
    el.replaceChildren();
    return;
  }
  const me = game.players.find(p => p.id === myId);
  el.replaceChildren(
    me && myMons(me, pokedexById),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, 'ผู้เล่น'),
      h('ul', { class: 'players' }, game.players.map(p => playerCard(room, p, pokedexById, myId)))));
}

function playerCard(room, p, pokedexById, myId) {
  const game = room.game;
  const info = room.players.find(r => r.id === p.id);
  const offline = info?.connected === false;
  const active = game.phase === 'playing' && p.id === game.turn.playerId;
  const turnPos = game.order.indexOf(p.id) + 1;
  return h('li', { class: `player${active ? ' is-active' : ''}${offline ? ' is-offline' : ''}` },
    h('div', { class: 'player-head' },
      h('span', { class: 'color-dot', style: { '--c': playerColor(room, p.id) }, 'aria-hidden': 'true' }),
      h('span', { class: 'player-name' }, p.name, p.id === myId && h('span', { class: 'tag tag-me' }, 'คุณ')),
      h('span', { class: `status ${offline ? 'off' : 'on'}` },
        h('span', { class: 'status-dot', 'aria-hidden': 'true' }), offline ? 'หลุด' : 'ออนไลน์')),
    h('div', { class: 'player-sub' },
      `${CLASS_INFO[p.cls]?.name ?? ''} · ${STARTER_INFO[p.starter]?.name ?? ''} · ลำดับเดินที่ ${turnPos}`),
    h('div', { class: 'player-stats' },
      h('span', { class: 'money' }, `เงิน ${p.money}`),
      h('span', {}, lapText(p))),
    h('div', { class: 'balls' },
      Object.keys(BALLS).map(b => h('span', { class: `ball ball-${b}` }, `${BALL_INFO[b].name} ${p.balls[b]}`))),
    h('ul', { class: 'abilities', 'aria-label': `ความสามารถของ ${p.name}` },
      abilityLines(p).map(line => h('li', {}, line))),
    h('div', { class: 'mons', 'aria-label': `โปเกม่อนของ ${p.name}` },
      p.mons.length === 0 && h('span', { class: 'muted' }, 'ยังไม่มีโปเกม่อน'),
      p.mons.map(m => h('span', {
        class: `mon${m.fainted ? ' is-fainted' : ''}${m.starter ? ' is-starter' : ''}`,
        title: `${pokedexById.get(m.dexId)?.name ?? ''}${m.fainted ? ' (หมดสภาพ)' : ''}${m.starter ? ' (ตัวเริ่มต้น)' : ''}`,
      }, sprite(pokedexById, m.dexId, 'mon-sprite')))));
}

// กล่องโปเกม่อนของเรา: sprite ชื่อ มูลค่า และป้ายหมดสภาพ (ป้ายเป็นตัวหนังสือ ไม่พึ่งสีอย่างเดียว)
function myMons(me, pokedexById) {
  return h('section', { class: 'card mybox' },
    h('h2', { class: 'section-title' }, 'โปเกม่อนของคุณ'),
    me.mons.length === 0
      ? h('p', { class: 'muted' }, 'ยังไม่มีโปเกม่อน')
      : h('ul', { class: 'box-grid' }, me.mons.map(m => {
        const mon = pokedexById.get(m.dexId);
        return h('li', { class: `box-mon${m.fainted ? ' is-fainted' : ''}${m.starter ? ' is-starter' : ''}` },
          sprite(pokedexById, m.dexId, 'box-sprite'),
          h('span', { class: 'box-name' }, mon?.name ?? '?'),
          h('span', { class: 'box-value' }, m.starter ? 'ตัวเริ่มต้น (ไม่นับมูลค่า)' : `มูลค่า ${monValue(m)}`),
          m.fainted && h('span', { class: 'badge-fainted' }, 'หมดสภาพ'));
      })),
    h('p', { class: 'box-total' }, `มูลค่ารวมที่ยังสู้ได้ ${currentMonValue(me)}`));
}

// ตัวนับเวลาถอยหลัง: เวลาที่เหลือคิดจากนาฬิกาเซิร์ฟเวอร์ (serverNow) และ room.deadline
export function renderTimer(el, room, serverNow) {
  const playing = room?.game?.phase === 'playing' && room.deadline;
  el.hidden = !playing;
  if (!playing) return;
  const left = Math.min(TURN_TIMEOUT_MS, Math.max(0, room.deadline - serverNow()));
  const secs = Math.ceil(left / 1000);
  el.textContent = `เหลือเวลา ${secs} วินาที`;
  el.classList.toggle('is-low', secs <= 10);
}
