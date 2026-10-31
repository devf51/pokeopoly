import { randomInt, randomUUID } from 'node:crypto';
import {
  CLASSES, MAX_PLAYERS, MIN_PLAYERS, ROOM_IDLE_MS, STARTERS, TURN_TIMEOUT_MS,
} from '../shared/constants.js';
import { makeContext } from '../shared/engine/context.js';
import { createGame } from '../shared/engine/state.js';
import { actorOf, applyAction } from '../shared/engine/index.js';
import { autoAction } from '../shared/engine/auto.js';
import { viewFor } from '../shared/engine/view.js';

// รหัสห้อง: ตัวอักษรพิมพ์ใหญ่ 4 ตัว ไม่ใช้ I และ O (Plan Decisions ข้อ 13)
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;
const MAX_NAME_LENGTH = 20;
// กันลูปเล่นแทนวนไม่จบ (หนึ่งตาจริงใช้ไม่เกินสิบกว่า action)
const MAX_AUTO_STEPS = 50;

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

const own = (obj, key) => Object.hasOwn(obj, key);

function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function normalizeName(name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean) throw new RoomError('BAD_NAME', 'กรุณาใส่ชื่อเล่น');
  if (clean.length > MAX_NAME_LENGTH) {
    throw new RoomError('BAD_NAME', `ชื่อเล่นยาวเกินไป (ไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร)`);
  }
  return clean;
}

// มุมมองห้องสำหรับผู้รับคนเดียว: เกมผ่าน viewFor เสมอ ห้ามส่ง GameState ดิบ
export function roomView(room, viewerId) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.game ? room.game.phase : 'lobby',
    players: room.players.map(({ id, name, cls, starter, connected }) => ({
      id, name, cls, starter, connected,
    })),
    game: room.game ? viewFor(room.game, viewerId) : null,
    deadline: room.deadline,
  };
}

export class RoomManager {
  constructor({
    pokedex,
    rng = Math.random,
    timeoutMs = TURN_TIMEOUT_MS,
    idleMs = ROOM_IDLE_MS,
    onUpdate = () => {},
  }) {
    this.pokedex = pokedex;
    this.rng = rng;
    this.timeoutMs = timeoutMs;
    this.idleMs = idleMs;
    this.onUpdate = onUpdate;
    this.rooms = new Map();
  }

  roomView(room, viewerId) {
    return roomView(room, viewerId);
  }

  getRoom(code) {
    return this.rooms.get(normalizeCode(code));
  }

  #requireRoom(code) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'ไม่พบห้องนี้ ตรวจสอบรหัสห้องอีกครั้ง');
    return room;
  }

  #requirePlayer(room, playerId) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new RoomError('NOT_IN_ROOM', 'คุณไม่ได้อยู่ในห้องนี้');
    return player;
  }

  #newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  #newPlayer(name) {
    return { id: randomUUID(), name, cls: null, starter: null, connected: true };
  }

  createRoom(name) {
    const cleanName = normalizeName(name);
    const player = this.#newPlayer(cleanName);
    const room = {
      code: this.#newCode(),
      hostId: player.id,
      players: [player],
      game: null,
      ctx: null,
      deadline: null,
      turnTimer: null,
      idleTimer: null,
    };
    this.rooms.set(room.code, room);
    return { code: room.code, playerId: player.id };
  }

  joinRoom(code, name) {
    const room = this.#requireRoom(code);
    const cleanName = normalizeName(name);
    const existing = room.players.find(p => p.name === cleanName);
    if (existing) {
      if (existing.connected) {
        throw new RoomError('NAME_TAKEN', 'ชื่อนี้มีคนใช้อยู่ในห้องแล้ว ลองใช้ชื่ออื่น');
      }
      existing.connected = true;
      this.#clearIdle(room);
      return { playerId: existing.id, reconnected: true };
    }
    if (room.game) throw new RoomError('GAME_STARTED', 'เกมในห้องนี้เริ่มไปแล้ว เข้าร่วมไม่ได้');
    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError('ROOM_FULL', `ห้องเต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`);
    }
    const player = this.#newPlayer(cleanName);
    room.players.push(player);
    this.#clearIdle(room);
    return { playerId: player.id, reconnected: false };
  }

  setConnected(code, playerId, connected) {
    const room = this.getRoom(code);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.connected = Boolean(connected);
    if (room.players.some(p => p.connected)) {
      this.#clearIdle(room);
    } else if (!room.idleTimer) {
      room.idleTimer = setTimeout(() => this.#deleteRoom(room), this.idleMs);
    }
  }

  choose(code, playerId, choice) {
    const room = this.#requireRoom(code);
    const player = this.#requirePlayer(room, playerId);
    if (room.game) throw new RoomError('GAME_STARTED', 'เกมเริ่มไปแล้ว เปลี่ยนคลาสไม่ได้');
    const { cls, starter } = choice ?? {};
    if (typeof cls !== 'string' || !CLASSES.includes(cls)) {
      throw new RoomError('BAD_CHOICE', 'เลือกคลาสไม่ถูกต้อง');
    }
    if (typeof starter !== 'string' || !own(STARTERS, starter)) {
      throw new RoomError('BAD_CHOICE', 'เลือกโปเกม่อนตัวเริ่มต้นไม่ถูกต้อง');
    }
    player.cls = cls;
    player.starter = starter;
  }

  startGame(code, playerId) {
    const room = this.#requireRoom(code);
    this.#requirePlayer(room, playerId);
    if (room.game) throw new RoomError('GAME_STARTED', 'เกมในห้องนี้เริ่มไปแล้ว');
    if (room.hostId !== playerId) {
      throw new RoomError('NOT_HOST', 'เฉพาะหัวหน้าห้องเท่านั้นที่เริ่มเกมได้');
    }
    if (room.players.length < MIN_PLAYERS) {
      throw new RoomError('NOT_READY', `ต้องมีผู้เล่นอย่างน้อย ${MIN_PLAYERS} คนจึงจะเริ่มเกมได้`);
    }
    if (room.players.some(p => !p.cls || !p.starter)) {
      throw new RoomError('NOT_READY', 'ผู้เล่นทุกคนต้องเลือกคลาสและโปเกม่อนตัวเริ่มต้นก่อน');
    }
    room.ctx = makeContext(this.pokedex, this.rng);
    room.game = createGame(
      room.players.map(({ id, name, cls, starter }) => ({ id, name, cls, starter })),
      room.ctx,
    );
    this.#armTimer(room);
  }

  // เดินหนึ่ง action ด้วย rng ของเซิร์ฟเวอร์ GameError ถูกโยนต่อโดยไม่แก้ไข
  act(code, playerId, action) {
    const room = this.#requireRoom(code);
    this.#requirePlayer(room, playerId);
    if (!room.game) throw new RoomError('NOT_STARTED', 'เกมยังไม่เริ่ม');
    const { state, events } = applyAction(room.game, playerId, action, room.ctx);
    room.game = state;
    this.#armTimer(room);
    return events;
  }

  close() {
    for (const room of this.rooms.values()) {
      this.#clearTurn(room);
      this.#clearIdle(room);
    }
    this.rooms.clear();
  }

  // ---- timers ----

  #clearTurn(room) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.deadline = null;
  }

  #clearIdle(room) {
    if (room.idleTimer) clearTimeout(room.idleTimer);
    room.idleTimer = null;
  }

  #deleteRoom(room) {
    this.#clearTurn(room);
    this.#clearIdle(room);
    if (this.rooms.get(room.code) === room) this.rooms.delete(room.code);
  }

  // ตั้งเวลาใหม่หลังการเปลี่ยนแปลงทุกครั้ง เกมจบแล้วไม่ตั้ง
  #armTimer(room) {
    this.#clearTurn(room);
    if (!room.game || room.game.phase !== 'playing') return;
    room.deadline = Date.now() + this.timeoutMs;
    room.turnTimer = setTimeout(() => this.#onTimeout(room), this.timeoutMs);
  }

  #onTimeout(room) {
    room.turnTimer = null;
    let events = [];
    try {
      events = this.#autoPlay(room);
    } catch (err) {
      console.error('auto-play failed', err);
    } finally {
      // ไม่ว่าจะเกิดอะไร ต้องตั้งเวลาต่อและแจ้งทุกคน เกมห้ามค้าง
      this.#armTimer(room);
      try {
        this.onUpdate(room, events);
      } catch (err) {
        console.error('onUpdate failed', err);
      }
    }
  }

  // เล่นแทนจนกว่าตาจะเปลี่ยน (actor เปลี่ยนหรือขึ้นตาใหม่) หรือเกมจบ
  // รวมถึงกรณีรอฝ่ายถูกท้าตอบ (step 'defend') เพราะ autoAction เลือก actor ให้เอง
  #autoPlay(room) {
    const collected = [];
    const startActor = actorOf(room.game);
    for (let i = 0; i < MAX_AUTO_STEPS; i++) {
      let step;
      try {
        step = autoAction(room.game);
        if (!step) break;
        const { state, events } = applyAction(room.game, step.actorId, step.action, room.ctx);
        room.game = state;
        collected.push(...events);
      } catch (err) {
        console.error('auto-play step failed', err);
        break;
      }
      if (room.game.phase !== 'playing') break;
      if (room.game.turn.step === 'roll' || actorOf(room.game) !== startActor) break;
    }
    return collected;
  }
}
