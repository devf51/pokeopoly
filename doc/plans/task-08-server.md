# Task 8: เซิร์ฟเวอร์ — ห้อง Socket.IO หมดเวลา และหลุดแล้วกลับเข้า

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `server-socket`

[← Task 7](task-07-engine-challenge-auto-view.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 9 →](task-09-ui-lobby-board.md)

**Files:**
- Create: `server/rooms.js`, `server/app.js`, `server/index.js`
- Test: `test/server/rooms.test.js`, `test/server/socket.test.js`

**Interfaces:**
- Consumes: `makeContext`, `createGame`, `applyAction`, `autoAction`, `actorOf`, `viewFor`, `GameError`
- Produces:
  - `class RoomError extends Error { constructor(code, message) }` codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`, `GAME_STARTED`, `NOT_HOST`, `NOT_READY` (คนไม่ถึง 2 หรือยังเลือกคลาส/ตัวเริ่มต้นไม่ครบ), `BAD_CHOICE`
  - `new RoomManager({ pokedex, rng = Math.random, timeoutMs = TURN_TIMEOUT_MS, idleMs = ROOM_IDLE_MS, onUpdate = (room, events) => {} })`
    - `createRoom(name) → { code, playerId }`
    - `joinRoom(code, name) → { playerId, reconnected }` (ชื่อซ้ำกับคนที่หลุดอยู่ = กลับเข้าตัวเดิม)
    - `setConnected(code, playerId, connected)` (ถ้าไม่มีใครเชื่อมต่อเลย ตั้งเวลาลบห้องตาม `idleMs`)
    - `choose(code, playerId, { cls, starter })`, `startGame(code, playerId)` (host เท่านั้น)
    - `act(code, playerId, action) → events` (แปลง `GameError` ให้ caller เห็น code กับ message เดิม) หลังทุกการเปลี่ยนแปลงให้ตั้งเวลาใหม่ `timeoutMs` เมื่อครบเวลา: เล่น `autoAction` ซ้ำจนกว่า actor จะเปลี่ยนหรือเกมจบ แล้วเรียก `onUpdate`
    - `roomView(room, viewerId) → { code, hostId, phase: 'lobby'|'playing'|'ended', players: [{ id, name, cls, starter, connected }], game: viewFor(...)|null, deadline: number|null }`
  - `createServer({ pokedex, rooms options... }) → { httpServer, io, rooms, listen(port) → Promise<port>, close() }` ใน `server/app.js`: เสิร์ฟ static `public/` ที่ `/`, `shared/` ที่ `/shared`, `data/` ที่ `/data`
  - Socket events (ทุก event ฝั่ง client→server ใช้ ack `(res) => res.ok ? ... : res.error.message`):

    | client → server | payload | ack สำเร็จ |
    |---|---|---|
    | `room:create` | `{ name }` | `{ ok: true, code, playerId }` |
    | `room:join` | `{ code, name }` | `{ ok: true, playerId, reconnected }` |
    | `lobby:choose` | `{ cls, starter }` | `{ ok: true }` |
    | `lobby:start` | `{}` | `{ ok: true }` |
    | `game:action` | `{ action }` | `{ ok: true }` |

    server → client: `room:update { room: roomView(room, ผู้รับ), events }` ส่งให้ทุก socket ในห้อง แต่ละคนได้มุมมองของตัวเอง
  - `server/index.js`: โหลด `data/pokedex.json` แล้ว `listen(process.env.PORT || 3000)` ที่ `0.0.0.0` พิมพ์ URL ของทุก IPv4 ที่ไม่ใช่ internal จาก `os.networkInterfaces()` (เพื่อแจก IP ให้เพื่อน)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
// rooms.test.js (ใช้ mock.timers จาก node:test สำหรับ setTimeout)
test('create and join', () => {
  const r = new RoomManager({ pokedex });
  const { code, playerId } = r.createRoom('Ash');
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  assert.equal(r.joinRoom(code, 'Misty').reconnected, false);
});
test('join errors', () => {
  // รหัสผิด → ROOM_NOT_FOUND; ชื่อซ้ำกับคนที่ยังต่ออยู่ → NAME_TAKEN; คนที่ 5 → ROOM_FULL
  // เริ่มเกมแล้วเข้าด้วยชื่อใหม่ → GAME_STARTED
});
test('reconnect by name returns the same player', () => {
  // setConnected(code, id, false) แล้ว joinRoom(code, 'Ash') → { playerId: id, reconnected: true }
});
test('start requires host, 2+ players and complete choices', () => {
  // คนที่ไม่ใช่ host → NOT_HOST; มีคนเดียว → NOT_READY; ยังไม่เลือก starter → NOT_READY; cls 'wizard' → BAD_CHOICE
});
test('timeout auto-plays the whole turn, including a pending defend', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // เริ่มเกม timeoutMs 1000, tick(1000) → game.turn.playerId เป็นคนที่สองใน order และ onUpdate ถูกเรียก
  // ตั้งสถานะ step 'defend' (คนท้าส่ง CHALLENGE แล้วฝ่ายรับไม่ตอบ) tick(1000) → การต่อสู้จบและตาเปลี่ยน
});
test('room is deleted after everyone has been gone for idleMs', (t) => { /* tick(idleMs) แล้ว joinRoom → ROOM_NOT_FOUND */ });

// socket.test.js
test('two clients can create, join, start and roll', async () => {
  // createServer + listen(0); client A room:create, client B room:join
  // ทั้งคู่ lobby:choose, A lobby:start
  // ฝ่ายที่เป็นตาแรกส่ง game:action {type:'ROLL'} → ทั้งสองได้ room:update ที่ game.turn.step === 'move'
  // ฝ่ายที่ไม่ใช่ตาส่ง ROLL → ack { ok:false, error.code:'NOT_YOUR_TURN' }
  // ปิด client และ server ตอนจบ
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/server/` / Expected: FAIL
- [ ] **Step 3: เขียน `server/rooms.js`, `server/app.js`, `server/index.js`**
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: ทดสอบมือ** — Run: `npm start` / Expected: เห็นข้อความเช่น `http://192.168.x.x:3000` และ `curl -s localhost:3000/shared/constants.js | head -1` ได้เนื้อไฟล์
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: socket.io rooms with timeouts and reconnect"`

---

[← Task 7](task-07-engine-challenge-auto-view.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 9 →](task-09-ui-lobby-board.md)
