import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import { createServer } from '../../server/app.js';
import { pokedex, die } from '../helpers.js';

// เปิดเซิร์ฟเวอร์จริงบนพอร์ตสุ่ม และคืนฟังก์ชันสร้าง client ที่ถูกปิดให้ตอนจบ
async function setup(options = {}) {
  const server = createServer({ pokedex, rng: () => die(3), ...options });
  const port = await server.listen(0);
  const clients = [];
  const client = () => {
    const c = connect(`http://127.0.0.1:${port}`, { forceNew: true, transports: ['websocket'] });
    c.updates = [];
    c.on('room:update', u => c.updates.push(u));
    clients.push(c);
    return c;
  };
  const stop = async () => {
    for (const c of clients) c.close();
    await server.close();
  };
  return { server, port, client, stop };
}

const emit = (c, event, payload) => new Promise(resolve => c.emit(event, payload, resolve));

async function waitFor(pred, what = 'condition') {
  for (let i = 0; i < 200; i++) {
    if (pred()) return;
    await new Promise(r => setTimeout(r, 10));
  }
  assert.fail(`timed out waiting for ${what}`);
}

const last = c => c.updates[c.updates.length - 1];

async function startedPair(env) {
  const A = env.client();
  const B = env.client();
  const created = await emit(A, 'room:create', { name: 'Ash' });
  const joined = await emit(B, 'room:join', { code: created.code, name: 'Misty' });
  await emit(A, 'lobby:choose', { cls: 'catcher', starter: 'bulbasaur' });
  await emit(B, 'lobby:choose', { cls: 'ranger', starter: 'pikachu' });
  const started = await emit(A, 'lobby:start', {});
  assert.deepEqual(started, { ok: true });
  await waitFor(() => last(A)?.room.phase === 'playing' && last(B)?.room.phase === 'playing', 'game start');
  return { A, B, code: created.code, idA: created.playerId, idB: joined.playerId };
}

test('two clients can create, join, start and roll', async () => {
  const env = await setup();
  try {
    const A = env.client();
    const B = env.client();
    const created = await emit(A, 'room:create', { name: 'Ash' });
    assert.equal(created.ok, true);
    assert.match(created.code, /^[A-HJ-NP-Z]{4}$/);
    assert.equal(typeof created.playerId, 'string');

    const joined = await emit(B, 'room:join', { code: created.code, name: 'Misty' });
    assert.equal(joined.ok, true);
    assert.equal(joined.reconnected, false);
    await waitFor(() => last(A)?.room.players.length === 2, 'A sees B');

    assert.deepEqual(await emit(A, 'lobby:choose', { cls: 'catcher', starter: 'bulbasaur' }), { ok: true });
    assert.deepEqual(await emit(B, 'lobby:choose', { cls: 'ranger', starter: 'pikachu' }), { ok: true });
    assert.deepEqual(await emit(A, 'lobby:start', {}), { ok: true });
    await waitFor(() => last(A)?.room.game && last(B)?.room.game, 'game views');

    const ids = { [created.playerId]: A, [joined.playerId]: B };
    const turnId = last(A).room.game.turn.playerId;
    const other = turnId === created.playerId ? joined.playerId : created.playerId;
    assert.equal(last(B).room.game.turn.playerId, turnId);

    const bad = await emit(ids[other], 'game:action', { action: { type: 'ROLL' } });
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, 'NOT_YOUR_TURN');
    assert.equal(bad.error.message, 'ยังไม่ถึงตาของคุณ');

    const before = { A: A.updates.length, B: B.updates.length };
    assert.deepEqual(await emit(ids[turnId], 'game:action', { action: { type: 'ROLL' } }), { ok: true });
    await waitFor(() => A.updates.length > before.A && B.updates.length > before.B, 'roll updates');
    for (const c of [A, B]) {
      const u = last(c);
      assert.equal(u.room.game.turn.step, 'move');
      assert.equal(u.room.game.turn.roll, 3);
      assert.equal(u.events[0].type, 'rolled');
    }
  } finally {
    await env.stop();
  }
});

test('each client only receives its own view and never raw wild pokemon', async () => {
  const env = await setup();
  try {
    const { A, B } = await startedPair(env);
    for (const c of [A, B]) {
      const wilds = last(c).room.game.board.filter(t => t.type === 'wild');
      assert.ok(wilds.length > 0);
      assert.ok(wilds.every(t => t.dexId === null));
    }
    assert.equal(typeof last(A).room.deadline, 'number');
  } finally {
    await env.stop();
  }
});

test('join errors come back in Thai through the ack', async () => {
  const env = await setup();
  try {
    const A = env.client();
    const B = env.client();
    const C = env.client();
    const { code } = await emit(A, 'room:create', { name: 'Ash' });

    const wrong = await emit(B, 'room:join', { code: 'ZZZZ', name: 'Misty' });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.error.code, 'ROOM_NOT_FOUND');
    assert.match(wrong.error.message, /[฀-๿]/);

    const dup = await emit(B, 'room:join', { code, name: 'Ash' });
    assert.equal(dup.error.code, 'NAME_TAKEN');
    assert.match(dup.error.message, /[฀-๿]/);

    await emit(B, 'room:join', { code, name: 'Misty' });
    await emit(C, 'room:join', { code, name: 'Brock' });
    const D = env.client();
    const E = env.client();
    await emit(D, 'room:join', { code, name: 'Gary' });
    const full = await emit(E, 'room:join', { code, name: 'Oak' });
    assert.equal(full.error.code, 'ROOM_FULL');
    assert.match(full.error.message, /[฀-๿]/);
  } finally {
    await env.stop();
  }
});

test('lobby and action errors: not host, not ready, bad choice, not in room, malformed payloads', async () => {
  const env = await setup();
  try {
    const A = env.client();
    const B = env.client();
    const stray = env.client();
    assert.equal((await emit(stray, 'lobby:start', {})).error.code, 'NOT_IN_ROOM');
    assert.equal((await emit(stray, 'game:action', { action: { type: 'ROLL' } })).error.code, 'NOT_IN_ROOM');
    assert.equal((await emit(stray, 'room:create', {})).error.code, 'BAD_NAME');
    assert.equal((await emit(stray, 'room:join', undefined)).error.code, 'ROOM_NOT_FOUND');

    const { code } = await emit(A, 'room:create', { name: 'Ash' });
    await emit(B, 'room:join', { code, name: 'Misty' });
    assert.equal((await emit(B, 'lobby:start', {})).error.code, 'NOT_HOST');
    assert.equal((await emit(A, 'lobby:start', {})).error.code, 'NOT_READY');
    assert.equal((await emit(A, 'lobby:choose', { cls: 'wizard', starter: 'pikachu' })).error.code, 'BAD_CHOICE');
    assert.equal((await emit(A, 'game:action', { action: { type: 'ROLL' } })).error.code, 'NOT_STARTED');
  } finally {
    await env.stop();
  }
});

test('a started game rejects newcomers but lets a dropped player come back by name', async () => {
  const env = await setup();
  try {
    const { A, B, code, idB } = await startedPair(env);
    const late = env.client();
    assert.equal((await emit(late, 'room:join', { code, name: 'Brock' })).error.code, 'GAME_STARTED');

    B.close();
    await waitFor(() => last(A).room.players.find(p => p.id === idB).connected === false, 'B marked offline');

    const B2 = env.client();
    const back = await emit(B2, 'room:join', { code, name: 'Misty' });
    assert.deepEqual(back, { ok: true, playerId: idB, reconnected: true });
    await waitFor(() => last(B2)?.room.phase === 'playing', 'B2 gets the game');
    await waitFor(() => last(A).room.players.find(p => p.id === idB).connected === true, 'B marked online');
    assert.equal(last(B2).room.game.players.length, 2);

    // ชื่อเดียวกันขณะที่ออนไลน์อยู่ ใช้ไม่ได้
    const B3 = env.client();
    assert.equal((await emit(B3, 'room:join', { code, name: 'Misty' })).error.code, 'NAME_TAKEN');
  } finally {
    await env.stop();
  }
});

test('timeout auto-plays over the socket and everyone gets the update', async () => {
  const env = await setup({ timeoutMs: 100 });
  try {
    const { A, B } = await startedPair(env);
    const first = last(A).room.game.turn.playerId;
    await waitFor(() => last(A).room.game.turn.playerId !== first, 'turn passed by timeout');
    await waitFor(() => last(B).room.game.turn.playerId !== first, 'B sees turn pass');
    assert.ok(last(A).events.some(e => e.type === 'rolled'));
  } finally {
    await env.stop();
  }
});

test('close() leaves no open handles: server and clients shut down cleanly', async () => {
  const env = await setup({ timeoutMs: 60000, idleMs: 600000 });
  const { A } = await startedPair(env);
  const closed = once(A, 'disconnect');
  await env.stop();
  await closed;
  assert.equal(env.server.rooms.rooms.size, 0);
});
