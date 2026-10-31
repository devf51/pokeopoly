// โมเดลปุ่มของแต่ละ step (ตาราง "Actions ต่อ step" ในแผนหลัก) — ฟังก์ชันบริสุทธิ์ ไม่แตะ DOM
//
// หน้าเว็บไม่ตัดสินผลอะไร ที่นี่ตัดสินแค่ "ปุ่มไหนแสดง / ปุ่มไหนกดไม่ได้เพราะอะไร" จากสถานะที่เซิร์ฟเวอร์ส่งมา
// (viewFor) ด้วยราคา เลขเป้า และสิทธิ์ความสามารถ ส่วนผลลัพธ์จริงเซิร์ฟเวอร์เป็นคนตัดสินเสมอ
// และถ้าเซิร์ฟเวอร์ปฏิเสธ ข้อความ error ภาษาไทยจะแสดงต่อ
//
// ใช้ relative import (../../../shared) เพื่อให้เทสต์ใน Node ได้ ส่วนในเบราว์เซอร์ได้ URL เดียวกับ /shared
import {
  BALLS, BOARD_SIZE, CATCHER_BONUS, CLASS_USES, LAPS_TO_FINISH, LEGENDARY_IDS, MIN_STEPS,
  RANGER_ADJUST_STEP, RANGER_MAX_STEPS, SQUIRTLE_MAX_WARP, ZONE_VALUE,
} from '../../../shared/constants.js';
import { catchTarget } from '../../../shared/catch.js';
import { ballPrice, healCost, monValue } from '../../../shared/economy.js';
import { challengeTargets } from '../../../shared/engine/challenge.js';
import { actorOf } from '../../../shared/engine/index.js';
import { BALL_INFO, STEP_LABEL, TILE_NAME, TYPE_NAME, className } from './info.js';

// จำนวนบอลที่เลือกซื้อได้ (ค่าของ UI ไม่ใช่กติกา)
export const QTY_OPTIONS = [1, 3, 5];

const WARP_STEPS = Array.from({ length: SQUIRTLE_MAX_WARP }, (_, i) => MIN_STEPS + i);
const isLegendaryDex = dexId => LEGENDARY_IDS.includes(dexId);

// ---------- เหตุผลที่ใช้ความสามารถไม่ได้ (null = ใช้ได้) ----------

export function classReason(me, cls) {
  if (me.cls !== cls) return `ใช้ได้เฉพาะคลาส ${className(cls)}`;
  if (me.classUses < 1) return `ใช้ความสามารถครบ ${CLASS_USES} ครั้งแล้ว`;
  return null;
}

export function starterReason(me, starter) {
  const name = starter.charAt(0).toUpperCase() + starter.slice(1);
  if (me.starter !== starter) return `ใช้ได้เฉพาะเมื่อเลือกตัวเริ่มต้นเป็น ${name}`;
  if (me.starterUsed) return `ใช้ความสามารถของ ${name} ไปแล้ว (ใช้ได้ครั้งเดียวต่อเกม)`;
  return null;
}

// ปลายทางของการเดิน n ก้าวเพื่อแสดงบนปุ่มวาร์ป (ผลจริงมาจาก event moved ของเซิร์ฟเวอร์)
// เดินผ่านจุดเริ่มต้นในรอบสุดท้าย = หยุดที่จุดเริ่มต้น
export function destinationIndex(me, steps) {
  const raw = me.position + steps;
  if (raw >= BOARD_SIZE && me.laps + 1 >= LAPS_TO_FINISH) return 0;
  return raw % BOARD_SIZE;
}

export function tileLabel(game, index, pokedexById) {
  const tile = game.board[index];
  if (!tile) return '';
  const base = tile.type === 'wild' ? `โซน ${tile.zone}` : TILE_NAME[tile.type];
  const mon = tile.dexId ? pokedexById.get(tile.dexId) : null;
  return `ช่อง ${index + 1} ${base}${mon ? ` · ${mon.name}` : ''}`;
}

// ---------- ตัวสร้างชิ้นส่วนของโมเดล ----------

// control: ปุ่มหนึ่งปุ่ม ถ้ามี reason จะ disabled และแสดงเหตุผลใต้ปุ่ม (showReason:false = เหตุผลไปแสดงที่หัวกลุ่มแทน)
function control(key, label, action, { detail, reason = null, variant = 'secondary', dexId, showReason = true } = {}) {
  return { key, label, detail, action, disabled: Boolean(reason), reason, showReason, variant, dexId };
}

const buttons = (id, items, extra = {}) => ({ kind: 'buttons', id, items, ...extra });

const healthy = player => player.mons.filter(m => !m.fainted);

// ความสามารถแสดงเฉพาะเมื่อเป็นของคลาส/ตัวเริ่มต้นของเราเอง (ของคนอื่นซ่อนไปเลย ไม่ให้ปุ่มที่กดไม่ได้ดันปุ่มจริงลงไป)
// ถ้าเป็นของเราแต่ใช้หมดแล้ว ยังแสดงแบบ disabled พร้อมเหตุผล
const owns = (me, who) => me.cls === who || me.starter === who;
const ifOwn = (me, who, items) => (owns(me, who) ? items : []);

function monName(pokedexById, dexId) {
  return pokedexById.get(dexId)?.name ?? '?';
}

function typesText(pokedexById, dexId) {
  const types = pokedexById.get(dexId)?.types ?? [];
  return types.map(t => TYPE_NAME[t] ?? t).join(' / ');
}

function normalizeSelection(ui, { targets = [], fighters = [], charmanderOk = false } = {}) {
  return {
    qty: QTY_OPTIONS.includes(ui.qty) ? ui.qty : QTY_OPTIONS[0],
    targetId: targets.some(p => p.id === ui.targetId) ? ui.targetId : (targets[0]?.id ?? null),
    uid: fighters.some(m => m.uid === ui.uid) ? ui.uid : (fighters[0]?.uid ?? null),
    charmander: charmanderOk && ui.charmander === true,
  };
}

// ---------- แต่ละ step ----------

function rollStep(game, me, pokedexById) {
  const warpReason = starterReason(me, 'squirtle');
  return {
    sections: [
      buttons('main', [control('roll', 'ทอยลูกเต๋า', { type: 'ROLL' }, { variant: 'primary' })]),
      buttons('warp', ifOwn(me, 'squirtle', WARP_STEPS.map(n => control(
        `warp-${n}`, `${n} ช่อง`,
        { type: 'SQUIRTLE_WARP', steps: n },
        { reason: warpReason, showReason: false, detail: `ไป${tileLabel(game, destinationIndex(me, n), pokedexById)}` },
      ))), {
        title: 'วาร์ปด้วย Squirtle แทนการทอย',
        note: warpReason ?? 'เลือกจำนวนช่องที่จะวาร์ปไปข้างหน้า (ใช้ได้ครั้งเดียวต่อเกม)',
        noteIsReason: Boolean(warpReason),
        layout: 'warp',
      }),
    ],
  };
}

function moveStep(game, me) {
  const roll = game.turn.roll;
  const rangerReason = classReason(me, 'ranger');
  const uses = me.cls === 'ranger' ? `เหลือ ${me.classUses} ครั้ง` : undefined;
  return {
    summary: [`ทอยได้ ${roll} ก้าว`],
    sections: [
      buttons('main', [control('confirm', `เดิน ${roll} ก้าว`, { type: 'CONFIRM_MOVE' }, { variant: 'primary' })]),
      buttons('abilities', [
        ...ifOwn(me, 'ranger', [
        control('ranger-reroll', 'Ranger: ทอยเดินใหม่', { type: 'RANGER_REROLL' }, { reason: rangerReason, detail: uses }),
        control('ranger-up', `Ranger: ขยับ +${RANGER_ADJUST_STEP}`, { type: 'RANGER_ADJUST', delta: RANGER_ADJUST_STEP }, {
          reason: rangerReason ?? (roll >= RANGER_MAX_STEPS ? `ก้าวมากสุดแล้ว (${RANGER_MAX_STEPS} ก้าว)` : null), detail: uses,
        }),
        control('ranger-down', `Ranger: ขยับ −${RANGER_ADJUST_STEP}`, { type: 'RANGER_ADJUST', delta: -RANGER_ADJUST_STEP }, {
          reason: rangerReason ?? (roll <= MIN_STEPS ? `ก้าวน้อยสุดแล้ว (${MIN_STEPS} ก้าว)` : null), detail: uses,
        }),
        ]),
        ...ifOwn(me, 'pikachu', [
          control('pikachu-reroll', 'Pikachu: ทอยเดินใหม่', { type: 'PIKACHU_REROLL' }, { reason: starterReason(me, 'pikachu') }),
        ]),
      ], { title: 'ความสามารถพิเศษ', layout: 'list' }),
    ],
  };
}

function encounterOf(game, me, pokedexById) {
  const tile = game.board[me.position];
  if (!tile?.dexId) return null;
  const legendary = isLegendaryDex(tile.dexId);
  const zone = legendary ? 'legendary' : tile.zone;
  return {
    kind: 'encounter',
    dexId: tile.dexId,
    name: monName(pokedexById, tile.dexId),
    zoneText: legendary ? 'ตัวตำนาน' : `โซน ${tile.zone}`,
    target: catchTarget(zone),
    value: ZONE_VALUE[zone],
    legendary,
  };
}

function catchStep(game, me, pokedexById) {
  const encounter = encounterOf(game, me, pokedexById);
  const bulbaReason = starterReason(me, 'bulbasaur')
    ?? (encounter?.legendary ? 'จับตัวตำนานแบบการันตีไม่ได้' : null);
  const throws = Object.keys(BALLS).map(ball => control(
    `throw-${ball}`, `โยน ${BALL_INFO[ball].name}`, { type: 'THROW', ball },
    {
      variant: 'primary',
      detail: `เหลือ ${me.balls[ball]} ลูก · ${BALL_INFO[ball].desc}`,
      reason: me.balls[ball] < 1 ? `ไม่มี ${BALL_INFO[ball].name} เหลือ` : null,
    },
  ));
  const summary = [];
  if (me.cls === 'catcher') summary.push(`นักจับ (Catcher) ได้ทอยจับ +${CATCHER_BONUS} อัตโนมัติ`);
  return {
    summary,
    sections: [
      encounter,
      buttons('other', ifOwn(me, 'bulbasaur', [
        control('bulbasaur', 'Bulbasaur: จับสำเร็จแน่นอน', { type: 'BULBASAUR_CATCH' }, { reason: bulbaReason }),
      ]), { layout: 'list' }),
      // ปุ่มไม่จับอยู่แถวเดียวกับปุ่มโยน (ส่วนที่ติดล่างการ์ด) จะได้ไม่ต้องหา
      buttons('throw', [...throws, control('skip', 'ไม่จับ ข้ามไป', { type: 'SKIP' })], {
        title: 'เลือกบอลที่จะโยน (โยนได้ครั้งเดียว)', layout: 'list',
      }),
    ].filter(Boolean),
  };
}

function catchFailedStep(game, me, pokedexById) {
  const encounter = encounterOf(game, me, pokedexById);
  const { roll, ball } = game.turn;
  const summary = [`ทอยได้ ${roll} ด้วย ${BALL_INFO[ball]?.name ?? 'บอล'} ยังไม่ถึงเลขเป้า${encounter ? ` ${encounter.target}+` : ''}`];
  const retries = [
    ...ifOwn(me, 'professor', [control('professor', 'Professor: ทอยจับใหม่', { type: 'PROFESSOR_REROLL' }, {
      reason: classReason(me, 'professor'), detail: `เหลือ ${me.classUses} ครั้ง`,
    })]),
    ...ifOwn(me, 'pikachu', [control('pikachu', 'Pikachu: ทอยจับใหม่', { type: 'PIKACHU_REROLL' }, { reason: starterReason(me, 'pikachu') })]),
  ];
  return {
    summary,
    sections: [
      encounter,
      buttons('retry', [
        ...retries,
        control('accept', 'ยอมรับผล (โปเกม่อนหนีไป)', { type: 'ACCEPT' }, { variant: 'primary' }),
      ], {
        // หัวข้อ "ทอยใหม่ได้" เฉพาะเมื่อมีความสามารถทอยใหม่ของเราเอง
        title: retries.length > 0 ? 'ทอยจับใหม่ได้ด้วยบอลลูกเดิม ไม่เสียบอลเพิ่ม' : undefined, layout: 'list',
      }),
    ].filter(Boolean),
  };
}

function shopStep(game, me, pokedexById, selection) {
  const tile = game.board[me.position];
  const atStart = tile.type === 'start';
  const { qty } = selection;
  const buys = Object.keys(BALLS).map(ball => {
    const price = ballPrice(ball, me.cls);
    const cost = price * qty;
    return control(`buy-${ball}`, `ซื้อ ${BALL_INFO[ball].name} × ${qty}`, { type: 'BUY', ball, qty }, {
      detail: `${BALL_INFO[ball].desc} · ${price} ต่อลูก · รวม ${cost} · มี ${me.balls[ball]} ลูก`,
      reason: me.money < cost ? `เงินไม่พอ (ต้องใช้ ${cost} มี ${me.money})` : null,
    });
  });

  let sells;
  if (!atStart) {
    sells = buttons('sell', [control('sell', 'ขายโปเกม่อน', { type: 'SELL' }, { reason: 'ขายได้เฉพาะตอนหยุดที่จุดเริ่มต้น' })], { layout: 'list' });
  } else {
    const sellable = me.mons.filter(m => !m.starter && !m.fainted);
    sells = sellable.length === 0
      ? buttons('sell', [control('sell', 'ขายโปเกม่อน', { type: 'SELL' }, {
        reason: 'ไม่มีโปเกม่อนให้ขาย (ตัวเริ่มต้นและตัวที่หมดสภาพขายไม่ได้)',
      })], { layout: 'list' })
      : buttons('sell', sellable.map(m => control(`sell-${m.uid}`, `ขาย ${monName(pokedexById, m.dexId)}`, { type: 'SELL', uid: m.uid }, {
        detail: `ได้เงิน ${monValue(m)}`, dexId: m.dexId,
      })), { title: 'ขายโปเกม่อน (ได้เงินเต็มมูลค่า)', layout: 'mons' });
  }

  return {
    summary: [`ที่ ${TILE_NAME[tile.type]} · เงินของคุณ ${me.money}`],
    sections: [
      { kind: 'qty', options: QTY_OPTIONS, selected: qty, title: 'ซื้อครั้งละกี่ลูก' },
      buttons('buy', buys, { layout: 'list' }),
      sells,
      buttons('done', [control('done', 'เสร็จแล้ว ไปต่อ', { type: 'DONE' }, { variant: 'primary' })]),
    ],
  };
}

function centerStep(game, me, pokedexById) {
  const fainted = me.mons.filter(m => m.fainted);
  const heals = fainted.length === 0
    ? buttons('heal', [control('heal', 'รักษาโปเกม่อน', { type: 'HEAL' }, { reason: 'ไม่มีโปเกม่อนที่หมดสภาพ' })], { layout: 'list' })
    : buttons('heal', fainted.map(m => {
      const cost = healCost(m);
      return control(`heal-${m.uid}`, `รักษา ${monName(pokedexById, m.dexId)}`, { type: 'HEAL', uid: m.uid }, {
        detail: cost === 0 ? 'ฟรี' : `ค่ารักษา ${cost}`,
        dexId: m.dexId,
        reason: me.money < cost ? `เงินไม่พอ (ต้องใช้ ${cost} มี ${me.money})` : null,
      });
    }), { title: 'โปเกม่อนที่หมดสภาพ', layout: 'mons' });
  return {
    summary: [`ที่ Pokémon Center · เงินของคุณ ${me.money}`],
    sections: [
      heals,
      buttons('done', [control('done', 'เสร็จแล้ว ไปต่อ', { type: 'DONE' }, { variant: 'primary' })]),
    ],
  };
}

function fighterOptions(fighters, pokedexById) {
  return fighters.map(m => ({
    value: m.uid,
    label: monName(pokedexById, m.dexId),
    detail: `ธาตุ${typesText(pokedexById, m.dexId)}${m.starter ? ' · ตัวเริ่มต้น' : ''}`,
    dexId: m.dexId,
  }));
}

function challengeStep(game, me, pokedexById, selection, targets, fighters, charmanderReason) {
  const none = targets.length === 0
    ? (fighters.length === 0 ? 'โปเกม่อนของคุณหมดสภาพทุกตัว' : 'ไม่มีผู้เล่นที่ท้าได้ในช่องนี้')
    : null;
  const action = none ? { type: 'CHALLENGE' } : {
    type: 'CHALLENGE', targetId: selection.targetId, uid: selection.uid, charmander: selection.charmander,
  };
  return {
    summary: ['ท้าสู้ได้ 1 คนจากคนที่อยู่ช่องเดียวกัน อีกฝ่ายปฏิเสธไม่ได้'],
    sections: [
      {
        kind: 'pick', field: 'targetId', title: 'เลือกคนที่จะท้า', selected: selection.targetId,
        options: targets.map(p => ({
          value: p.id, label: p.name, detail: `โปเกม่อนที่สู้ได้ ${healthy(p).length} ตัว`,
        })),
      },
      { kind: 'pick', field: 'uid', title: 'เลือกโปเกม่อนของคุณ', selected: selection.uid, options: fighterOptions(fighters, pokedexById) },
      owns(me, 'charmander') ? {
        kind: 'toggle', field: 'charmander', label: 'ใช้ความสามารถ Charmander: ชนะอัตโนมัติ',
        checked: selection.charmander, reason: charmanderReason,
      } : null,
      buttons('main', [
        control('challenge', 'ท้าสู้!', action, { variant: 'primary', reason: none }),
        control('skip', 'ไม่ท้า จบตา', { type: 'SKIP' }),
      ], { layout: 'list' }),
    ].filter(Boolean),
  };
}

function defendStep(game, me, pokedexById, selection, fighters, charmanderReason) {
  const { battle } = game.turn;
  const attacker = game.players.find(p => p.id === battle.attackerId);
  const attackerMon = attacker?.mons.find(m => m.uid === battle.attackerUid);
  const none = fighters.length === 0 ? 'โปเกม่อนของคุณหมดสภาพทุกตัว' : null;
  const action = none ? { type: 'DEFEND' } : { type: 'DEFEND', uid: selection.uid, charmander: selection.charmander };
  return {
    summary: [`${attacker?.name ?? ''} ท้าคุณสู้ด้วย ${attackerMon ? monName(pokedexById, attackerMon.dexId) : 'โปเกม่อน'}`],
    sections: [
      attackerMon ? { kind: 'foe', dexId: attackerMon.dexId, name: monName(pokedexById, attackerMon.dexId), detail: `ธาตุ${typesText(pokedexById, attackerMon.dexId)}` } : null,
      { kind: 'pick', field: 'uid', title: 'เลือกโปเกม่อนของคุณ', selected: selection.uid, options: fighterOptions(fighters, pokedexById) },
      owns(me, 'charmander') ? {
        kind: 'toggle', field: 'charmander', label: 'ใช้ความสามารถ Charmander: ชนะอัตโนมัติ',
        checked: selection.charmander, reason: charmanderReason,
      } : null,
      buttons('main', [control('defend', 'สู้!', action, { variant: 'primary', reason: none })]),
    ].filter(Boolean),
  };
}

const WAITING = {
  roll: name => `รอ ${name} ทอยลูกเต๋า`,
  move: name => `รอ ${name} ยืนยันการเดิน`,
  catch: name => `รอ ${name} ตัดสินใจว่าจะจับหรือไม่`,
  'catch-failed': name => `รอ ${name} ตัดสินใจหลังจับไม่สำเร็จ`,
  shop: name => `รอ ${name} ใช้ร้านค้า`,
  center: name => `รอ ${name} ใช้ศูนย์รักษา`,
  challenge: name => `รอ ${name} ตัดสินใจว่าจะท้าสู้หรือไม่`,
  defend: name => `รอ ${name} เลือกโปเกม่อนป้องกัน`,
};

// คืน null ถ้าเกมไม่ได้อยู่ระหว่างเล่น
// ui = ค่าที่ผู้เล่นเลือกค้างไว้ { qty, targetId, uid, charmander }; โมเดลคืน selection ที่ปรับให้ใช้ได้แล้ว
export function buildActionModel(game, myId, pokedexById, ui = {}) {
  if (!game || game.phase !== 'playing') return null;
  const { turn } = game;
  const actorId = actorOf(game);
  const actor = game.players.find(p => p.id === actorId);
  const me = game.players.find(p => p.id === myId);
  const base = {
    step: turn.step,
    title: STEP_LABEL[turn.step] ?? '',
    actorId,
    actorName: actor?.name ?? '',
    mine: Boolean(me) && actorId === myId,
    key: `${turn.playerId}|${turn.step}|${turn.battle?.attackerUid ?? ''}|${actor?.position ?? ''}`,
  };
  if (!base.mine) {
    return {
      ...base, summary: [(WAITING[turn.step] ?? (n => `รอ ${n}`))(base.actorName)], sections: [], selection: normalizeSelection(ui),
    };
  }

  const fighters = healthy(me);
  const charmanderReason = starterReason(me, 'charmander');
  let targets = [];
  if (turn.step === 'challenge') targets = challengeTargets(game, me);
  const selection = normalizeSelection(ui, { targets, fighters, charmanderOk: charmanderReason === null });

  let body;
  switch (turn.step) {
    case 'roll': body = rollStep(game, me, pokedexById); break;
    case 'move': body = moveStep(game, me); break;
    case 'catch': body = catchStep(game, me, pokedexById); break;
    case 'catch-failed': body = catchFailedStep(game, me, pokedexById); break;
    case 'shop': body = shopStep(game, me, pokedexById, selection); break;
    case 'center': body = centerStep(game, me, pokedexById); break;
    case 'challenge': body = challengeStep(game, me, pokedexById, selection, targets, fighters, charmanderReason); break;
    case 'defend': body = defendStep(game, me, pokedexById, selection, fighters, charmanderReason); break;
    default: body = { sections: [] };
  }
  // section ปุ่มที่ว่างหลังซ่อนความสามารถของคนอื่น ไม่ต้องแสดงหัวข้อค้างไว้
  const sections = body.sections.filter(sec => sec.kind !== 'buttons' || sec.items.length > 0);
  return { ...base, summary: [], ...body, sections, selection };
}

// ใช้ในเทสต์ / ตรวจว่าตารางแผนหลักครบ: รายชื่อ action type ที่แต่ละ step อาจแสดง
export function actionTypes(model) {
  return model.sections.flatMap(s => (s.kind === 'buttons' ? s.items.map(i => i.action.type) : []));
}
