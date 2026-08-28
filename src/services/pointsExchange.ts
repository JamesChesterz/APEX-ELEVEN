/**
 * ร้านแลกนักเตะด้วยแต้ม แบบที่ "แอดมินคุมเองทั้งหมด"
 *
 * เดิมร้านนี้สุ่มของเองทุก 3 ชั่วโมง (services/exchangeRotation.ts) และเปิดดูรอบถัดไปได้
 * ตอนนี้เลิกใช้ทั้งสองอย่างแล้ว — ของในร้านมาจากหน้า ADMIN → "แลกด้วยแต้ม" ล้วน ๆ:
 *   • เปิด/ปิดทั้งเมนูได้จากสวิตช์เดียว
 *   • เลือกเองว่าจะเอาการ์ดใบไหนเข้าร้าน
 *   • ตั้งราคาแต้มของแต่ละใบเอง
 *   • ตั้งเวลาที่แต่ละใบจะหายไปจากหน้าแลกเอง (ไม่ตั้ง = อยู่ยาว)
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = ร้านปิดและไม่มีของเลย (ไม่มีชุดค่าเริ่มต้นในโค้ด)
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizePointsExchange บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById } from '@/data/players';
import { getExchangePrice } from '@/services/exchange';
import type { PointsExchangeConfig, PointsExchangeItem } from '@/types/card';

/** กรอบที่ยอมให้ตั้งได้ */
export const POINTS_EXCHANGE_LIMITS = {
  /** จำนวนการ์ดสูงสุดที่วางในร้านพร้อมกันได้ */
  maxItems: 60,
  minPrice: 0,
  maxPrice: 9_999_999,
} as const;

/** ร้านปิด ไม่มีของ — ใช้เมื่อยังไม่เคยตั้งค่า หรือเล่นออฟไลน์ */
export const EMPTY_POINTS_EXCHANGE: PointsExchangeConfig = { enabled: false, items: [] };

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

/** รับเฉพาะ ISO string ที่แปลงเป็นเวลาได้จริง — ค่าขยะทิ้งทั้งหมด */
const cleanTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};

/** สร้างรายการใหม่หนึ่งใบ ราคาตั้งต้น = ราคาอัตโนมัติของนักเตะคนนั้น */
export const createExchangeItem = (playerId: string): PointsExchangeItem => {
  const player = getPlayerById(playerId);
  return {
    id: `px-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    price: player ? getExchangePrice(player) : 0,
    enabled: true,
  };
};

/** ราคาแนะนำของนักเตะคนหนึ่ง (สูตรเดิม: แต้มย่อย × EXCHANGE_RATE) — ใช้เป็นปุ่ม "ราคาอัตโนมัติ" */
export const suggestedPrice = (playerId: string): number => {
  const player = getPlayerById(playerId);
  return player ? getExchangePrice(player) : 0;
};

/** บีบรายการหนึ่งใบให้อยู่ในกรอบ — คืน null ถ้าอ้างถึงนักเตะที่ไม่มีอยู่จริง */
const normalizeItem = (raw: Partial<PointsExchangeItem>, index: number): PointsExchangeItem | null => {
  if (typeof raw.playerId !== 'string' || !getPlayerById(raw.playerId)) return null;

  const item: PointsExchangeItem = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : `px-${index + 1}`,
    playerId: raw.playerId,
    price: clampNumber(
      raw.price,
      POINTS_EXCHANGE_LIMITS.minPrice,
      POINTS_EXCHANGE_LIMITS.maxPrice,
      suggestedPrice(raw.playerId),
    ),
    enabled: raw.enabled !== false,
  };

  /*
   * ใส่ expiresAt ก็ต่อเมื่อมีค่าจริง — Firestore ปฏิเสธ field ที่เป็น undefined
   * ถ้าเผลอใส่ undefined ลงไป จะบันทึกทั้งเอกสารไม่ผ่านทันที
   */
  const expiresAt = cleanTimestamp(raw.expiresAt);
  if (expiresAt) item.expiresAt = expiresAt;

  return item;
};

/**
 * ทำให้ค่าตั้งที่มาจากเซิร์ฟเวอร์ใช้งานได้จริง
 * id ซ้ำเติมเลขต่อท้ายให้อัตโนมัติ (เหมือน normalizeExchangeDeals) กันกดแลกโดนใบผิด
 */
export const normalizePointsExchange = (
  raw?: Partial<PointsExchangeConfig> | null,
): PointsExchangeConfig => {
  if (!raw) return EMPTY_POINTS_EXCHANGE;

  const seen = new Set<string>();

  const items = (Array.isArray(raw.items) ? raw.items : [])
    .slice(0, POINTS_EXCHANGE_LIMITS.maxItems)
    .map((entry, index) => normalizeItem(entry, index))
    .filter((entry): entry is PointsExchangeItem => entry !== null)
    .map((item) => {
      let id = item.id;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${item.id}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      return { ...item, id };
    });

  return { enabled: raw.enabled === true, items };
};

/** ใบนี้หมดเวลาไปแล้วหรือยัง (ไม่ตั้งเวลา = ไม่มีวันหมด) */
export const isExpired = (item: PointsExchangeItem, now: number = Date.now()): boolean =>
  typeof item.expiresAt === 'string' && new Date(item.expiresAt).getTime() <= now;

/** ผู้เล่นควรเห็นใบนี้ในร้านไหม (เปิดอยู่ + ยังไม่หมดเวลา) */
export const isItemLive = (item: PointsExchangeItem, now: number = Date.now()): boolean =>
  item.enabled && !isExpired(item, now);

/** เหลืออีกกี่วินาทีก่อนใบนี้หายจากร้าน — null = ไม่มีกำหนด */
export const secondsUntilExpiry = (
  item: PointsExchangeItem,
  now: number = Date.now(),
): number | null => {
  if (typeof item.expiresAt !== 'string') return null;
  return Math.max(0, Math.floor((new Date(item.expiresAt).getTime() - now) / 1000));
};

/** แปลงวินาทีเป็นข้อความนับถอยหลัง เกิน 1 วันขึ้นแสดงเป็น "2 วัน 03:04" */
export const formatRemaining = (totalSeconds: number): string => {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  if (days > 0) return `${days} วัน ${pad(hours)}:${pad(minutes)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/*
 * ── ตัวช่วยสำหรับช่อง <input type="datetime-local"> ในหน้า ADMIN ──
 * ช่องนี้รับ/คืนค่าเป็น "เวลาท้องถิ่นไม่มี timezone" (YYYY-MM-DDTHH:mm)
 * แต่เราเก็บลง Firestore เป็น ISO (UTC) เสมอ เพื่อให้ทุกเครื่องทั่วโลกนับถอยหลังตรงกัน
 */

/** ISO → ค่าที่ใส่ในช่อง datetime-local ได้ (ว่าง = ไม่มีกำหนด) */
export const toLocalInputValue = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

/** ค่าจากช่อง datetime-local → ISO (ว่าง = ไม่มีกำหนด) */
export const fromLocalInputValue = (value: string): string | undefined => {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};

/** เวลาอีก N ชั่วโมงนับจากนี้ เป็น ISO — ใช้กับปุ่มลัด "+1 วัน / +3 วัน / +7 วัน" */
export const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
