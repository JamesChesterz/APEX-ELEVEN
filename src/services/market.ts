/**
 * ═══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET — กติกากลาง (pure function ล้วน)
 * ═══════════════════════════════════════════════════════════════
 *
 * ไฟล์นี้ถูกใช้ทั้งสองฝั่ง:
 *   • หน้าเว็บ  — กรอง เรียง นับถอยหลัง แสดงราคา
 *   • เซิร์ฟเวอร์ (functions/src/index.ts) — สร้างประกาศและตรึงราคา
 *
 * ห้าม import React หรือแตะ state ในไฟล์นี้เด็ดขาด ไม่งั้น Cloud Functions
 * จะลากไฟล์ฝั่ง DOM ตามไปด้วยแล้ว build ไม่ผ่าน
 *
 * ⚠️ เรื่องสำคัญที่สุดของไฟล์นี้: ราคาซื้อในตลาด "ต้องแพงกว่า" ราคาที่ขายการ์ด
 * ใบเดียวกันคืนเป็นเงิน (services/cardCash.ts) เสมอ ไม่งั้นผู้เล่นจะซื้อ-ขายวน
 * ปั๊มเหรียญได้ไม่รู้จบ — getMarketPrice จึงคิดจากราคาขายคืนคูณส่วนต่าง
 * ห้ามตั้ง priceMarkup ต่ำกว่า 1 เด็ดขาด (เทสในไฟล์ tests/market.test.ts กันไว้อยู่)
 */
import { PLAYERS } from '@/data/players';
import { DEFAULT_CARD_CASH, getCardCashValue } from '@/services/cardCash';
import { getDayKey, getDayStart } from '@/services/league';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardCashConfig } from '@/types/cardCash';
import type { MarketFilter, MarketListing, MarketSort } from '@/types/market';
import type { Player, Rarity } from '@/types/player';
import { RARITY_ORDER } from '@/types/player';
import { clamp, POSITION_GROUP } from '@/utils/helpers';
import { hashString, seededRandom } from '@/utils/seededRandom';

/* ══════════════════════════════════════════════════════════════
 *  ค่าตั้งของตลาด NPC — แก้ที่นี่ที่เดียว
 * ══════════════════════════════════════════════════════════════ */

export interface NpcMarketConfig {
  /** จำนวนประกาศสูงสุดที่ให้มีพร้อมกัน */
  maxListings: number;
  /** ต่ำกว่านี้เมื่อไร เซิร์ฟเวอร์จะเติมของทันทีที่มีคนเปิดตลาด */
  minListings: number;
  /** ความยาวของหนึ่ง "รอบเติมของ" (นาที) */
  windowMinutes: number;
  /** อายุของประกาศหนึ่งใบ (ชั่วโมง) — สุ่มระหว่างสองค่านี้ */
  minLifetimeHours: number;
  maxLifetimeHours: number;
  /** ช่วง OVR ของนักเตะที่เข้าตลาดได้ */
  minOvr: number;
  maxOvr: number;
  /** น้ำหนักการสุ่มระดับการ์ด (รวมกันเท่าไรก็ได้ ระบบหารให้เอง) */
  rarityWeights: Record<Rarity, number>;
  /** ราคาซื้อเป็นกี่เท่าของราคาขายการ์ดคืน (ต้อง > 1 เสมอ) */
  priceMarkup: number;
  /** เพดานล่าง–บนของราคา กันราคาหลุดเวลาแอดมินปรับค่าตัวคูณของระบบขายการ์ด */
  priceMin: number;
  priceMax: number;
  /** ปัดราคาให้ลงท้ายสวย ๆ ทีละเท่านี้ */
  priceRoundTo: number;
  /** ระดับการ์ดที่มีสิทธิ์เป็นใบเด่นประจำวัน */
  featuredRarities: Rarity[];
  /** ส่วนลดของใบเด่นประจำวัน (0.15 = ถูกกว่าราคาปกติ 15%) */
  featuredDiscount: number;
}

/**
 * ค่าตั้งจริงที่ใช้อยู่
 *
 * น้ำหนักตั้งไว้ให้ mythical/legendary "โผล่ยาก" ตามที่ออกแบบไว้
 * ตลาดจึงเป็นที่เก็บของระดับกลางเป็นหลัก ไม่ใช่ทางลัดข้ามระบบเปิดซอง
 */
export const NPC_MARKET_CONFIG: NpcMarketConfig = {
  maxListings: 18,
  minListings: 12,
  windowMinutes: 60,
  minLifetimeHours: 1,
  maxLifetimeHours: 6,
  minOvr: 0,
  maxOvr: 999,
  rarityWeights: {
    common: 44,
    rare: 28,
    epic: 18,
    legendary: 8,
    mythical: 2,
  },
  priceMarkup: 1.8,
  priceMin: 5_000,
  priceMax: 2_000_000,
  priceRoundTo: 1_000,
  featuredRarities: ['legendary', 'mythical'],
  featuredDiscount: 0.15,
};

/** ความยาวหนึ่งรอบเป็นมิลลิวินาที */
export const getWindowMs = (config: NpcMarketConfig = NPC_MARKET_CONFIG): number =>
  Math.max(1, config.windowMinutes) * 60 * 1000;

/* ══════════════════════════════════════════════════════════════
 *  ราคา
 * ══════════════════════════════════════════════════════════════ */

/**
 * ตัวคูณตามกลุ่มตำแหน่ง
 *
 * กองหน้า/ปีกเป็นของที่คนอยากได้มากกว่าในเกมนี้ (ยิงประตูได้จริงในเอนจิน)
 * ส่วนต่างตั้งไว้แคบ ๆ เพื่อไม่ให้ผู้รักษาประตูที่เก่งจริงกลายเป็นของถูกจนผิดปกติ
 */
const POSITION_MULTIPLIER: Record<'gk' | 'defence' | 'midfield' | 'attack', number> = {
  gk: 0.95,
  defence: 0.97,
  midfield: 1.03,
  attack: 1.08,
};

/**
 * ราคาซื้อของนักเตะหนึ่งคนในตลาด (หน่วยเป็นเหรียญ)
 *
 * คิดจากราคาที่ระบบรับซื้อการ์ดใบเดียวกันคืน (OVR × ระดับการ์ด — services/cardCash.ts)
 * แล้วบวกส่วนต่างของตลาด จึงได้คุณสมบัติสำคัญสามข้อฟรี ๆ:
 *   1. OVR สูงขึ้น → แพงขึ้นเสมอ (สูตรเดิมใช้ยกกำลัง 2.4)
 *   2. ระดับการ์ดสูงขึ้น → แพงขึ้นเสมอ
 *   3. ซื้อจากตลาดแล้วขายคืนทันที = ขาดทุนเสมอ
 *
 * ผลลัพธ์เป็นค่าคงที่ต่อ input เดียวกันเสมอ (ไม่มีการสุ่มในนี้)
 */
export const getMarketPrice = (
  player: Player,
  cash: CardCashConfig = DEFAULT_CARD_CASH,
  config: NpcMarketConfig = NPC_MARKET_CONFIG,
): number => {
  const resale = getCardCashValue(player, 1, cash);
  const positionFactor = POSITION_MULTIPLIER[POSITION_GROUP[player.position]];
  const raw = resale * Math.max(1, config.priceMarkup) * positionFactor;
  const rounded = Math.round(raw / config.priceRoundTo) * config.priceRoundTo;

  return clamp(rounded, config.priceMin, config.priceMax);
};

/* ══════════════════════════════════════════════════════════════
 *  รอบเวลา
 * ══════════════════════════════════════════════════════════════ */

/** เลขรอบของเวลาหนึ่ง — นับจาก epoch ทุกเครื่องจึงได้เลขเดียวกัน ไม่ขึ้นกับ timezone */
export const getMarketWindowIndex = (
  now: Date = new Date(),
  config: NpcMarketConfig = NPC_MARKET_CONFIG,
): number => Math.floor(now.getTime() / getWindowMs(config));

/** เวลาที่รอบนี้จบ (= รอบเติมของถัดไป) */
export const getMarketWindowEnd = (
  now: Date = new Date(),
  config: NpcMarketConfig = NPC_MARKET_CONFIG,
): Date => new Date((getMarketWindowIndex(now, config) + 1) * getWindowMs(config));

/** เหลืออีกกี่วินาทีถึงรอบเติมของถัดไป */
export const secondsToMarketRefresh = (
  now: Date = new Date(),
  config: NpcMarketConfig = NPC_MARKET_CONFIG,
): number => Math.max(0, Math.floor((getMarketWindowEnd(now, config).getTime() - now.getTime()) / 1000));

/** กุญแจของ "วันเด่น" — ใช้วันแข่งชุดเดียวกับลีก (เริ่ม 06:00) ทั้งเกมจะได้ตัดรอบพร้อมกัน */
export const getFeaturedDayKey = (now: Date = new Date()): string => getDayKey(getDayStart(now));

/** เวลาที่ใบเด่นของวันนี้หมดอายุ = ต้นวันแข่งถัดไป */
export const getFeaturedExpiry = (now: Date = new Date()): Date => {
  const start = getDayStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
};

/** id ของใบเด่นประจำวัน — วันเดียวกันได้ id เดียวกันเสมอ (กันสร้างซ้ำ) */
export const featuredListingId = (dayKey: string): string => `feat_${dayKey}`;

/** id ของประกาศ NPC หนึ่งใบ (รอบ + ช่อง) */
export const npcListingId = (windowIndex: number, slot: number): string =>
  `npc_${windowIndex}_${slot}`;

/* ══════════════════════════════════════════════════════════════
 *  สถานะของประกาศ
 * ══════════════════════════════════════════════════════════════ */

/** ประกาศใบนี้ยังซื้อได้อยู่ไหม (ยังไม่ถูกซื้อ และยังไม่หมดเวลา) */
export const isListingLive = (listing: MarketListing, nowMs: number = Date.now()): boolean =>
  listing.status === 'ACTIVE' && new Date(listing.expiresAt).getTime() > nowMs;

/** เหลืออีกกี่วินาทีก่อนใบนี้หมดอายุ (0 = หมดแล้ว) */
export const secondsUntilExpiry = (
  listing: MarketListing,
  nowMs: number = Date.now(),
): number => Math.max(0, Math.floor((new Date(listing.expiresAt).getTime() - nowMs) / 1000));

/* ══════════════════════════════════════════════════════════════
 *  สร้างประกาศ NPC
 * ══════════════════════════════════════════════════════════════ */

/** ข้อมูลนักเตะที่คิดค่าที่แอดมินแก้ทับแล้ว (ไม่เจอ = ใช้ข้อมูลดิบใน pool) */
const resolvePlayer = (player: Player): Player => getBasePlayer(player.id) ?? player;

/**
 * นักเตะทั้งหมดที่มีสิทธิ์ขึ้นตลาด
 * เรียงตาม id เสมอเพื่อให้การสุ่มด้วย seed เดิมได้ผลเดิมทุกเครื่อง
 */
export const getMarketPool = (
  config: NpcMarketConfig = NPC_MARKET_CONFIG,
  excluded: ReadonlySet<string> = new Set(),
): Player[] =>
  PLAYERS.map(resolvePlayer)
    .filter(
      (player) =>
        !excluded.has(player.id) && player.ovr >= config.minOvr && player.ovr <= config.maxOvr,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** สุ่มระดับการ์ดหนึ่งระดับตามน้ำหนักใน config */
export const pickRarity = (roll: number, config: NpcMarketConfig = NPC_MARKET_CONFIG): Rarity => {
  const entries = RARITY_ORDER.map((rarity) => ({
    rarity,
    weight: Math.max(0, config.rarityWeights[rarity] ?? 0),
  })).filter((entry) => entry.weight > 0);

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 'common';

  let ticket = clamp(roll, 0, 0.999999) * total;
  for (const entry of entries) {
    ticket -= entry.weight;
    if (ticket < 0) return entry.rarity;
  }

  return entries[entries.length - 1].rarity;
};

interface BuildListingInput {
  windowIndex: number;
  /** ช่องที่จะสร้าง (id = npc_{windowIndex}_{slot}) */
  slots: number[];
  now: Date;
  cash?: CardCashConfig;
  excluded?: ReadonlySet<string>;
  config?: NpcMarketConfig;
}

/**
 * สร้างประกาศ NPC ตามช่องที่ขอมา
 *
 * ทุกอย่างสุ่มจาก seed ที่คิดจาก "รอบ + ช่อง" ไม่ใช่ Math.random
 * ผลคือถ้าเซิร์ฟเวอร์สองตัวสร้างรอบเดียวกันพร้อมกัน จะได้ข้อมูลเหมือนกันเป๊ะ
 * เขียนทับกันเองก็ไม่มีอะไรเพี้ยน (idempotent by construction)
 */
export const buildNpcListings = ({
  windowIndex,
  slots,
  now,
  cash = DEFAULT_CARD_CASH,
  excluded = new Set(),
  config = NPC_MARKET_CONFIG,
}: BuildListingInput): MarketListing[] => {
  const pool = getMarketPool(config, excluded);
  if (pool.length === 0) return [];

  const createdAt = now.toISOString();

  return slots.map((slot) => {
    const random = seededRandom(hashString(`market:${windowIndex}:${slot}`));
    const rarity = pickRarity(random(), config);

    const byRarity = pool.filter((entry) => entry.rarity === rarity);
    const candidates = byRarity.length > 0 ? byRarity : pool;
    const player = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];

    const lifetimeHours =
      config.minLifetimeHours +
      random() * Math.max(0, config.maxLifetimeHours - config.minLifetimeHours);

    return {
      id: npcListingId(windowIndex, slot),
      playerId: player.id,
      sellerType: 'NPC',
      sellerUid: null,
      price: getMarketPrice(player, cash, config),
      rarity: player.rarity,
      ovr: player.ovr,
      position: player.position,
      status: 'ACTIVE',
      featured: false,
      windowIndex,
      createdAt,
      expiresAt: new Date(now.getTime() + lifetimeHours * 60 * 60 * 1000).toISOString(),
      buyerUid: null,
      soldAt: null,
    } satisfies MarketListing;
  });
};

/**
 * ใบเด่นประจำวัน — ทุกคนต้องเห็นใบเดียวกันทั้งวัน
 *
 * สุ่มจาก seed ที่เป็น "วันแข่ง" เท่านั้น เครื่องผู้เล่นจึงสุ่มเองไม่ได้
 * และต่อให้เซิร์ฟเวอร์สร้างซ้ำหลายครั้ง ก็ได้ใบเดิมและ id เดิมเสมอ
 */
export const buildFeaturedListing = ({
  now,
  cash = DEFAULT_CARD_CASH,
  excluded = new Set(),
  config = NPC_MARKET_CONFIG,
}: {
  now: Date;
  cash?: CardCashConfig;
  excluded?: ReadonlySet<string>;
  config?: NpcMarketConfig;
}): MarketListing | null => {
  const dayKey = getFeaturedDayKey(now);
  const pool = getMarketPool(config, excluded);
  if (pool.length === 0) return null;

  const allowed = new Set(config.featuredRarities);
  const candidates = pool.filter((player) => allowed.has(player.rarity));
  const list = candidates.length > 0 ? candidates : pool;

  const random = seededRandom(hashString(`market:featured:${dayKey}`));
  const player = list[Math.floor(random() * list.length)] ?? list[0];

  const full = getMarketPrice(player, cash, config);
  const discounted =
    Math.round((full * (1 - clamp(config.featuredDiscount, 0, 0.9))) / config.priceRoundTo) *
    config.priceRoundTo;

  return {
    id: featuredListingId(dayKey),
    playerId: player.id,
    sellerType: 'NPC',
    sellerUid: null,
    price: clamp(discounted, config.priceMin, config.priceMax),
    rarity: player.rarity,
    ovr: player.ovr,
    position: player.position,
    status: 'ACTIVE',
    featured: true,
    windowIndex: getMarketWindowIndex(now, config),
    createdAt: now.toISOString(),
    expiresAt: getFeaturedExpiry(now).toISOString(),
    buyerUid: null,
    soldAt: null,
  } satisfies MarketListing;
};

/* ══════════════════════════════════════════════════════════════
 *  วางแผนเติมของ (ฝั่งเซิร์ฟเวอร์เรียกใช้)
 * ══════════════════════════════════════════════════════════════ */

export interface MarketRefillPlan {
  /** ประกาศที่หมดเวลาแล้ว ต้องเปลี่ยนสถานะเป็น EXPIRED */
  expiredIds: string[];
  /** ช่องที่ต้องสร้างใบใหม่ในรอบนี้ */
  slots: number[];
  /** true = ยังไม่มีใบเด่นของวันนี้ ต้องสร้าง */
  needsFeatured: boolean;
  /** จำนวนใบที่ยังซื้อได้หลังหักใบหมดเวลาแล้ว */
  liveCount: number;
}

/**
 * ดูของที่มีอยู่แล้วตัดสินว่าต้องทำอะไรบ้างในรอบนี้
 *
 * แยกออกมาเป็น pure function เพื่อให้เทสได้โดยไม่ต้องต่อ Firestore
 * (ตัวที่แตะฐานข้อมูลจริงอยู่ใน functions/src/index.ts)
 */
export const planMarketRefill = ({
  listings,
  now,
  config = NPC_MARKET_CONFIG,
}: {
  listings: MarketListing[];
  now: Date;
  config?: NpcMarketConfig;
}): MarketRefillPlan => {
  const nowMs = now.getTime();
  const windowIndex = getMarketWindowIndex(now, config);
  const dayKey = getFeaturedDayKey(now);

  const expiredIds = listings
    .filter((listing) => listing.status === 'ACTIVE' && new Date(listing.expiresAt).getTime() <= nowMs)
    .map((listing) => listing.id);

  const live = listings.filter((listing) => isListingLive(listing, nowMs));
  const liveNpc = live.filter((listing) => !listing.featured);

  const missing = Math.max(0, config.maxListings - liveNpc.length);
  const taken = new Set(live.map((listing) => listing.id));

  /*
   * เดินไล่ช่องจาก 0 ขึ้นไปจนได้ครบจำนวนที่ขาด ข้ามช่องที่มีของอยู่แล้ว
   * (ใบที่ถูกซื้อไปในรอบเดียวกันจะถูกสร้างใหม่ไม่ได้ เพราะเอกสาร id เดิมยัง SOLD อยู่
   *  จึงต้องเดินเลยไปช่องถัดไป — เพดานกันวนไม่รู้จบคือ maxListings × 4)
   */
  const slots: number[] = [];
  for (let slot = 0; slots.length < missing && slot < config.maxListings * 4; slot += 1) {
    if (!taken.has(npcListingId(windowIndex, slot))) slots.push(slot);
  }

  return {
    expiredIds,
    slots,
    needsFeatured: !listings.some(
      (listing) => listing.id === featuredListingId(dayKey) && listing.status !== 'EXPIRED',
    ),
    liveCount: live.length,
  };
};

/* ══════════════════════════════════════════════════════════════
 *  กรอง / เรียง (ใช้ในหน้าเว็บ)
 * ══════════════════════════════════════════════════════════════ */

/** ผ่านตัวกรองนี้ไหม */
export const matchesMarketFilter = (listing: MarketListing, filter: MarketFilter): boolean => {
  if (filter.position && filter.position !== 'all' && listing.position !== filter.position) {
    return false;
  }
  if (filter.rarity && filter.rarity !== 'all' && listing.rarity !== filter.rarity) return false;
  if (filter.minOvr && listing.ovr < filter.minOvr) return false;
  if (filter.maxPrice && listing.price > filter.maxPrice) return false;
  return true;
};

/** กรองของในตลาดตามเงื่อนไขที่ผู้เล่นเลือก */
export const filterListings = (
  listings: MarketListing[],
  filter: MarketFilter,
): MarketListing[] => listings.filter((listing) => matchesMarketFilter(listing, filter));

/** เรียงของในตลาด (ใบเด่นถูกแสดงแยกอยู่แล้ว จึงไม่ได้ถูกดันขึ้นบนในนี้) */
export const sortListings = (listings: MarketListing[], sort: MarketSort): MarketListing[] =>
  [...listings].sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return a.price - b.price || b.ovr - a.ovr;
      case 'price-desc':
        return b.price - a.price || b.ovr - a.ovr;
      case 'ovr-desc':
        return b.ovr - a.ovr || a.price - b.price;
      case 'expiry-asc':
      default:
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    }
  });
