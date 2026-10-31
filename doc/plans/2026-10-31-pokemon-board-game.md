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

## Tasks

แต่ละ Task อยู่ในไฟล์ของตัวเอง ทำตามลำดับ เพราะ Task หลังใช้ Interfaces ของ Task ก่อนหน้า

| # | งาน | ไฟล์ | agent ที่เหมาะ |
|---|---|---|---|
| 1 | โครงโปรเจกต์ ค่าคงที่ ลูกเต๋า และผังกระดาน | [task-01-scaffold.md](task-01-scaffold.md) | `rules-engine` |
| 2 | ข้อมูลโปเกเด็กซ์และการแบ่งโซน | [task-02-pokedex.md](task-02-pokedex.md) | `rules-engine` |
| 3 | ตารางธาตุและสูตรต่อสู้ | [task-03-types-battle.md](task-03-types-battle.md) | `rules-engine` |
| 4 | สูตรจับและเศรษฐกิจ | [task-04-catch-economy.md](task-04-catch-economy.md) | `rules-engine` |
| 5 | Engine — สร้างเกม สุ่มโปเกม่อน เดิน และวนตา | [task-05-engine-movement.md](task-05-engine-movement.md) | `rules-engine` |
| 6 | Engine — จับ ร้านค้า และศูนย์รักษา | [task-06-engine-tiles.md](task-06-engine-tiles.md) | `rules-engine` |
| 7 | Engine — ท้าสู้ เล่นแทนเมื่อหมดเวลา และการซ่อนข้อมูล | [task-07-engine-challenge-auto-view.md](task-07-engine-challenge-auto-view.md) | `rules-engine` |
| 8 | เซิร์ฟเวอร์ — ห้อง Socket.IO หมดเวลา และหลุดแล้วกลับเข้า | [task-08-server.md](task-08-server.md) | `server-socket` |
| 9 | หน้าเว็บ — หน้าแรก ล็อบบี้ และกระดาน | [task-09-ui-lobby-board.md](task-09-ui-lobby-board.md) | `frontend-ui` |
| 10 | หน้าเว็บ — ปุ่ม action แอนิเมชัน ผลการแข่ง และคู่มือการเปิดเซิร์ฟเวอร์ | [task-10-ui-gameplay.md](task-10-ui-gameplay.md) | `frontend-ui` |
