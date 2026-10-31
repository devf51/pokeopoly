// ห่อ Socket.IO เป็น Promise และเก็บห้องล่าสุดไว้ใน localStorage
// หน้าเว็บทำหน้าที่แสดงผลและส่ง action เท่านั้น ผลทุกอย่างมาจากเซิร์ฟเวอร์

const socket = window.io();
const REQUEST_TIMEOUT_MS = 10000;
const STORAGE_KEY = 'pokemon-board:room';

const updateHandlers = new Set();
const connectionHandlers = new Set();
let playerId = null;
let clockOffset = 0;

// ต้องลงทะเบียนก่อน emit room:create / room:join เสมอ (เซิร์ฟเวอร์ ack ก่อน broadcast ครั้งแรก)
socket.on('room:update', payload => {
  for (const handler of updateHandlers) handler(payload);
});
socket.on('connect', () => connectionHandlers.forEach(h => h(true)));
socket.on('disconnect', () => connectionHandlers.forEach(h => h(false)));

export function onUpdate(handler) {
  updateHandlers.add(handler);
  return () => updateHandlers.delete(handler);
}

export function onConnection(handler) {
  connectionHandlers.add(handler);
  return () => connectionHandlers.delete(handler);
}

export function isConnected() {
  return socket.connected;
}

// ส่ง event แล้วรอ ack; ok:false -> reject ด้วย Error(message ภาษาไทยจากเซิร์ฟเวอร์) พร้อม .code
export function request(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(REQUEST_TIMEOUT_MS).emit(event, payload, (timeoutErr, res) => {
      if (timeoutErr) {
        reject(Object.assign(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'), { code: 'TIMEOUT' }));
        return;
      }
      if (!res?.ok) {
        const error = res?.error ?? {};
        reject(Object.assign(new Error(error.message ?? 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'), { code: error.code ?? 'UNKNOWN' }));
        return;
      }
      // เก็บ playerId ตรงนี้เลย (ก่อน resolve) เพราะ room:update อาจมาถึงในจังหวะเดียวกับ ack
      if (event === 'room:create' || event === 'room:join') playerId = res.playerId;
      resolve(res);
    });
  });
}

export function getPlayerId() {
  return playerId;
}

export function forgetPlayer() {
  playerId = null;
}

// ใช้หัว Date ของ HTTP response ประมาณนาฬิกาเซิร์ฟเวอร์ เพื่อคำนวณเวลาที่เหลือจาก deadline
// (หัว Date ปัดเศษวินาทีลง จึงบวก 500 ms ให้ตรงกลางวินาที)
export function syncClock(dateHeader) {
  const server = Date.parse(dateHeader ?? '');
  if (Number.isFinite(server)) clockOffset = server + 500 - Date.now();
}

export function serverNow() {
  return Date.now() + clockOffset;
}

// localStorage อาจโยน error (โหมดส่วนตัว / ถูกปิด) ทุกจุดต้องครอบ try/catch และเว็บยังใช้ได้ต่อ
export function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && typeof data.code === 'string' && typeof data.name === 'string') {
      return { code: data.code, name: data.name };
    }
  } catch { /* ใช้งานต่อโดยไม่มีข้อมูลที่บันทึก */ }
  return null;
}

export function saveRoom({ code, name }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, name }));
  } catch { /* เขียนไม่ได้ก็ไม่เป็นไร */ }
}

export function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* เขียนไม่ได้ก็ไม่เป็นไร */ }
}

// ชื่อเล่นล่าสุด ใช้เติมช่องกรอกชื่อในหน้าแรก
export function loadSavedName() {
  return loadSaved()?.name ?? '';
}
