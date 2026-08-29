/**
 * กติกาของ FC ALLSTAR PASS
 *
 * หนึ่งซีซัน 30 เลเวล · แต่ละเลเวลมีรางวัลสามสาย (free / premium / plus)
 * เลเวลขึ้นด้วย XP สะสมจากการลงแข่ง Matchmaking
 *
 * หลักที่ยึดไว้ตลอดไฟล์นี้:
 *   • สาย free ทุกคนได้เสมอ ไม่มีอะไรมาปิด — พาสนี้ต้องเล่นสนุกได้โดยไม่จ่ายอะไรเลย
 *   • สายบนครอบสายล่าง: ปลดล็อก plus แล้วได้ของ premium ด้วยทั้งหมด
 *   • ปลดล็อกช้าไม่เสียของ: รางวัลของเลเวลที่ "ถึงแล้ว" ยังรับย้อนหลังได้เสมอ
 *     ซื้อ premium ตอนเลเวล 20 จึงได้ของ premium เลเวล 1–20 ครบทันที
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = พาสปิดและไม่มีเลเวลเลย
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizePass บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById } from '@/data/players';
import { isSafeLuckyImage } from '@/services/luckyImage';
import type {
  PassConfig,
  PassLevel,
  PassProgress,
  PassReward,
  PassRewardType,
  PassTier,
  PassUnlockCost,
} from '@/types/pass';

/** หนึ่งซีซันมีกี่เลเวล */
export const PASS_LEVELS = 30;

/** สายเรียงจากล่างขึ้นบน — ตำแหน่งในอาร์เรย์คือ "ชั้น" ของสายนั้น */
export const PASS_TIERS: PassTier[] = ['free', 'premium', 'plus'];

/** กรอบที่ยอมให้ตั้งได้ */
export const PASS_LIMITS = {
  maxRewardsPerCell: 6,
  maxAmount: 999_999_999,
  maxXp: 9_999_999,
  maxTitleChars: 48,
  maxXpPerMatch: 100_000,
} as const;

/** ป้ายชื่อของแต่ละสาย ใช้ทั้งหน้าเกมและหน้า ADMIN */
export const TIER_LABEL: Record<PassTier, string> = {
  free: 'FREE',
  premium: 'PREMIUM',
  plus: 'PREMIUM+',
};

/** ประเภทรางวัลที่เลือกได้ในหน้า ADMIN */
export const PASS_REWARD_TYPES: Array<{ key: PassRewardType; label: string; icon: string }> = [
  { key: 'coins', label: 'เหรียญ', icon: '🪙' },
  { key: 'points', label: 'แต้มแลกนักเตะ', icon: '💠' },
  { key: 'upgradePoints', label: 'แต้มตีบวก', icon: '⚡' },
  { key: 'ticket', label: 'ตั๋วพาส', icon: '🎟️' },
  { key: 'card', label: 'การ์ดนักเตะ', icon: '🃏' },
];

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

/** สายนี้อยู่ชั้นที่เท่าไร (ยิ่งมากยิ่งสูง) */
export const tierRank = (tier: PassTier): number => Math.max(0, PASS_TIERS.indexOf(tier));

/** ผู้เล่นที่ปลดล็อกถึงสาย playerTier ได้ของสาย rewardTier ไหม */
export const tierCovers = (playerTier: PassTier, rewardTier: PassTier): boolean =>
  tierRank(playerTier) >= tierRank(rewardTier);

/** คีย์ของรางวัลหนึ่งช่อง ใช้จำว่ารับไปแล้ว */
export const claimKey = (tier: PassTier, level: number): string => `${tier}:${level}`;

/* ── ค่าตั้งต้น ───────────────────────────────────────────── */

/** XP สะสมตั้งต้นของเลเวลหนึ่ง — เลเวล 1 เริ่มที่ 0 แล้วไต่ทีละ 500 */
const defaultLevelXp = (level: number): number => (level - 1) * 500;

/** เลเวลเปล่าหนึ่งเลเวล (ยังไม่มีรางวัล) */
export const createLevel = (level: number, xp = defaultLevelXp(level)): PassLevel => ({
  level,
  xp: level === 1 ? 0 : xp,
  free: [],
  premium: [],
  plus: [],
});

/** ชุดเลเวลเปล่าครบ 30 เลเวล */
export const createLevels = (): PassLevel[] =>
  Array.from({ length: PASS_LEVELS }, (_, index) => createLevel(index + 1));

/** รางวัลใหม่หนึ่งชิ้น */
export const createReward = (type: PassRewardType = 'coins'): PassReward => ({
  id: `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  type,
  ...(type === 'card' ? {} : { amount: 10_000 }),
});

/** พาสเปล่า ใช้เมื่อยังไม่เคยตั้งค่า หรือเล่นออฟไลน์ */
export const EMPTY_PASS: PassConfig = {
  enabled: false,
  title: 'FC ALLSTAR PASS',
  seasonName: 'SEASON 1',
  season: 1,
  xpPerMatch: 100,
  levelUpCoins: 0,
  premiumCost: { tickets: 1, coins: 0 },
  plusCost: { tickets: 3, coins: 0 },
  levels: [],
};

/** ชุดตั้งต้นที่กดใช้ได้เลยในหน้า ADMIN (ปุ่ม "สร้างพาสตั้งต้น") */
export const createStarterPass = (): PassConfig => ({
  ...EMPTY_PASS,
  enabled: true,
  levelUpCoins: 100_000,
  levels: createLevels().map((entry) => ({
    ...entry,
    // ให้สาย free มีของทุกเลเวลตั้งแต่แรก พาสจะได้ไม่ดูว่างเปล่าสำหรับคนที่ไม่ปลดล็อก
    free: [{ ...createReward('coins'), amount: 5_000 + entry.level * 500 }],
  })),
});

/* ── บีบข้อมูลจากเซิร์ฟเวอร์ ───────────────────────────────── */

const normalizeReward = (raw: Partial<PassReward> | undefined, index: number): PassReward | null => {
  if (!raw) return null;

  const id =
    typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : `pr-${index + 1}`;

  if (raw.type === 'card') {
    // การ์ดที่ชี้ไปหานักเตะที่ไม่มีอยู่จริงถูกทิ้ง ไม่ให้มีช่องรางวัลที่กดแล้วไม่ได้อะไร
    if (typeof raw.playerId !== 'string' || !getPlayerById(raw.playerId)) return null;

    const reward: PassReward = { id, type: 'card', playerId: raw.playerId };
    if (isSafeLuckyImage(raw.image)) reward.image = raw.image;
    return reward;
  }

  const type: PassRewardType =
    raw.type === 'points' || raw.type === 'upgradePoints' || raw.type === 'ticket'
      ? raw.type
      : 'coins';

  const reward: PassReward = {
    id,
    type,
    amount: clampNumber(raw.amount, 0, PASS_LIMITS.maxAmount, 0),
  };

  // Firestore ปฏิเสธ field ที่เป็น undefined จึงใส่คีย์ก็ต่อเมื่อมีรูปจริง
  if (isSafeLuckyImage(raw.image)) reward.image = raw.image;
  return reward;
};

const normalizeRewards = (raw: unknown): PassReward[] =>
  (Array.isArray(raw) ? raw : [])
    .slice(0, PASS_LIMITS.maxRewardsPerCell)
    .map((entry, index) => normalizeReward(entry, index))
    .filter((entry): entry is PassReward => entry !== null);

const normalizeCost = (raw: Partial<PassUnlockCost> | undefined, fallback: PassUnlockCost): PassUnlockCost => ({
  tickets: clampNumber(raw?.tickets, 0, 9_999, fallback.tickets),
  coins: clampNumber(raw?.coins, 0, PASS_LIMITS.maxAmount, fallback.coins),
});

/**
 * ทำให้ค่าตั้งที่มาจากเซิร์ฟเวอร์ใช้งานได้จริง
 * เลเวลต้องครบ 30 เสมอ และ XP ต้องไม่ถอยหลัง (เลเวลหลังต้องใช้ XP ไม่น้อยกว่าเลเวลก่อน)
 * ไม่งั้นจะเกิดเลเวลที่ปลดล็อกแล้วแต่เลเวลก่อนหน้ายังไม่ปลด ซึ่งอธิบายกับผู้เล่นไม่ได้
 */
export const normalizePass = (raw?: Partial<PassConfig> | null): PassConfig => {
  if (!raw) return EMPTY_PASS;

  const source = Array.isArray(raw.levels) ? raw.levels : [];

  const levels =
    source.length === 0
      ? []
      : Array.from({ length: PASS_LEVELS }, (_, index) => {
          const level = index + 1;
          const entry = (source[index] ?? {}) as Partial<PassLevel>;

          return {
            level,
            xp: level === 1 ? 0 : clampNumber(entry.xp, 0, PASS_LIMITS.maxXp, defaultLevelXp(level)),
            free: normalizeRewards(entry.free),
            premium: normalizeRewards(entry.premium),
            plus: normalizeRewards(entry.plus),
          };
        }).map((entry, index, all) => ({
          // ดัน XP ให้ไม่ต่ำกว่าเลเวลก่อนหน้า
          ...entry,
          xp: index === 0 ? 0 : Math.max(entry.xp, all[index - 1].xp),
        }));

  const config: PassConfig = {
    enabled: raw.enabled === true,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, PASS_LIMITS.maxTitleChars)
        : EMPTY_PASS.title,
    seasonName:
      typeof raw.seasonName === 'string' && raw.seasonName.trim()
        ? raw.seasonName.trim().slice(0, PASS_LIMITS.maxTitleChars)
        : EMPTY_PASS.seasonName,
    season: clampNumber(raw.season, 1, 999_999, 1),
    xpPerMatch: clampNumber(raw.xpPerMatch, 0, PASS_LIMITS.maxXpPerMatch, EMPTY_PASS.xpPerMatch),
    levelUpCoins: clampNumber(raw.levelUpCoins, 0, PASS_LIMITS.maxAmount, 0),
    premiumCost: normalizeCost(raw.premiumCost, EMPTY_PASS.premiumCost),
    plusCost: normalizeCost(raw.plusCost, EMPTY_PASS.plusCost),
    levels,
  };

  const endsAt = typeof raw.endsAt === 'string' ? new Date(raw.endsAt).getTime() : NaN;
  if (Number.isFinite(endsAt)) config.endsAt = new Date(endsAt).toISOString();
  if (isSafeLuckyImage(raw.bannerImage)) config.bannerImage = raw.bannerImage;

  return config;
};

/** ความคืบหน้าเปล่าของซีซันหนึ่ง */
export const createPassProgress = (season: number): PassProgress => ({
  season,
  tier: 'free',
  claimed: [],
});

/** บีบความคืบหน้าที่อ่านมาจากบัญชี — คนละซีซันกับ config = เริ่มใหม่ทั้งชุด */
export const normalizePassProgress = (
  raw: Partial<PassProgress> | undefined,
  season: number,
): PassProgress => {
  if (!raw || raw.season !== season) return createPassProgress(season);

  return {
    season,
    tier: PASS_TIERS.includes(raw.tier as PassTier) ? (raw.tier as PassTier) : 'free',
    claimed: Array.isArray(raw.claimed)
      ? [...new Set(raw.claimed.filter((key): key is string => typeof key === 'string'))].slice(0, 500)
      : [],
  };
};

/* ── เลเวลกับ XP ──────────────────────────────────────────── */

/** พาสนี้ปิดไปแล้วหรือยัง */
export const isPassClosed = (config: PassConfig, now: number = Date.now()): boolean =>
  typeof config.endsAt === 'string' && new Date(config.endsAt).getTime() <= now;

/** วินาทีที่เหลือก่อนซีซันปิด — null = ไม่มีกำหนด */
export const secondsUntilPassEnds = (config: PassConfig, now: number = Date.now()): number | null => {
  if (typeof config.endsAt !== 'string') return null;
  return Math.max(0, Math.floor((new Date(config.endsAt).getTime() - now) / 1000));
};

/** สรุปสถานะเลเวลจาก XP สะสม */
export interface PassStanding {
  /** เลเวลปัจจุบัน (1 เป็นอย่างต่ำ) */
  level: number;
  /** XP สะสมทั้งหมด */
  xp: number;
  /** ได้ XP มาแล้วเท่าไรในเลเวลนี้ */
  into: number;
  /** ต้องใช้อีกกี่ XP ถึงจะขึ้นเลเวลถัดไป (0 = เลเวลสูงสุดแล้ว) */
  need: number;
  /** ความคืบหน้าในเลเวลนี้ 0–1 */
  ratio: number;
  /** true = ถึงเลเวลสูงสุดของซีซันแล้ว */
  maxed: boolean;
}

/** คิดเลเวลปัจจุบันจาก XP สะสม */
export const passStanding = (config: PassConfig, xp: number): PassStanding => {
  const total = Math.max(0, Math.floor(xp));

  if (config.levels.length === 0) {
    return { level: 1, xp: total, into: 0, need: 0, ratio: 1, maxed: true };
  }

  // เลเวลสูงสุดที่ XP สะสมถึงเกณฑ์แล้ว
  let level = 1;
  config.levels.forEach((entry) => {
    if (total >= entry.xp) level = Math.max(level, entry.level);
  });

  const current = config.levels[level - 1];
  const next = config.levels[level];

  if (!next) return { level, xp: total, into: 0, need: 0, ratio: 1, maxed: true };

  const span = Math.max(1, next.xp - current.xp);
  const into = Math.min(span, Math.max(0, total - current.xp));

  return { level, xp: total, into, need: span - into, ratio: into / span, maxed: false };
};

/* ── การรับรางวัล ─────────────────────────────────────────── */

/** ช่องรางวัลหนึ่งช่อง พร้อมสถานะที่ UI ต้องใช้ */
export interface PassCell {
  tier: PassTier;
  level: number;
  rewards: PassReward[];
  /** ถึงเลเวลนี้แล้ว */
  reached: boolean;
  /** ปลดล็อกสายนี้แล้ว */
  owned: boolean;
  /** รับไปแล้ว */
  claimed: boolean;
  /** กดรับได้ตอนนี้ */
  claimable: boolean;
}

/** สถานะช่องรางวัลหนึ่งช่อง */
export const passCell = (
  config: PassConfig,
  progress: PassProgress,
  standing: PassStanding,
  tier: PassTier,
  level: number,
): PassCell => {
  const entry = config.levels[level - 1];
  const rewards = entry ? entry[tier] : [];

  const reached = level <= standing.level;
  const owned = tierCovers(progress.tier, tier);
  const claimed = progress.claimed.includes(claimKey(tier, level));

  return {
    tier,
    level,
    rewards,
    reached,
    owned,
    claimed,
    claimable: reached && owned && !claimed && rewards.length > 0,
  };
};

/**
 * คีย์ของทุกช่องที่กดรับได้ตอนนี้ (เรียงจากเลเวลต่ำไปสูง)
 *
 * นี่คือหัวใจของข้อ "ซื้อ premium ตอนเลเวล 20 แล้วได้ของเลเวล 1–20 ย้อนหลัง":
 * เงื่อนไขคือ "ถึงเลเวลแล้ว + ปลดล็อกสายแล้ว + ยังไม่เคยรับ" ไม่มีเงื่อนไขเรื่องเวลาที่ปลดล็อก
 * พอปลดล็อกปุ๊บ ช่องเก่าทั้งหมดจึงเข้าเงื่อนไขทันที
 */
export const claimableKeys = (
  config: PassConfig,
  progress: PassProgress,
  standing: PassStanding,
): string[] => {
  const keys: string[] = [];

  config.levels.forEach((entry) => {
    PASS_TIERS.forEach((tier) => {
      if (passCell(config, progress, standing, tier, entry.level).claimable) {
        keys.push(claimKey(tier, entry.level));
      }
    });
  });

  return keys;
};

/** รวมรางวัลของคีย์ที่ระบุเป็นก้อนเดียว ใช้ตอนกดรับ */
export const rewardsForKeys = (config: PassConfig, keys: string[]): PassReward[] => {
  const wanted = new Set(keys);
  const rewards: PassReward[] = [];

  config.levels.forEach((entry) => {
    PASS_TIERS.forEach((tier) => {
      if (wanted.has(claimKey(tier, entry.level))) rewards.push(...entry[tier]);
    });
  });

  return rewards;
};

/** ข้อความสรุปรางวัลหนึ่งชิ้น */
export const describePassReward = (reward: PassReward): string => {
  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    return player ? `การ์ด ${player.name}` : 'การ์ด (ยังไม่เลือก)';
  }

  const label = PASS_REWARD_TYPES.find((entry) => entry.key === reward.type)?.label ?? 'เหรียญ';
  return `${label} ${(reward.amount ?? 0).toLocaleString('en-US')}`;
};

/** ไอคอนของรางวัลหนึ่งชิ้น */
export const passRewardIcon = (reward: PassReward): string =>
  PASS_REWARD_TYPES.find((entry) => entry.key === reward.type)?.icon ?? '🪙';

/** ราคาปลดล็อกสายนี้ (null = สายที่ไม่ต้องซื้อ) */
export const unlockCost = (config: PassConfig, tier: PassTier): PassUnlockCost | null => {
  if (tier === 'premium') return config.premiumCost;
  if (tier === 'plus') return config.plusCost;
  return null;
};
