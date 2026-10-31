import {
  clearSaved, forgetPlayer, getPlayerId, isConnected, loadSaved, loadSavedName, onConnection,
  onUpdate, request, saveRoom, serverNow, syncClock,
} from './api.js';
import { h } from './ui/dom.js';
import { mountHome } from './screens/home.js';
import { mountLobby } from './screens/lobby.js';
import { mountGame } from './screens/game.js';

const app = document.getElementById('app');
const banner = document.getElementById('conn-banner');
const RETRY_MS = 5000;

const ctx = {
  request,
  serverNow,
  pokedexById: new Map(),
  getMyId: getPlayerId,
  leaveRoom,
};

let current = { name: null, screen: null };
let lastRoom = null;
// เก็บในหน่วยความจำด้วย เผื่อ localStorage ใช้ไม่ได้ จะได้ยังกลับเข้าห้องหลังหลุดได้
let identity = null;
let resuming = false;
let retryTimer = null;
let everConnected = isConnected();

function show(name, mount) {
  current.screen?.destroy();
  clearTimeout(retryTimer);
  current = { name, screen: mount() };
  return current.screen;
}

function showHome(notice = '') {
  lastRoom = null;
  show('home', () => mountHome(app, ctx, { notice, initialName: loadSavedName() }));
}

// หน้าข้อความเต็มจอ ใช้ตอนโหลดข้อมูล / กำลังกลับเข้าห้อง / กลับเข้าห้องไม่ได้
function showStatus(message, actions = []) {
  show('status', () => {
    app.replaceChildren(h('section', { class: 'status-card card', role: 'status' },
      h('p', { class: 'status-text' }, message),
      actions.length > 0 && h('div', { class: 'status-actions' },
        actions.map(a => h('button', { class: `btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`, type: 'button', onclick: a.run }, a.label)))));
    return { destroy() {} };
  });
}

function leaveRoom() {
  clearSaved();
  identity = null;
  forgetPlayer();
  // โหลดหน้าใหม่ เพื่อตัดการเชื่อมต่อเดิม (เซิร์ฟเวอร์จะทำเครื่องหมายว่าออฟไลน์)
  location.reload();
}

function handleUpdate({ room, events }) {
  const myId = getPlayerId();
  const me = room.players.find(p => p.id === myId);
  if (!me) return; // ยังไม่รู้ว่าเราคือใคร (ไม่ควรเกิดเพราะ api.js เก็บ playerId ก่อน)
  lastRoom = room;
  identity = { code: room.code, name: me.name };
  const saved = loadSaved();
  if (saved?.code !== room.code || saved?.name !== me.name) saveRoom({ code: room.code, name: me.name });

  const wanted = room.phase === 'lobby' ? 'lobby' : 'game';
  if (current.name !== wanted) {
    show(wanted, () => (wanted === 'lobby' ? mountLobby(app, ctx) : mountGame(app, ctx)));
  }
  current.screen.update(room, events);
}

// กลับเข้าห้องที่บันทึกไว้ (ตอนโหลดหน้าใหม่ และตอน socket ต่อใหม่หลังหลุด)
async function resume() {
  const saved = loadSaved() ?? identity;
  if (!saved) {
    showHome();
    return;
  }
  if (resuming) return;
  resuming = true;
  showStatus(`กำลังกลับเข้าห้อง ${saved.code}…`);
  try {
    await request('room:join', saved);
    // ต่อจากนี้ room:update จะเลือกหน้าล็อบบี้หรือหน้าเกมให้เอง
  } catch (err) {
    if (err.code === 'ROOM_NOT_FOUND') {
      clearSaved();
      identity = null;
      showHome('ห้องเดิมไม่มีอยู่แล้ว สร้างห้องใหม่หรือเข้าห้องอื่นได้เลย');
    } else {
      const wait = err.code === 'NAME_TAKEN'
        ? `${err.message} (อาจเป็นการเชื่อมต่อเดิมของคุณที่ยังไม่หลุดจากเซิร์ฟเวอร์ รอสักครู่แล้วลองใหม่)`
        : err.message;
      showStatus(wait, [
        { label: 'ลองอีกครั้ง', primary: true, run: resume },
        { label: 'กลับหน้าแรก', run: () => { clearSaved(); identity = null; showHome(); } },
      ]);
      if (err.code === 'NAME_TAKEN' || err.code === 'TIMEOUT') {
        retryTimer = setTimeout(resume, RETRY_MS);
      }
    }
  } finally {
    resuming = false;
  }
}

async function loadPokedex() {
  const res = await fetch('/data/pokedex.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  syncClock(res.headers.get('date'));
  const list = await res.json();
  ctx.pokedexById = new Map(list.map(p => [p.id, p]));
}

onUpdate(handleUpdate);

onConnection(connected => {
  banner.hidden = connected;
  if (!connected) return;
  // ต่อใหม่หลังหลุด: socket ตัวใหม่ยังไม่อยู่ในห้อง ต้อง join ด้วยชื่อเดิมอีกครั้ง
  // (การเชื่อมต่อครั้งแรกไม่ต้อง เพราะ boot() จัดการแล้ว)
  if (!everConnected) {
    everConnected = true;
    return;
  }
  if (identity) resume();
});

async function boot() {
  showStatus('กำลังโหลด…');
  try {
    await loadPokedex();
  } catch {
    showStatus('โหลดข้อมูลโปเกม่อนไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่', [
      { label: 'ลองอีกครั้ง', primary: true, run: boot },
    ]);
    return;
  }
  await resume();
}

boot();
