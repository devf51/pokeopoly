# Task 4: สูตรจับและเศรษฐกิจ

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 3](task-03-types-battle.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 5 →](task-05-engine-movement.md)

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

[← Task 3](task-03-types-battle.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 5 →](task-05-engine-movement.md)
