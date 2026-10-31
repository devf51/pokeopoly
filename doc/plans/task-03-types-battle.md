# Task 3: ตารางธาตุและสูตรต่อสู้

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `rules-engine`

[← Task 2](task-02-pokedex.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 4 →](task-04-catch-economy.md)

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

[← Task 2](task-02-pokedex.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 4 →](task-04-catch-economy.md)
