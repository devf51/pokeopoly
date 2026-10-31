import { BOARD_SIZE, FIRST_FINISHER_BONUS, LAPS_TO_FINISH } from '../constants.js';
import { finalTotals, salaryFor } from '../economy.js';

const STEP_BY_TILE = { start: 'shop', mart: 'shop', center: 'center', wild: 'catch' };

// เดินทีละช่อง ทุกครั้งที่ข้ามหรือหยุดที่ index 0 นับรอบ + เงินเดือน
// ครบรอบที่ LAPS_TO_FINISH ให้หยุดที่ 0 ทันทีไม่ว่าแต้มเหลือเท่าไร แล้วเข้าเส้นชัย
export function moveBy(state, player, steps, events) {
  const from = player.position;
  let walked = 0;
  while (walked < steps) {
    player.position = (player.position + 1) % BOARD_SIZE;
    walked++;
    if (player.position !== 0) continue;

    player.laps++;
    const amount = salaryFor(player.cls);
    player.money += amount;
    events.push({ type: 'salary', playerId: player.id, amount });

    if (player.laps >= LAPS_TO_FINISH) {
      player.finished = true;
      let bonus = 0;
      if (state.firstFinisherId === null) {
        state.firstFinisherId = player.id;
        bonus = FIRST_FINISHER_BONUS;
        player.money += bonus;
      }
      events.push({ type: 'finished', playerId: player.id, bonus });
      break;
    }
  }
  events.push({ type: 'moved', playerId: player.id, from, to: player.position, steps: walked });
}

// ตั้ง step ตามชนิดช่องที่ผู้เล่นของตานี้ยืนอยู่ (จุดเริ่มต้นและ Mart = 'shop', wild = 'catch')
export function enterTile(state, events, ctx) {
  const player = state.players.find(p => p.id === state.turn.playerId);
  const tile = state.board[player.position];
  state.turn.roll = null;
  state.turn.ball = null;
  state.turn.step = STEP_BY_TILE[tile.type];
}

// เรียกหลังจบหน้าที่ของช่อง Task 7 จะเพิ่มการเช็กท้าสู้ตรงนี้
export function afterTile(state, events) {
  endTurn(state, events);
}

// ไปผู้เล่นถัดไปที่ยังไม่เข้าเส้นชัย ถ้าทุกคนเข้าเส้นชัยแล้วจบเกม
export function endTurn(state, events) {
  const n = state.order.length;
  for (let i = 1; i <= n; i++) {
    const index = (state.turnIndex + i) % n;
    const player = state.players.find(p => p.id === state.order[index]);
    if (player.finished) continue;
    state.turnIndex = index;
    state.turn = { playerId: player.id, step: 'roll', roll: null, ball: null, battle: null };
    events.push({ type: 'turn', playerId: player.id });
    return;
  }
  endGame(state, events);
}

function endGame(state, events) {
  const ranking = state.players
    .map(p => ({ playerId: p.id, ...finalTotals(p) }))
    .sort((a, b) => b.total - a.total);
  const best = ranking[0].total;
  state.phase = 'ended';
  state.result = {
    ranking,
    winnerIds: ranking.filter(r => r.total === best).map(r => r.playerId),
  };
  events.push({ type: 'gameOver', result: state.result });
}
