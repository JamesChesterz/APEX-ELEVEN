/**
 * กติกาของกล่องสุ่มรางวัลแบบตาราง 8×8 (เมนู Lucky Box)
 *
 * ตาราง 64 ช่อง: กลางตารางจองไว้ 2×2 ช่องให้การ์ดใหญ่หนึ่งใบ (MYTHICAL)
 * ที่เหลือ 60 ช่องเป็นรางวัลที่แอดมินตั้งเอง (เหรียญ / แต้มแลกนักเตะ / แต้มตีบวก / การ์ด)
 *
 * ทุกช่องเปิดได้ครั้งเดียวต่อหนึ่งรอบ และราคาสุ่มแพงขึ้นตามจำนวนครั้งที่สุ่มไปแล้ว
 * (baseCost + costStep × จำนวนครั้งที่สุ่มแล้ว โดยไม่เกิน maxCost ถ้าตั้งเพดานไว้)
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = กล่องปิดและไม่มีรางวัลเลย
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeLuckyGrid บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById, PLAYERS } from '@/data/players';
import type { LuckyGridConfig, LuckyGridState, LuckyReward, LuckyRewardType } from '@/types/lucky';

/** ตารางกว้าง/สูงกี่ช่อง */
export const GRID_SIZE = 8;

/** ช่องกลางที่การ์ดใหญ่กิน (1-based, ครอบ 2×2 พอดี เพราะ 8 ช่องไม่มีช่องกลางเดี่ยว) */
export const GRAND_START = GRID_SIZE / 2; // = 4 → กินแถว/คอลัมน์ 4–5

/** จำนวนช่องรางวัลปกติ = 64 − 4 ช่องกลาง */
export const CELL_COUNT = GRID_SIZE * GRID_SIZE - 4;

/** index ที่ใช้แทน "การ์ดใหญ่กลางตาราง" ในรายการช่องที่เปิดแล้ว */
export const GRAND_INDEX = CELL_COUNT;

/** จำนวนของรางวัลทั้งหมดในหนึ่งรอบ (ช่องปกติ + การ์ดใหญ่) */
export const TOTAL_SLOTS = CELL_COUNT + 1;

/** กรอบที่ยอมให้ตั้งได้ */
export const LUCKY_LIMITS = {
  minCost: 0,
  maxCost: 999_999_999,
  minAmount: 0,
  maxAmount: 999_999_999,
  maxTitleChars: 40,
} as const;

/** ประเภทรางวัลที่เลือกได้ในหน้า ADMIN */
export const REWARD_TYPES: Array<{ key: LuckyRewardType; label: string; icon: string }> = [
  { key: 'coins', label: 'เหรียญ', icon: '🪙' },
  { key: 'points', label: 'แต้มแลกนักเตะ', icon: '💠' },
  { key: 'upgradePoints', label: 'แต้มตีบวก', icon: '⚡' },
  { key: 'card', label: 'การ์ดนักเตะ', icon: '🃏' },
];

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

/** การ์ด MYTHICAL ใบแรกที่เจอ ใช้เป็นค่าตั้งต้นของรางวัลใหญ่ */
const defaultGrandPlayerId = (): string =>
  PLAYERS.find((player) => player.rarity === 'mythical')?.id ?? PLAYERS[0]?.id ?? '';

/**
 * ชุดรางวัลตั้งต้น 60 ช่อง — เหรียญเป็นหลัก แซมแต้มไว้เป็นระยะ
 * ไม่ได้ตั้งใจให้สมดุล แค่ให้แอดมินมีของให้แก้ต่อแทนที่จะเจอตารางว่างเปล่า
 */
export const createDefaultCells = (): LuckyReward[] =>
  Array.from({ length: CELL_COUNT }, (_, index) => {
    if (index % 10 === 4) return { type: 'upgradePoints', amount: 50 };
    if (index % 5 === 2) return { type: 'points', amount: 500 };
    // เหรียญไล่จากก้อนเล็กไปก้อนใหญ่ตามลำดับช่อง
    return { type: 'coins', amount: 5_000 + (index % 12) * 2_500 };
  });

/** กล่องเปล่า ใช้เมื่อยังไม่เคยตั้งค่า หรือเล่นออฟไลน์ */
export const EMPTY_LUCKY_GRID: LuckyGridConfig = {
  enabled: false,
  title: 'MYTHIC BOX',
  baseCost: 50_000,
  costStep: 10_000,
  maxCost: 0,
  grandPlayerId: '',
  cells: [],
  autoReset: true,
  round: 1,
};

/** ค่าตั้งต้นที่กดใช้ได้เลยในหน้า ADMIN (ปุ่ม "สร้างกล่องตั้งต้น") */
export const createStarterGrid = (): LuckyGridConfig => ({
  ...EMPTY_LUCKY_GRID,
  enabled: true,
  grandPlayerId: defaultGrandPlayerId(),
  cells: createDefaultCells(),
});

/** บีบรางวัลหนึ่งช่องให้อยู่ในกรอบ — การ์ดที่ไม่มีอยู่จริงถูกแปลงเป็นเหรียญแทน */
const normalizeReward = (raw: Partial<LuckyReward> | undefined): LuckyReward => {
  if (raw?.type === 'card') {
    if (typeof raw.playerId === 'string' && getPlayerById(raw.playerId)) {
      return { type: 'card', playerId: raw.playerId };
    }
    return { type: 'coins', amount: 10_000 };
  }

  const type: LuckyRewardType =
    raw?.type === 'points' || raw?.type === 'upgradePoints' ? raw.type : 'coins';

  return {
    type,
    amount: clampNumber(raw?.amount, LUCKY_LIMITS.minAmount, LUCKY_LIMITS.maxAmount, 0),
  };
};

/** ทำให้ค่าตั้งที่มาจากเซิร์ฟเวอร์ใช้งานได้จริง (ช่องต้องครบ 60 เสมอ) */
export const normalizeLuckyGrid = (raw?: Partial<LuckyGridConfig> | null): LuckyGridConfig => {
  if (!raw) return EMPTY_LUCKY_GRID;

  const source = Array.isArray(raw.cells) ? raw.cells : [];
  const cells = Array.from({ length: CELL_COUNT }, (_, index) => normalizeReward(source[index]));

  const grandPlayerId =
    typeof raw.grandPlayerId === 'string' && getPlayerById(raw.grandPlayerId)
      ? raw.grandPlayerId
      : '';

  const endsAtTime = typeof raw.endsAt === 'string' ? new Date(raw.endsAt).getTime() : NaN;

  const config: LuckyGridConfig = {
    enabled: raw.enabled === true,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, LUCKY_LIMITS.maxTitleChars)
        : EMPTY_LUCKY_GRID.title,
    baseCost: clampNumber(raw.baseCost, LUCKY_LIMITS.minCost, LUCKY_LIMITS.maxCost, EMPTY_LUCKY_GRID.baseCost),
    costStep: clampNumber(raw.costStep, LUCKY_LIMITS.minCost, LUCKY_LIMITS.maxCost, EMPTY_LUCKY_GRID.costStep),
    maxCost: clampNumber(raw.maxCost, 0, LUCKY_LIMITS.maxCost, 0),
    grandPlayerId,
    cells,
    autoReset: raw.autoReset !== false,
    round: clampNumber(raw.round, 1, 999_999, 1),
  };

  // ใส่ endsAt ก็ต่อเมื่อแปลงเป็นเวลาได้จริง — Firestore ปฏิเสธ field ที่เป็น undefined
  if (Number.isFinite(endsAtTime)) config.endsAt = new Date(endsAtTime).toISOString();

  return config;
};

/** ราคาสุ่มครั้งถัดไป เมื่อสุ่มไปแล้ว drawsDone ครั้งในรอบนี้ */
export const drawCost = (config: LuckyGridConfig, drawsDone: number): number => {
  const raw = config.baseCost + config.costStep * Math.max(0, drawsDone);
  return config.maxCost > 0 ? Math.min(raw, config.maxCost) : raw;
};

/** กล่องนี้หมดเวลาไปแล้วหรือยัง */
export const isGridClosed = (config: LuckyGridConfig, now: number = Date.now()): boolean =>
  typeof config.endsAt === 'string' && new Date(config.endsAt).getTime() <= now;

/** วินาทีที่เหลือก่อนกล่องปิด — null = ไม่มีกำหนด */
export const secondsUntilClose = (
  config: LuckyGridConfig,
  now: number = Date.now(),
): number | null => {
  if (typeof config.endsAt !== 'string') return null;
  return Math.max(0, Math.floor((new Date(config.endsAt).getTime() - now) / 1000));
};

/** ความคืบหน้าเปล่าของรอบหนึ่ง */
export const createProgress = (round: number): LuckyGridState => ({ round, opened: [], draws: 0 });

/** บีบความคืบหน้าที่อ่านมาจากบัญชี — คนละรอบกับ config = เริ่มใหม่ทั้งชุด */
export const normalizeProgress = (
  raw: Partial<LuckyGridState> | undefined,
  round: number,
): LuckyGridState => {
  if (!raw || raw.round !== round) return createProgress(round);

  const opened = Array.isArray(raw.opened)
    ? [
        ...new Set(
          raw.opened.filter(
            (index): index is number => Number.isInteger(index) && index >= 0 && index <= GRAND_INDEX,
          ),
        ),
      ]
    : [];

  return {
    round,
    opened,
    // สุ่มไปแล้วอย่างน้อยเท่ากับจำนวนช่องที่เปิด — กันค่าที่ถูกแก้ให้ราคาถูกลง
    draws: Math.max(clampNumber(raw.draws, 0, 999_999, 0), opened.length),
  };
};

/** รางวัลของช่องหนึ่ง (index = GRAND_INDEX คือการ์ดใหญ่กลางตาราง) */
export const rewardAt = (config: LuckyGridConfig, index: number): LuckyReward =>
  index === GRAND_INDEX
    ? { type: 'card', playerId: config.grandPlayerId }
    : (config.cells[index] ?? { type: 'coins', amount: 0 });

/**
 * ตำแหน่งของช่องปกติช่องที่ index บนตาราง CSS (1-based)
 * ไล่จากซ้ายไปขวา บนลงล่าง แล้วข้ามช่องกลาง 2×2 ไปเฉย ๆ
 */
export const cellPosition = (index: number): { row: number; column: number } => {
  let seen = 0;

  for (let row = 1; row <= GRID_SIZE; row += 1) {
    for (let column = 1; column <= GRID_SIZE; column += 1) {
      const inCenter =
        row >= GRAND_START && row <= GRAND_START + 1 && column >= GRAND_START && column <= GRAND_START + 1;
      if (inCenter) continue;
      if (seen === index) return { row, column };
      seen += 1;
    }
  }

  return { row: 1, column: 1 };
};

/** ข้อความสรุปรางวัลหนึ่งช่อง ใช้ทั้งหน้าเกมและหน้า ADMIN */
export const describeReward = (reward: LuckyReward): string => {
  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    return player ? `การ์ด ${player.name}` : 'การ์ด (ยังไม่เลือก)';
  }

  const label = REWARD_TYPES.find((entry) => entry.key === reward.type)?.label ?? 'เหรียญ';
  return `${label} ${(reward.amount ?? 0).toLocaleString('en-US')}`;
};

/** ไอคอนของรางวัลหนึ่งช่อง */
export const rewardIcon = (reward: LuckyReward): string =>
  REWARD_TYPES.find((entry) => entry.key === reward.type)?.icon ?? '🪙';
