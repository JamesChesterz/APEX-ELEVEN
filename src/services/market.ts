/**
 * ═══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET — กติกากลางของตลาด (pure function ล้วน)
 * ═══════════════════════════════════════════════════════════════
 *
 * ของในตลาด "ไม่ได้ถูกเก็บไว้ในฐานข้อมูล" แต่ถูกคำนวณขึ้นใหม่ทุกครั้งจาก
 * เลขรอบเวลา (window) — กลไกเดียวกับร้านแลกนักเตะที่หมุนทุก 3 ชั่วโมง
 * (ดู services/exchangeRotation.ts ซึ่งใช้วิธีนี้อยู่ก่อนแล้ว)
 *
 * ผลที่ได้จากการออกแบบแบบนี้:
 *   • ทุกเครื่องเห็นของชุดเดียวกันโดยไม่ต้องมีเซิร์ฟเวอร์คอยสร้างให้
 *   • ตลาดมีของเสมอ แม้ไม่มีใครออนไลน์เลยสักคน
 *   • ไม่มีค่าอ่าน/เขียนฐานข้อมูลสำหรับตัวประกาศเลย
 *   • ย้อนดูรอบที่แล้วหรือคำนวณรอบหน้าล่วงหน้าได้ ผลตรงกันเสมอ
 *
 * สิ่งเดียวที่ต้องใช้ฐานข้อมูลคือ "ใครซื้อใบไหนไปแล้ว"
 * ซึ่งอยู่ที่ services/firebase/marketClaims.ts (จองได้ครั้งเดียวต่อใบ)
 *
 * ห้าม import React หรือแตะ state ในไฟล์นี้ — ตั้งใจให้ยกไปรันฝั่ง
 * Cloud Functions ได้ทั้งไฟล์ในวันที่พร้อม โดยไม่ต้องแก้อะไรเลย
 *
 * ⚠️ เรื่องสำคัญที่สุด: ราคาซื้อในตลาด "ต้องแพงกว่า" ราคาที่ขายการ์ดใบเดียวกัน
 * คืนเป็นเงิน (services/cardCash.ts) เสมอ ไม่งั้นซื้อ-ขายวนปั๊มเหรียญได้ไม่รู้จบ
 * ห้ามตั้ง priceMarkup ต่ำกว่า 1 เด็ดขาด (มีเทสกันไว้แล้ว)
 */
import { PLAYERS } from '@/data/players';
import { DEFAULT_CARD_CASH, getCardCashValue } from '@/services/cardCash';
import { getDayKey, getDayStart } from '@/services/league';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardCashConfig } from '@/types/cardCash';
import type { MarketConfig, MarketFilter, MarketListing, MarketSort } from '@/types/market';
import type { Player, Rarity } from '@/types/player';
import { RARITY_ORDER } from '@/types/player';
import { clamp, POSITION_GROUP } from '@/utils/helpers';
import { hashString, seededRandom } from '@/utils/seededRandom';

/* ══════════════════════════════════════════════════════════════
 *  ค่าตั้งของตลาด NPC — แก้ที่นี่ที่เดียว
 * ══════════════════════════════════════════════════════════════ */

/**
 * ค่าตั้งจริงที่ใช้อยู่
 *
 * จำนวนใบที่อยู่ในตลาดพร้อมกัน = listingsPerWindow × อายุเฉลี่ย
 * ค่าปัจจุบัน 5 ใบ/ชั่วโมง × อายุเฉลี่ย 3.5 ชั่วโมง ≈ 17–18 ใบตลอดเวลา
 *
 * น้ำหนักตั้งไว้ให้ mythical/legendary โผล่ยาก ตลาดจึงเป็นแหล่งของระดับกลาง
 * ไม่ใช่ทางลัดข้ามระบบเปิดซอง
 */
export const NPC_MARKET_CONFIG: MarketConfig = {
  enabled: true,
  closedMessage: 'ตลาดปิดปรับปรุงชั่วคราว เดี๋ยวกลับมาใหม่',
  windowMinutes: 60,
  listingsPerWindow: 5,
  minLifetimeHours: 1,
  maxLifetimeHours: 6,
  minOvr: 0,
  maxOvr: 999,
  blockedPlayers: [],
  allowedPlayers: [],
  rarityWeights: {
    common: 44,
    rare: 28,
    epic: 18,
    legendary: 8,
    mythical: 2,
  },
  priceMarkup: 1.8,
  /*
   * บันไดราคาที่ตั้งใจให้เป็น (การ์ด +0 ราคาปกติ):
   *   common     5,000 – 9,000
   *   rare      22,000 – 27,000
   *   epic      75,000 – 88,000
   *   legendary   306,000 – 360,000
   *   mythical  1,340,000 – 1,600,000   ← ของระดับล่าสุดต้องเป็นเป้าหมายระยะยาว
   */
  rarityMultiplier: {
    common: 1,
    rare: 1.4,
    epic: 2.2,
    legendary: 4.5,
    mythical: 11,
  },
  priceMin: 5_000,
  priceMax: 5_000_000,
  priceRoundTo: 1_000,
  featuredEnabled: true,
  featuredRarities: ['legendary', 'mythical'],
  featuredDiscount: 0.15,
  featuredPlayerId: null,
};

/* ══════════════════════════════════════════════════════════════
 *  ตรวจค่าตั้งที่มาจากหน้าแอดมิน
 * ══════════════════════════════════════════════════════════════ */

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

const idList = (value: unknown, limit = 200): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string'))).slice(
        0,
        limit,
      )
    : [];

/**
 * เติมช่องที่ยังไม่ได้ตั้งให้ครบและบีบทุกค่าให้อยู่ในกรอบที่ปลอดภัย
 *
 * ค่าตั้งชุดนี้มาจากเอกสารใน Firestore ที่แอดมินแก้เองได้ ถ้าปล่อยผ่านมาดิบ ๆ
 * พิมพ์ผิดครั้งเดียว (เช่น listingsPerWindow = 100000) ตลาดของทุกคนพังทันที
 * ตัวนี้จึงเป็นด่านเดียวที่ทั้งเกมใช้ก่อนเอาค่าไปคำนวณอะไรก็ตาม
 */
export const normalizeMarketConfig = (value: Partial<MarketConfig> | null): MarketConfig => {
  const base = NPC_MARKET_CONFIG;
  if (!value) return base;

  const minLifetime = num(value.minLifetimeHours, base.minLifetimeHours, 0.25, 72);
  const minOvr = num(value.minOvr, base.minOvr, 0, 999);
  const priceMin = Math.round(num(value.priceMin, base.priceMin, 1, 100_000_000));

  const weights = { ...base.rarityWeights };
  const multipliers = { ...base.rarityMultiplier };
  RARITY_ORDER.forEach((rarity) => {
    weights[rarity] = num(value.rarityWeights?.[rarity], base.rarityWeights[rarity], 0, 1000);
    // ห้ามต่ำกว่า 1 เด็ดขาด ไม่งั้นราคาหลุดต่ำกว่าราคาขายคืนแล้วปั๊มเหรียญได้
    multipliers[rarity] = num(value.rarityMultiplier?.[rarity], base.rarityMultiplier[rarity], 1, 500);
  });

  const featuredRarities = Array.isArray(value.featuredRarities)
    ? RARITY_ORDER.filter((rarity) => value.featuredRarities?.includes(rarity))
    : base.featuredRarities;

  return {
    enabled: value.enabled !== false,
    closedMessage:
      typeof value.closedMessage === 'string' && value.closedMessage.trim()
        ? value.closedMessage.slice(0, 300)
        : base.closedMessage,

    windowMinutes: Math.round(num(value.windowMinutes, base.windowMinutes, 5, 1440)),
    listingsPerWindow: Math.round(num(value.listingsPerWindow, base.listingsPerWindow, 1, 40)),
    minLifetimeHours: minLifetime,
    // อายุสูงสุดต้องไม่ต่ำกว่าอายุต่ำสุด ไม่งั้นช่วงสุ่มกลับหัว
    maxLifetimeHours: num(value.maxLifetimeHours, base.maxLifetimeHours, minLifetime, 72),

    minOvr,
    maxOvr: num(value.maxOvr, base.maxOvr, minOvr, 999),
    blockedPlayers: idList(value.blockedPlayers),
    allowedPlayers: idList(value.allowedPlayers),
    rarityWeights: weights,

    priceMarkup: num(value.priceMarkup, base.priceMarkup, 1, 100),
    rarityMultiplier: multipliers,
    priceMin,
    priceMax: Math.round(num(value.priceMax, base.priceMax, priceMin, 1_000_000_000)),
    priceRoundTo: Math.round(num(value.priceRoundTo, base.priceRoundTo, 1, 1_000_000)),

    featuredEnabled: value.featuredEnabled !== false,
    featuredRarities: featuredRarities.length > 0 ? featuredRarities : base.featuredRarities,
    featuredDiscount: num(value.featuredDiscount, base.featuredDiscount, 0, 0.9),
    featuredPlayerId:
      typeof value.featuredPlayerId === 'string' && value.featuredPlayerId.trim()
        ? value.featuredPlayerId.trim()
        : null,
  };
};

/** ความยาวหนึ่งรอบเป็นมิลลิวินาที */
export const getWindowMs = (config: MarketConfig = NPC_MARKET_CONFIG): number =>
  Math.max(1, config.windowMinutes) * 60 * 1000;

/* ══════════════════════════════════════════════════════════════
 *  ราคา
 * ══════════════════════════════════════════════════════════════ */

/**
 * ตัวคูณตามกลุ่มตำแหน่ง
 *
 * กองหน้า/ปีกเป็นของที่คนอยากได้มากกว่าในเกมนี้ (ยิงประตูได้จริงในเอนจิน)
 * ส่วนต่างตั้งไว้แคบ ๆ เพื่อไม่ให้ผู้รักษาประตูที่เก่งจริงถูกจนผิดปกติ
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
 *   1. OVR สูงขึ้น → แพงขึ้นเสมอ
 *   2. ระดับการ์ดสูงขึ้น → แพงขึ้นเสมอ
 *   3. ซื้อจากตลาดแล้วขายคืนทันที = ขาดทุนเสมอ
 */
export const getMarketPrice = (
  player: Player,
  cash: CardCashConfig = DEFAULT_CARD_CASH,
  config: MarketConfig = NPC_MARKET_CONFIG,
): number => {
  const resale = getCardCashValue(player, 1, cash);
  const positionFactor = POSITION_MULTIPLIER[POSITION_GROUP[player.position]];
  // บังคับพื้นที่ 1 เท่า: ต่อให้ตั้งค่าพลาด ราคาก็ยังไม่ต่ำกว่าราคาขายคืน
  const rarityFactor = Math.max(1, config.rarityMultiplier[player.rarity] ?? 1);
  const raw = resale * Math.max(1, config.priceMarkup) * rarityFactor * positionFactor;
  const rounded = Math.round(raw / config.priceRoundTo) * config.priceRoundTo;

  return clamp(rounded, config.priceMin, config.priceMax);
};

/* ══════════════════════════════════════════════════════════════
 *  รอบเวลา
 * ══════════════════════════════════════════════════════════════ */

/** เลขรอบของเวลาหนึ่ง — นับจาก epoch ทุกเครื่องจึงได้เลขเดียวกัน ไม่ขึ้นกับ timezone */
export const getMarketWindowIndex = (
  now: Date = new Date(),
  config: MarketConfig = NPC_MARKET_CONFIG,
): number => Math.floor(now.getTime() / getWindowMs(config));

/** เวลาเริ่มของรอบนั้น */
export const getWindowStart = (
  windowIndex: number,
  config: MarketConfig = NPC_MARKET_CONFIG,
): Date => new Date(windowIndex * getWindowMs(config));

/** เวลาที่รอบปัจจุบันจบ (= ของชุดใหม่เข้า) */
export const getMarketWindowEnd = (
  now: Date = new Date(),
  config: MarketConfig = NPC_MARKET_CONFIG,
): Date => getWindowStart(getMarketWindowIndex(now, config) + 1, config);

/** เหลืออีกกี่วินาทีถึงของชุดใหม่ */
export const secondsToMarketRefresh = (
  now: Date = new Date(),
  config: MarketConfig = NPC_MARKET_CONFIG,
): number =>
  Math.max(0, Math.floor((getMarketWindowEnd(now, config).getTime() - now.getTime()) / 1000));

/**
 * ต้องย้อนดูของกี่รอบถึงจะครบทุกใบที่ยังไม่หมดอายุ
 * (ใบที่อายุยาวสุดถูกสร้างเมื่อ maxLifetimeHours ที่แล้ว จึงต้องย้อนไปถึงรอบนั้น)
 */
export const getWindowSpan = (config: MarketConfig = NPC_MARKET_CONFIG): number =>
  Math.ceil((config.maxLifetimeHours * 60) / Math.max(1, config.windowMinutes));

/** กุญแจของ "วันเด่น" — ใช้วันแข่งชุดเดียวกับลีก (เริ่ม 06:00) ทั้งเกมจะได้ตัดรอบพร้อมกัน */
export const getFeaturedDayKey = (now: Date = new Date()): string => getDayKey(getDayStart(now));

/** เวลาที่ใบเด่นของวันนี้หมดอายุ = ต้นวันแข่งถัดไป */
export const getFeaturedExpiry = (now: Date = new Date()): Date => {
  const start = getDayStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
};

/** id ของใบเด่นประจำวัน — วันเดียวกันได้ id เดียวกันเสมอ */
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
export const secondsUntilExpiry = (listing: MarketListing, nowMs: number = Date.now()): number =>
  Math.max(0, Math.floor((new Date(listing.expiresAt).getTime() - nowMs) / 1000));

/* ══════════════════════════════════════════════════════════════
 *  สร้างประกาศ
 * ══════════════════════════════════════════════════════════════ */

/** ข้อมูลนักเตะที่คิดค่าที่แอดมินแก้ทับแล้ว (ไม่เจอ = ใช้ข้อมูลดิบใน pool) */
const resolvePlayer = (player: Player): Player => getBasePlayer(player.id) ?? player;

/**
 * นักเตะทั้งหมดที่มีสิทธิ์ขึ้นตลาด
 * เรียงตาม id เสมอ เพื่อให้การสุ่มด้วย seed เดิมได้ผลเดิมทุกเครื่อง
 */
export const getMarketPool = (
  config: MarketConfig = NPC_MARKET_CONFIG,
  excluded: ReadonlySet<string> = new Set(),
): Player[] => {
  const blocked = new Set(config.blockedPlayers);
  // รายชื่อขาว: ตั้งไว้เมื่อไร ตลาดจะมีแค่คนในรายชื่อนี้เท่านั้น
  const allowed = config.allowedPlayers.length > 0 ? new Set(config.allowedPlayers) : null;

  return PLAYERS.map(resolvePlayer)
    .filter(
      (player) =>
        !excluded.has(player.id) &&
        !blocked.has(player.id) &&
        (!allowed || allowed.has(player.id)) &&
        player.ovr >= config.minOvr &&
        player.ovr <= config.maxOvr,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

/** สุ่มระดับการ์ดหนึ่งระดับตามน้ำหนักใน config */
export const pickRarity = (roll: number, config: MarketConfig = NPC_MARKET_CONFIG): Rarity => {
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

interface BuildOptions {
  cash?: CardCashConfig;
  excluded?: ReadonlySet<string>;
  config?: MarketConfig;
}

/**
 * ของที่ "เข้าตลาดในรอบนั้น" — คำนวณจากเลขรอบล้วน ๆ ไม่ใช้เวลาปัจจุบันเลย
 *
 * นี่คือหัวใจที่ทำให้ทุกเครื่องเห็นตรงกัน: เวลาสร้างและเวลาหมดอายุผูกกับ
 * "เวลาเริ่มของรอบ" ไม่ใช่ "ตอนที่ใครเปิดหน้าจอ" — เปิดคนละเวลาจึงได้ชุดเดียวกัน
 * และนาฬิกานับถอยหลังของทุกคนตรงกันด้วย
 */
export const buildWindowListings = (
  windowIndex: number,
  { cash = DEFAULT_CARD_CASH, excluded = new Set(), config = NPC_MARKET_CONFIG }: BuildOptions = {},
): MarketListing[] => {
  const pool = getMarketPool(config, excluded);
  if (pool.length === 0) return [];

  const start = getWindowStart(windowIndex, config);
  const createdAt = start.toISOString();

  return Array.from({ length: Math.max(0, config.listingsPerWindow) }, (_, slot) => {
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
      expiresAt: new Date(start.getTime() + lifetimeHours * 60 * 60 * 1000).toISOString(),
      buyerUid: null,
      soldAt: null,
    } satisfies MarketListing;
  });
};

/**
 * ใบเด่นประจำวัน — ทุกคนต้องเห็นใบเดียวกันทั้งวัน
 *
 * สุ่มจาก seed ที่เป็น "วันแข่ง" เท่านั้น ปรับนาฬิกาเครื่องตัวเองจึงได้แค่
 * "ไปดูของวันอื่น" ไม่ได้สุ่มใบใหม่ให้ตัวเอง (และของวันอื่นก็ซื้อไม่ได้อยู่ดี
 * เพราะการจองถูกตัดสินด้วยเวลาของเซิร์ฟเวอร์ — ดู marketClaims.ts)
 */
export const buildFeaturedListing = (
  now: Date,
  { cash = DEFAULT_CARD_CASH, excluded = new Set(), config = NPC_MARKET_CONFIG }: BuildOptions = {},
): MarketListing | null => {
  if (!config.featuredEnabled) return null;

  const dayKey = getFeaturedDayKey(now);
  const pool = getMarketPool(config, excluded);
  if (pool.length === 0) return null;

  const allowed = new Set(config.featuredRarities);
  const candidates = pool.filter((player) => allowed.has(player.rarity));
  const list = candidates.length > 0 ? candidates : pool;

  const random = seededRandom(hashString(`market:featured:${dayKey}`));
  /*
   * แอดมินเลือกไว้เอง = ใช้คนนั้นเลย (ต้องอยู่ใน pool ด้วย ไม่งั้นแปลว่าโดนแบน
   * หรือถูกกรอง OVR ออกไปแล้ว — กรณีนั้นถอยกลับไปสุ่มตามวันตามปกติ)
   */
  const forced = config.featuredPlayerId
    ? (pool.find((entry) => entry.id === config.featuredPlayerId) ?? null)
    : null;

  const player = forced ?? list[Math.floor(random() * list.length)] ?? list[0];

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
    createdAt: getDayStart(now).toISOString(),
    expiresAt: getFeaturedExpiry(now).toISOString(),
    buyerUid: null,
    soldAt: null,
  } satisfies MarketListing;
};

/**
 * ของทั้งหมดที่ซื้อได้ ณ เวลานี้ = ของจากรอบล่าสุดย้อนไปจนสุดอายุ
 * ตัดใบที่หมดเวลาและใบที่มีคนซื้อไปแล้วออกให้เรียบร้อย
 *
 * @param claimed id ของใบที่มีคนจองไว้แล้ว (มาจาก Firestore — ดู marketClaims.ts)
 */
export const getLiveListings = (
  now: Date,
  {
    cash = DEFAULT_CARD_CASH,
    excluded = new Set(),
    config = NPC_MARKET_CONFIG,
    claimed = new Set<string>(),
  }: BuildOptions & { claimed?: ReadonlySet<string> } = {},
): MarketListing[] => {
  const current = getMarketWindowIndex(now, config);
  const span = getWindowSpan(config);
  const nowMs = now.getTime();

  const listings: MarketListing[] = [];

  for (let index = current - span; index <= current; index += 1) {
    buildWindowListings(index, { cash, excluded, config }).forEach((listing) => {
      if (isListingLive(listing, nowMs) && !claimed.has(listing.id)) listings.push(listing);
    });
  }

  const featured = buildFeaturedListing(now, { cash, excluded, config });
  if (featured && isListingLive(featured, nowMs) && !claimed.has(featured.id)) {
    listings.push(featured);
  }

  return listings;
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
export const filterListings = (listings: MarketListing[], filter: MarketFilter): MarketListing[] =>
  listings.filter((listing) => matchesMarketFilter(listing, filter));

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
