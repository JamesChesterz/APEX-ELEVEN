/**
 * TRANSFER MARKET — เทสกติกากลางของตลาด (ฝั่ง pure function)
 *
 * ครอบสี่เรื่องที่พังแล้วเสียหายกับเศรษฐกิจในเกมโดยตรง:
 *   1. ราคาต้องแพงกว่าราคาขายการ์ดคืนเสมอ (ไม่งั้นซื้อ-ขายวนปั๊มเหรียญได้)
 *   2. การสร้างของต้องได้ผลเดิมเมื่อ seed เดิม (สร้างซ้อนกันแล้วข้อมูลต้องไม่เพี้ยน)
 *   3. ใบเด่นประจำวันต้องเป็นคนเดียวกันทั้งวันสำหรับทุกคน
 *   4. ตัวกรอง/การเรียงต้องตรงกับที่หน้าเว็บสัญญาไว้
 */
import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@/data/players';
import { DEFAULT_CARD_CASH, getCardCashValue } from '@/services/cardCash';
import {
  NPC_MARKET_CONFIG,
  buildFeaturedListing,
  buildNpcListings,
  featuredListingId,
  filterListings,
  getFeaturedDayKey,
  getMarketPool,
  getMarketPrice,
  getMarketWindowIndex,
  isListingLive,
  npcListingId,
  pickRarity,
  planMarketRefill,
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
      const price = getMarketPrice(entry);
      const resale = getCardCashValue(entry, 1, DEFAULT_CARD_CASH);
      expect(price).toBeGreaterThan(resale);
    });
  });

  it('ส่วนต่างของตลาดห้ามตั้งต่ำกว่า 1 เท่า', () => {
    expect(NPC_MARKET_CONFIG.priceMarkup).toBeGreaterThan(1);
  });

  it('OVR สูงกว่า = แพงกว่า เมื่อระดับการ์ดเท่ากัน', () => {
    const cheap = getMarketPrice(player({ ovr: 100 }));
    const rich = getMarketPrice(player({ ovr: 120 }));
    expect(rich).toBeGreaterThan(cheap);
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

/* ── สร้างประกาศ NPC ───────────────────────────────────────── */

describe('buildNpcListings', () => {
  const slots = Array.from({ length: NPC_MARKET_CONFIG.maxListings }, (_, index) => index);

  it('สร้างครบตามจำนวนช่องที่ขอ และ id ไม่ซ้ำกัน', () => {
    const built = buildNpcListings({ windowIndex: 42, slots, now: NOW });

    expect(built).toHaveLength(slots.length);
    expect(new Set(built.map((entry) => entry.id)).size).toBe(slots.length);
    expect(built[0].id).toBe(npcListingId(42, 0));
  });

  it('รอบเดียวกันสร้างซ้ำกี่ครั้งก็ได้ของชุดเดิมเป๊ะ (สร้างซ้อนกันแล้วไม่เพี้ยน)', () => {
    const first = buildNpcListings({ windowIndex: 42, slots, now: NOW });
    const second = buildNpcListings({ windowIndex: 42, slots, now: NOW });

    expect(second).toEqual(first);
  });

  it('คนละรอบได้ของคนละชุด', () => {
    const first = buildNpcListings({ windowIndex: 42, slots, now: NOW });
    const second = buildNpcListings({ windowIndex: 43, slots, now: NOW });

    expect(second.map((entry) => entry.playerId)).not.toEqual(first.map((entry) => entry.playerId));
  });

  it('ทุกใบเริ่มต้นเป็น ACTIVE ราคาถูกตรึงไว้ และหมดอายุในช่วงที่ตั้งไว้', () => {
    buildNpcListings({ windowIndex: 7, slots, now: NOW }).forEach((entry) => {
      const lifetime = new Date(entry.expiresAt).getTime() - NOW.getTime();

      expect(entry.status).toBe('ACTIVE');
      expect(entry.sellerType).toBe('NPC');
      expect(entry.sellerUid).toBeNull();
      expect(entry.featured).toBe(false);
      expect(entry.price).toBeGreaterThan(0);
      expect(lifetime).toBeGreaterThanOrEqual(NPC_MARKET_CONFIG.minLifetimeHours * HOUR);
      expect(lifetime).toBeLessThanOrEqual(NPC_MARKET_CONFIG.maxLifetimeHours * HOUR);
    });
  });

  it('การ์ดต้องห้ามไม่โผล่ในตลาดทุกรอบที่สุ่ม', () => {
    const banned = PLAYERS.slice(0, 5).map((entry) => entry.id);
    const excluded = new Set(banned);

    for (let round = 0; round < 30; round += 1) {
      const built = buildNpcListings({ windowIndex: round, slots, now: NOW, excluded });
      built.forEach((entry) => expect(banned).not.toContain(entry.playerId));
    }
  });

  it('ระดับสูงต้องออกยากกว่าระดับต่ำอย่างชัดเจน', () => {
    const counts = { high: 0, low: 0 };

    for (let round = 0; round < 200; round += 1) {
      buildNpcListings({ windowIndex: round, slots, now: NOW }).forEach((entry) => {
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
    const pool = getMarketPool({ ...NPC_MARKET_CONFIG, minOvr: 120, maxOvr: 999 });
    pool.forEach((entry) => expect(entry.ovr).toBeGreaterThanOrEqual(120));
  });
});

/* ── ใบเด่นประจำวัน ────────────────────────────────────────── */

describe('ใบเด่นประจำวัน', () => {
  it('วันเดียวกันได้ใบเดิมเสมอ ไม่ว่าจะถามตอนไหนของวัน', () => {
    const morning = buildFeaturedListing({ now: new Date('2026-03-01T09:00:00.000Z') });
    const evening = buildFeaturedListing({ now: new Date('2026-03-01T20:00:00.000Z') });

    expect(morning).not.toBeNull();
    expect(evening?.playerId).toBe(morning?.playerId);
    expect(evening?.id).toBe(morning?.id);
    expect(evening?.price).toBe(morning?.price);
  });

  it('id ผูกกับวันแข่ง จึงสร้างซ้ำไม่ได้ในวันเดียวกัน', () => {
    const featured = buildFeaturedListing({ now: NOW });
    expect(featured?.id).toBe(featuredListingId(getFeaturedDayKey(NOW)));
    expect(featured?.featured).toBe(true);
  });

  it('เป็นการ์ดระดับสูงและถูกกว่าราคาตลาดปกติของคนเดียวกัน', () => {
    const featured = buildFeaturedListing({ now: NOW });
    const source = PLAYERS.find((entry) => entry.id === featured?.playerId);

    expect(featured).not.toBeNull();
    expect(NPC_MARKET_CONFIG.featuredRarities).toContain(featured?.rarity);
    expect(featured!.price).toBeLessThan(getMarketPrice(source!));
  });

  it('หมดอายุตอนขึ้นวันแข่งใหม่', () => {
    const featured = buildFeaturedListing({ now: NOW })!;
    const lifetime = new Date(featured.expiresAt).getTime() - NOW.getTime();

    expect(lifetime).toBeGreaterThan(0);
    expect(lifetime).toBeLessThanOrEqual(24 * HOUR);
  });
});

/* ── วางแผนเติมของ ─────────────────────────────────────────── */

describe('planMarketRefill', () => {
  it('ตลาดว่างเปล่า = สร้างให้เต็มเพดาน และต้องมีใบเด่นด้วย', () => {
    const plan = planMarketRefill({ listings: [], now: NOW });

    expect(plan.slots).toHaveLength(NPC_MARKET_CONFIG.maxListings);
    expect(plan.needsFeatured).toBe(true);
    expect(plan.liveCount).toBe(0);
  });

  it('ปิดใบที่หมดเวลา แล้วเติมของแทนให้ครบ', () => {
    const dead = listing({
      id: 'npc_0_0',
      expiresAt: new Date(NOW.getTime() - HOUR).toISOString(),
    });
    const plan = planMarketRefill({ listings: [dead], now: NOW });

    expect(plan.expiredIds).toEqual(['npc_0_0']);
    expect(plan.liveCount).toBe(0);
    expect(plan.slots).toHaveLength(NPC_MARKET_CONFIG.maxListings);
  });

  it('ของยังเต็มอยู่ = ไม่สร้างเพิ่ม', () => {
    const windowIndex = getMarketWindowIndex(NOW);
    const full = buildNpcListings({
      windowIndex,
      slots: Array.from({ length: NPC_MARKET_CONFIG.maxListings }, (_, index) => index),
      now: NOW,
    });

    const plan = planMarketRefill({ listings: full, now: NOW });

    expect(plan.slots).toHaveLength(0);
    expect(plan.expiredIds).toHaveLength(0);
    expect(plan.liveCount).toBe(NPC_MARKET_CONFIG.maxListings);
  });

  it('ไม่แย่งช่องที่มีของอยู่แล้วในรอบเดียวกัน', () => {
    const windowIndex = getMarketWindowIndex(NOW);
    const existing = buildNpcListings({ windowIndex, slots: [0, 1, 2], now: NOW });
    const plan = planMarketRefill({ listings: existing, now: NOW });

    expect(plan.slots).not.toContain(0);
    expect(plan.slots).not.toContain(1);
    expect(plan.slots).not.toContain(2);
    expect(plan.slots).toHaveLength(NPC_MARKET_CONFIG.maxListings - 3);
  });

  it('มีใบเด่นของวันนี้อยู่แล้ว = ไม่สร้างซ้ำ', () => {
    const featured = buildFeaturedListing({ now: NOW })!;
    expect(planMarketRefill({ listings: [featured], now: NOW }).needsFeatured).toBe(false);
  });

  it('ใบที่ขายไปแล้วไม่ถูกนับว่ายังอยู่ในตลาด', () => {
    const sold = listing({ status: 'SOLD' });
    expect(isListingLive(sold, NOW.getTime())).toBe(false);
    expect(planMarketRefill({ listings: [sold], now: NOW }).liveCount).toBe(0);
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
