import { h } from './dom.js';
import { rankLabels } from './status.js';

// ตารางอันดับตอนจบเกม: เงิน + มูลค่าโปเกม่อน = รวม ไฮไลต์ผู้ชนะ (ชนะร่วมได้)
// result มาจากเซิร์ฟเวอร์ (game.result) ส่วน players = [{ id, name, color? }]
// onHome: เรียกเมื่อกด "กลับหน้าแรก" (main.js ล้างห้องที่บันทึกไว้แล้วโหลดหน้าใหม่)
export function renderResults(el, result, players, onHome) {
  if (!result) {
    el.replaceChildren();
    return;
  }
  const byId = new Map(players.map(p => [p.id, p]));
  const winners = result.winnerIds.map(id => byId.get(id)?.name ?? '').filter(Boolean);
  const ranks = rankLabels(result.ranking);
  const shared = result.winnerIds.length > 1;

  el.replaceChildren(h('section', { class: 'card results', role: 'region', 'aria-labelledby': 'results-title' },
    h('h2', { id: 'results-title', class: 'results-title', tabindex: '-1' }, 'เกมจบแล้ว'),
    h('p', { class: 'results-winner' },
      shared ? `ชนะร่วมกัน: ${winners.join(', ')}` : `ผู้ชนะคือ ${winners[0] ?? ''}`),
    h('table', { class: 'results-table' },
      h('caption', { class: 'sr-only' }, 'อันดับผู้เล่น เรียงจากเงินรวมมากไปน้อย'),
      h('thead', {}, h('tr', {},
        ['อันดับ', 'ผู้เล่น', 'เงิน', 'โปเกม่อน', 'รวม'].map((t, i) => h('th', { scope: 'col', class: i >= 2 ? 'num' : '' }, t)))),
      h('tbody', {}, result.ranking.map((r, i) => {
        const p = byId.get(r.playerId);
        const win = result.winnerIds.includes(r.playerId);
        return h('tr', { class: win ? 'is-winner' : '' },
          h('td', { class: 'rank' }, String(ranks[i])),
          h('th', { scope: 'row', class: 'who' },
            h('span', { class: 'color-dot', style: { '--c': p?.color ?? '#999' }, 'aria-hidden': 'true' }),
            h('span', { class: 'who-name' }, p?.name ?? ''),
            win && h('span', { class: 'tag tag-win' }, 'ผู้ชนะ')),
          h('td', { class: 'num' }, String(r.money)),
          h('td', { class: 'num' }, String(r.monValue)),
          h('td', { class: 'num total' }, String(r.total)));
      }))),
    h('p', { class: 'section-note' }, 'โปเกม่อนที่ยังสู้ได้นับตามมูลค่า ตัวที่หมดสภาพและตัวเริ่มต้นนับ 0'),
    h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: onHome }, 'กลับหน้าแรก')));
}
