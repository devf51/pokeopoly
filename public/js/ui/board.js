import { cellFor } from './layout.js';
import { h, sprite } from './dom.js';

// สีผู้เล่น 4 สีคงที่ ตามลำดับเข้าห้อง (index ใน room.players)
export const PLAYER_COLORS = ['#e63946', '#1d4ed8', '#16a34a', '#7c3aed'];

export function playerColor(room, playerId) {
  const i = room.players.findIndex(p => p.id === playerId);
  return PLAYER_COLORS[Math.max(i, 0) % PLAYER_COLORS.length];
}

const TILE_LABEL = { start: 'เริ่ม', mart: 'ร้าน', center: 'รักษา' };
const TILE_NAME = { start: 'จุดเริ่มต้น', mart: 'Poké Mart', center: 'Pokémon Center' };

// element ของกระดานแต่ละอัน -> { cells, tokens, stage }  (สร้างครั้งเดียว แล้วอัปเดตในที่เดิม
// เพื่อให้ Task 10 ย้ายตัวหมาก/เล่นแอนิเมชันบน element เดิมได้)
const state = new WeakMap();

function tileClass(tile) {
  return tile.type === 'wild' ? `z${tile.zone}` : `t-${tile.type}`;
}

function buildCell(tile) {
  const { row, col } = cellFor(tile.index);
  const spriteSlot = h('span', { class: 'cell-mon' });
  const tokens = h('span', { class: 'tokens' });
  const el = h('div', {
    class: `cell ${tileClass(tile)}`,
    dataset: { index: tile.index },
    style: { gridRow: row + 1, gridColumn: col + 1 },
  },
  spriteSlot,
  h('span', { class: 'cell-label' }, tile.type === 'wild' ? tile.zone : TILE_LABEL[tile.type]),
  tokens);
  return { el, spriteSlot, tokens, dexId: undefined };
}

function describe(tile, mon) {
  if (tile.type !== 'wild') return `ช่อง ${tile.index + 1} ${TILE_NAME[tile.type]}`;
  const base = `ช่อง ${tile.index + 1} โซน ${tile.zone}`;
  return mon ? `${base} มี ${mon.name}` : base;
}

function build(el, board) {
  el.classList.add('board');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'กระดานเกม');
  el.replaceChildren();
  const cells = board.map(buildCell);
  const stage = h('div', { class: 'stage', dataset: { slot: 'stage' } });
  const roomCode = h('span', { class: 'center-code' });
  const center = h('div', { class: 'board-center' },
    h('div', { class: 'center-title' }, 'เศรษฐีโปเกม่อน'),
    h('div', { class: 'center-room' }, 'ห้อง ', roomCode),
    stage);
  el.append(...cells.map(c => c.el), center);
  const entry = { cells, tokens: new Map(), stage, roomCode };
  state.set(el, entry);
  return entry;
}

// วาดกระดาน 32 ช่องด้วย CSS grid; เรียกซ้ำได้ทุกครั้งที่ room:update มา (อัปเดตในที่เดิม)
// room.game.board ถูกซ่อนโดยเซิร์ฟเวอร์แล้ว: dexId ที่เป็น null = ผู้เล่นคนนี้ไม่เห็นตัวในช่องนั้น
export function renderBoard(el, room, pokedexById, myId) {
  const game = room.game;
  if (!game) return null;
  const entry = state.get(el) ?? build(el, game.board);
  entry.roomCode.textContent = room.code;

  const actor = game.turn?.playerId;
  const actorPlayer = game.players.find(p => p.id === actor);

  game.board.forEach((tile, i) => {
    const cell = entry.cells[i];
    const mon = tile.dexId ? pokedexById.get(tile.dexId) : null;
    if (cell.dexId !== tile.dexId) {
      cell.dexId = tile.dexId;
      cell.spriteSlot.replaceChildren(...(tile.dexId ? [sprite(pokedexById, tile.dexId, 'cell-sprite')] : []));
      cell.el.classList.toggle('has-mon', Boolean(tile.dexId));
    }
    const label = describe(tile, mon);
    cell.el.title = label;
    cell.el.setAttribute('aria-label', label);
    cell.el.classList.toggle('is-active', game.phase === 'playing' && actorPlayer?.position === i);
  });

  // ตัวหมาก: element คงที่ต่อผู้เล่น ย้ายด้วย appendChild
  for (const p of game.players) {
    const info = room.players.find(r => r.id === p.id);
    let token = entry.tokens.get(p.id);
    if (!token) {
      token = h('span', { class: 'token' });
      entry.tokens.set(p.id, token);
    }
    token.style.setProperty('--c', playerColor(room, p.id));
    token.textContent = Array.from(p.name)[0] ?? '?';
    token.title = p.id === myId ? `${p.name} (คุณ)` : p.name;
    token.classList.toggle('is-me', p.id === myId);
    token.classList.toggle('is-turn', p.id === actor && game.phase === 'playing');
    token.classList.toggle('is-offline', info ? !info.connected : false);
    const target = entry.cells[p.position]?.tokens;
    if (target && token.parentElement !== target) target.append(token);
  }
  syncTokenFlags(entry);
  return entry;
}

// ช่องที่มีหมากยืนอยู่ได้ class has-tokens เพื่อให้ CSS ดัน sprite ขึ้น ไม่ให้แถวหมากบังตัวโปเกม่อน
function syncTokenFlags(entry) {
  for (const cell of entry.cells) cell.el.classList.toggle('has-tokens', cell.tokens.childElementCount > 0);
}

// ย้ายหมากของผู้เล่นไปช่อง index ด้วย appendChild (ใช้ตอนเล่นแอนิเมชันเดินทีละช่อง) คืน element หมาก หรือ null
export function placeToken(el, playerId, index) {
  const entry = state.get(el);
  const token = entry?.tokens.get(playerId);
  const cell = entry?.cells[index];
  if (!token || !cell) return null;
  if (token.parentElement !== cell.tokens) cell.tokens.append(token);
  syncTokenFlags(entry);
  return token;
}

// ช่องว่างกลางกระดานสำหรับลูกเต๋า/ผลลัพธ์ (Task 10)
export function stageOf(boardEl) {
  return state.get(boardEl)?.stage ?? null;
}
