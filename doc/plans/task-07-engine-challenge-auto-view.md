# Task 7: Engine — ท้าสู้ เล่นแทนเมื่อหมดเวลา และการซ่อนข้อมูล

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 6](task-06-engine-tiles.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 8 →](task-08-server.md)

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

[← Task 6](task-06-engine-tiles.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 8 →](task-08-server.md)
