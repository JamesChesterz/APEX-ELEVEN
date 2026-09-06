/**
 * TRANSFER MARKET — เทสการซื้อฝั่งเซิร์ฟเวอร์
 *
 * ครอบทุกทางที่คำขอควรถูกปฏิเสธ และที่สำคัญที่สุดคือกรณี "สองคนกดใบเดียวกัน"
 * ซึ่งถ้าพลาดจะเกิดการ์ดจากอากาศและเหรียญหายไปฟรี ๆ ของผู้เล่นคนที่สอง
 *
 * ตัวที่แตะฐานข้อมูลจริง (transaction) อยู่ที่ functions/src/index.ts
 * ไฟล์นี้เทสกติกาที่ transaction นั้นใช้ตัดสิน จึงไม่ต้องต่อ Firebase
 */
import { describe, expect, it } from 'vitest';
import { INVENTORY_CAPACITY } from '@/services/cardInstance';
import { getMarketPrice } from '@/services/market';
import { getBasePlayer } from '@/services/playerAttributes';
import type { MarketListing } from '@/types/market';
import { resolveMarketPurchase } from '../functions/src/market';

const BUYER = 'user_A';
const RIVAL = 'user_B';
const NOW = new Date('2026-03-01T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const PLAYER_ID = 'p001';
const PRICE = getMarketPrice(getBasePlayer(PLAYER_ID)!);

const listing = (extra: Partial<MarketListing> = {}): MarketListing => ({
  id: 'npc_1_0',
  playerId: PLAYER_ID,
  sellerType: 'NPC',
  sellerUid: null,
  price: PRICE,
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

const run = (overrides: Partial<Parameters<typeof resolveMarketPurchase>[0]> = {}) =>
  resolveMarketPurchase({
    listing: listing(),
    buyerUid: BUYER,
    coins: 1_000_000,
    cardCount: 10,
    now: NOW,
    ...overrides,
  });

/* ── ซื้อสำเร็จ ────────────────────────────────────────────── */

describe('ซื้อสำเร็จ', () => {
  it('หักเหรียญตามราคาในประกาศ ไม่ใช่ตามที่เครื่องผู้เล่นบอก', () => {
    const outcome = run({ coins: 500_000 });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.price).toBe(PRICE);
    expect(outcome.coinsLeft).toBe(500_000 - PRICE);
    expect(outcome.result.coinsBefore).toBe(500_000);
    expect(outcome.result.coinsAfter).toBe(outcome.coinsLeft);
  });

  it('สร้างการ์ดใบใหม่ให้คนซื้อ ค่าบวกเริ่มที่ +0 และไม่ได้ลงสนามอัตโนมัติ', () => {
    const outcome = run();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.card.playerId).toBe(PLAYER_ID);
    expect(outcome.card.ownerId).toBe(BUYER);
    expect(outcome.card.level).toBe(1);
    expect(outcome.card.inSquad).toBe(false);
    expect(outcome.result.cardId).toBe(outcome.card.id);
  });

  it('เกมนี้ถือการ์ดซ้ำได้ ซื้อนักเตะคนเดิมอีกใบจึงต้องได้การ์ดคนละใบ', () => {
    const first = run();
    const second = run();

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.card.playerId).toBe(first.card.playerId);
    expect(second.card.id).not.toBe(first.card.id);
  });

  it('เหรียญพอดีเป๊ะก็ซื้อได้', () => {
    const outcome = run({ coins: PRICE });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.coinsLeft).toBe(0);
  });
});

/* ── ทางที่ต้องถูกปฏิเสธ ───────────────────────────────────── */

describe('คำขอที่ต้องถูกปฏิเสธ', () => {
  it('ไม่มีประกาศนี้แล้ว', () => {
    const outcome = run({ listing: undefined });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('listing-not-found');
  });

  it('เหรียญไม่พอ (ขาดอยู่เหรียญเดียวก็ซื้อไม่ได้)', () => {
    const outcome = run({ coins: PRICE - 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('insufficient-coins');
  });

  it('ประกาศหมดเวลาแล้ว', () => {
    const outcome = run({
      listing: listing({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('listing-expired');
  });

  it('ประกาศถูกซื้อไปแล้ว', () => {
    const outcome = run({ listing: listing({ status: 'SOLD', buyerUid: RIVAL }) });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('listing-sold');
  });

  it('ประกาศที่ถูกปิดเพราะหมดเวลาไปแล้ว ซื้อไม่ได้อีก', () => {
    const outcome = run({ listing: listing({ status: 'EXPIRED' }) });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('listing-expired');
  });

  it('คลังการ์ดเต็ม', () => {
    const outcome = run({ cardCount: INVENTORY_CAPACITY });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('inventory-full');
  });

  it('นักเตะไม่มีอยู่จริงใน pool', () => {
    const outcome = run({ listing: listing({ playerId: 'ไม่มีคนนี้' }) });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('player-not-found');
  });

  it('ราคาในเอกสารเพี้ยน (0 หรือติดลบ) ต้องไม่ยอมให้ซื้อ', () => {
    expect(run({ listing: listing({ price: 0 }) }).ok).toBe(false);
    expect(run({ listing: listing({ price: -100 }) }).ok).toBe(false);
  });

  it('ซื้อของที่ตัวเองวางขายไม่ได้ (เตรียมไว้ให้ตลาดผู้เล่นต่อผู้เล่น)', () => {
    const outcome = run({
      listing: listing({ sellerType: 'PLAYER', sellerUid: BUYER }),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('own-listing');
  });

  it('ของที่คนอื่นวางขายยังซื้อได้ตามปกติ', () => {
    expect(run({ listing: listing({ sellerType: 'PLAYER', sellerUid: RIVAL }) }).ok).toBe(true);
  });
});

/* ── สองคนกดพร้อมกัน ───────────────────────────────────────── */

describe('สองคนแย่งซื้อใบเดียวกัน', () => {
  it('คนที่สองต้องถูกปฏิเสธเสมอ ไม่มีทางได้การ์ดทั้งคู่', () => {
    /*
     * จำลองสิ่งที่ Firestore transaction ทำจริง: คนแรกชนะแล้วเขียน SOLD
     * คนที่สองถูกบังคับให้อ่านใหม่ จึงเห็นสถานะที่อัปเดตแล้วเสมอ
     */
    const open = listing();

    const first = resolveMarketPurchase({
      listing: open,
      buyerUid: BUYER,
      coins: 1_000_000,
      cardCount: 0,
      now: NOW,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const afterWrite: MarketListing = {
      ...open,
      status: 'SOLD',
      buyerUid: BUYER,
      soldAt: first.result.at,
    };

    const second = resolveMarketPurchase({
      listing: afterWrite,
      buyerUid: RIVAL,
      coins: 1_000_000,
      cardCount: 0,
      now: NOW,
    });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('listing-sold');
  });

  it('คนที่ถูกปฏิเสธต้องไม่เสียเหรียญและไม่ได้การ์ด', () => {
    const outcome = run({ listing: listing({ status: 'SOLD' }), coins: 999_999 });

    expect(outcome.ok).toBe(false);
    expect('card' in outcome).toBe(false);
    expect('coinsLeft' in outcome).toBe(false);
  });
});
