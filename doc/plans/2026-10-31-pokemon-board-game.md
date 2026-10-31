# เกมเศรษฐีโปเกม่อน Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บเกมกระดานออนไลน์ 2–4 คน แนวเศรษฐีผสมโปเกม่อน Gen 1 ที่เจ้าของเปิดเซิร์ฟเวอร์บนคอมตัวเองแล้วเพื่อนเข้าเล่นผ่าน IP

**Architecture:** กติกาทั้งหมดเป็นฟังก์ชันบริสุทธิ์ใน `shared/` (ESM ใช้ได้ทั้ง Node และเบราว์เซอร์) โดยมี `applyAction(state, actorId, action, ctx)` เป็นทางเดียวที่เปลี่ยนสถานะเกม เซิร์ฟเวอร์ Express + Socket.IO ถือสถานะจริง ทอยเต๋าเอง และส่ง "มุมมอง" เฉพาะของผู้เล่นแต่ละคนไปให้หน้าเว็บ (ซ่อนโปเกม่อนที่ยังไม่ควรเห็น) หน้าเว็บเป็น HTML/CSS/JS ธรรมดา ทำหน้าที่แสดงผลและส่ง action เท่านั้น

**Tech Stack:** Node.js 24 (ESM), Express 4, Socket.IO 4, `node:test` + `node:assert/strict`, socket.io-client (เฉพาะเทสต์), HTML/CSS/JS ไม่มี build

**Spec:** [doc/context.md](../context.md)

## Global Constraints

- `package.json` มี `"type": "module"` ห้ามใช้ TypeScript หรือขั้นตอน build
- dependencies ตอนรัน: `express`, `socket.io` เท่านั้น / devDependencies: `socket.io-client` เท่านั้น
- ไฟล์ใน `shared/` ต้องรันในเบราว์เซอร์ได้: ห้าม import โมดูลของ Node ใช้ relative import ที่ลงท้าย `.js`
- เซิร์ฟเวอร์เป็นผู้ตัดสินเพียงผู้เดียว: ความสุ่มทุกอย่างมาจาก `ctx.rng` ฝั่งเซิร์ฟเวอร์ หน้าเว็บไม่คำนวณผลเอง
- ตัวเลขเกมทุกตัวอยู่ใน `shared/constants.js` ไฟล์อื่นห้ามเขียนตัวเลขกติกาตรงๆ
- ข้อความ UI และข้อความ error เป็นภาษาไทย ชื่อโปเกม่อนเป็นภาษาอังกฤษ
- ฟังพอร์ต `process.env.PORT || 3000` ที่ host `0.0.0.0`
- ภาพโปเกม่อนใช้ URL ของ PokéAPI เท่านั้น ห้าม commit ไฟล์ภาพ
- `npm test` = `node --test` ไฟล์เทสต์อยู่ที่ `test/**/*.test.js`
- `npm start` = `node server/index.js`

## Plan Decisions

จุดที่สเปกไม่ได้ระบุ แผนนี้ตัดสินไว้ดังนี้ (ตรวจได้ก่อนลงมือ):

1. **ระยะห่างจากจุดเริ่มต้น** นับตามทิศทางเดิน: โซนเพิ่มขึ้นตาม index ของช่อง โซน 5 อยู่ก่อนกลับถึงจุดเริ่มต้น ทุกรอบจึงจบด้วยโซนหายาก
2. **ผังกระดาน** (index 0–31):
   `S, 1,1,1, M, 1,1,1, 2,2,2, C, 2,2,2, 3,3,3,3,3, M, 4,4,4,4,4, C, 5,5,5,5,5`
   (S = จุดเริ่มต้น, M = Poké Mart ที่ 4 และ 20, C = Pokémon Center ที่ 11 และ 26, ตัวเลข = โซน; จำนวนช่องโซน 1–5 = 6/6/5/5/5)
3. **แบ่งโซนด้วย BST**: ตัดตัวตำนาน 5 ตัวออก เหลือ 146 ตัว เรียง BST จากน้อยไปมาก (เท่ากันเรียงตาม id) แล้วตัดเป็น 5 กลุ่มขนาด 30/29/29/29/29
4. **ตัวตำนานมีได้ตัวเดียวในเกม**: ไม่สุ่มออก ถ้าถูกจับไปแล้ว หรือกำลังอยู่บนช่องใดช่องหนึ่งของกระดาน ถ้าไม่เหลือตัวไหนให้ออก โซน 5 สุ่มตัวปกติแทน
5. **Ranger ขยับ ±1** แล้วจำนวนก้าวถูกบีบให้อยู่ใน 1–7
6. **Squirtle วาร์ป** ใช้แทนการทอยเดินของตานั้น (เดิน 1–6 ก้าวตามที่เลือก) ถ้าผ่านจุดเริ่มต้นก็นับรอบและได้เงินเดือนตามปกติ
7. **ทอยจับใหม่** (Professor/Pikachu) ใช้บอลลูกเดิม ไม่เสียบอลเพิ่ม
8. **Charmander ทั้งสองฝ่าย** หักล้างกัน ทอยตามปกติ และนับว่าใช้ความสามารถไปทั้งคู่
9. **ผู้เล่นที่เข้าเส้นชัยแล้ว** ท้าคนอื่นไม่ได้ และถูกท้าไม่ได้
10. **ตัวเริ่มต้นซ้ำกันได้** เหมือนคลาส
11. **ตัวเลขปัดเศษ**: ราคาของ Merchant ใช้ `Math.round(price * 0.7)` (35/84/175) ค่ารักษาใช้ `Math.floor(value * 0.2)` ค่าปรับแพ้ใช้ `Math.floor(money * 0.1)`
12. **คะแนนเท่ากันตอนจบ**: ชนะร่วมกัน
13. **รหัสห้อง**: ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ 4 ตัว ไม่ใช้ `I` และ `O`
14. **ลบห้อง** หลังจากไม่มีใครเชื่อมต่ออยู่เลยครบ 10 นาที
15. **จุดเริ่มต้นเปิดร้าน** เฉพาะตอนหยุดตรงจุดเริ่มต้น (ตกพอดี หรือหยุดเพราะครบรอบที่ 2) ถ้าแค่เดินผ่านได้เงินเดือนอย่างเดียว
16. **คนที่เข้าเส้นชัยแล้ว** ขายโปเกม่อนได้ในตาที่เข้าเส้นชัย (ร้านที่จุดเริ่มต้น) หลังจากนั้นถูกข้ามตาไปเลย ไม่เสียอะไร เพราะขายได้ 100% เท่ากับมูลค่าตอนจบ และหลังเข้าเส้นชัยก็ไม่มีใครท้าสู้ทำให้หมดสภาพได้แล้ว

## Review Focus

1. **ผู้เล่นหลุดหรือไม่ตอบในตาของตัวเอง หรือหลุดตอนเป็นฝ่ายถูกท้า**: หลัง 60 วินาที ระบบต้องเล่นแทนจนหมดตาและเกมเดินต่อ ห้ามค้าง → เทสต์ใน Task 7 (`autoAction` ทุก step) และ Task 8 (timer ข้ามตาและข้าม step `defend`)
2. **ไม่มีบอลหรือเงินไม่พอ**: `THROW` และ `BUY` ต้องถูกปฏิเสธโดยสถานะไม่เปลี่ยน ค่าปรับแพ้ต้องไม่ทำให้เงินติดลบ → Task 6, Task 7
3. **โปเกม่อนหมดสภาพทุกตัว รวมตัวเริ่มต้น**: ท้าใครไม่ได้และถูกท้าไม่ได้ แต่เกมยังเดินต่อ → Task 7
4. **เข้าห้องแบบผิดปกติ**: ชื่อซ้ำกับคนที่ยังออนไลน์ ห้องเต็ม เกมเริ่มไปแล้ว หรือรหัสห้องผิด ต้องได้ข้อความ error ภาษาไทย และหลุดแล้วต้องกลับเข้าตัวเดิมได้ → Task 8
5. **ตัวตำนานไม่ซ้ำ**: ไม่ออกซ้ำถ้าถูกจับไปแล้วหรือมีอยู่บนกระดาน และถ้าหมดทั้ง 5 ตัว โซน 5 ต้องยังสุ่มตัวปกติได้ → Task 5

---

## โครงสร้างไฟล์

```
package.json, .gitignore, README.md
scripts/build-pokedex.js        ดึงข้อมูลจาก PokéAPI ครั้งเดียว
data/pokedex.json               151 ตัว (commit ไว้)
shared/constants.js             ตัวเลขกติกาทั้งหมด
shared/rng.js                   rollD6, pick, shuffle
shared/board.js                 ผังกระดาน
shared/pokedex.js               แบ่งโซนตาม BST
shared/types.js                 ตารางธาตุ
shared/catch.js                 สูตรจับ
shared/battle.js                สูตรต่อสู้
shared/economy.js               ราคา เงินเดือน มูลค่า ค่ารักษา คะแนน
shared/engine/errors.js         GameError
shared/engine/context.js        makeContext
shared/engine/spawn.js          สุ่มโปเกม่อนลงช่อง
shared/engine/state.js          createGame
shared/engine/turn.js           เดิน เข้าช่อง จบตา จบเกม
shared/engine/tile-actions.js   จับ ร้าน ศูนย์รักษา
shared/engine/challenge.js      ท้าสู้และป้องกัน
shared/engine/auto.js           autoAction (หมดเวลา)
shared/engine/view.js           viewFor (ซ่อนข้อมูล)
shared/engine/index.js          applyAction (ตัวกระจาย action)
server/rooms.js                 RoomManager
server/app.js                   createServer (Express + Socket.IO)
server/index.js                 จุดเริ่ม npm start
public/index.html, public/css/style.css
public/js/main.js               เชื่อมต่อ socket และสลับหน้าจอ
public/js/api.js                ห่อ socket.emit เป็น Promise
public/js/screens/home.js, lobby.js, game.js
public/js/ui/layout.js          index → ตำแหน่งในตาราง 9×9
public/js/ui/board.js, panel.js, actions.js, dice.js, results.js
test/helpers.js
test/shared/*.test.js, test/server/*.test.js, test/public/layout.test.js
```

## โมเดลข้อมูล (ทุก Task ใช้ร่วมกัน)

```js
// Tile
{ index, type: 'start'|'mart'|'center'|'wild', zone: 1..5|null, dexId: number|null }

// Mon
{ uid: number, dexId: number, zone: 1..5|'legendary'|null, starter: boolean, fainted: boolean }

// Player
{ id, name, cls: 'catcher'|'merchant'|'ranger'|'professor',
  starter: 'bulbasaur'|'charmander'|'squirtle'|'pikachu',
  starterUsed: false, classUses: 2,
  position: 0, laps: 0, finished: false,
  money: 500, balls: { poke: 5, great: 0, ultra: 0 },
  mons: Mon[] }                      // ตัวเริ่มต้นเป็น Mon ตัวแรก starter:true zone:null

// Turn
{ playerId,
  step: 'roll'|'move'|'catch'|'catch-failed'|'shop'|'center'|'challenge'|'defend',
  roll: number|null,                 // จำนวนก้าวที่รอยืนยันใน step 'move'
  ball: 'poke'|'great'|'ultra'|null, // บอลที่เพิ่งโยน (ใช้ตอนทอยจับใหม่)
  battle: null | { attackerId, defenderId, attackerUid, attackerCharmander } }

// GameState
{ phase: 'playing'|'ended', board: Tile[], players: Player[],
  order: string[], turnIndex: number, turn: Turn,
  caughtLegendaries: number[], firstFinisherId: string|null, nextUid: number,
  result: null | { ranking: [{ playerId, money, monValue, total }], winnerIds: string[] } }
```

### Actions ต่อ step

| step | ผู้ทำ | actions |
|---|---|---|
| `roll` | เจ้าของตา | `ROLL`, `SQUIRTLE_WARP {steps:1..6}` |
| `move` | เจ้าของตา | `CONFIRM_MOVE`, `RANGER_REROLL`, `RANGER_ADJUST {delta:1\|-1}`, `PIKACHU_REROLL` |
| `catch` | เจ้าของตา | `THROW {ball}`, `BULBASAUR_CATCH`, `SKIP` |
| `catch-failed` | เจ้าของตา | `PROFESSOR_REROLL`, `PIKACHU_REROLL`, `ACCEPT` |
| `shop` | เจ้าของตา | `BUY {ball, qty}`, `SELL {uid}` (เฉพาะจุดเริ่มต้น), `DONE` |
| `center` | เจ้าของตา | `HEAL {uid}`, `DONE` |
| `challenge` | เจ้าของตา | `CHALLENGE {targetId, uid, charmander}`, `SKIP` |
| `defend` | ฝ่ายถูกท้า | `DEFEND {uid, charmander}` |

### Events (ส่งให้หน้าเว็บเล่นแอนิเมชัน)

`rolled {playerId, value, source}` · `moved {playerId, from, to, steps}` · `salary {playerId, amount}` · `finished {playerId, bonus}` · `ability {playerId, name}` · `caught {playerId, dexId, roll, total, target}` · `fled {playerId, dexId, roll, total, target}` · `bought {playerId, ball, qty, cost}` · `sold {playerId, dexId, amount}` · `healed {playerId, dexId, cost}` · `battle {attackerId, defenderId, attackerTotal, defenderTotal, winnerId|null, penalty}` · `turn {playerId}` · `gameOver {result}`

### Error codes (`GameError.code`)

`NOT_YOUR_TURN`, `INVALID_ACTION` (action ไม่ตรง step), `NO_USES` (ใช้ความสามารถหมดแล้ว หรือคลาส/ตัวเริ่มต้นไม่ตรง), `NO_BALL`, `NOT_ENOUGH_MONEY`, `BAD_TARGET` (uid หรือผู้เล่นเป้าหมายไม่ถูกต้อง), `LEGENDARY` (Bulbasaur ใช้กับตัวตำนาน)

---

### Task 1: โครงโปรเจกต์ ค่าคงที่ ลูกเต๋า และผังกระดาน

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

### Task 2: ข้อมูลโปเกเด็กซ์และการแบ่งโซน

**Files:**
- Create: `scripts/build-pokedex.js`, `data/pokedex.json` (สร้างจากสคริปต์), `shared/pokedex.js`
- Test: `test/shared/pokedex.test.js`

**Interfaces:**
- Consumes: `LEGENDARY_IDS` จาก Task 1
- Produces:
  - `data/pokedex.json`: `[{ id, name, types: string[], bst, sprite }]` เรียงตาม id 1–151
  - `buildPools(pokedex) → { 1: number[], 2: [...], 3: [...], 4: [...], 5: [...], legendary: number[] }` (dexId) ตาม Plan Decisions ข้อ 3
  - `zoneOfDex(pools, dexId) → 1..5 | 'legendary'`

- [ ] **Step 1: เขียน `scripts/build-pokedex.js`** ดึง `https://pokeapi.co/api/v2/pokemon/{id}` ของ id 1–151 (ยิงพร้อมกันครั้งละ 10) เก็บ `types` จาก `types[].type.name`, `bst` = ผลรวม `stats[].base_stat`, `sprite` = `sprites.front_default`, `name` = ตัวแรกพิมพ์ใหญ่ ยกเว้น `{29: 'Nidoran♀', 32: 'Nidoran♂', 83: "Farfetch'd", 122: 'Mr. Mime'}` เขียนไฟล์แบบ `JSON.stringify(data, null, 1)`
- [ ] **Step 2: รันสคริปต์** — Run: `node scripts/build-pokedex.js` / Expected: `data/pokedex.json` มี 151 รายการ
- [ ] **Step 3: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
const pokedex = JSON.parse(readFileSync(new URL('../../data/pokedex.json', import.meta.url)));
test('pokedex has 151 well-formed entries', () => {
  assert.equal(pokedex.length, 151);
  pokedex.forEach((p, i) => {
    assert.equal(p.id, i + 1);
    assert.ok(p.types.length >= 1 && p.types.length <= 2);
    assert.ok(p.bst > 0);
    assert.match(p.sprite, /^https:\/\//);
  });
  assert.equal(pokedex[24].name, 'Pikachu');
  assert.equal(pokedex[121].name, 'Mr. Mime');
});
test('pools split 146 non-legendaries 30/29/29/29/29 by BST', () => {
  const pools = buildPools(pokedex);
  assert.deepEqual([1, 2, 3, 4, 5].map(z => pools[z].length), [30, 29, 29, 29, 29]);
  assert.deepEqual(pools.legendary, [144, 145, 146, 150, 151]);
  const bst = id => pokedex[id - 1].bst;
  for (let z = 1; z < 5; z++)
    assert.ok(Math.max(...pools[z].map(bst)) <= Math.min(...pools[z + 1].map(bst)));
  assert.equal(zoneOfDex(pools, 10), 1);           // Caterpie
  assert.equal(zoneOfDex(pools, 149), 5);          // Dragonite
  assert.equal(zoneOfDex(pools, 150), 'legendary');
});
```

- [ ] **Step 4: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/pokedex.test.js` / Expected: FAIL (`buildPools` ยังไม่มี)
- [ ] **Step 5: เขียน `shared/pokedex.js`**
- [ ] **Step 6: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: add Gen 1 pokedex data and BST zone pools"`

---

### Task 3: ตารางธาตุและสูตรต่อสู้

**Files:**
- Create: `shared/types.js`, `shared/battle.js`
- Test: `test/shared/battle.test.js`

**Interfaces:**
- Consumes: `BATTLE_PENALTY_RATE`
- Produces:
  - `hasTypeAdvantage(attTypes: string[], defTypes: string[]) → boolean` (จริงเมื่อธาตุใดธาตุหนึ่งของฝ่ายโจมตีชนะทางธาตุใดธาตุหนึ่งของฝ่ายรับ)
  - `resolveBattle({ attackerRoll, defenderRoll, attackerTypes, defenderTypes, attackerCharmander, defenderCharmander }) → { winner: 'attacker'|'defender'|'draw', attackerTotal, defenderTotal }` (ถ้า Charmander ฝ่ายเดียว ฝ่ายนั้นชนะทันที total เป็น `null`; ถ้าใช้ทั้งคู่ก็ทอยตามปกติ)
  - `battlePenalty(money) → Math.floor(money * BATTLE_PENALTY_RATE)`

ตาราง "ชนะทาง" (ตารางปัจจุบันของ PokéAPI ตัว Gen 1 บางตัวจึงมีธาตุ fairy หรือ steel):

```js
export const SUPER_EFFECTIVE = {
  normal: [], fire: ['grass', 'ice', 'bug', 'steel'], water: ['fire', 'ground', 'rock'],
  electric: ['water', 'flying'], grass: ['water', 'ground', 'rock'],
  ice: ['grass', 'ground', 'flying', 'dragon'], fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
  poison: ['grass', 'fairy'], ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
  flying: ['grass', 'fighting', 'bug'], psychic: ['fighting', 'poison'], bug: ['grass', 'psychic', 'dark'],
  rock: ['fire', 'ice', 'flying', 'bug'], ghost: ['psychic', 'ghost'], dragon: ['dragon'],
  dark: ['psychic', 'ghost'], steel: ['ice', 'rock', 'fairy'], fairy: ['fighting', 'dragon', 'dark'],
};
```

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
test('type advantage', () => {
  assert.equal(hasTypeAdvantage(['fire'], ['grass']), true);
  assert.equal(hasTypeAdvantage(['grass'], ['fire']), false);
  assert.equal(hasTypeAdvantage(['water', 'ground'], ['fire', 'flying']), true);
  assert.equal(hasTypeAdvantage(['normal'], ['ghost']), false);
  // ได้เปรียบทั้งสองฝ่าย
  assert.equal(hasTypeAdvantage(['fire', 'ground'], ['water', 'rock']), true);
  assert.equal(hasTypeAdvantage(['water', 'rock'], ['fire', 'ground']), true);
});
const base = { attackerTypes: ['normal'], defenderTypes: ['normal'], attackerCharmander: false, defenderCharmander: false };
test('higher total wins, equal is draw, advantage adds 1 once', () => {
  assert.equal(resolveBattle({ ...base, attackerRoll: 5, defenderRoll: 3 }).winner, 'attacker');
  assert.equal(resolveBattle({ ...base, attackerRoll: 2, defenderRoll: 2 }).winner, 'draw');
  const r = resolveBattle({ ...base, attackerTypes: ['fire', 'ice'], defenderTypes: ['grass', 'flying'], attackerRoll: 3, defenderRoll: 4 });
  assert.deepEqual([r.attackerTotal, r.defenderTotal, r.winner], [4, 4, 'draw']);
});
test('charmander wins outright unless both use it', () => {
  assert.equal(resolveBattle({ ...base, attackerRoll: 1, defenderRoll: 6, attackerCharmander: true }).winner, 'attacker');
  assert.equal(resolveBattle({ ...base, attackerRoll: 1, defenderRoll: 6, attackerCharmander: true, defenderCharmander: true }).winner, 'defender');
});
test('penalty is floor 10% and never negative', () => {
  assert.equal(battlePenalty(155), 15);
  assert.equal(battlePenalty(0), 0);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/battle.test.js` / Expected: FAIL
- [ ] **Step 3: เขียน `shared/types.js` และ `shared/battle.js`**
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add type chart and battle resolution"`

---

### Task 4: สูตรจับและเศรษฐกิจ

**Files:**
- Create: `shared/catch.js`, `shared/economy.js`
- Test: `test/shared/catch.test.js`, `test/shared/economy.test.js`

**Interfaces:**
- Consumes: ค่าคงที่จาก Task 1
- Produces:
  - `catchTarget(zone: 1..5|'legendary') → number` (จาก `ZONE_TARGET`)
  - `catchTotal(roll, ball, cls) → roll + BALLS[ball].bonus + (cls === 'catcher' ? 1 : 0)`
  - `isCaught(total, zone) → total >= catchTarget(zone)`
  - `ballPrice(ball, cls) → number`, `salaryFor(cls) → number`
  - `monValue(mon) → number` (ตัวเริ่มต้น = 0), `healCost(mon) → number` (ตัวเริ่มต้น = 0)
  - `finalTotals(player) → { money, monValue, total }` (นับเฉพาะตัวที่ไม่หมดสภาพ)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
test('catch targets and totals', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 'legendary'].map(catchTarget), [2, 3, 4, 5, 6, 7]);
  assert.equal(catchTotal(6, 'poke', 'catcher'), 7);
  assert.equal(catchTotal(5, 'ultra', 'ranger'), 7);
  assert.equal(isCaught(6, 'legendary'), false);
  assert.equal(isCaught(7, 'legendary'), true);
  assert.equal(isCaught(1, 1), false);
});
const mon = (zone, extra = {}) => ({ uid: 1, dexId: 1, zone, starter: false, fainted: false, ...extra });
test('prices and salary', () => {
  assert.deepEqual(['poke', 'great', 'ultra'].map(b => ballPrice(b, 'merchant')), [35, 84, 175]);
  assert.equal(ballPrice('great', 'catcher'), 120);
  assert.equal(salaryFor('merchant'), 300);
  assert.equal(salaryFor('professor'), 200);
});
test('values and heal cost', () => {
  assert.equal(monValue(mon(3)), 200);
  assert.equal(monValue(mon('legendary')), 2000);
  assert.equal(monValue(mon(null, { starter: true })), 0);
  assert.equal(healCost(mon(3)), 40);
  assert.equal(healCost(mon('legendary')), 400);
  assert.equal(healCost(mon(null, { starter: true })), 0);
});
test('final totals skip fainted and starter', () => {
  const p = { money: 300, mons: [mon(null, { starter: true }), mon(5), mon(4, { fainted: true })] };
  assert.deepEqual(finalTotals(p), { money: 300, monValue: 800, total: 1100 });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/catch.test.js test/shared/economy.test.js` / Expected: FAIL
- [ ] **Step 3: เขียน `shared/catch.js` และ `shared/economy.js`**
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add catch formula and economy helpers"`

---

### Task 5: Engine — สร้างเกม สุ่มโปเกม่อน เดิน และวนตา

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

### Task 6: Engine — จับ ร้านค้า และศูนย์รักษา

**Files:**
- Create: `shared/engine/tile-actions.js`; Modify: `shared/engine/index.js` (ลงทะเบียน handler)
- Test: `test/shared/engine-tile.test.js`

**Interfaces:**
- Consumes: `catchTotal`, `isCaught`, `ballPrice`, `monValue`, `healCost`, `spawnFor`, `afterTile`
- Produces handlers:
  - `catch`: `THROW {ball}` (ไม่มีบอลชนิดนั้น → `NO_BALL`; หักบอล 1 ลูก; ถ้าพลาดและมีสิทธิ์ทอยใหม่ (Professor ที่ `classUses > 0` หรือ Pikachu ที่ยังไม่ใช้) → step `'catch-failed'` เก็บ `turn.ball` ไว้ ถ้าไม่มีสิทธิ์ → หนีไป), `BULBASAUR_CATCH` (ไม่ใช้บอล; ตัวตำนาน → `LEGENDARY`), `SKIP`
  - `catch-failed`: `PROFESSOR_REROLL`, `PIKACHU_REROLL` (ทอยใหม่ด้วย `turn.ball` เดิม), `ACCEPT`
  - จับได้: เพิ่ม Mon (`zone` จาก `zoneOfDex`; ถ้าเป็นตัวตำนานเพิ่มเข้า `caughtLegendaries`) ไม่ว่าจับได้หรือหนี ให้สุ่มตัวใหม่ลงช่องด้วย `spawnFor` แล้วเรียก `afterTile`
  - `shop`: `BUY {ball, qty≥1}` (`NOT_ENOUGH_MONEY`), `SELL {uid}` (ใช้ได้เฉพาะช่อง `start`; ห้ามขายตัวเริ่มต้นหรือตัวที่หมดสภาพ → `BAD_TARGET`), `DONE`
  - `center`: `HEAL {uid}` (ต้องหมดสภาพอยู่ → ไม่งั้น `BAD_TARGET`; `NOT_ENOUGH_MONEY`), `DONE`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน** (helper `atWild(zone, dexId?)`: วาง p1 ไว้หน้าช่อง wild แรกของโซนนั้น แล้ว ROLL/CONFIRM ให้มาอยู่ step `'catch'` และตั้ง `tile.dexId` ถ้าส่งมา)

```js
test('successful throw adds the mon, uses a ball and respawns the tile', () => {
  // p1 cls ranger, zone 2 (เป้า 3), THROW poke ด้วย die(3)
  // → mons.length 2, mons[1].zone 2, balls.poke 4, tile.dexId ถูกสุ่มใหม่, มี event 'caught'
});
test('failed throw without reroll ability flees', () => { /* ranger zone 2, die(2) → event 'fled', balls.poke 4, mons.length 1 */ });
test('throw without that ball is rejected', () => { /* THROW ultra → NO_BALL, สถานะไม่เปลี่ยน */ });
test('catcher gets +1', () => { /* catcher zone 2, die(2) → caught */ });
test('legendary needs 7', () => {
  // tile.dexId = 150: THROW poke die(6) → fled; อีกเคสให้ balls.great=1 THROW great die(6) → caught, caughtLegendaries [150]
});
test('bulbasaur guarantees a non-legendary catch once', () => {
  // BULBASAUR_CATCH → caught, balls.poke ยังเป็น 5, starterUsed true; บนตัวตำนาน → LEGENDARY
});
test('professor reroll keeps the same ball and costs a use', () => {
  // professor zone 5, THROW poke die(1) → step 'catch-failed', balls.poke 4
  // PROFESSOR_REROLL die(6) → caught, balls.poke 4, classUses 1
});
test('accepting a failed catch flees', () => { /* catch-failed → ACCEPT → event 'fled' */ });
test('buy respects merchant price and money', () => {
  // p2 merchant ที่ช่อง mart: BUY great qty 2 → money 500-168, balls.great 2
  // BUY ultra qty 3 (525) → NOT_ENOUGH_MONEY และสถานะไม่เปลี่ยน
});
test('sell only at start and only healthy non-starter mons', () => {
  // ที่ start: SELL ตัวโซน 3 → money +200 และตัวนั้นหายไป; SELL ตัวเริ่มต้น → BAD_TARGET; SELL ตัวหมดสภาพ → BAD_TARGET
  // ที่ mart: SELL → INVALID_ACTION
});
test('heal fainted mons at the center', () => {
  // ตัวโซน 3 หมดสภาพ: HEAL → money -40, fainted false; ตัวเริ่มต้นหมดสภาพ → ฟรี
  // HEAL ตัวที่ยังสู้ได้ → BAD_TARGET; money 10 กับตัวตำนาน (400) → NOT_ENOUGH_MONEY
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/engine-tile.test.js` / Expected: FAIL
- [ ] **Step 3: เขียน `shared/engine/tile-actions.js` และลงทะเบียน handler ใน `index.js`**
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: catching, shops and pokemon center"`

---

### Task 7: Engine — ท้าสู้ เล่นแทนเมื่อหมดเวลา และการซ่อนข้อมูล

**Files:**
- Create: `shared/engine/challenge.js`, `shared/engine/auto.js`, `shared/engine/view.js`; Modify: `shared/engine/turn.js` (`afterTile`), `shared/engine/index.js`
- Test: `test/shared/engine-battle.test.js`, `test/shared/engine-auto-view.test.js`

**Interfaces:**
- Consumes: `resolveBattle`, `battlePenalty`, `hasTypeAdvantage` (ผ่าน `resolveBattle`), `ctx.byId` สำหรับธาตุ
- Produces:
  - `challengeTargets(state, player) → Player[]`: ผู้เล่นคนอื่นที่อยู่ช่องเดียวกัน ยังไม่ finished และมี Mon ที่ยังสู้ได้ (ถ้าผู้เล่นเองหมดสภาพทุกตัวหรือ finished แล้ว คืน `[]`)
  - `afterTile`: ถ้า `challengeTargets` ไม่ว่าง → step `'challenge'` ไม่งั้น `endTurn`
  - `CHALLENGE {targetId, uid, charmander}` → step `'defend'` (ตรวจ target และ uid ต้องอยู่ในเงื่อนไข ไม่งั้น `BAD_TARGET`; ใช้ `charmander` ได้ต่อเมื่อตัวเริ่มต้นเป็น charmander และยังไม่ใช้ ไม่งั้น `NO_USES`)
  - `DEFEND {uid, charmander}` (ผู้ทำคือ `turn.battle.defenderId`) → ทอยฝ่ายโจมตีก่อนแล้วฝ่ายรับ (ไม่ทอยถ้า Charmander ชนะทันที) ฝ่ายแพ้: Mon หมดสภาพ และย้ายเงิน `battlePenalty(loser.money)` ไปให้ฝ่ายชนะ แล้ว `endTurn`
  - `actorOf(state) → playerId` (ใน step `defend` คือฝ่ายถูกท้า ที่เหลือคือเจ้าของตา) ให้ `applyAction` ใช้ตรวจ `NOT_YOUR_TURN`
  - `autoAction(state) → { actorId, action }`: roll→`ROLL`, move→`CONFIRM_MOVE`, catch→`SKIP`, catch-failed→`ACCEPT`, shop/center→`DONE`, challenge→`SKIP`, defend→`DEFEND` ด้วย Mon ตัวแรกที่ยังสู้ได้ และ `charmander:false`
  - `viewFor(state, viewerId) → GameState` (clone): ทุกช่อง wild ใส่ `dexId: null` ยกเว้น (ก) ช่องที่เจ้าของตายืนอยู่ระหว่าง step `catch`/`catch-failed` และ (ข) ถ้าผู้ดูเป็น professor ช่องที่อยู่ข้างหน้า 1..`PROFESSOR_VISION` ช่องนับจากตำแหน่งผู้ดู (วนรอบด้วย mod 32)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
// engine-battle.test.js — helper sameTile(): วาง p1 กับ p2 ไว้ช่องเดียวกัน ให้ p1 SKIP การจับจนมาถึง step 'challenge'
test('landing next to an eligible player offers a challenge', () => { /* step 'challenge' */ });
test('no challenge when target is all fainted, finished, or attacker has nothing healthy', () => {
  // สามเคส → turn ไปที่ p2 เลย
});
test('only the defender may defend', () => {
  // CHALLENGE {targetId:'p2', uid:1, charmander:false} → step 'defend'
  // p1 ส่ง DEFEND → NOT_YOUR_TURN
});
test('loser faints and pays 10% of their money', () => {
  // p2 money 155, attacker die(5), defender die(3) → mon ของ p2 หมดสภาพ, p2 money 140, p1 money 515, event 'battle'
});
test('draw changes nothing', () => { /* ให้ทั้งคู่มี Rattata (dexId 19, ธาตุ normal) แล้วสู้ด้วยตัวนั้น die(4) vs die(4) */ });
test('type advantage adds one', () => { /* p2 เป็นฝ่ายท้าด้วย Charmander(fire) ใส่ Bulbasaur(grass) ของ p1: die(3)+1 vs die(4) → draw */ });
test('charmander wins without rolling; both cancel', () => {
  // ฝ่ายโจมตีใช้ charmander โดยไม่ใส่ค่า rng → ชนะ (rng ไม่ถูกเรียก)
  // ทั้งสองฝ่ายใช้ → ทอยตามปกติ และ starterUsed เป็น true ทั้งคู่
});
// engine-auto-view.test.js
test('autoAction covers every step and plays out a full turn', () => {
  // วน applyAction(autoAction(state)) ไปเรื่อยๆ จนกว่า actor จะเปลี่ยน → p1 ไม่ได้จับอะไร, turn ไปที่ p2
  // step 'defend' → actorId = defender, action DEFEND ด้วย uid ของ Mon ตัวแรกที่ยังสู้ได้
});
test('viewFor hides wild pokemon except current encounter', () => {
  // ผู้ดูที่ไม่ใช่ professor: ทุกช่อง wild เป็น null; ระหว่าง step 'catch' ช่องของเจ้าของตายังเห็น dexId
});
test('professor sees six tiles ahead, wrapping past start', () => {
  // professor position 30 → มองได้ถึงช่อง 31, 0..4: เห็น dexId ของช่อง wild 31, 1, 2, 3 (0 เป็นจุดเริ่มต้น, 4 เป็น mart); ช่อง 5 เป็น null
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/shared/engine-battle.test.js test/shared/engine-auto-view.test.js` / Expected: FAIL
- [ ] **Step 3: เขียน `challenge.js`, `auto.js`, `view.js` และแก้ `afterTile`, `applyAction`**
- [ ] **Step 4: รันเทสต์** — Run: `npm test` / Expected: PASS ทั้งหมด (รวมเทสต์ของ Task 5–6)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: challenges, timeout auto-play and per-player views"`

---

### Task 8: เซิร์ฟเวอร์ — ห้อง Socket.IO หมดเวลา และหลุดแล้วกลับเข้า

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

### Task 9: หน้าเว็บ — หน้าแรก ล็อบบี้ และกระดาน

**Files:**
- Create: `public/index.html`, `public/css/style.css`, `public/js/main.js`, `public/js/api.js`, `public/js/screens/home.js`, `public/js/screens/lobby.js`, `public/js/screens/game.js`, `public/js/ui/layout.js`, `public/js/ui/board.js`
- Test: `test/public/layout.test.js`

**Interfaces:**
- Consumes: socket events ของ Task 8, `/shared/*.js`, `/data/pokedex.json`, `/socket.io/socket.io.js` (เสิร์ฟโดย Socket.IO เอง ไม่ใช้ CDN)
- Produces:
  - `cellFor(index) → { row, col }` บนตาราง 9×9 (0-based): index 0 มุมขวาล่าง `(8,8)` เดินไปทางซ้ายตามแถวล่าง 0–8 → `(8, 8-i)`, ขึ้นตามคอลัมน์ซ้าย 9–16 → `(16-i, 0)`, ไปทางขวาตามแถวบน 17–24 → `(0, i-16)`, ลงตามคอลัมน์ขวา 25–31 → `(i-24, 8)`
  - `api.js`: `request(event, payload) → Promise` (reject ด้วย `error.message` ถ้า `ok:false`), `onUpdate(handler)`
  - `renderBoard(el, room, pokedexById, myId)`: วาด 32 ช่องด้วย CSS grid, สีช่องตามชนิดและโซน (start ทอง, mart น้ำเงิน, center ชมพู, โซน 1–5 ไล่สีเขียว ฟ้า ส้ม ม่วง แดง), ช่องที่เห็น `dexId` แสดง sprite, ตัวหมากผู้เล่นเป็นวงกลมสีประจำตัว (4 สีคงที่ตามลำดับเข้าห้อง)
  - เก็บ `{ code, name }` ใน `localStorage` (ครอบ try/catch) ตอนโหลดหน้าใหม่ให้ `room:join` อัตโนมัติ

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```js
test('cellFor walks the 9x9 perimeter once', () => {
  assert.deepEqual(cellFor(0), { row: 8, col: 8 });
  assert.deepEqual(cellFor(8), { row: 8, col: 0 });
  assert.deepEqual(cellFor(16), { row: 0, col: 0 });
  assert.deepEqual(cellFor(24), { row: 0, col: 8 });
  assert.deepEqual(cellFor(31), { row: 7, col: 8 });
  const keys = new Set(Array.from({ length: 32 }, (_, i) => JSON.stringify(cellFor(i))));
  assert.equal(keys.size, 32);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน** — Run: `node --test test/public/layout.test.js` / Expected: FAIL
- [ ] **Step 3: เขียน `layout.js`** แล้วรันเทสต์ให้ผ่าน
- [ ] **Step 4: เขียนหน้าแรก** (ช่องกรอกชื่อเล่น ปุ่ม "สร้างห้อง" และช่องกรอกรหัสห้อง + ปุ่ม "เข้าห้อง" แสดง error ภาษาไทยจาก ack)
- [ ] **Step 5: เขียนล็อบบี้** (รหัสห้องตัวใหญ่ให้คัดลอกง่าย รายชื่อผู้เล่นพร้อมสถานะออนไลน์ เลือกคลาส 4 ใบพร้อมคำอธิบายความสามารถ เลือกตัวเริ่มต้น 4 ตัวพร้อม sprite และความสามารถ ปุ่ม "เริ่มเกม" แสดงเฉพาะ host)
- [ ] **Step 6: เขียน `board.js` และโครงหน้าเกม** (กระดานอยู่ซ้าย แผงข้อมูลอยู่ขวา; จอแคบกว่า 768px ให้แผงลงไปอยู่ใต้กระดาน และกระดานกว้างเต็มจอด้วย `aspect-ratio: 1`)
- [ ] **Step 7: ทดสอบมือ** — `npm start` เปิด `http://localhost:3000` สองแท็บ (แท็บหนึ่งเป็นหน้าต่าง private เพื่อแยก localStorage) สร้างห้อง เข้าห้อง เลือก เริ่มเกม / Expected: ทั้งสองแท็บเห็นกระดาน 32 ช่องและตัวหมากที่จุดเริ่มต้น รีเฟรชแท็บแล้วกลับเข้าห้องเดิมได้
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: home, lobby and board rendering"`

---

### Task 10: หน้าเว็บ — ปุ่ม action แอนิเมชัน ผลการแข่ง และคู่มือการเปิดเซิร์ฟเวอร์

**Files:**
- Create: `public/js/ui/panel.js`, `public/js/ui/actions.js`, `public/js/ui/dice.js`, `public/js/ui/results.js`, `README.md`; Modify: `public/js/screens/game.js`, `public/css/style.css`

**Interfaces:**
- Consumes: `roomView` (Task 8), events (Task 5–7), `ballPrice`, `monValue`, `healCost`, `catchTarget`, `challengeTargets` จาก `/shared`
- Produces:
  - `renderPanel(el, room, pokedexById, myId)`: ผู้เล่นทุกคน (ชื่อ คลาส เงิน บอล รอบที่เดินได้ ความสามารถที่เหลือ) กล่องโปเกม่อนของตัวเองพร้อม sprite มูลค่า และป้ายหมดสภาพ ตัวนับเวลาถอยหลังจาก `room.deadline`
  - `renderActions(el, room, myId, send)`: แสดงปุ่มเฉพาะเมื่อ `actorOf` เป็นตัวเรา ตามตาราง Actions ต่อ step ปุ่มที่ใช้ไม่ได้ (ไม่มีบอล เงินไม่พอ ความสามารถหมด) ให้ disabled พร้อมเหตุผล ใน step `catch` แสดงชื่อโปเกม่อน sprite และเลขเป้า
  - `animateDice(el, value) → Promise` (หมุนประมาณ 600ms แล้วหยุดที่ค่า), ตัวหมากเดินทีละช่องช่องละ 150ms ตาม event `moved`
  - `renderResults(el, result, players)`: ตารางอันดับ (เงิน + มูลค่าโปเกม่อน = รวม) ไฮไลต์ผู้ชนะ (ชนะร่วมได้) ปุ่ม "กลับหน้าแรก"
  - ประวัติเหตุการณ์ล่าสุด 10 บรรทัดภาษาไทยจาก events (เช่น "Ash จับ Pidgey ได้! (ทอย 4 + 0 ≥ 3)")

- [ ] **Step 1: เขียน `dice.js` และ `panel.js`**
- [ ] **Step 2: เขียน `actions.js`** ครอบคลุมทุก step: ใน `move` แสดงจำนวนก้าวพร้อมปุ่ม Ranger/Pikachu, ใน `roll` มีปุ่ม Squirtle วาร์ปให้เลือก 1–6, ใน `challenge` เลือกเป้าหมายและโปเกม่อนของเรา, ใน `defend` ฝ่ายรับเลือกโปเกม่อนและตัวเลือก Charmander
- [ ] **Step 3: เขียน `results.js` และเชื่อมทุกอย่างใน `screens/game.js`** (เล่นแอนิเมชันจาก events ก่อน แล้วค่อยวาดสถานะใหม่)
- [ ] **Step 4: เขียน `README.md`** (ภาษาไทย): ติดตั้ง (`npm install`), รัน (`npm start`), เพื่อนในบ้านเดียวกันใช้ URL ที่เซิร์ฟเวอร์พิมพ์ออกมา, อนุญาตพอร์ต 3000 ใน firewall ถ้ามี (`sudo ufw allow 3000/tcp`), เพื่อนต่างบ้านใช้ Tailscale (ทุกคนติดตั้งและล็อกอินเครือข่ายเดียวกัน แล้วเข้า `http://<Tailscale IP>:3000`), สร้างข้อมูลโปเกเด็กซ์ใหม่ด้วย `node scripts/build-pokedex.js`, คำเตือนว่าเป็นแฟนเกมส่วนตัว
- [ ] **Step 5: รันเทสต์ทั้งหมด** — Run: `npm test` / Expected: PASS
- [ ] **Step 6: ทดสอบมือเต็มเกม** — `npm start` เปิด 2 แท็บ เล่นจนจบ / Expected:
  - ทอยเต๋าแล้วมีแอนิเมชัน ตัวหมากเดินทีละช่อง
  - จับได้และหนีได้ ซื้อบอลที่ mart ขายโปเกม่อนที่จุดเริ่มต้น รักษาที่ center
  - ท้าสู้แล้วฝ่ายรับเห็นปุ่มเลือกโปเกม่อน ใช้ความสามารถของคลาสและตัวเริ่มต้นได้
  - ปล่อยไว้ 60 วินาทีแล้วระบบเล่นแทน
  - เกมจบแล้วเห็นตารางอันดับ
  - ใช้ viewport มือถือ (375×812) แล้วกระดานไม่ล้นจอและกดปุ่มได้ครบ
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: playable game UI, animations, results and hosting guide"`
