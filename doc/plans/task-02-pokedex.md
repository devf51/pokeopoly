# Task 2: ข้อมูลโปเกเด็กซ์และการแบ่งโซน

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 1](task-01-scaffold.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 3 →](task-03-types-battle.md)

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

[← Task 1](task-01-scaffold.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 3 →](task-03-types-battle.md)
