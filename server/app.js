import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { GameError } from '../shared/engine/errors.js';
import { RoomError, RoomManager, roomView } from './rooms.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// ส่ง room:update ให้ทุก socket ในห้อง แต่ละคนได้มุมมองของตัวเอง (ผ่าน roomView -> viewFor)
function broadcast(io, room, events = []) {
  const members = io.sockets.adapter.rooms.get(room.code);
  if (!members) return;
  for (const id of members) {
    const socket = io.sockets.sockets.get(id);
    if (!socket) continue;
    socket.emit('room:update', { room: roomView(room, socket.data.playerId), events });
  }
}

// สร้างเซิร์ฟเวอร์ HTTP + Socket.IO; options ที่เหลือส่งต่อให้ RoomManager (rng, timeoutMs, idleMs, onUpdate)
export function createServer({ pokedex, onUpdate, ...roomOptions }) {
  const app = express();
  app.use('/shared', express.static(root + 'shared'));
  app.use('/data', express.static(root + 'data'));
  app.use('/', express.static(root + 'public'));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer);

  const rooms = new RoomManager({
    pokedex,
    ...roomOptions,
    onUpdate: (room, events) => {
      broadcast(io, room, events);
      onUpdate?.(room, events);
    },
  });

  // ถอด socket ออกจากห้อง (ปิดการเชื่อมต่อ หรือสร้าง/เข้าห้องใหม่) แล้วแจ้งคนที่เหลือ
  function release(socket) {
    const { code, playerId } = socket.data;
    if (!code) return;
    socket.leave(code);
    socket.data.code = null;
    socket.data.playerId = null;
    const room = rooms.getRoom(code);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    // ถ้าผู้เล่นคนนี้กลับเข้ามาด้วย socket ใหม่แล้ว อย่าเขียนทับด้วย "หลุด"
    const stillHere = [...(io.sockets.adapter.rooms.get(code) ?? [])]
      .some(id => io.sockets.sockets.get(id)?.data.playerId === playerId);
    if (player && !stillHere) {
      rooms.setConnected(code, playerId, false);
      broadcast(io, room);
    }
  }

  function attach(socket, code, playerId) {
    release(socket);
    socket.data.code = code;
    socket.data.playerId = playerId;
    socket.join(code);
  }

  function requireMembership(socket) {
    const { code, playerId } = socket.data;
    if (!code || !rooms.getRoom(code)) {
      throw new RoomError('NOT_IN_ROOM', 'คุณยังไม่ได้เข้าห้อง');
    }
    return { code, playerId };
  }

  // handler คืน { reply, events } ; ack ส่งก่อน แล้วค่อย broadcast เพื่อให้ client รู้ playerId ก่อนได้ room:update
  function on(socket, event, handler) {
    socket.on(event, (payload, ack) => {
      if (typeof payload === 'function') [payload, ack] = [undefined, payload];
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const result = handler(payload ?? {}) ?? {};
        reply({ ok: true, ...result.reply });
        if (result.code) {
          const room = rooms.getRoom(result.code);
          if (room) broadcast(io, room, result.events ?? []);
        }
      } catch (err) {
        if (err instanceof RoomError || err instanceof GameError) {
          reply({ ok: false, error: { code: err.code, message: err.message } });
        } else {
          console.error(`${event} failed`, err);
          reply({ ok: false, error: { code: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ ลองใหม่อีกครั้ง' } });
        }
      }
    });
  }

  io.on('connection', (socket) => {
    on(socket, 'room:create', ({ name }) => {
      const { code, playerId } = rooms.createRoom(name);
      attach(socket, code, playerId);
      return { reply: { code, playerId }, code };
    });

    on(socket, 'room:join', ({ code, name }) => {
      const joined = rooms.joinRoom(code, name);
      const roomCode = rooms.getRoom(code).code;
      attach(socket, roomCode, joined.playerId);
      return { reply: { playerId: joined.playerId, reconnected: joined.reconnected }, code: roomCode };
    });

    on(socket, 'lobby:choose', ({ cls, starter }) => {
      const { code, playerId } = requireMembership(socket);
      rooms.choose(code, playerId, { cls, starter });
      return { code };
    });

    on(socket, 'lobby:start', () => {
      const { code, playerId } = requireMembership(socket);
      rooms.startGame(code, playerId);
      return { code };
    });

    on(socket, 'game:action', ({ action }) => {
      const { code, playerId } = requireMembership(socket);
      const events = rooms.act(code, playerId, action);
      return { code, events };
    });

    socket.on('disconnect', () => release(socket));
  });

  function listen(port, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, host, () => {
        httpServer.off('error', reject);
        resolve(httpServer.address().port);
      });
    });
  }

  // ปิดทุกอย่าง: timer ของทุกห้อง, socket ทุกตัว และ HTTP server
  async function close() {
    rooms.close();
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
  }

  return { httpServer, io, rooms, listen, close };
}
