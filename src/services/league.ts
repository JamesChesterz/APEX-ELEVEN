/**
 * ลีกประจำวัน (Matchmaking แบบอัตโนมัติ กับผู้เล่นจริง)
 *
 * กติกา:
 *   - หนึ่งลีกมี 10 ทีม เป็นผู้เล่นจริงที่ค่าพลังใกล้เคียงกัน (ดู buildLeagueMembers)
 *   - ค่าพลังทีมขยับเมื่อไหร่ รอบถัดไปจะถูกจัดเข้าลีกกลุ่มใหม่ให้เอง
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
import { difficultyFromGap, rewardForOpponent } from '@/services/matchmaking';
import type { LeagueDaily, LeagueState } from '@/types/account';
import type { Opponent } from '@/types/match';
import type { FormationId } from '@/types/team';
import { clamp } from '@/utils/helpers';

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

/* ── สมาชิกในลีก (ผู้เล่นจริง) ─────────────────────────────── */

/** จำนวนทีมต่อหนึ่งลีก */
export const LEAGUE_SIZE = 10;

/**
 * หนึ่งทีมในลีกประจำวัน
 * ข้อมูลมาจากโปรไฟล์สาธารณะบน Firestore ของผู้เล่นจริง (services/firebase/profiles.ts)
 */
export interface LeagueMember {
  /** uid ของผู้เล่นจริง (โหมดออฟไลน์ = id ของทีมสำรอง) */
  id: string;
  teamName: string;
  managerName: string;
  ovr: number;
  formationId: FormationId;
  avatar?: string;
  /** true = ผู้เล่นจริงจากเซิร์ฟเวอร์ → กดดูตัวจริง 11 คนของเขาได้ */
  isReal: boolean;
}

/**
 * ทีมสำรองสำหรับ "โหมดออฟไลน์เท่านั้น"
 *
 * ใช้ก็ต่อเมื่อยังไม่ได้ตั้งค่า Firebase หรือยังไม่มีผู้เล่นจริงคนอื่นเลยแม้แต่คนเดียว
 * (ถ้าไม่มีตัวสำรองไว้ ลีกจะเดินต่อไม่ได้เพราะไม่มีคู่ให้แข่ง)
 * พอมีผู้เล่นจริงเข้ามา ระบบจะเปลี่ยนไปใช้คนจริงทั้งลีกทันที
 */
export const FALLBACK_MEMBERS: LeagueMember[] = LEADERBOARD.filter(
  (entry) => !entry.isCurrentUser,
)
  .slice(0, LEAGUE_SIZE - 1)
  .map((entry, index) => ({
    id: `lg${index + 1}`,
    teamName: entry.teamName,
    managerName: entry.managerName,
    ovr: entry.teamOvr,
    formationId: '4-3-3' as FormationId,
    isReal: false,
  }));

/**
 * คัดสมาชิกลีกของรอบนี้: ผู้เล่นจริง 10 คนที่ค่าพลังใกล้เคียงเราที่สุด
 *
 * เรียงทุกคนตาม OVR แล้วตัดหน้าต่าง 10 คนที่มีเราอยู่ตรงกลาง
 * ผลคือทุกคนในลีกมี OVR ไล่เลี่ยกัน และเมื่อ OVR ของเราขยับ (ตีบวก/เปลี่ยนตัว)
 * รอบถัดไปหน้าต่างนี้จะถูกคำนวณใหม่ เราจึงถูกจับเข้าลีกกลุ่มใหม่ให้เองอัตโนมัติ
 *
 * ผู้เล่นจริงยังไม่ถึง 10 คน ก็แข่งกันเท่าที่มี (ไม่เติมบอทเข้ามาปน)
 */
export const buildLeagueMembers = (
  me: LeagueMember,
  others: LeagueMember[],
  size = LEAGUE_SIZE,
): LeagueMember[] => {
  const pool = [me, ...others.filter((member) => member.id !== me.id)].sort(
    // id เป็นตัวตัดสินเมื่อ OVR เท่ากัน เพื่อให้ลำดับคงที่ทุกครั้งที่คำนวณใหม่
    (a, b) => b.ovr - a.ovr || (a.id < b.id ? -1 : 1),
  );

  if (pool.length <= size) return pool;

  const mine = pool.findIndex((member) => member.id === me.id);
  const start = clamp(mine - Math.floor((size - 1) / 2), 0, pool.length - size);

  return pool.slice(start, start + size);
};

/**
 * ตารางแข่งของรอบหนึ่ง (วิธี round-robin แบบวงกลม)
 *
 * ตรึงทีมแรกไว้แล้วหมุนที่เหลือไปทีละหนึ่งในแต่ละรอบ
 * ลีก 10 ทีมจึงเจอกันครบทุกคู่ใน 9 รอบ แล้วเริ่มวนใหม่
 * จำนวนทีมเป็นเลขคี่ = มีหนึ่งทีมได้พักในรอบนั้น
 */
export const buildRoundPairings = (
  members: LeagueMember[],
  roundIndex: number,
): Array<[LeagueMember, LeagueMember]> => {
  if (members.length < 2) return [];

  const list: Array<LeagueMember | null> =
    members.length % 2 === 0 ? [...members] : [...members, null];
  const size = list.length;
  const rounds = size - 1;
  const step = ((roundIndex % rounds) + rounds) % rounds;

  const [fixed, ...rest] = list;
  const rotated = [...rest.slice(rest.length - step), ...rest.slice(0, rest.length - step)];
  const ordered = [fixed, ...rotated];

  const pairs: Array<[LeagueMember, LeagueMember]> = [];
  for (let index = 0; index < size / 2; index += 1) {
    const home = ordered[index];
    const away = ordered[size - 1 - index];
    if (home && away) pairs.push([home, away]);
  }

  return pairs;
};

/** คู่แข่งของเราในรอบนี้ (null = รอบนี้ได้พัก หรือยังไม่มีใครในลีก) */
export const getRoundRival = (
  members: LeagueMember[],
  myId: string,
  roundIndex: number,
): LeagueMember | null => {
  const pair = buildRoundPairings(members, roundIndex).find(
    ([home, away]) => home.id === myId || away.id === myId,
  );
  if (!pair) return null;

  return pair[0].id === myId ? pair[1] : pair[0];
};

/** แปลงสมาชิกลีกให้เป็นคู่แข่งที่ simulateMatch ใช้ได้ */
export const memberToOpponent = (member: LeagueMember, myOvr: number): Opponent => {
  const gap = member.ovr - myOvr;

  return {
    id: member.id,
    name: member.teamName,
    manager: member.managerName,
    ovr: member.ovr,
    formationId: member.formationId,
    difficulty: difficultyFromGap(gap),
    rewardCoins: rewardForOpponent(member.ovr, gap),
    isBot: !member.isReal,
  };
};

/* ── ผลของคู่แข่งในตารางประจำวัน ───────────────────────────── */

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
 * ผลสะสมของคู่แข่งหนึ่งทีมในวันนี้
 *
 * เกมนี้ไม่มีเซิร์ฟเวอร์คอยแข่งให้ตอนทุกคนปิดแอป ผลของทีมอื่นในตารางจึงถูก
 * "จำลอง" จาก seed คงที่ (วัน + uid ของเขา) — เปิดกี่ครั้งก็ได้ผลเดิม ไม่สุ่มใหม่
 * แต่คนที่อยู่ในตารางเป็นผู้เล่นจริง ค่าพลังจริง และกดดูทีมจริงของเขาได้
 *
 * โอกาสชนะอิงกับ OVR เฉลี่ยของลีก คนที่แกร่งกว่าค่าเฉลี่ยจึงเก็บแต้มได้ดีกว่า
 */
export const getMemberDaily = (
  memberId: string,
  ovr: number,
  averageOvr: number,
  dayKey: string,
  rounds: number,
): LeagueDaily => {
  const random = seededRandom(hashString(`${dayKey}:${memberId}`));
  const daily: LeagueDaily = { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

  const winChance = clamp(0.5 + (ovr - averageOvr) * 0.02, 0.2, 0.75);
  const drawChance = 0.22;

  for (let round = 0; round < rounds; round += 1) {
    const roll = random();
    const scored = 1 + Math.floor(random() * 3);
    const conceded = Math.floor(random() * 3);

    if (roll < winChance) {
      daily.points += 3;
      daily.wins += 1;
      daily.goalsFor += scored;
      daily.goalsAgainst += Math.min(conceded, Math.max(0, scored - 1));
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
  /** uid ของเจ้าของทีม ใช้เปิดดูตัวจริง 11 คนของเขา */
  id: string;
  teamName: string;
  managerName: string;
  ovr: number;
  avatar?: string;
  /** true = ผู้เล่นจริง (กดดูทีมได้) */
  isReal: boolean;
  daily: LeagueDaily;
  isCurrentUser?: boolean;
}

/** ผลต่างประตู ใช้ตัดสินอันดับเมื่อคะแนนเท่ากัน */
export const goalDiff = (daily: LeagueDaily): number => daily.goalsFor - daily.goalsAgainst;

/** ตารางอันดับประจำวันของลีกนี้ เรียงตามคะแนน → ผลต่างประตู → ประตูได้ */
export const buildDailyStandings = (
  members: LeagueMember[],
  userId: string,
  userDaily: LeagueDaily,
  dayKey: string,
  roundsPlayed: number,
): LeagueStanding[] => {
  const average =
    members.reduce((sum, member) => sum + member.ovr, 0) / Math.max(1, members.length);

  return members
    .map((member) => ({
      id: member.id,
      teamName: member.teamName,
      managerName: member.managerName,
      ovr: member.ovr,
      avatar: member.avatar,
      isReal: member.isReal,
      isCurrentUser: member.id === userId,
      daily:
        member.id === userId
          ? userDaily
          : getMemberDaily(member.id, member.ovr, average, dayKey, roundsPlayed),
    }))
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

/**
 * สถานะลีกเริ่มต้นของบัญชีใหม่
 *
 * ทุกบัญชีถูกนับเป็น "เข้าร่วมแล้ว" ตั้งแต่วินาทีที่สมัคร ไม่ต้องกดเข้าร่วมเอง —
 * ผู้เล่นทุกคนบนเซิร์ฟเวอร์จึงอยู่ในลีกเสมอ และถูกจับเป็นคู่แข่งของคนอื่นได้
 * แม้เจ้าตัวจะยังไม่เคยเปิดเกมกลับเข้ามาเลยก็ตาม
 *
 * lastRoundAt เริ่มที่ "ตอนนี้" ไม่ใช่ null เพื่อไม่ให้บัญชีที่เพิ่งสมัคร
 * ถูกย้อนคิดรอบทั้งวันย้อนหลังตั้งแต่ 06:00 ในการเปิดเกมครั้งแรก
 */
export const createLeagueState = (now = new Date()): LeagueState => ({
  joined: true,
  joinedAt: now.toISOString(),
  dayStartedAt: getDayStart(now).toISOString(),
  lastRoundAt: now.toISOString(),
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
