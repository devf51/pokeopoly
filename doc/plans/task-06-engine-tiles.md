# Task 6: Engine — จับ ร้านค้า และศูนย์รักษา

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 5](task-05-engine-movement.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 7 →](task-07-engine-challenge-auto-view.md)

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

[← Task 5](task-05-engine-movement.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 7 →](task-07-engine-challenge-auto-view.md)
