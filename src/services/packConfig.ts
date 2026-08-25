/**
 * ซองการ์ดที่เจ้าของโปรเจคสร้างเอง (pure function ล้วน)
 *
 * ค่าเริ่มต้นอยู่ในโค้ด (src/data/cards.ts) ส่วนชุดที่แอดมินสร้างเก็บบน Firestore
 * มีชุดบนเซิร์ฟเวอร์เมื่อไหร่ = ใช้ชุดนั้นแทนทั้งหมด (ไม่ผสมกัน จะได้รู้แน่ ๆ ว่าร้านมีอะไร)
 *
 * ข้อมูลที่มาจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizePacks บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 * ตั้งค่าเพี้ยนแค่ไหนก็ไม่ทำให้ร้านพังหรือแจกการ์ดเกินจริง
 */
import { CARD_PACKS } from '@/data/cards';
import { getPlayerById } from '@/data/players';
import type { CardPack, PackTier } from '@/types/card';
import { RARITY_ORDER, type Rarity } from '@/types/player';

/** กรอบที่ยอมให้ตั้งได้ */
export const PACK_LIMITS = {
  maxPacks: 12,
  maxCardsPerPack: 10,
  maxPrice: 10_000_000,
  maxPoolSize: 200,
  maxNameChars: 40,
  maxDescriptionChars: 120,
} as const;

export const PACK_TIERS: PackTier[] = ['bronze', 'silver', 'gold', 'special', 'mythic'];

/** ซองเปล่าไว้เป็นจุดตั้งต้นตอนกด "เพิ่มซองใหม่" */
export const createEmptyPack = (): CardPack => ({
  id: `pack-${Date.now().toString(36)}`,
  name: 'ซองใหม่',
  tier: 'gold',
  price: 5000,
  cardCount: 1,
  odds: { common: 70, rare: 20, epic: 7, legendary: 2, mythical: 1 },
  pool: [],
  description: '',
});

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const cleanText = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** รวม odds ทั้งห้าระดับ ใช้เตือนตอนแก้ว่ายังไม่ครบ 100 */
export const sumOdds = (odds: Record<Rarity, number>): number =>
  RARITY_ORDER.reduce((total, rarity) => total + (Number(odds[rarity]) || 0), 0);

/**
 * ระดับที่ odds ให้น้ำหนักไว้ แต่ pool ไม่มีนักเตะระดับนั้นเลย
 *
 * เป็นกับดักที่เจอบ่อยสุดตอนสร้างซอง: ตั้ง mythical ไว้ 1% แต่ลืมใส่การ์ด mythical
 * ลงในซอง ผลคือสุ่มไม่เคยออกจริง — ตัวนี้เอาไว้เตือนก่อนเซฟ
 */
export const findEmptyRarities = (pack: CardPack): Rarity[] => {
  if (!pack.pool || pack.pool.length === 0) return [];

  const inPool = new Set(
    pack.pool.map((id) => getPlayerById(id)?.rarity).filter(Boolean) as Rarity[],
  );

  return RARITY_ORDER.filter((rarity) => (pack.odds[rarity] ?? 0) > 0 && !inPool.has(rarity));
};

/** บีบซองหนึ่งใบให้อยู่ในกรอบที่ปลอดภัย */
const normalizePack = (raw: Partial<CardPack>, index: number): CardPack => {
  const odds = RARITY_ORDER.reduce(
    (acc, rarity) => ({ ...acc, [rarity]: clampNumber(raw.odds?.[rarity], 0, 100, 0) }),
    {} as Record<Rarity, number>,
  );

  // odds ว่างทั้งหมด = สุ่มไม่ออกอะไรเลย ถอยไปใช้ common ล้วนแทน
  if (sumOdds(odds) === 0) odds.common = 100;

  const pool = Array.isArray(raw.pool)
    ? [...new Set(raw.pool.filter((id) => typeof id === 'string' && getPlayerById(id)))].slice(
        0,
        PACK_LIMITS.maxPoolSize,
      )
    : [];

  return {
    id: cleanText(raw.id, 40) || `pack-${index + 1}`,
    name: cleanText(raw.name, PACK_LIMITS.maxNameChars) || `ซองที่ ${index + 1}`,
    tier: PACK_TIERS.includes(raw.tier as PackTier) ? (raw.tier as PackTier) : 'gold',
    price: clampNumber(raw.price, 0, PACK_LIMITS.maxPrice, 5000),
    cardCount: clampNumber(raw.cardCount, 1, PACK_LIMITS.maxCardsPerPack, 1),
    odds,
    // pool ว่าง = สุ่มจากนักเตะทั้งเกม (ไม่ส่งฟิลด์นี้ไปเลย)
    ...(pool.length > 0 ? { pool } : {}),
    description: cleanText(raw.description, PACK_LIMITS.maxDescriptionChars),
  };
};

/**
 * ทำให้รายการซองใช้งานได้จริง
 *
 * id ซ้ำเป็นบั๊กที่หาไม่เจอ (getPackById ใช้ .find เจอตัวแรกเสมอ กดซองหลังได้ของซองแรก)
 * จึงเติมเลขต่อท้ายให้อัตโนมัติแทนที่จะปล่อยผ่าน
 */
export const normalizePacks = (raw?: Array<Partial<CardPack>> | null): CardPack[] => {
  if (!Array.isArray(raw) || raw.length === 0) return CARD_PACKS;

  const seen = new Set<string>();

  return raw.slice(0, PACK_LIMITS.maxPacks).map((entry, index) => {
    const pack = normalizePack(entry, index);

    let id = pack.id;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${pack.id}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    return { ...pack, id };
  });
};
