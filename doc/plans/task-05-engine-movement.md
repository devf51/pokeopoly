# Task 5: Engine — สร้างเกม สุ่มโปเกม่อน เดิน และวนตา

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 4](task-04-catch-economy.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 6 →](task-06-engine-tiles.md)

**Files:**
- Create: `shared/engine/errors.js`, `shared/engine/context.js`, `shared/engine/spawn.js`, `shared/engine/state.js`, `shared/engine/turn.js`, `shared/engine/index.js`
- Test: `test/shared/engine-move.test.js`, `test/shared/spawn.test.js`; Modify: `test/helpers.js`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces:
  - `class GameError extends Error { constructor(code, message) }` (message ภาษาไทย)
  - `makeContext(pokedex, rng = Math.random) → { pokedex, byId: Map<number, entry>, pools, rng }`
  - `spawnFor(zone, state, ctx) → dexId` (Plan Decisions ข้อ 4; โซน 5 ทอย `ctx.rng() < LEGENDARY_CHANCE` ก่อน แล้วค่อย `pick`)
  - `createGame(players: [{ id, name, cls, starter }], ctx) → GameState` (สลับลำดับด้วย `shuffle`, สุ่มโปเกม่อนลงทุกช่อง wild, ตัวเริ่มต้นเป็น Mon `uid` 1.., `turn = { playerId: order[0], step: 'roll', ... }`)
  - `applyAction(state, actorId, action, ctx) → { state, events }`: clone ด้วย `structuredClone` ก่อนแก้ ถ้าผิดกติกาให้ throw `GameError` และสถานะเดิมต้องไม่เปลี่ยน
  - ใน `turn.js`: `moveBy(state, player, steps, events)`, `enterTile(state, events, ctx)` (ตั้ง step ตามชนิดช่อง; ช่อง wild → `'catch'`), `afterTile(state, events)` (ตอนนี้แค่เรียก `endTurn`; Task 7 จะเพิ่มการเช็กท้าสู้), `endTurn(state, events)` (ไปผู้เล่นถัดไปที่ยังไม่ finished ถ้าทุกคน finished ให้ `phase = 'ended'`, ใส่ `result`, ส่ง event `gameOver`)
  - Actions ที่ task นี้รับ: `ROLL`, `SQUIRTLE_WARP`, `CONFIRM_MOVE`, `RANGER_REROLL`, `RANGER_ADJUST`, `PIKACHU_REROLL` (เฉพาะใน step `move`), `SKIP` (ใน step `catch`), `DONE` (ใน step `shop`/`center`)
  - `test/helpers.js` เพิ่ม `pokedex` (อ่านจาก `data/pokedex.json`), `newGame({ players, rngValues }) → { state, ctx }` (ค่าเริ่มต้น: `p1` catcher/bulbasaur, `p2` merchant/charmander, บังคับ `state.order = ['p1', 'p2']`), `act(state, ctx, actorId, action, rngValues = [])` (ตั้ง `ctx.rng = fixedRng(rngValues)` แล้วเรียก `applyAction`)

กติกาการเดิน (`moveBy`): ก้าวทีละช่อง ทุกครั้งที่ข้ามหรือหยุดที่ index 0 ให้ `laps++` และได้ `salaryFor(cls)` ถ้า `laps` ถึง `LAPS_TO_FINISH` ให้หยุดที่ 0 ทันที `finished = true` ถ้าเป็นคนแรกได้ `FIRST_FINISHER_BONUS` แล้วเข้าช่องจุดเริ่มต้น (`'shop'`)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน** (ใน `engine-move.test.js` ใช้ `die(n)` ใส่ใน `rngValues`)

```js
test('ROLL then CONFIRM_MOVE moves and enters a wild tile', () => {
  let { state, ctx } = newGame();
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(3)]));
  assert.equal(state.turn.step, 'move');
  assert.equal(state.turn.roll, 3);
  ({ state } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }));
  assert.equal(state.players[0].position, 3);
  assert.equal(state.turn.step, 'catch');
});
test('passing start pays salary and counts a lap', () => {
  let { state, ctx } = newGame();
  state.players[0].position = 30;
  ({ state } = act(state, ctx, 'p1', { type: 'ROLL' }, [die(4)]));
  const { state: s, events } = act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' });
  assert.deepEqual([s.players[0].position, s.players[0].laps, s.players[0].money], [2, 1, 700]);
  assert.ok(events.some(e => e.type === 'salary' && e.amount === 200));
});
test('landing exactly on start opens the shop', () => { /* position 28, roll 4 → position 0, step 'shop', money 700 */ });
test('second lap stops at start, finishes, first finisher gets bonus once', () => {
  // p1 laps=1 position=30 roll 6 → position 0, finished true, money 500+200+300=1000, step 'shop'
  // แล้วให้ p2 (merchant) laps=1 position=31 roll 5 → finished, money 500+300 (ไม่มีโบนัส)
});
test('ranger adjust clamps to 1..7 and uses run out after two', () => {
  // p1 cls ranger: roll 1, RANGER_ADJUST -1 → roll 1, classUses 1; RANGER_ADJUST +1 → roll 2, classUses 0
  // RANGER_ADJUST อีกครั้ง → throws GameError code 'NO_USES'
});
test('pikachu reroll in move step uses the starter ability once', () => { /* starterUsed true; ครั้งที่สอง NO_USES */ });
test('squirtle warp replaces the roll', () => {
  // p1 starter squirtle: SQUIRTLE_WARP {steps:4} → position 4, starterUsed true
  // {steps:7} → INVALID_ACTION
});
test('wrong actor and wrong step are rejected without touching state', () => {
  const { state, ctx } = newGame();
  const before = structuredClone(state);
  assert.throws(() => act(state, ctx, 'p2', { type: 'ROLL' }), { code: 'NOT_YOUR_TURN' });
  assert.throws(() => act(state, ctx, 'p1', { type: 'CONFIRM_MOVE' }), { code: 'INVALID_ACTION' });
  assert.deepEqual(state, before);
});
test('turns skip finished players and game ends when all finish', () => {
  // p2 finished; p1 SKIP ใน step 'catch' → turn ยังเป็น p1 (p2 ถูกข้าม)
  // p1 ครบรอบที่ 2 แล้ว DONE ที่จุดเริ่มต้น → phase 'ended', result.ranking เรียงตาม total, winnerIds ถูกต้อง, มี event gameOver
});
```

```js
// spawn.test.js
test('zone pools are respected', () => { /* spawnFor(2, ...) คืน id ที่อยู่ใน ctx.pools[2] */ });
test('zone 5 may spawn a legendary at 5% chance', () => {
  // ล้าง dexId ทุกช่องบนกระดานก่อน (createGame อาจสุ่มตัวตำนานลงไปแล้ว)
  // rng [0.01, 0] → LEGENDARY_IDS[0]; rng [0.5, 0] → id จาก pools[5]
});
test('legendaries are unique per game', () => {
  // caughtLegendaries = [144,145,146,150] และ 151 อยู่บนช่อง wild ช่องหนึ่ง → rng [0.01, 0] ต้องได้ตัวจาก pools[5]
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/engine-move.test.js test/shared/spawn.test.js` / Expected: FAIL
- [ ] **Step 3: เขียนไฟล์ engine ตาม Interfaces** (`applyAction` ใน `index.js` ใช้ map `{ [step]: { [type]: handler } }` handler รับ `(state, player, action, events, ctx)`)
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: game engine setup, spawning, movement and turn flow"`

---

[← Task 4](task-04-catch-economy.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 6 →](task-06-engine-tiles.md)
