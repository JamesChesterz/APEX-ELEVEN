/**
 * ระบบจับคู่และจำลองผลการแข่ง
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 *
 * หลักการ: ผลต่าง OVR ระหว่างสองทีมคือตัวกำหนดโอกาสชนะ
 * ทีม OVR สูงกว่าได้เปรียบชัดเจน แต่ไม่การันตี — ยังมีโอกาสพลิกเสมอ
 */
import { OPPONENTS } from '@/data/opponents';
import type {
  Difficulty,
  MatchEvent,
  MatchOdds,
  MatchOutcome,
  MatchResult,
  Opponent,
} from '@/types/match';
import type { FormationId } from '@/types/team';
import { clamp, createId, pickRandom } from '@/utils/helpers';

/* ── ค่าคงที่ที่ใช้ปรับสมดุลเกม ─────────────────────────────── */

/** ผลต่าง OVR ที่ทำให้โอกาสชนะเปลี่ยนไปหนึ่งเท่าตัว (ยิ่งน้อย ยิ่งเอียงตาม OVR แรง) */
const OVR_SCALE = 8;
/** โอกาสเสมอสูงสุดเมื่อสองทีมพลังใกล้เคียงกันมาก */
const MAX_DRAW_CHANCE = 0.26;
/** ช่วง OVR ที่ระบบยอมจับคู่ให้ (บวก/ลบจากทีมเรา) */
const SEARCH_BAND = 6;

/* ── ชื่อบอทที่สุ่มขึ้นมาตอนหาคู่ ──────────────────────────── */

const BOT_PREFIX = ['Royal', 'Iron', 'Neon', 'Crimson', 'Silver', 'Delta', 'Union', 'Nova', 'Wild', 'Storm'];
const BOT_SUFFIX = ['Rangers', 'Wanderers', 'Athletic', 'City', 'Dynamo', 'Sparta', 'Vertex', 'Galaxy', 'Lions', 'Falcons'];
const BOT_MANAGER = ['A. Duarte', 'K. Novak', 'S. Mbeki', 'J. Haraldsen', 'V. Rossi', 'D. Chaiyo', 'L. Moreau', 'O. Yilmaz', 'B. Nakamura', 'R. Okafor'];
const BOT_FORMATIONS: FormationId[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'];

/** ระดับความยากจากผลต่าง OVR เทียบทีมเรา (gap = OVR คู่แข่ง − OVR เรา) */
export const difficultyFromGap = (gap: number): Difficulty => {
  if (gap <= -4) return 'easy';
  if (gap < 3) return 'normal';
  if (gap < 7) return 'hard';
  return 'elite';
};

/** เหรียญที่ได้เมื่อชนะ — คู่แข่งยิ่งแกร่งกว่าเรา รางวัลยิ่งสูง */
export const rewardForOpponent = (opponentOvr: number, gap: number): number =>
  Math.round(600 + Math.max(0, gap) * 220 + opponentOvr * 12);

/* ── โอกาสชนะ ─────────────────────────────────────────────── */

/**
 * โอกาสแพ้/เสมอ/ชนะจากผลต่าง OVR
 * ใช้เส้นโค้งแบบ logistic เหมือนระบบ Elo: ต่างกัน 8 แต้ม ≈ โอกาสชนะราว 2 ใน 3
 */
export const getMatchOdds = (teamOvr: number, opponentOvr: number): MatchOdds => {
  const gap = teamOvr - opponentOvr;
  const base = 1 / (1 + Math.pow(10, -gap / OVR_SCALE));

  // ยิ่งพลังใกล้กัน โอกาสเสมอยิ่งสูง
  const draw = MAX_DRAW_CHANCE * Math.exp(-Math.abs(gap) / 10);
  const win = base * (1 - draw);

  return { win, draw, loss: 1 - win - draw };
};

/** โอกาสชนะเป็นเปอร์เซ็นต์เต็ม ใช้แสดงบน UI */
export const getWinChancePercent = (teamOvr: number, opponentOvr: number): number =>
  Math.round(getMatchOdds(teamOvr, opponentOvr).win * 100);

/* ── หาคู่แข่ง ─────────────────────────────────────────────── */

/** กรองคู่แข่งตามระดับความยาก ใช้กับปุ่มเลือกโหมดในหน้า Match */
export const getOpponentsByDifficulty = (difficulty: Difficulty): Opponent[] =>
  OPPONENTS.filter((opponent) => opponent.difficulty === difficulty);

/** สุ่มบอทขึ้นมาใหม่หนึ่งทีม โดยให้ค่าพลังวนอยู่รอบ ๆ ทีมของเรา */
export const generateBotOpponent = (teamOvr: number): Opponent => {
  const gap = Math.round((Math.random() * 2 - 1) * SEARCH_BAND);
  const ovr = clamp(teamOvr + gap, 55, 99);

  return {
    id: createId('bot'),
    name: `${pickRandom(BOT_PREFIX)} ${pickRandom(BOT_SUFFIX)}`,
    manager: pickRandom(BOT_MANAGER),
    ovr,
    formationId: pickRandom(BOT_FORMATIONS),
    difficulty: difficultyFromGap(gap),
    rewardCoins: rewardForOpponent(ovr, gap),
    isBot: true,
  };
};

/**
 * หาคู่แข่งให้ทีมที่มีค่าพลัง teamOvr
 *
 * โหมดออนไลน์: **เจอผู้เล่นจริงเท่านั้น** ไม่มีบอทเลย
 * คู่แข่งไม่จำเป็นต้องออนไลน์อยู่ — ระบบใช้ทีมล่าสุดที่เขาประกาศไว้บนเซิร์ฟเวอร์
 * ถ้าไม่มีใครให้เจอ (คนน้อย หรือติดคูลดาวน์หมด) จะคืน null แล้วให้ UI บอกผู้เล่นตรง ๆ
 * ดีกว่าแอบยัดบอทให้ เพราะบอทคือช่องทางปั้มดาวที่ง่ายที่สุด
 *
 * โหมดออฟไลน์ (ไม่ได้ตั้งค่า Firebase): ยังใช้ทีมประจำระบบและบอทเหมือนเดิม
 * ไม่งั้นจะเล่นไม่ได้เลยเพราะไม่มีเซิร์ฟเวอร์ให้หาคน
 *
 * @param pool      คู่แข่งที่เป็นคนจริง (กรองคนที่ติดคูลดาวน์ออกมาก่อนแล้ว)
 * @param allowBots true เฉพาะโหมดออฟไลน์
 */
export const findOpponent = (
  teamOvr: number,
  pool: Opponent[] = [],
  allowBots = false,
): Opponent | null => {
  // คนจริงที่ค่าพลังใกล้เคียงกันก่อน
  const nearbyPlayers = pool.filter((entry) => Math.abs(entry.ovr - teamOvr) <= SEARCH_BAND);
  if (nearbyPlayers.length > 0) return pickRandom(nearbyPlayers);

  // ไม่มีใครอยู่ในช่วงพลังเดียวกัน → ขยายวงไปทั้งเซิร์ฟเวอร์ ดีกว่าไม่ได้เล่น
  if (pool.length > 0) return pickRandom(pool);

  if (!allowBots) return null;

  const nearby = OPPONENTS.filter((opponent) => Math.abs(opponent.ovr - teamOvr) <= SEARCH_BAND);
  if (nearby.length > 0 && Math.random() < 0.4) return pickRandom(nearby);

  return generateBotOpponent(teamOvr);
};

/* ── ผลจากการถูกท้า (ฝั่งตั้งรับ) ─────────────────────────── */

/**
 * เหรียญที่ได้ตอนถูกท้า — ให้น้อยกว่าการลงแข่งเอง เพราะไม่ได้ลงมือเล่น
 * (กันไม่ให้เปิดเกมทิ้งไว้แล้วได้เงินฟรีจากการถูกรุมท้า)
 */
const DEFENSE_COINS: Record<MatchOutcome, number> = { win: 500, draw: 200, loss: 0 };

/** ผลของนัดที่โดนท้า คิดจากสกอร์ที่ผู้ท้าส่งมา แต่คำนวณรางวัลใหม่ทั้งหมดที่ฝั่งเรา */
export const buildDefenseResult = (report: {
  id: string;
  fromUid: string;
  fromTeamName: string;
  fromTeamOvr: number;
  toTeamOvr: number;
  teamScore: number;
  opponentScore: number;
  events: MatchEvent[];
  playedAt: string;
}): MatchResult => {
  // ตัวเลขจากอีกเครื่องหนึ่ง — บีบให้อยู่ในช่วงที่เป็นไปได้ก่อนใช้เสมอ
  const teamScore = clamp(Math.round(report.teamScore), 0, 20);
  const opponentScore = clamp(Math.round(report.opponentScore), 0, 20);
  const teamOvr = clamp(Math.round(report.toTeamOvr), 0, 120);
  const opponentOvr = clamp(Math.round(report.fromTeamOvr), 0, 120);

  const outcome: MatchOutcome =
    teamScore > opponentScore ? 'win' : teamScore === opponentScore ? 'draw' : 'loss';

  return {
    id: report.id,
    opponentId: report.fromUid,
    opponentName: report.fromTeamName,
    opponentOvr,
    teamOvr,
    teamScore,
    opponentScore,
    outcome,
    coinsEarned: DEFENSE_COINS[outcome],
    rankingPoints: getRankingPoints(outcome),
    odds: getMatchOdds(teamOvr, opponentOvr),
    events: Array.isArray(report.events) ? report.events.slice(0, 20) : [],
    mode: 'defense',
    playedAt: report.playedAt,
  };
};

/* ── จำลองผลการแข่ง ───────────────────────────────────────── */

/** สุ่มผลแพ้/เสมอ/ชนะตามน้ำหนักโอกาส */
const rollOutcome = (odds: MatchOdds): MatchOutcome => {
  const roll = Math.random();
  if (roll < odds.win) return 'win';
  if (roll < odds.win + odds.draw) return 'draw';
  return 'loss';
};

/** สุ่มจำนวนประตูแบบ Poisson (วิธีของ Knuth) — ให้สกอร์กระจายเหมือนบอลจริง */
const poisson = (mean: number): number => {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = Math.random();

  while (product > limit && count < 9) {
    count += 1;
    product *= Math.random();
  }
  return count;
};

/**
 * สร้างสกอร์ที่สอดคล้องกับผลที่สุ่มได้
 * สุ่มประตูจากค่าพลังก่อน แล้วค่อยบังคับให้ฝั่งที่ชนะมีสกอร์นำจริง
 */
const buildScore = (
  outcome: MatchOutcome,
  teamOvr: number,
  opponentOvr: number,
): { teamScore: number; opponentScore: number } => {
  const gap = (teamOvr - opponentOvr) / 20;
  let teamScore = poisson(clamp(1.4 + gap, 0.3, 4));
  let opponentScore = poisson(clamp(1.4 - gap, 0.3, 4));

  if (outcome === 'draw') opponentScore = teamScore;
  if (outcome === 'win' && teamScore <= opponentScore) teamScore = opponentScore + 1;
  if (outcome === 'loss' && opponentScore <= teamScore) opponentScore = teamScore + 1;

  return { teamScore, opponentScore };
};

/**
 * ดาวที่ได้/เสียจากหนึ่งนัด — กติกาเดียวกันทุกโหมด
 *   ชนะ +1 ⭐ · เสมอ 0 · แพ้ −1 ⭐
 *
 * ตั้งใจให้ไม่ขึ้นกับผลต่าง OVR เลย: ล้มทีมแกร่งกว่ากับล้มทีมอ่อนกว่าได้เท่ากัน
 * ตารางอันดับจึงวัด "ชนะได้กี่นัดสุทธิ" ตรง ๆ อ่านง่ายและปั้มยาก
 * (ดาวรวมมีพื้นที่ต่ำสุดที่ 0 — ดูที่จุดที่บวกดาวเข้าสถิติ)
 */
export const getRankingPoints = (outcome: MatchOutcome): number => {
  if (outcome === 'win') return 1;
  if (outcome === 'draw') return 0;
  return -1;
};

/** เหรียญที่ได้จากผลการแข่ง (แพ้ยังได้ค่าเหนื่อยเล็กน้อย) */
const getCoins = (outcome: MatchOutcome, opponent: Opponent): number => {
  if (outcome === 'win') return opponent.rewardCoins;
  if (outcome === 'draw') return Math.round(opponent.rewardCoins * 0.4);
  return Math.round(opponent.rewardCoins * 0.12);
};

/** ชื่อสมมติของนักเตะฝั่งบอท ใช้ตอนไม่รู้ว่าใครอยู่ในทีมคู่แข่ง */
const BOT_SCORERS = [
  'M. Silva',
  'R. Kovac',
  'J. Adeyemi',
  'L. Moreau',
  'D. Novak',
  'A. Yilmaz',
  'S. Tanaka',
  'P. Andersen',
] as const;

/** ความยาวของหนึ่งแมตช์ (นาทีในเกม) */
export const MATCH_MINUTES = 90;

/** ผู้เล่นตัวจริงหนึ่งคน ใช้เป็นตัวเลือกสุ่มเหตุการณ์บาดเจ็บ/ใบแดง */
export interface MatchActor {
  name: string;
  /** มีเฉพาะฝั่งเรา — ใช้เปิดหน้าต่างเปลี่ยนตัวหรือขึ้นทะเบียนโดนแบน */
  cardId?: string;
  slotId?: string;
}

/** โอกาสที่แต่ละทีมจะมีคนบาดเจ็บ/โดนใบแดงอย่างน้อยหนึ่งครั้งต่อนัด (ไม่การันตี ไม่ใช่ทุกนัดมี) */
const INJURY_CHANCE = 0.14;
const RED_CARD_CHANCE = 0.08;

/**
 * กระจายประตูที่สุ่มได้ออกเป็นไทม์ไลน์รายนาที พร้อมสุ่มเหตุการณ์บาดเจ็บ/ใบแดงเบา ๆ
 * ใช้สกอร์ที่ตัดสินไว้แล้วเป็นตัวตั้ง จึงไม่มีทางที่ไทม์ไลน์กับผลสุดท้ายไม่ตรงกัน
 *
 * @param scorers         ชื่อนักเตะตัวจริงฝั่งเรา (กองหน้ามีชื่อซ้ำหลายครั้ง = โอกาสยิงสูงกว่า)
 * @param opponentScorers  ชื่อนักเตะตัวจริงฝั่งตรงข้าม
 * @param ourActors        ตัวจริง 11 คนฝั่งเรา (ไม่ถ่วงน้ำหนัก) พร้อม cardId/slotId ใช้สุ่มบาดเจ็บ/ใบแดง
 * @param theirActorNames   ชื่อตัวจริงฝั่งตรงข้าม (ไม่ถ่วงน้ำหนัก) ใช้สุ่มบาดเจ็บ/ใบแดงเช่นกัน
 *
 * ทั้งสองฝั่งต้องเป็นชื่อจริงจากตัวจริง 11 คน ไม่ใช่ชื่อสมมติ
 * เพราะไทม์ไลน์ชุดนี้ถูกส่งไปให้อีกฝ่ายดูด้วย — เขาต้องเห็นนักเตะของตัวเองเป็นคนยิง
 * ไม่มีรายชื่อส่งมา (เช่นทีมสำรองในโหมดออฟไลน์) ค่อยถอยไปใช้ชื่อกลาง ๆ
 */
export const buildTimeline = (
  teamScore: number,
  opponentScore: number,
  scorers: string[],
  opponentScorers: string[] = [],
  ourActors: MatchActor[] = [],
  theirActorNames: string[] = [],
): MatchEvent[] => {
  /** สุ่มนาทีแบบไม่ให้ซ้ำกัน เพื่อไม่ให้สองเหตุการณ์เกิดนาทีเดียวกัน */
  const usedMinutes = new Set<number>();
  const nextMinute = (): number => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const minute = 1 + Math.floor(Math.random() * MATCH_MINUTES);
      if (!usedMinutes.has(minute)) {
        usedMinutes.add(minute);
        return minute;
      }
    }
    return 1 + Math.floor(Math.random() * MATCH_MINUTES);
  };

  const ourScorers = scorers.length > 0 ? scorers : ['นักเตะของเรา'];
  const theirScorers = opponentScorers.length > 0 ? opponentScorers : BOT_SCORERS;

  const goals: MatchEvent[] = [
    ...Array.from({ length: teamScore }, () => ({
      minute: nextMinute(),
      side: 'team' as const,
      scorer: pickRandom(ourScorers),
      type: 'goal' as const,
    })),
    ...Array.from({ length: opponentScore }, () => ({
      minute: nextMinute(),
      side: 'opponent' as const,
      scorer: pickRandom(theirScorers),
      type: 'goal' as const,
    })),
  ];

  /** สุ่มเหตุการณ์บาดเจ็บ/ใบแดงหนึ่งฝั่ง — คนละไม่เกิน 1 บาดเจ็บ + 1 ใบแดงต่อนัด กันไม่ให้ซ้ำคนเดิม */
  const usedActorNames = new Set<string>();
  const incidents: MatchEvent[] = [];

  const rollIncident = (
    side: 'team' | 'opponent',
    chance: number,
    type: 'injury' | 'redCard',
    actors: MatchActor[],
  ) => {
    const eligible = actors.filter((actor) => !usedActorNames.has(actor.name));
    if (eligible.length === 0 || Math.random() >= chance) return;

    const actor = pickRandom(eligible);
    usedActorNames.add(actor.name);
    incidents.push({
      minute: nextMinute(),
      side,
      scorer: actor.name,
      type,
      cardId: actor.cardId,
      slotId: actor.slotId,
    });
  };

  const theirActors: MatchActor[] = theirActorNames.map((name) => ({ name }));

  rollIncident('team', INJURY_CHANCE, 'injury', ourActors);
  rollIncident('team', RED_CARD_CHANCE, 'redCard', ourActors);
  rollIncident('opponent', INJURY_CHANCE, 'injury', theirActors);
  rollIncident('opponent', RED_CARD_CHANCE, 'redCard', theirActors);

  return [...goals, ...incidents].sort((a, b) => a.minute - b.minute);
};

/**
 * จำลองผลการแข่งหนึ่งนัดจากค่าพลังของทั้งสองทีม
 * ทีม OVR สูงกว่ามีโอกาสชนะมากกว่าเสมอ แต่ยังมีความสุ่มพอให้ลุ้น
 *
 * @param scorers          ชื่อนักเตะตัวจริงฝั่งเรา ใช้สร้างไทม์ไลน์ประตู
 * @param opponentScorers   ชื่อนักเตะตัวจริงฝั่งตรงข้าม (ดู services/scorers.ts)
 * @param ourActors         ตัวจริง 11 คนฝั่งเรา (พร้อม cardId/slotId) ใช้สุ่มบาดเจ็บ/ใบแดง
 * @param theirActorNames    ชื่อตัวจริงฝั่งตรงข้าม ใช้สุ่มบาดเจ็บ/ใบแดงของเขา
 */
export const simulateMatch = (
  teamOvr: number,
  opponent: Opponent,
  scorers: string[] = [],
  opponentScorers: string[] = [],
  ourActors: MatchActor[] = [],
  theirActorNames: string[] = [],
): MatchResult => {
  const odds = getMatchOdds(teamOvr, opponent.ovr);
  const outcome = rollOutcome(odds);
  const { teamScore, opponentScore } = buildScore(outcome, teamOvr, opponent.ovr);

  return {
    events: buildTimeline(
      teamScore,
      opponentScore,
      scorers,
      opponentScorers,
      ourActors,
      theirActorNames,
    ),
    id: createId('match'),
    opponentId: opponent.id,
    opponentName: opponent.name,
    opponentOvr: opponent.ovr,
    teamOvr,
    teamScore,
    opponentScore,
    outcome,
    coinsEarned: getCoins(outcome, opponent),
    rankingPoints: getRankingPoints(outcome),
    odds,
    playedAt: new Date().toISOString(),
  };
};
