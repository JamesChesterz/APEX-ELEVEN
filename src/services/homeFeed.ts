/**
 * ข้อมูลหน้า HOME สองส่วนที่แอดมินจัดการเองได้ (pure function ล้วน ห้าม import React)
 *
 *   1. ประกาศอัปเดตล่าสุด (news) — รายการข่าว/แบนเนอร์ที่ขึ้นบนสุดของหน้า HOME
 *      ต่างจาก config/announcement (แผง "ประกาศ" เดิม) ตรงที่อันนั้นเด้งเป็นป็อปอัปครั้งเดียว
 *      ส่วนอันนี้คือฟีดข่าวที่อยู่บนหน้า HOME ตลอด เหมือนของแท้ FIFA/EA FC
 *   2. การ์ดใหม่ล่าสุด (featuredCards) — รายชื่อ id นักเตะที่แอดมินเลือกมาโชว์แถวบนสุด
 *
 * ข้อมูลที่มาจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeNews/normalizeFeaturedCards
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

/* ── การ์ดใหม่ล่าสุด ───────────────────────────────────────── */

export const FEATURED_CARDS_LIMITS = { maxCards: 12 } as const;

/** บีบรายชื่อ id นักเตะจากเซิร์ฟเวอร์: ตัด id ที่ไม่มีจริงทิ้ง จำกัดจำนวน */
export const normalizeFeaturedCards = (raw?: unknown): string[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((id): id is string => typeof id === 'string' && Boolean(getPlayerById(id)))
    .slice(0, FEATURED_CARDS_LIMITS.maxCards);
};
