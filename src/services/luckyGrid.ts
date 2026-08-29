/**
 * กติกาของกล่องสุ่มรางวัลแบบตาราง (เมนู Lucky Box)
 *
 * ขนาดตารางแอดมินตั้งเองได้: คอลัมน์ × แถว อย่างละ 3–12 ช่อง (ค่าตั้งต้น 8×8)
 * กลางตารางจองไว้ให้การ์ดใหญ่หนึ่งใบ (MYTHICAL) เสมอ โดยด้านที่เป็นเลขคู่จะจองกว้าง 2 ช่อง
 * ส่วนด้านที่เป็นเลขคี่จองช่องเดียว — เลขคู่ไม่มีช่องกลางเดี่ยว จึงต้องกินสองช่องถึงจะอยู่ตรงกลางจริง
 *   8×8 → จอง 2×2 เหลือช่องรางวัลปกติ 60 ช่อง
 *   7×7 → จอง 1×1 เหลือ 48 ช่อง
 *   6×9 → จอง 2×1 เหลือ 52 ช่อง
 *
 * ทุกช่องเปิดได้ครั้งเดียวต่อหนึ่งรอบ และราคาสุ่มแพงขึ้นตามจำนวนครั้งที่สุ่มไปแล้ว
 * (baseCost + costStep × จำนวนครั้งที่สุ่มแล้ว โดยไม่เกิน maxCost ถ้าตั้งเพดานไว้)
 *
 * เก็บครบทุกช่องแล้วรอบนั้นจบเลย ผู้เล่นเล่นต่อไม่ได้จนกว่าแอดมินจะกด "เริ่มรอบใหม่" (round +1)
 * ตั้งใจให้เป็นแบบนี้ — ถ้ารีเซ็ตเองอัตโนมัติ ผู้เล่นจะวนเก็บรางวัลชุดเดิมซ้ำได้ไม่จำกัด
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = กล่องปิดและไม่มีรางวัลเลย
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeLuckyGrid บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById, PLAYERS } from '@/data/players';
import { isSafeLuckyImage } from '@/services/luckyImage';
import type { LuckyGridConfig, LuckyGridState, LuckyReward, LuckyRewardType } from '@/types/lucky';

/** กรอบที่ยอมให้ตั้งได้ */
export const LUCKY_LIMITS = {
  minCost: 0,
  maxCost: 999_999_999,
  minAmount: 0,
  maxAmount: 999_999_999,
  maxTitleChars: 40,
  /** ตารางกว้าง/สูงได้กี่ช่อง — ต่ำกว่า 3 แทบไม่เหลือช่องรางวัล สูงกว่า 12 ก็เล็กจนกดไม่ถูก */
  minSide: 3,
  maxSide: 12,
} as const;

/** ขนาดตารางตั้งต้น */
export const DEFAULT_COLUMNS = 8;
export const DEFAULT_ROWS = 8;

/** ประเภทรางวัลที่เลือกได้ในหน้า ADMIN */
export const REWARD_TYPES: Array<{ key: LuckyRewardType; label: string; icon: string }> = [
  { key: 'coins', label: 'เหรียญ', icon: '🪙' },
  { key: 'points', label: 'แต้มแลกนักเตะ', icon: '💠' },
  { key: 'upgradePoints', label: 'แต้มตีบวก', icon: '⚡' },
  { key: 'card', label: 'การ์ดนักเตะ', icon: '🃏' },
];

/** ขนาดตารางแบบย่อ ใช้กับฟังก์ชันเรขาคณิตทั้งหมด */
export type GridSize = Pick<LuckyGridConfig, 'columns' | 'rows'>;

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

/*
 * ── เรขาคณิตของตาราง ──
 * ทุกฟังก์ชันในกลุ่มนี้คิดจาก columns/rows ล้วน จึงใช้ได้กับตารางทุกขนาด
 */

/** ด้านหนึ่งของการ์ดใหญ่กินกี่ช่อง (เลขคู่ = 2 เพื่อให้อยู่กลางจริง, เลขคี่ = 1) */
export const grandSpan = (side: number): number => (side % 2 === 0 ? 2 : 1);

/** การ์ดใหญ่เริ่มที่ช่องที่เท่าไรของด้านนั้น (1-based) */
export const grandStart = (side: number): number =>
  side % 2 === 0 ? side / 2 : Math.ceil(side / 2);

/** ช่องรางวัลปกติมีกี่ช่องในตารางขนาดนี้ */
export const cellCountOf = (columns: number, rows: number): number =>
  columns * rows - grandSpan(columns) * grandSpan(rows);

/** index ที่ใช้แทน "การ์ดใหญ่กลางตาราง" ในรายการช่องที่เปิดแล้ว (ต่อท้ายช่องปกติ) */
export const grandIndexOf = (size: GridSize): number => cellCountOf(size.columns, size.rows);

/** จำนวนของรางวัลทั้งหมดในหนึ่งรอบ (ช่องปกติ + การ์ดใหญ่) */
export const totalSlotsOf = (size: GridSize): number => grandIndexOf(size) + 1;

/** ช่องนี้เป็นส่วนหนึ่งของการ์ดใหญ่กลางตารางไหม (row/column เป็น 1-based) */
export const isGrandCell = (row: number, column: number, size: GridSize): boolean => {
  const rowStart = grandStart(size.rows);
  const columnStart = grandStart(size.columns);
  return (
    row >= rowStart &&
    row < rowStart + grandSpan(size.rows) &&
    column >= columnStart &&
    column < columnStart + grandSpan(size.columns)
  );
};

/**
 * ตำแหน่งของช่องปกติช่องที่ index บนตาราง CSS (1-based)
 * ไล่จากซ้ายไปขวา บนลงล่าง แล้วข้ามช่องที่การ์ดใหญ่จองไว้
 */
export const cellPosition = (index: number, size: GridSize): { row: number; column: number } => {
  let seen = 0;

  for (let row = 1; row <= size.rows; row += 1) {
    for (let column = 1; column <= size.columns; column += 1) {
      if (isGrandCell(row, column, size)) continue;
      if (seen === index) return { row, column };
      seen += 1;
    }
  }

  return { row: 1, column: 1 };
};

/** ช่องว่างระหว่างช่องในตาราง (px) — ยิ่งช่องใหญ่ยิ่งเว้นห่างขึ้น แต่ไม่เกินกรอบนี้ */
export const GRID_GAP_MIN = 4;
export const GRID_GAP_MAX = 12;

/**
 * เล็กสุดที่ยังพอดูออกว่าเป็นรางวัลอะไร (px)
 * ต่ำกว่านี้เราเลือกให้ล้นดีกว่าย่อจนมองไม่เห็นอะไรเลย
 */
export const CELL_MIN = 22;

/**
 * ขนาดช่องที่ทำให้ตาราง "เต็มกรอบ" ที่มีอยู่พอดี ไม่ล้นทั้งแนวกว้างและแนวสูง
 *
 * ไม่มีเพดานขนาดช่อง — ตารางจะขยายจนชนขอบกรอบเสมอ ไม่ว่าจะกี่แถวกี่คอลัมน์
 * ตาราง 4×4 บนจอกว้างจึงได้ช่องใหญ่เต็มพื้นที่ ไม่ใช่กระจุกเล็ก ๆ อยู่กลางกรอบ
 *
 * ช่องเป็นสี่เหลี่ยมจัตุรัสเสมอ จึงยึด "ด้านที่คับกว่า" เป็นตัวตัดสิน
 * (กรอบเตี้ยก็โตตามความสูง กรอบแคบก็โตตามความกว้าง) แล้วจัดกึ่งกลางในด้านที่เหลือ
 * ถ้าดันให้เต็มทั้งสองด้าน ช่องจะกลายเป็นสี่เหลี่ยมผืนผ้าและรูปการ์ดจะยืดจนเสียรูป
 *
 * ยังวัดพื้นที่ไม่ได้ (width/height = 0 ตอน render รอบแรก) → คืนค่าเล็กสุดไว้ก่อน
 */
export const fitCellSize = (
  width: number,
  height: number,
  columns: number,
  rows: number,
  gap: number = GRID_GAP_MIN,
): number => {
  if (!(width > 0) || !(height > 0) || columns < 1 || rows < 1) return CELL_MIN;

  const byWidth = (width - gap * (columns - 1)) / columns;
  const byHeight = (height - gap * (rows - 1)) / rows;

  return Math.max(CELL_MIN, Math.floor(Math.min(byWidth, byHeight)));
};

/**
 * ขนาดช่อง + ระยะห่างที่เหมาะกับกรอบขนาดหนึ่ง
 *
 * คิดสองรอบ: รอบแรกหาขนาดช่องด้วยระยะห่างน้อยสุดก่อน เพื่อรู้ว่าช่องจะใหญ่ประมาณไหน
 * แล้วค่อยขยายระยะห่างตามขนาดช่องนั้น (ตารางช่องใหญ่ที่เบียดกันจะดูอึดอัด)
 * รอบสองคำนวณขนาดช่องใหม่ด้วยระยะห่างจริง — ระยะห่างมากขึ้นเท่ากับช่องเล็กลง
 * ผลลัพธ์จึงยังพอดีกรอบเสมอ ไม่มีทางล้น
 */
export const fitGrid = (
  width: number,
  height: number,
  columns: number,
  rows: number,
): { cell: number; gap: number } => {
  const rough = fitCellSize(width, height, columns, rows, GRID_GAP_MIN);
  const gap = Math.min(GRID_GAP_MAX, Math.max(GRID_GAP_MIN, Math.round(rough * 0.07)));

  return { gap, cell: fitCellSize(width, height, columns, rows, gap) };
};

/** การ์ด MYTHICAL ใบแรกที่เจอ ใช้เป็นค่าตั้งต้นของรางวัลใหญ่ */
const defaultGrandPlayerId = (): string =>
  PLAYERS.find((player) => player.rarity === 'mythical')?.id ?? PLAYERS[0]?.id ?? '';

/** รางวัลตั้งต้นของช่องที่ index — เหรียญเป็นหลัก แซมแต้มไว้เป็นระยะ */
const defaultCell = (index: number): LuckyReward => {
  if (index % 10 === 4) return { type: 'upgradePoints', amount: 50 };
  if (index % 5 === 2) return { type: 'points', amount: 500 };
  return { type: 'coins', amount: 5_000 + (index % 12) * 2_500 };
};

/**
 * ชุดรางวัลตั้งต้นของตารางขนาดหนึ่ง
 * ไม่ได้ตั้งใจให้สมดุล แค่ให้แอดมินมีของให้แก้ต่อแทนที่จะเจอตารางว่างเปล่า
 */
export const createDefaultCells = (columns: number, rows: number): LuckyReward[] =>
  Array.from({ length: cellCountOf(columns, rows) }, (_, index) => defaultCell(index));

/**
 * ปรับความยาวรายการช่องให้พอดีกับตารางขนาดใหม่
 * ช่องเดิมที่ยังอยู่ในระยะถูกเก็บไว้ทั้งหมด ช่องที่เพิ่มมาเติมด้วยรางวัลตั้งต้น
 * (ย่อตารางแล้วขยายกลับ ช่องท้าย ๆ ที่หายไปจะไม่กลับมาเป็นของเดิม — ตั้งใหม่ได้ที่หน้า ADMIN)
 */
export const resizeCells = (cells: LuckyReward[], columns: number, rows: number): LuckyReward[] =>
  Array.from({ length: cellCountOf(columns, rows) }, (_, index) => cells[index] ?? defaultCell(index));

/** กล่องเปล่า ใช้เมื่อยังไม่เคยตั้งค่า หรือเล่นออฟไลน์ */
export const EMPTY_LUCKY_GRID: LuckyGridConfig = {
  enabled: false,
  title: 'MYTHIC BOX',
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_ROWS,
  baseCost: 50_000,
  costStep: 10_000,
  maxCost: 0,
  grandPlayerId: '',
  cells: [],
  round: 1,
};

/** ค่าตั้งต้นที่กดใช้ได้เลยในหน้า ADMIN (ปุ่ม "สร้างกล่องตั้งต้น") */
export const createStarterGrid = (): LuckyGridConfig => ({
  ...EMPTY_LUCKY_GRID,
  enabled: true,
  grandPlayerId: defaultGrandPlayerId(),
  cells: createDefaultCells(DEFAULT_COLUMNS, DEFAULT_ROWS),
});

/** บีบรางวัลหนึ่งช่องให้อยู่ในกรอบ — การ์ดที่ไม่มีอยู่จริงถูกแปลงเป็นเหรียญแทน */
const normalizeReward = (raw: Partial<LuckyReward> | undefined, index: number): LuckyReward => {
  // ช่องที่เพิ่งงอกมาจากการขยายตาราง (ยังไม่มีข้อมูล) เติมรางวัลตั้งต้นให้แทนช่องว่าง
  if (!raw) return defaultCell(index);

  const reward: LuckyReward =
    raw.type === 'card'
      ? typeof raw.playerId === 'string' && getPlayerById(raw.playerId)
        ? { type: 'card', playerId: raw.playerId }
        : { type: 'coins', amount: 10_000 }
      : {
          type: (raw.type === 'points' || raw.type === 'upgradePoints'
            ? raw.type
            : 'coins') as LuckyRewardType,
          amount: clampNumber(raw.amount, LUCKY_LIMITS.minAmount, LUCKY_LIMITS.maxAmount, 0),
        };

  /*
   * รูปใส่ก็ต่อเมื่อค่าที่ได้มาเอาไปเป็น src ของ <img> ได้จริง
   * (Firestore ปฏิเสธ field ที่เป็น undefined จึงต้องไม่ใส่คีย์เลยเมื่อไม่มีรูป)
   */
  if (isSafeLuckyImage(raw.image)) reward.image = raw.image;

  return reward;
};

/** ทำให้ค่าตั้งที่มาจากเซิร์ฟเวอร์ใช้งานได้จริง (จำนวนช่องต้องพอดีกับขนาดตารางเสมอ) */
export const normalizeLuckyGrid = (raw?: Partial<LuckyGridConfig> | null): LuckyGridConfig => {
  if (!raw) return EMPTY_LUCKY_GRID;

  const columns = clampNumber(raw.columns, LUCKY_LIMITS.minSide, LUCKY_LIMITS.maxSide, DEFAULT_COLUMNS);
  const rows = clampNumber(raw.rows, LUCKY_LIMITS.minSide, LUCKY_LIMITS.maxSide, DEFAULT_ROWS);

  /*
   * ยังไม่เคยตั้งช่องเลย = ปล่อยว่างไว้ (หน้า ADMIN จะชวนกด "สร้างกล่องตั้งต้น")
   * แต่ถ้าตั้งมาแล้ว ต้องบีบให้ยาวพอดีกับตารางเสมอ ไม่งั้นช่องท้ายจะกลายเป็นช่องว่าง
   */
  const source = Array.isArray(raw.cells) ? raw.cells : [];
  const cells =
    source.length === 0
      ? []
      : Array.from({ length: cellCountOf(columns, rows) }, (_, index) =>
          normalizeReward(source[index], index),
        );

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
    columns,
    rows,
    baseCost: clampNumber(raw.baseCost, LUCKY_LIMITS.minCost, LUCKY_LIMITS.maxCost, EMPTY_LUCKY_GRID.baseCost),
    costStep: clampNumber(raw.costStep, LUCKY_LIMITS.minCost, LUCKY_LIMITS.maxCost, EMPTY_LUCKY_GRID.costStep),
    maxCost: clampNumber(raw.maxCost, 0, LUCKY_LIMITS.maxCost, 0),
    grandPlayerId,
    cells,
    round: clampNumber(raw.round, 1, 999_999, 1),
  };

  // ใส่ endsAt ก็ต่อเมื่อแปลงเป็นเวลาได้จริง — Firestore ปฏิเสธ field ที่เป็น undefined
  if (Number.isFinite(endsAtTime)) config.endsAt = new Date(endsAtTime).toISOString();
  if (isSafeLuckyImage(raw.coverImage)) config.coverImage = raw.coverImage;

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

/**
 * บีบความคืบหน้าที่อ่านมาจากบัญชี
 * คนละรอบกับ config = เริ่มใหม่ทั้งชุด · ช่องที่หลุดนอกตาราง (แอดมินย่อตาราง) ถูกตัดทิ้ง
 */
export const normalizeProgress = (
  raw: Partial<LuckyGridState> | undefined,
  round: number,
  totalSlots: number,
): LuckyGridState => {
  if (!raw || raw.round !== round) return createProgress(round);

  const opened = Array.isArray(raw.opened)
    ? [
        ...new Set(
          raw.opened.filter(
            (index): index is number => Number.isInteger(index) && index >= 0 && index < totalSlots,
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

/** รางวัลของช่องหนึ่ง (index = ช่องกลาง คือการ์ดใหญ่) */
export const rewardAt = (config: LuckyGridConfig, index: number): LuckyReward =>
  index === grandIndexOf(config)
    ? { type: 'card', playerId: config.grandPlayerId }
    : (config.cells[index] ?? { type: 'coins', amount: 0 });

/** ข้อความสรุปรางวัลหนึ่งช่อง ใช้ทั้งหน้าเกมและหน้า ADMIN */
export const describeReward = (reward: LuckyReward): string => {
  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    return player ? `การ์ด ${player.name}` : 'การ์ด (ยังไม่เลือก)';
  }

  const label = REWARD_TYPES.find((entry) => entry.key === reward.type)?.label ?? 'เหรียญ';
  return `${label} ${(reward.amount ?? 0).toLocaleString('en-US')}`;
};

/** ไอคอนอีโมจิของรางวัลหนึ่งช่อง (ใช้เมื่อไม่มีรูป) */
export const rewardIcon = (reward: LuckyReward): string =>
  REWARD_TYPES.find((entry) => entry.key === reward.type)?.icon ?? '🪙';

/**
 * รูปตั้งต้นของรางวัลแต่ละประเภท — ไฟล์จริงอยู่ใน public/icons/
 * ใช้ชุดเดียวกับพาสเพื่อให้ไอคอนเหรียญ/EP/UP ทั้งเกมเป็นภาพเดียวกัน
 * เป็นพาธ ไม่ใช่ data URL จึงไม่กินพื้นที่เอกสารค่าตั้งเลย
 */
export const DEFAULT_CELL_IMAGE: Partial<Record<LuckyRewardType, string>> = {
  coins: '/icons/money.png',
  points: '/icons/exchange-point.png',
  upgradePoints: '/icons/upgrade-point.png',
};

/**
 * รูปที่ควรใช้แสดงรางวัลช่องนี้ — รูปที่แอดมินใส่เองมาก่อนเสมอ
 * ไม่ได้ใส่ก็ถอยไปใช้รูปตั้งต้นตามประเภท · ไม่มีทั้งคู่คืน null ให้ผู้เรียกไปใช้อีโมจิแทน
 */
export const rewardImage = (reward: LuckyReward): string | null =>
  reward.image ?? DEFAULT_CELL_IMAGE[reward.type] ?? null;

/*
 * ── มาตรวัดขนาดเอกสาร ──
 * เอกสาร Firestore หนึ่งใบเก็บได้ไม่เกิน 1 MB และเอกสารนี้ผู้เล่นทุกคนต้องโหลด
 * รูปที่อัปโหลดเข้ามาเป็น data URL คือสิ่งเดียวที่ทำให้บวมได้จริง จึงต้องมีตัวเตือน
 */

/** เพดานจริงของ Firestore (ไบต์) */
export const FIRESTORE_DOC_LIMIT = 1_048_576;

/** เกินเท่านี้ขึ้นคำเตือนสีส้ม — เผื่อที่ให้แก้ต่อได้อีกหน่อย */
export const LUCKY_SIZE_WARN = 600_000;

/** เกินเท่านี้ห้ามบันทึก — กันเซฟไปแล้วโดนเซิร์ฟเวอร์ปฏิเสธทั้งก้อน */
export const LUCKY_SIZE_BLOCK = 900_000;

/** ขนาดโดยประมาณของค่าตั้งชุดนี้เมื่อเก็บลง Firestore (ไบต์) */
export const configByteSize = (config: LuckyGridConfig): number =>
  new Blob([JSON.stringify(config)]).size;

/** มีรูปที่ฝังเป็น data URL อยู่กี่ใบ (รูปที่เป็นพาธไม่นับ เพราะไม่กินพื้นที่) */
export const embeddedImageCount = (config: LuckyGridConfig): number =>
  config.cells.filter((cell) => cell.image?.startsWith('data:')).length +
  (config.coverImage?.startsWith('data:') ? 1 : 0);

/*
 * ── ลูกเล่นวงวิ่งแบบรูเล็ต ──
 * ตอนกดสุ่ม ไฟจะวิ่งไล่ไปตามช่องแล้วค่อย ๆ ช้าลงจนหยุดที่ช่องที่ได้จริง
 * รางวัลถูกตัดสินไปแล้วตั้งแต่ตอนกด (ดู useLuckyGrid) — ส่วนนี้เป็นแค่การนำเสนอ
 * ไม่มีการสุ่มซ้ำหรือแก้ผลระหว่างทาง ปลายทางคือช่องเดิมเสมอ
 */

/**
 * ลำดับที่ไฟจะวิ่งไปตามช่อง — ไล่ทีละแถวสลับทิศ (ซ้าย→ขวา แล้วขวา→ซ้าย)
 * ไฟจึงเคลื่อนต่อเนื่องเหมือนงูเลื้อย ไม่กระโดดข้ามจอไปมา
 * ช่องกลาง (การ์ดใหญ่) แทรกอยู่ตามตำแหน่งจริงของมันในตาราง
 */
export const spinOrder = (config: GridSize): number[] => {
  const entries: Array<{ index: number; row: number; column: number }> = [];

  for (let index = 0; index < cellCountOf(config.columns, config.rows); index += 1) {
    entries.push({ index, ...cellPosition(index, config) });
  }

  entries.push({
    index: grandIndexOf(config),
    row: grandStart(config.rows),
    column: grandStart(config.columns),
  });

  return entries
    .sort((a, b) =>
      a.row !== b.row
        ? a.row - b.row
        : a.row % 2 === 1
          ? a.column - b.column
          : b.column - a.column,
    )
    .map((entry) => entry.index);
};

/** จำนวนก้าวช่วงท้ายที่ไฟจะเดินเรียงเข้าหาเป้าหมาย (ให้ความรู้สึกว่ากำลังจะหยุด) */
const APPROACH_STEPS = 6;

/**
 * เส้นทางที่ไฟจะวิ่ง — ช่วงแรกกระโดดสุ่มเร็ว ๆ ช่วงท้ายเดินเรียงเข้าหาเป้าหมาย
 * ก้าวสุดท้ายเป็นช่องเป้าหมายเสมอ ไม่ว่าจะสุ่มเส้นทางออกมาได้แบบไหน
 */
export const buildSpinPath = (order: number[], target: number, steps = 26): number[] => {
  if (order.length === 0) return [target];

  const total = order.length;
  const targetPosition = Math.max(0, order.indexOf(target));
  const approach = Math.min(APPROACH_STEPS, total);
  const path: number[] = [];

  for (let step = 0; step < Math.max(0, steps - approach); step += 1) {
    path.push(order[Math.floor(Math.random() * total)]);
  }

  // เดินย้อนขึ้นไป approach ก้าวแล้วไล่กลับลงมา — ก้าวสุดท้ายจึงตกที่เป้าหมายพอดี
  for (let back = approach - 1; back >= 0; back -= 1) {
    path.push(order[(targetPosition - back + total * total) % total]);
  }

  return path;
};

/**
 * หน่วงเวลาก่อนไฟจะขยับไปก้าวถัดไป (มิลลิวินาที)
 * เริ่มเร็วแล้วถ่วงขึ้นแบบกำลังสาม เพื่อให้รู้สึกว่ากำลังหมดแรงจริง ๆ ไม่ใช่หยุดกึก
 */
export const spinStepDelay = (step: number, total: number): number => {
  const progress = total <= 1 ? 1 : step / (total - 1);
  return Math.round(45 + 300 * progress ** 3);
};
