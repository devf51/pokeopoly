import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, RoomError, roomView } from '../../server/rooms.js';
import { pokedex, die } from '../helpers.js';

const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

function expectError(fn, code) {
  assert.throws(fn, e => {
    assert.ok(e instanceof RoomError, `expected RoomError, got ${e}`);
    assert.equal(e.code, code);
    assert.match(e.message, /[฀-๿]/, 'message should be Thai');
    return true;
  });
}

function manager(opts = {}) {
  return new RoomManager({ pokedex, rng: seeded(), ...opts });
}

// ห้อง 2 คน เลือกครบ เริ่มเกมแล้ว
function startedRoom(r) {
  const { code, playerId: a } = r.createRoom('Ash');
  const { playerId: b } = r.joinRoom(code, 'Misty');
  r.choose(code, a, { cls: 'catcher', starter: 'bulbasaur' });
  r.choose(code, b, { cls: 'merchant', starter: 'charmander' });
  r.startGame(code, a);
  return { code, a, b, room: r.getRoom(code) };
}

test('create and join', () => {
  const r = manager();
  const { code } = r.createRoom('Ash');
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  const joined = r.joinRoom(code, 'Misty');
  assert.equal(joined.reconnected, false);
  assert.equal(r.getRoom(code).players.length, 2);
  assert.equal(r.getRoom(code).hostId, r.getRoom(code).players[0].id);
  r.close();
});

test('room codes never contain I or O and are unique', () => {
  const r = manager();
  const codes = new Set();
  for (let i = 0; i < 300; i++) {
    const { code } = r.createRoom('P' + i);
    assert.match(code, /^[A-HJ-NP-Z]{4}$/);
    codes.add(code);
  }
  assert.equal(codes.size, 300);
  r.close();
});

test('join errors are Thai RoomErrors', () => {
  const r = manager();
  expectError(() => r.joinRoom('ZZZZ', 'Misty'), 'ROOM_NOT_FOUND');
  const { code } = r.createRoom('Ash');
  expectError(() => r.joinRoom(code, 'Ash'), 'NAME_TAKEN');
  expectError(() => r.joinRoom(code, '   '), 'BAD_NAME');
  r.joinRoom(code, 'Misty');
  r.joinRoom(code, 'Brock');
  r.joinRoom(code, 'Gary');
  expectError(() => r.joinRoom(code, 'Oak'), 'ROOM_FULL');
  r.close();
});

test('lowercase / padded room code still finds the room', () => {
  const r = manager();
  const { code } = r.createRoom('Ash');
  assert.equal(r.joinRoom(` ${code.toLowerCase()} `, 'Misty').reconnected, false);
  r.close();
});

test('new name after the game started is GAME_STARTED, full check wins for 5th', () => {
  const r = manager();
  const { code } = startedRoom(r);
  expectError(() => r.joinRoom(code, 'Brock'), 'GAME_STARTED');
  r.close();
});

test('reconnect by name returns the same player, even after the game started', () => {
  const r = manager();
  const { code, a, b } = startedRoom(r);
  expectError(() => r.joinRoom(code, 'Ash'), 'NAME_TAKEN');
  r.setConnected(code, a, false);
  assert.deepEqual(r.joinRoom(code, 'Ash'), { playerId: a, reconnected: true });
  assert.equal(r.getRoom(code).players.find(p => p.id === a).connected, true);
  r.setConnected(code, b, false);
  assert.deepEqual(r.joinRoom(code, 'Misty'), { playerId: b, reconnected: true });
  r.close();
});

test('reconnect in the lobby keeps choices', () => {
  const r = manager();
  const { code, playerId } = r.createRoom('Ash');
  r.choose(code, playerId, { cls: 'ranger', starter: 'pikachu' });
  r.setConnected(code, playerId, false);
  r.joinRoom(code, 'Ash');
  const p = r.getRoom(code).players[0];
  assert.equal(p.cls, 'ranger');
  assert.equal(p.starter, 'pikachu');
  r.close();
});

test('choose validates class and starter', () => {
  const r = manager();
  const { code, playerId } = r.createRoom('Ash');
  expectError(() => r.choose(code, playerId, { cls: 'wizard', starter: 'bulbasaur' }), 'BAD_CHOICE');
  expectError(() => r.choose(code, playerId, { cls: 'catcher', starter: 'mew' }), 'BAD_CHOICE');
  expectError(() => r.choose(code, playerId, undefined), 'BAD_CHOICE');
  expectError(() => r.choose(code, playerId, { cls: 'toString', starter: 'bulbasaur' }), 'BAD_CHOICE');
  expectError(() => r.choose(code, playerId, { cls: 'catcher', starter: 'constructor' }), 'BAD_CHOICE');
  r.close();
});

test('start requires host, 2+ players and complete choices', () => {
  const r = manager();
  const { code, playerId: a } = r.createRoom('Ash');
  r.choose(code, a, { cls: 'catcher', starter: 'bulbasaur' });
  expectError(() => r.startGame(code, a), 'NOT_READY'); // มีคนเดียว
  const { playerId: b } = r.joinRoom(code, 'Misty');
  expectError(() => r.startGame(code, b), 'NOT_HOST');
  expectError(() => r.startGame(code, a), 'NOT_READY'); // b ยังไม่เลือก
  r.choose(code, b, { cls: 'merchant', starter: 'charmander' });
  r.startGame(code, a);
  const room = r.getRoom(code);
  assert.equal(room.game.phase, 'playing');
  assert.equal(room.game.players.length, 2);
  expectError(() => r.startGame(code, a), 'GAME_STARTED');
  expectError(() => r.choose(code, a, { cls: 'ranger', starter: 'pikachu' }), 'GAME_STARTED');
  r.close();
});

test('act before start and unknown player are rejected in Thai', () => {
  const r = manager();
  const { code, playerId } = r.createRoom('Ash');
  expectError(() => r.act(code, playerId, { type: 'ROLL' }), 'NOT_STARTED');
  expectError(() => r.act('ZZZZ', playerId, { type: 'ROLL' }), 'ROOM_NOT_FOUND');
  expectError(() => r.act(code, 'nobody', { type: 'ROLL' }), 'NOT_IN_ROOM');
  r.close();
});

test('act passes GameError through with its original code and message', () => {
  const r = manager();
  const { code, room } = startedRoom(r);
  const waiting = room.game.order[1];
  assert.throws(() => r.act(code, waiting, { type: 'ROLL' }), e => {
    assert.equal(e.name, 'GameError');
    assert.equal(e.code, 'NOT_YOUR_TURN');
    assert.equal(e.message, 'ยังไม่ถึงตาของคุณ');
    return true;
  });
  r.close();
});

test('act applies the action with the server rng and returns events', () => {
  const r = manager({ rng: () => die(4) });
  const { code, room } = startedRoom(r);
  const first = room.game.order[0];
  const events = r.act(code, first, { type: 'ROLL' });
  assert.equal(events[0].type, 'rolled');
  assert.equal(events[0].value, 4);
  assert.equal(r.getRoom(code).game.turn.step, 'move');
  r.close();
});

test('roomView gives each viewer their own game view and never leaks hidden tiles', () => {
  const r = manager();
  const { code, a, room } = startedRoom(r);
  const view = roomView(room, a);
  assert.equal(view.code, code);
  assert.equal(view.hostId, a);
  assert.equal(view.phase, 'playing');
  assert.deepEqual(Object.keys(view.players[0]).sort(), ['cls', 'connected', 'id', 'name', 'starter']);
  assert.ok(view.game.board.filter(t => t.type === 'wild').every(t => t.dexId === null));
  assert.ok(room.game.board.filter(t => t.type === 'wild').every(t => t.dexId !== null));
  assert.equal(typeof view.deadline, 'number');
  assert.equal(r.roomView(room, a).phase, 'playing');
  r.close();
});

test('roomView in the lobby has no game and no deadline', () => {
  const r = manager();
  const { code } = r.createRoom('Ash');
  const view = roomView(r.getRoom(code), 'x');
  assert.equal(view.phase, 'lobby');
  assert.equal(view.game, null);
  assert.equal(view.deadline, null);
  r.close();
});

test('timeout auto-plays the whole turn and passes it on', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const updates = [];
  const r = manager({ timeoutMs: 1000, onUpdate: (room, events) => updates.push({ room, events }) });
  const { code, room } = startedRoom(r);
  const [first, second] = room.game.order;
  assert.equal(room.game.turn.playerId, first);

  t.mock.timers.tick(999);
  assert.equal(updates.length, 0);
  t.mock.timers.tick(1);

  assert.equal(updates.length, 1);
  assert.ok(updates[0].events.length > 0);
  assert.equal(r.getRoom(code).game.turn.playerId, second);
  assert.equal(r.getRoom(code).game.turn.step, 'roll');
  r.close();
});

test('timer is re-armed after every action and after auto-play', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const r = manager({ timeoutMs: 1000, onUpdate: () => updates++ });
  const { code, room } = startedRoom(r);
  t.mock.timers.tick(900);
  r.act(code, room.game.order[0], { type: 'ROLL' }); // reset
  t.mock.timers.tick(900);
  assert.equal(updates, 0);
  t.mock.timers.tick(100);
  assert.equal(updates, 1);
  t.mock.timers.tick(1000); // ตาถัดไปก็ถูกเล่นแทนต่อ
  assert.equal(updates, 2);
  r.close();
});

test('timeout resolves a pending defend and the game keeps going', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const r = manager({ timeoutMs: 1000, onUpdate: () => updates++ });
  const { code, room } = startedRoom(r);
  const [first, second] = room.game.order;
  const game = room.game;
  game.players.find(p => p.id === first).position = 5;
  game.players.find(p => p.id === second).position = 5;
  game.turn.step = 'challenge';
  const attackerMon = game.players.find(p => p.id === first).mons[0];
  r.act(code, first, { type: 'CHALLENGE', targetId: second, uid: attackerMon.uid, charmander: false });
  assert.equal(r.getRoom(code).game.turn.step, 'defend');

  t.mock.timers.tick(1000);

  const after = r.getRoom(code).game;
  assert.equal(updates, 1);
  assert.notEqual(after.turn.step, 'defend');
  assert.equal(after.turn.battle, null);
  assert.equal(after.turn.playerId, second);
  r.close();
});

test('timeout never stalls: errors inside auto-play are swallowed and the timer re-arms', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a);
  try {
    let updates = 0;
    const r = manager({ timeoutMs: 1000, onUpdate: () => updates++ });
    const { code, room } = startedRoom(r);
    room.game.turn.step = 'bogus'; // สถานะที่ autoAction เล่นต่อไม่ได้
    t.mock.timers.tick(1000);
    assert.ok(errors.length > 0);
    // ซ่อมสถานะแล้วรอบถัดไปต้องเดินต่อ
    room.game.turn.step = 'roll';
    t.mock.timers.tick(1000);
    assert.equal(r.getRoom(code).game.turn.playerId, room.game.order[1]);
    r.close();
  } finally {
    console.error = orig;
  }
});

test('a finished game clears its timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const r = manager({ timeoutMs: 1000, onUpdate: () => updates++ });
  const { code, room } = startedRoom(r);
  room.game.phase = 'ended';
  t.mock.timers.tick(1000);
  assert.equal(updates, 1); // auto เจอ null → จบโดยไม่เล่น
  t.mock.timers.tick(5000);
  assert.equal(updates, 1);
  assert.equal(roomView(r.getRoom(code), 'x').deadline, null);
  assert.equal(roomView(r.getRoom(code), 'x').phase, 'ended');
  r.close();
});

test('room is deleted after everyone has been gone for idleMs', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = manager({ idleMs: 5000 });
  const { code, a, b } = startedRoom(r);
  r.setConnected(code, a, false);
  t.mock.timers.tick(4000);
  r.setConnected(code, b, false);
  t.mock.timers.tick(4999);
  assert.ok(r.getRoom(code));
  t.mock.timers.tick(1);
  expectError(() => r.joinRoom(code, 'Ash'), 'ROOM_NOT_FOUND');
  r.close();
});

test('someone coming back cancels the idle deletion', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = manager({ idleMs: 5000 });
  const { code, a, b } = startedRoom(r);
  r.setConnected(code, a, false);
  r.setConnected(code, b, false);
  t.mock.timers.tick(4000);
  r.joinRoom(code, 'Ash');
  t.mock.timers.tick(10000);
  assert.ok(r.getRoom(code));
  r.close();
});

test('a deleted room stops its turn timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const r = manager({ timeoutMs: 1000, idleMs: 500, onUpdate: () => updates++ });
  const { code, a, b } = startedRoom(r);
  r.setConnected(code, a, false);
  r.setConnected(code, b, false);
  t.mock.timers.tick(500);
  assert.equal(r.getRoom(code), undefined);
  t.mock.timers.tick(5000);
  assert.equal(updates, 0);
  r.close();
});

test('close() clears every timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const r = manager({ timeoutMs: 1000, idleMs: 500, onUpdate: () => updates++ });
  startedRoom(r);
  const other = r.createRoom('Gary');
  r.setConnected(other.code, other.playerId, false); // idle timer
  r.close();
  t.mock.timers.tick(100000);
  assert.equal(updates, 0);
  assert.equal(r.rooms.size, 0);
});
