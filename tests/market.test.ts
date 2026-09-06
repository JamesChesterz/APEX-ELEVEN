/**
 * TRANSFER MARKET — เทสกติกากลางของตลาด
 *
 * ครอบสี่เรื่องที่พังแล้วเสียหายกับเศรษฐกิจในเกมโดยตรง:
 *   1. ราคาต้องแพงกว่าราคาขายการ์ดคืนเสมอ (ไม่งั้นซื้อ-ขายวนปั๊มเหรียญได้)
 *   2. ของต้องคำนวณจากรอบเวลาล้วน ๆ — คนละเครื่องคนละเวลาต้องได้ชุดเดียวกัน
 *      (ข้อนี้คือสิ่งที่ทำให้ตลาดทำงานได้โดยไม่ต้องมีเซิร์ฟเวอร์คอยสร้างของ)
 *   3. ใบเด่นประจำวันต้องเป็นคนเดียวกันทั้งวันสำหรับทุกคน
 *   4. ตัวกรอง/การเรียงต้องตรงกับที่หน้าเว็บสัญญาไว้
 */
import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@/data/players';
import { DEFAULT_CARD_CASH, getCardCashValue } from '@/services/cardCash';
import {
  NPC_MARKET_CONFIG,
  buildFeaturedListing,
  buildWindowListings,
  featuredListingId,
  filterListings,
  getFeaturedDayKey,
  getLiveListings,
  getMarketPool,
  getMarketPrice,
  getMarketWindowEnd,
  getMarketWindowIndex,
  getWindowSpan,
  getWindowStart,
  isListingLive,
  npcListingId,
  pickRarity,
  sortListings,
} from '@/services/market';
import type { MarketListing } from '@/types/market';
import type { Player } from '@/types/player';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const player = (extra: Partial<Player> = {}): Player => ({
  id: 'test-player',
  name: 'Test Player',
  club: 'Test FC',
  nation: 'Thailand',
  position: 'ST',
  altPositions: [],
  ovr: 100,
  rarity: 'epic',
  stats: { pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 80, physical: 80 },
  ...extra,
});

const listing = (extra: Partial<MarketListing> = {}): MarketListing => ({
  id: 'npc_1_0',
  playerId: 'p001',
  sellerType: 'NPC',
  sellerUid: null,
  price: 50_000,
  rarity: 'common',
  ovr: 91,
  position: 'ST',
  status: 'ACTIVE',
  featured: false,
  windowIndex: 1,
  createdAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + 3 * HOUR).toISOString(),
  buyerUid: null,
  soldAt: null,
  ...extra,
});

/* ── ราคา ──────────────────────────────────────────────────── */

describe('getMarketPrice', () => {
  it('ซื้อจากตลาดแล้วขายคืนทันทีต้องขาดทุนเสมอ (กันปั๊มเหรียญ)', () => {
    PLAYERS.forEach((entry) => {
      expect(getMarketPrice(entry)).toBeGreaterThan(getCardCashValue(entry, 1, DEFAULT_CARD_CASH));
    });
  });

  it('ส่วนต่างของตลาดห้ามตั้งต่ำกว่า 1 เท่า', () => {
    expect(NPC_MARKET_CONFIG.priceMarkup).toBeGreaterThan(1);
  });

  it('OVR สูงกว่า = แพงกว่า เมื่อระดับการ์ดเท่ากัน', () => {
    expect(getMarketPrice(player({ ovr: 120 }))).toBeGreaterThan(
      getMarketPrice(player({ ovr: 100 })),
    );
  });

  it('ระดับการ์ดสูงกว่า = แพงกว่า เมื่อ OVR เท่ากัน', () => {
    const common = getMarketPrice(player({ rarity: 'common' }));
    const legendary = getMarketPrice(player({ rarity: 'legendary' }));
    const mythical = getMarketPrice(player({ rarity: 'mythical' }));

    expect(legendary).toBeGreaterThan(common);
    expect(mythical).toBeGreaterThan(legendary);
  });

  it('ราคาอยู่ในกรอบเพดานเสมอ และเรียกกี่ครั้งก็ได้ค่าเดิม', () => {
    PLAYERS.forEach((entry) => {
      const price = getMarketPrice(entry);
      expect(price).toBeGreaterThanOrEqual(NPC_MARKET_CONFIG.priceMin);
      expect(price).toBeLessThanOrEqual(NPC_MARKET_CONFIG.priceMax);
      expect(getMarketPrice(entry)).toBe(price);
    });
  });
});

/* ── ของในแต่ละรอบ ─────────────────────────────────────────── */

describe('buildWindowListings', () => {
  it('รอบหนึ่งมีของเข้าเท่ากับที่ตั้งไว้ และ id ไม่ซ้ำ', () => {
    const built = buildWindowListings(42);

    expect(built).toHaveLength(NPC_MARKET_CONFIG.listingsPerWindow);
    expect(new Set(built.map((entry) => entry.id)).size).toBe(built.length);
    expect(built[0].id).toBe(npcListingId(42, 0));
  });

  it('รอบเดียวกันคิดกี่ครั้ง เครื่องไหน ก็ได้ของชุดเดิมเป๊ะ', () => {
    expect(buildWindowListings(42)).toEqual(buildWindowListings(42));
  });

  it('เวลาสร้าง/หมดอายุผูกกับรอบ ไม่ใช่เวลาที่เปิดจอ (ทุกคนจึงนับถอยหลังตรงกัน)', () => {
    const built = buildWindowListings(42);
    const start = getWindowStart(42).getTime();

    built.forEach((entry) => {
      expect(new Date(entry.createdAt).getTime()).toBe(start);

      const lifetime = new Date(entry.expiresAt).getTime() - start;
      expect(lifetime).toBeGreaterThanOrEqual(NPC_MARKET_CONFIG.minLifetimeHours * HOUR);
      expect(lifetime).toBeLessThanOrEqual(NPC_MARKET_CONFIG.maxLifetimeHours * HOUR);
    });
  });

  it('คนละรอบได้ของคนละชุด', () => {
    expect(buildWindowListings(43).map((entry) => entry.playerId)).not.toEqual(
      buildWindowListings(42).map((entry) => entry.playerId),
    );
  });

  it('ทุกใบเป็นของ NPC ราคาถูกตรึงไว้ และเริ่มต้นเป็น ACTIVE', () => {
    buildWindowListings(7).forEach((entry) => {
      expect(entry.status).toBe('ACTIVE');
      expect(entry.sellerType).toBe('NPC');
      expect(entry.sellerUid).toBeNull();
      expect(entry.featured).toBe(false);
      expect(entry.price).toBeGreaterThan(0);
    });
  });

  it('การ์ดต้องห้ามไม่โผล่ในตลาดทุกรอบที่สุ่ม', () => {
    const banned = PLAYERS.slice(0, 5).map((entry) => entry.id);
    const excluded = new Set(banned);

    for (let round = 0; round < 50; round += 1) {
      buildWindowListings(round, { excluded }).forEach((entry) =>
        expect(banned).not.toContain(entry.playerId),
      );
    }
  });

  it('ระดับสูงต้องออกยากกว่าระดับต่ำอย่างชัดเจน', () => {
    const counts = { high: 0, low: 0 };

    for (let round = 0; round < 400; round += 1) {
      buildWindowListings(round).forEach((entry) => {
        if (entry.rarity === 'mythical' || entry.rarity === 'legendary') counts.high += 1;
        if (entry.rarity === 'common' || entry.rarity === 'rare') counts.low += 1;
      });
    }

    expect(counts.low).toBeGreaterThan(counts.high * 3);
  });

  it('pickRarity เคารพน้ำหนักที่ตั้งไว้', () => {
    expect(pickRarity(0)).toBe('common');
    expect(pickRarity(0.999999)).toBe('mythical');
  });

  it('pool ตัดคนที่ OVR อยู่นอกช่วงที่ตั้งไว้ออก', () => {
    getMarketPool({ ...NPC_MARKET_CONFIG, minOvr: 120 }).forEach((entry) =>
      expect(entry.ovr).toBeGreaterThanOrEqual(120),
    );
  });
});

/* ── ของที่ซื้อได้ตอนนี้ ────────────────────────────────────── */

describe('getLiveListings', () => {
  it('ตลาดมีของเสมอ และไม่มีใบไหนหมดเวลาปนมา', () => {
    const live = getLiveListings(NOW);

    expect(live.length).toBeGreaterThan(0);
    live.forEach((entry) => expect(isListingLive(entry, NOW.getTime())).toBe(true));
  });

  it('จำนวนของในตลาดอยู่ในระดับที่ตั้งใจไว้ (ไม่ว่างเปล่าและไม่ล้น)', () => {
    // เช็คหลายชั่วโมงติดกัน เพราะของทยอยเข้า-หมดอายุตลอดเวลา
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(NOW.getTime() + hour * HOUR);
      const live = getLiveListings(at).filter((entry) => !entry.featured);

      expect(live.length).toBeGreaterThanOrEqual(NPC_MARKET_CONFIG.listingsPerWindow);
      expect(live.length).toBeLessThanOrEqual(
        NPC_MARKET_CONFIG.listingsPerWindow * (getWindowSpan() + 1),
      );
    }
  });

  it('ของที่มีคนซื้อไปแล้วหายจากตลาด', () => {
    const live = getLiveListings(NOW);
    const claimed = new Set([live[0].id]);

    const after = getLiveListings(NOW, { claimed });

    expect(after).toHaveLength(live.length - 1);
    expect(after.some((entry) => entry.id === live[0].id)).toBe(false);
  });

  it('เปิดคนละวินาทีในรอบเดียวกันได้ของชุดเดียวกัน', () => {
    const early = getLiveListings(new Date(NOW.getTime() + 5_000)).map((entry) => entry.id);
    const late = getLiveListings(new Date(NOW.getTime() + 30_000)).map((entry) => entry.id);

    expect(late).toEqual(early);
  });

  it('ขึ้นรอบใหม่แล้วมีของใหม่เข้ามาจริง', () => {
    const before = new Set(getLiveListings(NOW).map((entry) => entry.id));
    const after = getLiveListings(new Date(getMarketWindowEnd(NOW).getTime() + 1_000));

    expect(after.some((entry) => !before.has(entry.id))).toBe(true);
  });
});

/* ── ใบเด่นประจำวัน ────────────────────────────────────────── */

describe('ใบเด่นประจำวัน', () => {
  it('วันเดียวกันได้ใบเดิมเสมอ ไม่ว่าจะถามตอนไหนของวัน', () => {
    const morning = buildFeaturedListing(new Date('2026-03-01T09:00:00.000Z'));
    const evening = buildFeaturedListing(new Date('2026-03-01T20:00:00.000Z'));

    expect(morning).not.toBeNull();
    expect(evening?.playerId).toBe(morning?.playerId);
    expect(evening?.id).toBe(morning?.id);
    expect(evening?.price).toBe(morning?.price);
  });

  it('id ผูกกับวันแข่ง จึงมีได้ใบเดียวต่อวัน', () => {
    const featured = buildFeaturedListing(NOW);
    expect(featured?.id).toBe(featuredListingId(getFeaturedDayKey(NOW)));
    expect(featured?.featured).toBe(true);
  });

  it('เป็นการ์ดระดับสูงและถูกกว่าราคาตลาดปกติของคนเดียวกัน', () => {
    const featured = buildFeaturedListing(NOW);
    const source = PLAYERS.find((entry) => entry.id === featured?.playerId);

    expect(featured).not.toBeNull();
    expect(NPC_MARKET_CONFIG.featuredRarities).toContain(featured?.rarity);
    expect(featured!.price).toBeLessThan(getMarketPrice(source!));
  });

  it('หมดอายุตอนขึ้นวันแข่งใหม่', () => {
    const featured = buildFeaturedListing(NOW)!;
    const lifetime = new Date(featured.expiresAt).getTime() - NOW.getTime();

    expect(lifetime).toBeGreaterThan(0);
    expect(lifetime).toBeLessThanOrEqual(24 * HOUR);
  });

  it('อยู่ในรายการของที่ซื้อได้ด้วย', () => {
    expect(getLiveListings(NOW).some((entry) => entry.featured)).toBe(true);
  });
});

/* ── รอบเวลา ───────────────────────────────────────────────── */

describe('รอบเวลาของตลาด', () => {
  it('เลขรอบไม่ขึ้นกับ timezone และรอบถัดไปมาตรงเวลา', () => {
    const index = getMarketWindowIndex(NOW);
    const end = getMarketWindowEnd(NOW);

    expect(getWindowStart(index).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(end.getTime()).toBeGreaterThan(NOW.getTime());
    expect(end.getTime() - getWindowStart(index).getTime()).toBe(
      NPC_MARKET_CONFIG.windowMinutes * 60 * 1000,
    );
  });
});

/* ── กรอง / เรียง ──────────────────────────────────────────── */

describe('ตัวกรองและการเรียงของในตลาด', () => {
  const rows: MarketListing[] = [
    listing({ id: 'a', position: 'ST', rarity: 'common', ovr: 90, price: 10_000 }),
    listing({ id: 'b', position: 'CB', rarity: 'legendary', ovr: 120, price: 90_000 }),
    listing({
      id: 'c',
      position: 'ST',
      rarity: 'epic',
      ovr: 110,
      price: 40_000,
      expiresAt: new Date(NOW.getTime() + HOUR).toISOString(),
    }),
  ];

  it('กรองตามตำแหน่ง', () => {
    expect(filterListings(rows, { position: 'ST' }).map((row) => row.id)).toEqual(['a', 'c']);
  });

  it('กรองตามระดับการ์ด', () => {
    expect(filterListings(rows, { rarity: 'legendary' }).map((row) => row.id)).toEqual(['b']);
  });

  it('กรองตาม OVR ขั้นต่ำและราคาสูงสุด', () => {
    expect(filterListings(rows, { minOvr: 100 }).map((row) => row.id)).toEqual(['b', 'c']);
    expect(filterListings(rows, { maxPrice: 40_000 }).map((row) => row.id)).toEqual(['a', 'c']);
  });

  it("'all' และค่าว่างแปลว่าไม่กรอง", () => {
    expect(filterListings(rows, { position: 'all', rarity: 'all' })).toHaveLength(3);
    expect(filterListings(rows, {})).toHaveLength(3);
  });

  it('เรียงตามราคาและ OVR ได้ถูกต้อง', () => {
    expect(sortListings(rows, 'price-asc').map((row) => row.id)).toEqual(['a', 'c', 'b']);
    expect(sortListings(rows, 'price-desc').map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(sortListings(rows, 'ovr-desc').map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(sortListings(rows, 'expiry-asc')[0].id).toBe('c');
  });
});
