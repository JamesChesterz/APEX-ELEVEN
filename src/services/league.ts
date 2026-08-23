/**
 * ลีกประจำวัน (Matchmaking แบบอัตโนมัติ)
 *
 * กติกา:
 *   - เข้าร่วมครั้งเดียว แล้วระบบจับคู่ให้เองทุก ๆ 30 นาที (นาที :00 และ :30)
 *   - หนึ่งวันแข่งเริ่ม 06:00 ไปจนถึงรอบ 05:30 ของวันถัดไป รวม 48 รอบ
 *   - ครบวันแล้วสรุปอันดับ แจกรางวัลตามอันดับ (เหรียญ + แต้ม) แล้วเริ่มวันใหม่
 *   - ทีมที่ใช้แข่งคือทีมชุดล่าสุดในหน้า MY TEAM เสมอ เปลี่ยนตัวได้ตลอด ไม่มีคูลดาวน์
 *
 * เกมนี้ไม่มีเซิร์ฟเวอร์ รอบที่ผ่านไปตอนผู้เล่นปิดแอปจึงถูก "ย้อนคำนวณ" ตอนเปิดกลับมา
 * (ดู getRoundsBetween + MAX_CATCHUP_ROUNDS) ผลจึงเดินหน้าต่อแม้ไม่ได้เปิดเกมค้างไว้
 *
 * ทั้งไฟล์เป็น pure function ห้าม import React หรือแตะ state
 */
import { LEADERBOARD } from '@/data/opponents';
import type { LeagueDaily, LeagueState } from '@/types/account';
import type { Opponent } from '@/types/match';

/** แข่งทุกกี่นาที */
export const ROUND_MINUTES = 30;

/** วันแข่งเริ่มกี่โมง (เวลาเครื่องผู้เล่น) */
export const DAY_START_HOUR = 6;

/** จำนวนรอบสูงสุดที่ย้อนคำนวณให้ในครั้งเดียว (กันเปิดแอปครั้งเดียวแล้วรันเป็นพันรอบ) */
export const MAX_CATCHUP_ROUNDS = 48;

/** จำนวนรอบทั้งหมดในหนึ่งวัน */
export const ROUNDS_PER_DAY = (24 * 60) / ROUND_MINUTES;

/** เก็บผลการแข่งย้อนหลังได้กี่นัด */
export const HISTORY_LIMIT = 60;

/* ── เวลาและรอบ ────────────────────────────────────────────── */

/** เวลาเริ่มของ "วันแข่ง" ที่ครอบเวลา now อยู่ (06:00 ของวันนี้ หรือของเมื่อวานถ้ายังไม่ถึง 06:00) */
export const getDayStart = (now: Date): Date => {
  const start = new Date(now);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
  return start;
};

/** เวลาของรอบถัดไป (ปัดขึ้นไปที่นาที :00 หรือ :30 ถัดไป) */
export const getNextRound = (now: Date): Date => {
  const next = new Date(now);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const target = minutes < ROUND_MINUTES ? ROUND_MINUTES : 60;
  next.setMinutes(target);
  return next;
};

/**
 * รายการเวลาของรอบที่เกิดขึ้นแล้ว หลังจาก after จนถึง until
 * ตัดให้เหลือแค่ MAX_CATCHUP_ROUNDS รอบล่าสุดเสมอ
 */
export const getRoundsBetween = (after: Date, until: Date): Date[] => {
  const rounds: Date[] = [];

  // เริ่มจากรอบแรกที่อยู่ "หลัง" after
  const cursor = new Date(after);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() < ROUND_MINUTES ? ROUND_MINUTES : 60, 0, 0);

  while (cursor.getTime() <= until.getTime() && rounds.length < MAX_CATCHUP_ROUNDS * 4) {
    rounds.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + ROUND_MINUTES);
  }

  return rounds.slice(-MAX_CATCHUP_ROUNDS);
};

/** ลำดับรอบภายในวัน (0 = รอบ 06:00) */
export const getRoundIndex = (roundAt: Date): number =>
  Math.floor((roundAt.getTime() - getDayStart(roundAt).getTime()) / (ROUND_MINUTES * 60 * 1000));

/** กุญแจของวันแข่ง ใช้เป็น seed ให้ผลของบอทคงที่ทั้งวัน */
export const getDayKey = (dayStart: Date): string =>
  `${dayStart.getFullYear()}-${dayStart.getMonth() + 1}-${dayStart.getDate()}`;

/* ── ทีมในลีก ──────────────────────────────────────────────── */

/** ทีมคู่แข่งประจำลีก แปลงจากตารางอันดับ mock เดิม เพื่อให้เป็นลีกเดียวกันทั้งเกม */
export const LEAGUE_TEAMS: Opponent[] = LEADERBOARD.filter((entry) => !entry.isCurrentUser).map(
  (entry, index) => ({
    id: `lg${index + 1}`,
    name: entry.teamName,
    manager: entry.managerName,
    ovr: entry.teamOvr,
    formationId: '4-3-3',
    difficulty: entry.teamOvr >= 88 ? 'elite' : entry.teamOvr >= 82 ? 'hard' : 'normal',
    // ทีมแกร่งกว่า = ชนะแล้วได้เหรียญเยอะกว่า
    rewardCoins: Math.round(entry.teamOvr ** 2 * 1.4),
  }),
);

/** คู่แข่งของรอบนี้ — วนไปตามลำดับรอบ ทุกทีมจึงได้เจอกันครบทั้งวัน */
export const getRoundOpponent = (roundIndex: number): Opponent =>
  LEAGUE_TEAMS[((roundIndex % LEAGUE_TEAMS.length) + LEAGUE_TEAMS.length) % LEAGUE_TEAMS.length];

/* ── ผลของบอทในตารางประจำวัน ───────────────────────────────── */

/** PRNG แบบ mulberry32 — ให้ผลเดิมทุกครั้งเมื่อ seed เท่ากัน */
const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * ผลสะสมของบอทหนึ่งทีมในวันนี้
 *
 * เดินจาก seed เดียวกันทุกครั้ง ผลของรอบที่ผ่านไปแล้วจึงไม่เปลี่ยนเมื่อรีเฟรช
 * (เดิมบอทในตารางอันดับมีคะแนนค้างนิ่ง — ตารางประจำวันนี้ขยับจริงทุกรอบ)
 */
export const getBotDaily = (botId: string, ovr: number, dayKey: string, rounds: number): LeagueDaily => {
  const random = seededRandom(hashString(`${dayKey}:${botId}`));
  const daily: LeagueDaily = { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

  // ทีมยิ่ง OVR สูง ยิ่งมีโอกาสชนะต่อรอบสูง
  const winChance = Math.min(0.72, Math.max(0.22, (ovr - 62) / 45));
  const drawChance = 0.22;

  for (let round = 0; round < rounds; round += 1) {
    const roll = random();
    const scored = 1 + Math.floor(random() * 3);
    const conceded = Math.floor(random() * 3);

    if (roll < winChance) {
      daily.points += 3;
      daily.wins += 1;
      daily.goalsFor += scored;
      daily.goalsAgainst += Math.min(conceded, scored - 1 < 0 ? 0 : scored - 1);
    } else if (roll < winChance + drawChance) {
      daily.points += 1;
      daily.draws += 1;
      daily.goalsFor += conceded;
      daily.goalsAgainst += conceded;
    } else {
      daily.losses += 1;
      daily.goalsFor += Math.max(0, conceded - 1);
      daily.goalsAgainst += scored;
    }
  }

  return daily;
};

/* ── ตารางประจำวัน ─────────────────────────────────────────── */

export interface LeagueStanding {
  rank: number;
  teamName: string;
  managerName: string;
  ovr: number;
  daily: LeagueDaily;
  isCurrentUser?: boolean;
}

/** ผลต่างประตู ใช้ตัดสินอันดับเมื่อคะแนนเท่ากัน */
export const goalDiff = (daily: LeagueDaily): number => daily.goalsFor - daily.goalsAgainst;

/** ตารางอันดับประจำวัน: ผู้เล่น + บอททั้งลีก เรียงตามคะแนน → ผลต่างประตู → ประตูได้ */
export const buildDailyStandings = (
  userDaily: LeagueDaily,
  teamName: string,
  managerName: string,
  teamOvr: number,
  dayKey: string,
  roundsPlayed: number,
): LeagueStanding[] => {
  const rows: Array<Omit<LeagueStanding, 'rank'>> = [
    ...LEAGUE_TEAMS.map((team) => ({
      teamName: team.name,
      managerName: team.manager,
      ovr: team.ovr,
      daily: getBotDaily(team.id, team.ovr, dayKey, roundsPlayed),
    })),
    { teamName, managerName, ovr: teamOvr, daily: userDaily, isCurrentUser: true },
  ];

  return rows
    .sort(
      (a, b) =>
        b.daily.points - a.daily.points ||
        goalDiff(b.daily) - goalDiff(a.daily) ||
        b.daily.goalsFor - a.daily.goalsFor,
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

/* ── รางวัลประจำวัน ────────────────────────────────────────── */

export interface DailyReward {
  coins: number;
  /** แต้มแลกนักเตะ */
  points: number;
  /** แต้มตีบวก — อันดับ 1–5 ได้ 8,000 → 4,000 ที่เหลือได้ 2,000 เท่ากันหมด */
  upgradePoints: number;
  label: string;
}

/** แต้มตีบวกของอันดับ 1–5 ตอนจบวัน */
export const LEAGUE_UPGRADE_POINTS = [10_000, 8_000, 7_000, 6_000, 5_000];

/** อันดับ 6 ลงไปได้แต้มตีบวกเท่ากันหมด */
export const LEAGUE_UPGRADE_POINTS_OTHER = 3_000;

/** แต้มตีบวกที่ได้จากอันดับที่จบลีกประจำวัน */
export const getLeagueUpgradePoints = (rank: number): number =>
  LEAGUE_UPGRADE_POINTS[rank - 1] ?? LEAGUE_UPGRADE_POINTS_OTHER;

/** เหรียญและแต้มแลกนักเตะตามอันดับที่จบวัน — อันดับสูงได้ของดีกว่าชัดเจน */
const REWARD_TABLE: Array<{ maxRank: number; coins: number; points: number; label: string }> = [
  { maxRank: 1, coins: 100_000, points: 10_000, label: 'แชมป์ประจำวัน' },
  { maxRank: 2, coins: 50_000, points: 8_000, label: 'รองแชมป์' },
  { maxRank: 3, coins: 30_000, points: 7_000, label: 'อันดับ 3' },
  { maxRank: 5, coins: 20_000, points: 6_000, label: 'ห้าอันดับแรก' },
  { maxRank: 99, coins: 10_000, points: 4_000, label: 'รางวัลปลอบใจ' },
];

/**
 * รางวัลรวมของอันดับที่จบวัน
 * แต้มตีบวกใช้ตารางแยก (getLeagueUpgradePoints) เพราะเป็นสกุลเงินคนละกองกับแต้มแลกนักเตะ
 */
export const getDailyReward = (rank: number): DailyReward => {
  const row = REWARD_TABLE.find((entry) => rank <= entry.maxRank) ?? REWARD_TABLE[REWARD_TABLE.length - 1];
  return {
    coins: row.coins,
    points: row.points,
    upgradePoints: getLeagueUpgradePoints(rank),
    label: row.label,
  };
};

/** สรุปผลของวันที่จบไป ใช้แสดงในหน้าต่างรับรางวัล */
export interface DailySummary {
  /** เวลาเริ่มของวันที่เพิ่งจบ (ISO) */
  dayStartedAt: string;
  rank: number;
  totalTeams: number;
  daily: LeagueDaily;
  reward: DailyReward;
}

/* ── ค่าเริ่มต้น ───────────────────────────────────────────── */

export const EMPTY_DAILY: LeagueDaily = {
  points: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
};

export const createLeagueState = (now = new Date()): LeagueState => ({
  joined: false,
  joinedAt: null,
  dayStartedAt: getDayStart(now).toISOString(),
  lastRoundAt: null,
  lastSquadChangeAt: null,
  daily: { ...EMPTY_DAILY },
});

/** รวมผลหนึ่งนัดเข้ากับสถิติประจำวัน (คะแนนลีกใช้ระบบ 3-1-0) */
export const addResultToDaily = (
  daily: LeagueDaily,
  teamScore: number,
  opponentScore: number,
): LeagueDaily => ({
  points: daily.points + (teamScore > opponentScore ? 3 : teamScore === opponentScore ? 1 : 0),
  wins: daily.wins + (teamScore > opponentScore ? 1 : 0),
  draws: daily.draws + (teamScore === opponentScore ? 1 : 0),
  losses: daily.losses + (teamScore < opponentScore ? 1 : 0),
  goalsFor: daily.goalsFor + teamScore,
  goalsAgainst: daily.goalsAgainst + opponentScore,
});
