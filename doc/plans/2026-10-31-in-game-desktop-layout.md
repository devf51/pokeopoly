# ปุ่มคำสั่งกลางกระดาน (หน้าในเกมบนคอม) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บนจอ ≥ 768px ย้ายการ์ดปุ่มคำสั่งไปไว้กลางกระดานใต้ลูกเต๋า ให้ปุ่มหลักอยู่ในจอเสมอโดยไม่ต้องเลื่อน และจัดแผงขวาให้เหลือแค่ข้อมูล

**Architecture:** เพิ่มฟังก์ชันบริสุทธิ์ `splitActionSections` แยก section ของโมเดลปุ่มเป็น body (เลื่อนได้) กับ footer (ปุ่มหลัก ติดล่างการ์ด) แล้ว `actions.js` วาดการ์ดเป็นสองส่วน `game.js` ย้าย element `#action-area` อันเดียวไปมาระหว่างกลางกระดาน (คอม) กับแผง (มือถือ) ด้วย `matchMedia` และซ่อนไว้ระหว่างแอนิเมชัน `panel.js` เรียงการ์ดผู้เล่นของเราขึ้นก่อน

**Tech Stack:** HTML/CSS/JS ธรรมดา (ES modules ไม่มี build), `node:test` + `node:assert/strict`

**Spec:** [doc/superpowers/specs/2026-10-31-in-game-desktop-layout-design.md](../superpowers/specs/2026-10-31-in-game-desktop-layout-design.md)

## Global Constraints

- ไม่มีขั้นตอน build ไม่เพิ่ม dependency
- ไม่แตะ `shared/`, `server/` และไม่เปลี่ยนตรรกะ/ข้อความใน `public/js/ui/action-model.js`; `test/public/action-model.test.js` ต้องผ่านโดยไม่แก้
- จุดตัดคอม/มือถือ: `(min-width: 768px)` ตรงกับ media query เดิมใน `style.css`
- มือถือ (< 768px) หน้าตาและลำดับเหมือนเดิม
- ขนาดกระดานคงเดิม: `.board-wrap { width: min(100%, calc(100dvh - 2rem)) }`
- ข้อความ UI ภาษาไทย คอมเมนต์ในโค้ดภาษาไทยตามไฟล์เดิม
- หน้าผลการแข่งตอนจบเกมอยู่ในแผงขวาเหมือนเดิม
- `npm test` ต้องผ่านทั้งหมดก่อน commit ทุกครั้ง

## Review Focus

1. **รายการยาว** (ศูนย์รักษาที่มีโปเกม่อนหมดสภาพ 6+ ตัว / ขายที่จุดเริ่มต้นมี 10+ ตัว) → body เลื่อนในการ์ด ปุ่ม "เสร็จแล้ว ไปต่อ" ยังเห็นอยู่ในจอ — ตรวจใน Task 4 ขั้น 3
2. **update มาติดๆ กัน** (คิวข้ามแอนิเมชัน หรือแท็บถูกซ่อน `document.hidden`) → การ์ดคำสั่งต้องไม่ค้างซ่อน: `applyState` ตั้ง `hidden = false` ทุกครั้ง — Task 3 ขั้น 2
3. **ย่อ/ขยายหน้าต่างข้าม 768px ระหว่างเลือกค่า** (เช่นเลือกจำนวนบอล 5 ลูกไว้) → การ์ดย้ายที่โดยค่าที่เลือกยังอยู่ เพราะย้าย element เดิม ไม่สร้างใหม่ — Task 4 ขั้น 4
4. **กด Tab ไล่ปุ่มใน body** → ปุ่มที่โฟกัสไม่ถูก footer บัง (`scroll-padding-bottom`) — Task 4 ขั้น 3
5. **เซิร์ฟเวอร์ตอบ error** (เช่นเงินไม่พอ) → ข้อความ `.form-error` เห็นได้โดยไม่ต้องเลื่อน: วางไว้ใน footer เหนือปุ่ม — Task 1 test + Task 2

---

### Task 1: แยก section เป็น body / footer

**Files:**
- Create: `public/js/ui/action-layout.js`
- Test: `test/public/action-layout.test.js`
- Also commit: `doc/superpowers/specs/2026-10-31-in-game-desktop-layout-design.md`, `doc/plans/2026-10-31-in-game-desktop-layout.md`

**Interfaces:**
- Produces: `FOOTER_SECTION_IDS = ['main', 'throw', 'retry', 'done']` และ `splitActionSections(sections) -> { body: Section[], footer: Section[] }` — section ที่ `kind === 'buttons'` และ `id` อยู่ใน `FOOTER_SECTION_IDS` ไป footer ที่เหลือไป body ลำดับเดิมคงไว้ทั้งสองฝั่ง

- [ ] **Step 1: เขียนเทสต์ที่ล้ม**

ใช้ `setup` / `model` แบบเดียวกับ `test/public/action-model.test.js` บรรทัด 10–27 (คัดลอกมา ไม่ export จากไฟล์นั้น)

```js
test('splitActionSections keeps order and routes footer ids', () => {
  const s = id => ({ kind: 'buttons', id, items: [] });
  const enc = { kind: 'encounter' };
  const { body, footer } = splitActionSections([enc, s('throw'), s('other')]);
  assert.deepEqual(body, [enc, s('other')]);
  assert.deepEqual(footer, [s('throw')]);
});

test('a pick/toggle section never goes to the footer', () => {
  const { footer } = splitActionSections([{ kind: 'pick', id: 'main' }, { kind: 'toggle', id: 'main' }]);
  assert.deepEqual(footer, []);
});

test('every step the actor sees has a primary button in the footer', () => {
  // สร้างสถานะด้วย setup แบบเดียวกับเทสต์ 'every step shows exactly the actions…' ใน action-model.test.js
  // (position: shop 0, center 11, อื่นๆ 1; tweak: roll 3, ball 'poke', p2 อยู่ช่องเดียวกัน, เพิ่มโปเกม่อน uid 90 ที่หมดสภาพเมื่อ center)
  // step 'defend' ตั้ง s.turn.battle แบบเทสต์ 'defend: …' แล้วดูจากมุมของ 'p2'; step อื่นดูจาก 'p1'
  for (const step of ['roll', 'move', 'catch', 'catch-failed', 'shop', 'center', 'challenge', 'defend']) {
    const m = model(stateFor(step), step === 'defend' ? 'p2' : 'p1');
    const { footer } = splitActionSections(m.sections);
    assert.ok(footer.flatMap(s => s.items).some(i => i.variant === 'primary'), step);
  }
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `node --test test/public/action-layout.test.js`
Expected: FAIL — `Cannot find module …/action-layout.js`

- [ ] **Step 3: เขียน `splitActionSections` ใน `public/js/ui/action-layout.js`**

ฟังก์ชันบริสุทธิ์ ไม่ import DOM ใส่คอมเมนต์ภาษาไทยหัวไฟล์ว่า footer = ปุ่มหลักที่ต้องเห็นเสมอ

- [ ] **Step 4: รันเทสต์ทั้งหมดให้ผ่าน**

Run: `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add public/js/ui/action-layout.js test/public/action-layout.test.js doc/superpowers/specs/2026-10-31-in-game-desktop-layout-design.md doc/plans/2026-10-31-in-game-desktop-layout.md
git commit -m "feat: split action sections into scrollable body and pinned footer"
```

---

### Task 2: การ์ดคำสั่งสองส่วน (body เลื่อนได้ / footer ติดล่าง)

**Files:**
- Modify: `public/js/ui/actions.js` (`buildCard`, บรรทัด ~92–102)
- Modify: `public/css/style.css` (หมวด `/* ---------- ปุ่ม action ---------- */` ~บรรทัด 589)

**Interfaces:**
- Consumes: `splitActionSections` จาก Task 1
- Produces: DOM ของการ์ดของเรา = `section.actions-card.is-mine` > `div.actions-body` (หัวข้อ, summary, section ใน body) + `div.actions-footer` (`.form-error` ถ้ามี แล้วตาม section ใน footer); การ์ดรอยังเป็น `section.wait-card` เหมือนเดิม

- [ ] **Step 1: แก้ `buildCard` ให้วาดสองส่วนตาม Interfaces**

`.form-error` ย้ายจากใต้ summary ไปบนสุดของ footer

- [ ] **Step 2: CSS**

- `.actions-card.is-mine` เป็น `display: flex; flex-direction: column; min-height: 0`
- `.actions-body { overflow-y: auto; min-height: 0; flex: 1 1 auto; scroll-padding-bottom: 1rem }`
- `.actions-footer { flex: none; padding-top: 0.6rem; border-top: 2px dashed var(--ink) }` (ใช้ token สีเดิม ห้ามใส่ hex ใหม่)
- ยังไม่จำกัดความสูงในขั้นนี้ (Task 3 จำกัดเมื่ออยู่กลางกระดาน) มือถือจึงหน้าตาเหมือนเดิมแค่มีเส้นคั่นเหนือปุ่มหลัก

- [ ] **Step 3: ตรวจ**

Run: `npm test` → PASS
เปิด `npm start` แล้วเข้าเกม 2 แท็บ ที่จอ 375px: การ์ดคำสั่งยังอยู่ใต้กระดาน ปุ่มครบเหมือนเดิม

- [ ] **Step 4: Commit**

```bash
git add public/js/ui/actions.js public/css/style.css
git commit -m "feat: action card with scrollable body and pinned footer"
```

---

### Task 3: ย้ายการ์ดคำสั่งไปกลางกระดานบนคอม

**Files:**
- Modify: `public/js/screens/game.js` (`mountGame`, `playEvents`/`pump`, `applyState`, `destroy`)
- Modify: `public/css/style.css` (`.board-center`, `.stage`, media query `min-width: 768px`)

**Interfaces:**
- Consumes: DOM จาก Task 2; `stageOf`/`[data-slot="stage"]` ใน `.board-center` จาก `public/js/ui/board.js`
- Produces: `#action-area` อยู่ใน `.board-center` ต่อจาก `.stage` เมื่อ `matchMedia('(min-width: 768px)').matches` ไม่งั้นอยู่ในแผงตำแหน่งเดิม (ระหว่าง `resultsSlot` กับการ์ดถัดไป); `slots.actions` คืน element เดิมเสมอ

- [ ] **Step 1: ย้าย element ตาม media query**

ใน `mountGame` สร้าง `const desktop = matchMedia('(min-width: 768px)')` และฟังก์ชัน `placeActions()` ที่ append `actionArea` ไปที่ `.board-center` (หาได้หลัง `renderBoard` ครั้งแรก) หรือกลับไปแผงด้วย `resultsSlot.after(actionArea)`; เรียกหลัง `renderBoard` ใน `applyState` และใน listener `desktop.addEventListener('change', placeActions)`; ถอด listener ใน `destroy()`

- [ ] **Step 2: ซ่อนระหว่างแอนิเมชัน**

ใน `pump()` เมื่อ `animate` เป็นจริง ตั้ง `actionArea.hidden = true` ก่อน `playEvents`; ใน `applyState` ตั้ง `actionArea.hidden = false` ทุกครั้ง (Review Focus ข้อ 2)

- [ ] **Step 3: CSS ในกลางกระดาน (เฉพาะ `@media (min-width: 768px)`)**

- `.board-center` เปลี่ยน `justify-content` เป็น `flex-start` เมื่อมีการ์ดคำสั่ง (`.board-center:has(.actions-card)`) และซ่อน `.center-title` ในกรณีนั้น (ห้องยังแสดง)
- `.board-center .action-area { width: 100%; min-height: 0; flex: 1 1 auto; display: flex; color: var(--ink); text-align: start }`
- `.board-center .actions-card { width: 100%; max-height: 100%; }` ให้ body เลื่อนเมื่อสูงเกิน
- `.board-center:has(.actions-card) .stage { min-height: 0 }` และลดขนาดลูกเต๋า/sprite (`.stage-sprite`) ลงราวครึ่งหนึ่ง ตัวเลขยังอ่านชัด
- `.board-center .wait-card { display: none }`
- `.board-center .act-warp, .board-center .act-mons` ใช้ `repeat(auto-fill, minmax(8rem, 1fr))` ให้พอดีที่ ~540px

- [ ] **Step 4: ตรวจ**

Run: `npm test` → PASS
ที่ 1366×768: ตาเรา step ทอย การ์ดอยู่กลางกระดานใต้ลูกเต๋า ตาคนอื่นกลางกระดานมีแค่ข้อความ "ตาของ X"; ระหว่างลูกเต๋าหมุนไม่มีการ์ดบัง

- [ ] **Step 5: Commit**

```bash
git add public/js/screens/game.js public/css/style.css
git commit -m "feat: show the action card in the board center on desktop"
```

---

### Task 4: เรียงแผงขวาใหม่ และตรวจครบทุก step

**Files:**
- Modify: `public/js/ui/panel.js` (`renderPanel`)
- Modify: `public/css/style.css` (media query `min-width: 768px`)

**Interfaces:**
- Consumes: `playerCard(room, p, pokedexById, myId)` เดิมใน `panel.js`
- Produces: `renderPanel` วาด: การ์ดผู้เล่นของเรา (`playerCard` ของ me ในการ์ดหัวข้อ "ข้อมูลของคุณ") → `myMons` → การ์ด "ผู้เล่นคนอื่น" (เฉพาะคนที่ไม่ใช่เรา); ถ้าเราไม่ใช่ผู้เล่น (ไม่มี me) แสดงการ์ด "ผู้เล่น" ทุกคนเหมือนเดิม

- [ ] **Step 1: แก้ `renderPanel` ตาม Interfaces และลำดับแผงบนคอม**

ลำดับ DOM ใน `game.js` คงเดิม (มือถือจึงยังเป็น ปุ่ม → ประวัติ → ผู้เล่น) บนคอมใช้ CSS ใน `@media (min-width: 768px)`: `.panel .history-card { order: 1 } .panel .legend { order: 2 }` ให้ได้ `turn-card` → `resultsSlot` → `playersSlot` → `history-card` → `legend`
การเรียงการ์ดของเราขึ้นก่อนใน `renderPanel` มีผลทั้งคอมและมือถือ (ข้อยกเว้นเดียวของ "มือถือคงเดิม" — แจ้งผู้ใช้แล้ว)

- [ ] **Step 2: เทสต์**

Run: `npm test` → PASS

- [ ] **Step 3: ตรวจในเบราว์เซอร์ที่ 1366×768 และ 1920×1080 (2 แท็บ 2 ผู้เล่น)**

เล่นผ่านแต่ละ step แล้วดูว่าปุ่มหลักอยู่ในจอโดยไม่เลื่อนหน้าหรือแผง และไม่บังลูกเต๋า:
ทอย/วาร์ป → ยืนยันเดิน → จับ (3 ปุ่มบอล + ข้าม) → จับพลาด → ร้าน (เลือก 1/3/5 ลูก) → ศูนย์รักษา → ขายที่จุดเริ่มต้น → ท้าสู้ / ถูกท้า
และ Review Focus ข้อ 1 (รายการยาว: footer ยังเห็น), ข้อ 4 (Tab ไล่ปุ่มใน body ไม่ถูก footer บัง), ข้อ 5 (กดซื้อตอนเงินไม่พอให้เห็น error)
step ไหนเล่นไปไม่ถึงในเวลาที่มี ให้จดไว้ในรายงาน ไม่ต้องข้ามไปเงียบๆ

- [ ] **Step 4: ตรวจการย่อหน้าต่าง**

ที่ step ร้าน เลือก 5 ลูก แล้วย่อหน้าต่างเหลือ 700px: การ์ดย้ายไปใต้แผงและยังเลือก 5 ลูกอยู่ ขยายกลับ: กลับไปกลางกระดาน (Review Focus ข้อ 3)
ที่ 375px: ลำดับและหน้าตาเหมือนก่อนแก้ ยกเว้นการ์ดผู้เล่นของเราขึ้นก่อน

- [ ] **Step 5: Commit**

```bash
git add public/js/ui/panel.js public/css/style.css
git commit -m "feat: put your own info first in the side panel"
```
