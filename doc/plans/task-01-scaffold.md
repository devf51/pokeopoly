# Task 1: โครงโปรเจกต์ ค่าคงที่ ลูกเต๋า และผังกระดาน

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 2 →](task-02-pokedex.md)

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`), `shared/constants.js`, `shared/rng.js`, `shared/board.js`, `test/helpers.js`
- Test: `test/shared/board.test.js`, `test/shared/rng.test.js`

**Interfaces:**
- Produces:
  - `shared/constants.js` export ค่าตามนี้ (คัดจากสเปก):
    ```js
    BOARD_SIZE = 32; LAPS_TO_FINISH = 2; MIN_PLAYERS = 2; MAX_PLAYERS = 4
    STARTING_MONEY = 500; STARTING_BALLS = { poke: 5, great: 0, ultra: 0 }
    SALARY = 200; MERCHANT_SALARY = 300; FIRST_FINISHER_BONUS = 300
    BALLS = { poke: { bonus: 0, price: 50 }, great: { bonus: 1, price: 120 }, ultra: { bonus: 2, price: 250 } }
    MERCHANT_DISCOUNT = 0.3
    ZONE_TARGET = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, legendary: 7 }
    ZONE_VALUE = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 800, legendary: 2000 }
    LEGENDARY_IDS = [144, 145, 146, 150, 151]; LEGENDARY_CHANCE = 0.05
    HEAL_RATE = 0.2; BATTLE_PENALTY_RATE = 0.1
    CLASS_USES = 2; PROFESSOR_VISION = 6; SQUIRTLE_MAX_WARP = 6
    TURN_TIMEOUT_MS = 60000; ROOM_IDLE_MS = 600000
    CLASSES = ['catcher', 'merchant', 'ranger', 'professor']
    STARTERS = { bulbasaur: 1, charmander: 4, squirtle: 7, pikachu: 25 }   // ชื่อ → dexId
    ```
  - `rollD6(rng: () => number) → 1..6` (`1 + Math.floor(rng() * 6)`), `pick(arr, rng)`, `shuffle(arr, rng)` (Fisher–Yates คืน array ใหม่)
  - `buildBoard() → Tile[]` ตามผังใน Plan Decisions ข้อ 2 (`dexId: null` ทุกช่อง)
  - `test/helpers.js`: `die(n) → number` (ค่า rng ที่ทำให้ `rollD6` ได้ `n` คือ `(n - 0.5) / 6`), `fixedRng(values) → () => number` (คืนค่าตามลำดับ ถ้าหมดให้ throw `Error('rng exhausted')`)

- [ ] **Step 1: เริ่ม git และ npm**

Run: `git init && npm init -y && npm pkg set type=module scripts.test="node --test" scripts.start="node server/index.js" && npm i express@4 socket.io@4 && npm i -D socket.io-client@4`
Expected: มี `package.json` ที่มี `"type": "module"` และ `node_modules/`

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
// test/shared/board.test.js
test('board has 32 tiles with the right type counts', () => {
  const b = buildBoard();
  const count = t => b.filter(x => x.type === t).length;
  assert.equal(b.length, 32);
  assert.equal(b[0].type, 'start');
  assert.deepEqual([count('start'), count('mart'), count('center'), count('wild')], [1, 2, 2, 27]);
  assert.deepEqual([b[4].type, b[20].type, b[11].type, b[26].type], ['mart', 'mart', 'center', 'center']);
});
test('wild zones never decrease along the path and have sizes 6/6/5/5/5', () => {
  const zones = buildBoard().filter(t => t.type === 'wild').map(t => t.zone);
  assert.deepEqual(zones, [...zones].sort((a, b) => a - b));
  assert.deepEqual([1, 2, 3, 4, 5].map(z => zones.filter(x => x === z).length), [6, 6, 5, 5, 5]);
});
// test/shared/rng.test.js
test('rollD6 maps rng to 1..6', () => {
  assert.equal(rollD6(() => 0), 1);
  assert.equal(rollD6(() => 0.9999), 6);
  for (let n = 1; n <= 6; n++) assert.equal(rollD6(() => die(n)), n);
});
test('shuffle keeps all elements and does not mutate input', () => {
  const a = [1, 2, 3, 4];
  assert.deepEqual(shuffle(a, () => 0.3).sort(), [1, 2, 3, 4]);
  assert.deepEqual(a, [1, 2, 3, 4]);
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `npm test` / Expected: FAIL (โมดูลยังไม่มี)
- [ ] **Step 4: เขียน `shared/constants.js`, `shared/rng.js`, `shared/board.js`, `test/helpers.js` ตาม Interfaces**
- [ ] **Step 5: รันเทสต์** — Run: `npm test` / Expected: PASS ทั้งหมด
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: scaffold project with constants, dice and board layout"`

---

[แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 2 →](task-02-pokedex.md)
