# Task 9: หน้าเว็บ — หน้าแรก ล็อบบี้ และกระดาน

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `frontend-ui`

[← Task 8](task-08-server.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 10 →](task-10-ui-gameplay.md)

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

[← Task 8](task-08-server.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md) · [Task 10 →](task-10-ui-gameplay.md)
