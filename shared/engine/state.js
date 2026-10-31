import { STARTERS, STARTING_BALLS, STARTING_MONEY, CLASS_USES } from '../constants.js';
import { buildBoard } from '../board.js';
import { shuffle } from '../rng.js';
import { spawnFor } from './spawn.js';

// players: [{ id, name, cls, starter }] -> GameState
// ลำดับตาสุ่มด้วย shuffle แล้วสุ่มโปเกม่อนลงทุกช่อง wild ตามลำดับ index
export function createGame(players, ctx) {
  let nextUid = 1;
  const state = {
    phase: 'playing',
    board: buildBoard(),
    players: players.map(({ id, name, cls, starter }) => ({
      id,
      name,
      cls,
      starter,
      starterUsed: false,
      classUses: CLASS_USES,
      position: 0,
      laps: 0,
      finished: false,
      money: STARTING_MONEY,
      balls: { ...STARTING_BALLS },
      mons: [{ uid: nextUid++, dexId: STARTERS[starter], zone: null, starter: true, fainted: false }],
    })),
    order: shuffle(players.map(p => p.id), ctx.rng),
    turnIndex: 0,
    turn: null,
    caughtLegendaries: [],
    firstFinisherId: null,
    nextUid,
    result: null,
  };
  state.turn = { playerId: state.order[0], step: 'roll', roll: null, ball: null, battle: null };

  for (const tile of state.board) {
    if (tile.type === 'wild') tile.dexId = spawnFor(tile.zone, state, ctx);
  }
  return state;
}
