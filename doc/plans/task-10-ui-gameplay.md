# Task 10: หน้าเว็บ — ปุ่ม action แอนิเมชัน ผลการแข่ง และคู่มือการเปิดเซิร์ฟเวอร์

> ส่วนหนึ่งของ [แผนหลัก](2026-10-31-pokemon-board-game.md) อ่าน **Global Constraints**, **Plan Decisions**, **Review Focus**, **โครงสร้างไฟล์** และ **โมเดลข้อมูล** ในแผนหลักก่อนเริ่ม ทุกข้อในนั้นใช้กับ Task นี้ด้วย
>
> สเปก: [doc/context.md](../context.md) · agent ที่เหมาะ: `frontend-ui`

[← Task 9](task-09-ui-lobby-board.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md)

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

---

[← Task 9](task-09-ui-lobby-board.md) · [แผนหลัก](2026-10-31-pokemon-board-game.md)
