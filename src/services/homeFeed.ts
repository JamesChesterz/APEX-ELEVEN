/**
 * ข้อมูลหน้า HOME สองส่วนที่แอดมินจัดการเองได้ (pure function ล้วน ห้าม import React)
 *
 *   1. ประกาศอัปเดตล่าสุด (news) — รายการข่าว/แบนเนอร์ที่ขึ้นบนสุดของหน้า HOME
 *      ต่างจาก config/announcement (แผง "ประกาศ" เดิม) ตรงที่อันนั้นเด้งเป็นป็อปอัปครั้งเดียว
 *      ส่วนอันนี้คือฟีดข่าวที่อยู่บนหน้า HOME ตลอด เหมือนของแท้ FIFA/EA FC
 *   2. การ์ดใหม่ล่าสุด (featuredCards) — "แถวการ์ด" หลายแถวที่แอดมินสร้างเองได้
 *      เช่น "การ์ดใหม่ล่าสุด" / "การ์ด OVR สูงสุด" / "LIMITED EDITION" — แต่ละแถวมีหัวข้อ
 *      ป้ายบนการ์ด และรายชื่อการ์ดของตัวเอง เรียงจากบนลงล่างตามลำดับที่ตั้งไว้
 *
 * ข้อมูลที่มาจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeNews/normalizeFeaturedCardRows
 * บีบทุกค่าให้อยู่ในกรอบก่อนใช้เสมอ
 */
import { getPlayerById } from '@/data/players';

/** หนึ่งรายการข่าว/ประกาศอัปเดตบนหน้า HOME */
export interface NewsItem {
  id: string;
  title: string;
  message: string;
  /** ข้อความวันที่ (พิมพ์เองอิสระ เช่น 27/05/2024) */
  date: string;
  /** รูปแบนเนอร์ (URL) — ใส่แล้วรายการนี้จะโผล่ในสไลด์แบนเนอร์ด้านบนด้วย */
  imageUrl?: string;
  /** true = ติดป้าย NEW สีเขียว */
  badge?: boolean;
}

export const NEWS_LIMITS = {
  maxItems: 12,
  maxTitleChars: 80,
  maxDateChars: 30,
  maxMessageChars: 400,
  maxImageUrlChars: 600,
} as const;

/** ข่าวเปล่าไว้เป็นจุดตั้งต้นตอนกด "เพิ่มข่าวใหม่" */
export const createEmptyNews = (): NewsItem => ({
  id: `news-${Date.now().toString(36)}`,
  title: '',
  message: '',
  date: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  imageUrl: '',
  badge: true,
});

const cleanText = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** บีบรายการข่าวจากเซิร์ฟเวอร์ให้อยู่ในกรอบ ตัดรายการว่างทิ้ง */
export const normalizeNews = (raw?: Array<Partial<NewsItem>> | null): NewsItem[] => {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();

  return raw
    .slice(0, NEWS_LIMITS.maxItems)
    .map((entry, index) => {
      const title = cleanText(entry?.title, NEWS_LIMITS.maxTitleChars);
      const message = cleanText(entry?.message, NEWS_LIMITS.maxMessageChars);
      let id = cleanText(entry?.id, 40) || `news-${index}`;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${id}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);

      return {
        id,
        title,
        message,
        date: cleanText(entry?.date, NEWS_LIMITS.maxDateChars),
        imageUrl: cleanText(entry?.imageUrl, NEWS_LIMITS.maxImageUrlChars) || undefined,
        badge: Boolean(entry?.badge),
      };
    })
    .filter((item) => item.title || item.message);
};

/* ── การ์ดใหม่ล่าสุด (หลายแถว) ───────────────────────────────── */

/** หนึ่งแถวการ์ดบนหน้า HOME เช่น "การ์ดใหม่ล่าสุด" หรือ "LIMITED EDITION" */
export interface FeaturedCardRow {
  id: string;
  /** หัวข้อแถว เช่น "การ์ดใหม่ล่าสุด", "การ์ด OVR สูงสุด", "LIMITED EDITION" */
  title: string;
  /** ข้อความป้ายมุมการ์ด (ว่าง = ไม่ติดป้าย) เช่น "NEW", "TOP OVR", "LIMITED" */
  badge: string;
  /** รายชื่อ id นักเตะในแถวนี้ เรียงซ้าย → ขวา */
  cardIds: string[];
}

export const FEATURED_ROW_LIMITS = {
  maxRows: 6,
  maxCardsPerRow: 12,
  maxTitleChars: 40,
  maxBadgeChars: 20,
} as const;

/** พรีเซ็ตหัวข้อ+ป้าย ให้กดเพิ่มแถวได้ไวโดยไม่ต้องพิมพ์เอง */
export const FEATURED_ROW_PRESETS: Record<'new' | 'topOvr' | 'limited', { title: string; badge: string }> = {
  new: { title: 'การ์ดใหม่ล่าสุด', badge: 'NEW' },
  topOvr: { title: 'การ์ด OVR สูงสุด', badge: 'TOP OVR' },
  limited: { title: 'LIMITED EDITION', badge: 'LIMITED' },
};

/** แถวเปล่าไว้เป็นจุดตั้งต้นตอนกด "เพิ่มแถวใหม่" */
export const createEmptyCardRow = (preset?: keyof typeof FEATURED_ROW_PRESETS): FeaturedCardRow => ({
  id: `row-${Date.now().toString(36)}`,
  title: preset ? FEATURED_ROW_PRESETS[preset].title : '',
  badge: preset ? FEATURED_ROW_PRESETS[preset].badge : 'NEW',
  cardIds: [],
});

/** บีบรายชื่อ id นักเตะ: ตัด id ที่ไม่มีจริงทิ้ง จำกัดจำนวนต่อแถว */
const normalizeCardIds = (raw?: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((id): id is string => typeof id === 'string' && Boolean(getPlayerById(id)))
    .slice(0, FEATURED_ROW_LIMITS.maxCardsPerRow);
};

/**
 * บีบรายการแถวการ์ดจากเซิร์ฟเวอร์ให้อยู่ในกรอบ ตัดแถวที่ไม่มีการ์ดเลยทิ้ง
 * รองรับข้อมูลรูปแบบเก่า (ก่อนมีหลายแถว) ที่เก็บเป็น `cards: string[]` เฉย ๆ
 * โดยแปลงให้กลายเป็นแถวเดียวชื่อ "การ์ดใหม่ล่าสุด" อัตโนมัติ
 */
export const normalizeFeaturedCardRows = (raw?: {
  rows?: Array<Partial<FeaturedCardRow>>;
  cards?: unknown;
} | null): FeaturedCardRow[] => {
  if (!raw) return [];

  const source: Array<Partial<FeaturedCardRow>> = Array.isArray(raw.rows)
    ? raw.rows
    : Array.isArray(raw.cards) && raw.cards.length > 0
      ? [{ ...FEATURED_ROW_PRESETS.new, cardIds: raw.cards as string[] }]
      : [];

  const seen = new Set<string>();

  return source
    .slice(0, FEATURED_ROW_LIMITS.maxRows)
    .map((entry, index) => {
      let id = cleanText(entry?.id, 40) || `row-${index}`;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${id}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);

      return {
        id,
        title: cleanText(entry?.title, FEATURED_ROW_LIMITS.maxTitleChars),
        badge: cleanText(entry?.badge, FEATURED_ROW_LIMITS.maxBadgeChars),
        cardIds: normalizeCardIds(entry?.cardIds),
      };
    })
    .filter((row) => row.cardIds.length > 0);
};
