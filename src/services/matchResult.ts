/**
 * ผลการแข่งขันจาก Match Engine
 *
 * นี่คือคำตอบของ KNOWN ISSUE ข้อ 1 ของ PHASE 3: สกอร์ในเอนจินกับผลทางการเป็นคนละตัว
 * ตั้งแต่ PHASE 4 เป็นต้นไป **เอนจินคือผลจริง** — ไฟล์นี้แปลงผลนั้นเป็น MatchResult
 * ซึ่งเป็นชนิดข้อมูลเดิมของเกมทั้งใบ ระบบเหรียญ ดาว ลีก และประวัติการแข่งจึงไม่ต้องแก้อะไรเลย
 *
 *   MatchEngine → MatchResult → ระบบรางวัล/ประวัติเดิม
 *
 * ตรรกะเรื่องเหรียญ ดาว และโอกาสชนะ ยังเป็นของ services/matchmaking.ts เหมือนเดิม
 * ไฟล์นี้ไม่คิดเศรษฐกิจเอง แค่เรียกใช้ของเดิม (ห้ามสร้าง economy ใหม่)
 */
import type { MatchEngine, MatchTeamInput } from '@/match-engine';
import type { Tactics } from '@/match-engine/tactics';
import {
  INJURY_CHANCE,
  getCoins,
  getMatchOdds,
  getRankingPoints,
  type MatchActor,
} from '@/services/matchmaking';
import { MATCH_REAL_SECONDS, createMatchSession } from '@/services/matchSession';
import type {
  MatchEngineStats,
  MatchEvent,
  MatchOutcome,
  MatchResult,
  Opponent,
} from '@/types/match';
import { createId } from '@/utils/helpers';

/**
 * ความยาวของการจำลองหนึ่งนัด — ค่าเดียวกับที่ใช้ตอนดูสด (matchSession.ts)
 * ไม่มีตัวเลขคนละชุดระหว่าง "ดูสด" กับ "คิดผล" อีกต่อไปแล้ว
 */
const SIM_SECONDS = MATCH_REAL_SECONDS;

/**
 * ก้าวเวลาของการจำลองแบบไม่แสดงผล
 * หยาบกว่าตอนวาดจอ (1/60) เพื่อให้จบภายในเวลาไม่กี่ร้อยมิลลิวินาที
 * ยังละเอียดพอที่ลูกบอลจะไม่กระโดดข้ามระยะตัดบอลหรือระยะเอื้อมของผู้รักษาประตู
 */
const SIM_STEP = 1 / 24;

export interface EngineMatchInput {
  /** รหัสแมตช์จริงจาก session — ไม่สุ่มรหัสใหม่ */
  matchId: string;
  teamOvr: number;
  opponent: Opponent;
  /** ทีมของเราในภาษาของเอนจิน (จาก services/matchSession.ts) */
  home: MatchTeamInput;
  away: MatchTeamInput;
  /** ตัวจริงฝั่งเรา ใช้สุ่มอาการบาดเจ็บ (เอนจินยังไม่จำลองการบาดเจ็บ) */
  ourActors?: MatchActor[];
  /**
   * อาการบาดเจ็บที่ถูกสุ่มไว้ล่วงหน้าแล้ว (โหมดดูสด สุ่มตั้งแต่เขี่ยบอลเพื่อให้รู้ว่าจะเกิดนาทีไหน)
   * ส่งมาแล้วจะไม่สุ่มซ้ำ — เหตุการณ์ที่ผู้เล่นเห็นระหว่างแข่งกับที่อยู่ในผลจึงเป็นตัวเดียวกัน
   */
  injuryEvent?: MatchEvent | null;
  tactics?: { home?: Partial<Tactics>; away?: Partial<Tactics> };
}

/** ผลลัพธ์: ผลการแข่งแบบเดิมของเกม พร้อมเอนจินที่ใช้จำลอง (เผื่ออยากดูสถิติเชิงลึก) */
export interface EngineMatchOutcome {
  result: MatchResult;
  engine: MatchEngine;
}

/** เดินการจำลองจนหมดเวลา แล้วคืนเอนจินที่จบแมตช์แล้ว */
export const runMatchToFullTime = (input: EngineMatchInput): MatchEngine => {
  const { engine } = createMatchSession({
    matchId: input.matchId,
    home: input.home,
    away: input.away,
    tactics: input.tactics,
  });

  /*
   * เผื่อจำนวนก้าวไว้ 20% เพราะช่วงพักครึ่ง ฉลองประตู และบอลตายจากฟาวล์
   * กินเวลาจำลองโดยที่นาฬิกาในเกมไม่เดิน ถ้าไม่เผื่อจะหยุดที่นาที 89
   */
  const steps = Math.round((SIM_SECONDS * 1.2) / SIM_STEP);
  for (let index = 0; index < steps && engine.period !== 'FULL_TIME'; index += 1) {
    engine.tick(SIM_STEP);
  }

  return engine;
};

/** แปลงเหตุการณ์ของเอนจินเป็นเหตุการณ์ในภาษาของเกม (ประตู / ใบแดง) */
const toGameEvents = (engine: MatchEngine): MatchEvent[] => {
  // ชื่อและช่องของทุกคน เก็บไว้ตั้งแต่ต้น เพราะคนที่โดนใบแดงจะหายจาก engine.players
  const roster = new Map(
    [...engine.home.players, ...engine.away.players].map((agent) => [
      agent.id,
      { name: agent.name, slotId: agent.slotId, side: agent.side },
    ]),
  );

  const events: MatchEvent[] = [];

  engine.events.forEach((event) => {
    if (event.type !== 'goal' && event.type !== 'red_card') return;

    const actor = event.playerId ? roster.get(event.playerId) : undefined;
    const side = event.side === 'home' ? 'team' : 'opponent';
    const minute = Math.min(Math.max(Math.round(event.minute), 1), 90);

    if (event.type === 'goal') {
      events.push({ minute, side, scorer: actor?.name ?? 'ไม่ทราบชื่อ', type: 'goal' });
      return;
    }

    events.push({
      minute,
      side,
      scorer: actor?.name ?? 'ไม่ทราบชื่อ',
      type: 'redCard',
      // ฝั่งเราเท่านั้นที่รู้รหัสการ์ดจริง (id ของผู้เล่นในเอนจินคือ cardId)
      cardId: side === 'team' ? event.playerId : undefined,
      slotId: side === 'team' ? actor?.slotId : undefined,
    });
  });

  return events;
};

/**
 * สุ่มอาการบาดเจ็บฝั่งเรา
 *
 * เอนจินยังไม่จำลองการบาดเจ็บ (ไม่อยู่ในขอบเขต PHASE 1–4) แต่ระบบเปลี่ยนตัวของเกมพึ่งพามัน
 * จึงคงการสุ่มเดิมไว้ ใช้ค่าความน่าจะเป็นตัวเดียวกับ services/matchmaking.ts ไม่ได้ตั้งค่าใหม่
 */
export const rollInjury = (
  actors: MatchActor[],
  usedMinutes: Set<number> = new Set(),
): MatchEvent | null => {
  if (actors.length === 0 || Math.random() >= INJURY_CHANCE) return null;

  const actor = actors[Math.floor(Math.random() * actors.length)];
  let minute = 1 + Math.floor(Math.random() * 90);
  for (let attempt = 0; attempt < 20 && usedMinutes.has(minute); attempt += 1) {
    minute = 1 + Math.floor(Math.random() * 90);
  }

  return {
    minute,
    side: 'team',
    scorer: actor.name,
    type: 'injury',
    cardId: actor.cardId,
    slotId: actor.slotId,
  };
};

/** สรุปสถิติสองฝั่งในรูปแบบที่ชั้น types ของเกมใช้ได้ */
export const toEngineStats = (engine: MatchEngine): MatchEngineStats => ({
  team: { ...engine.stats.home },
  opponent: { ...engine.stats.away },
  possession: engine.possessionShare('home'),
});

const outcomeFromScore = (teamScore: number, opponentScore: number): MatchOutcome => {
  if (teamScore > opponentScore) return 'win';
  if (teamScore < opponentScore) return 'loss';
  return 'draw';
};

/**
 * แปลงเอนจินที่เล่นจบแล้วเป็นผลการแข่งในรูปแบบเดิมของเกม
 *
 * นี่คือทางเดียวที่ผลการแข่งเกิดขึ้นได้ตั้งแต่ PHASE 5 — ไม่ว่าจะดูสดจนจบ
 * หรือคิดผลแบบไม่แสดงผล ก็เรียกฟังก์ชันนี้กับเอนจินตัวที่เล่นจริงตัวนั้น
 * ไม่มีการจำลองรอบสองและไม่มีการสุ่มผลใหม่
 */
export const buildResultFromEngine = (
  engine: MatchEngine,
  input: Omit<EngineMatchInput, 'home' | 'away' | 'tactics'>,
): MatchResult => {
  const teamScore = engine.score.home;
  const opponentScore = engine.score.away;
  const outcome = outcomeFromScore(teamScore, opponentScore);

  const events = toGameEvents(engine);
  const usedMinutes = new Set(events.map((event) => event.minute));
  const injury =
    input.injuryEvent !== undefined
      ? input.injuryEvent
      : rollInjury(input.ourActors ?? [], usedMinutes);
  if (injury) events.push(injury);
  events.sort((a, b) => a.minute - b.minute);

  return {
    id: input.matchId || createId('match'),
    opponentId: input.opponent.id,
    opponentName: input.opponent.name,
    opponentOvr: input.opponent.ovr,
    teamOvr: input.teamOvr,
    teamScore,
    opponentScore,
    outcome,
    coinsEarned: getCoins(outcome, input.opponent),
    rankingPoints: getRankingPoints(outcome),
    // โอกาสชนะยังคิดจากผลต่าง OVR เหมือนเดิม — ใช้โชว์ก่อนแข่ง ไม่ได้ตัดสินผล
    odds: getMatchOdds(input.teamOvr, input.opponent.ovr),
    events,
    engineStats: toEngineStats(engine),
    playedAt: new Date().toISOString(),
  };
};

/**
 * จำลองหนึ่งนัดด้วย Match Engine แล้วคืนผลในรูปแบบเดิมของเกม
 *
 * เป็นตัวแทนของ simulateMatch() สำหรับนัดที่คิดผลในเครื่อง
 * ต่างกันตรงที่สกอร์ไม่ได้มาจากการทอยลูกเต๋าตามผลต่าง OVR อีกต่อไป
 * แต่มาจากการเล่นฟุตบอลจริงในเอนจิน — ค่าพลัง แผน และแทคติกจึงมีผลกับผลการแข่งจริง ๆ
 */
export const simulateMatchWithEngine = (input: EngineMatchInput): EngineMatchOutcome => {
  const engine = runMatchToFullTime(input);
  return { result: buildResultFromEngine(engine, input), engine };
};
