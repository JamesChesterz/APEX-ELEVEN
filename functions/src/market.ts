/**
 * ═══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET — กติกาการซื้อฝั่งเซิร์ฟเวอร์ (pure function ล้วน)
 * ═══════════════════════════════════════════════════════════════
 *
 * แยกออกจาก index.ts ด้วยเหตุผลเดียวกับ functions/src/upgrade.ts:
 * เทสได้โดยไม่ต้องต่อ Firebase ส่วนตัวที่แตะฐานข้อมูลจริง
 * (transaction + กันคำขอซ้ำ) อยู่ที่ index.ts
 *
 * หัวใจ: เครื่องผู้เล่นส่งมาได้แค่ listingId กับ requestId เท่านั้น
 * ราคาอ่านจากเอกสารประกาศ · เหรียญอ่านจากบัญชี · การ์ดสร้างที่นี่
 * ไม่มีตัวเลขไหนเลยที่มาจากเครื่องผู้เล่น
 */
import { INVENTORY_CAPACITY, createCardInstance } from '@/services/cardInstance';
import { isListingLive } from '@/services/market';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import type { MarketListing, MarketPurchaseResult } from '@/types/market';

/** เหตุผลที่คำขอซื้อถูกปฏิเสธ — ใช้เลือก error code ที่ index.ts */
export type MarketRejection =
  | 'listing-not-found'
  | 'listing-sold'
  | 'listing-expired'
  | 'player-not-found'
  | 'own-listing'
  | 'bad-price'
  | 'insufficient-coins'
  | 'inventory-full';

export interface ResolveMarketPurchaseInput {
  /** ประกาศที่ขอซื้อ (undefined = ไม่มีเอกสารนี้ในฐานข้อมูล) */
  listing: MarketListing | undefined;
  /** uid ของคนกดซื้อ */
  buyerUid: string;
  /** เหรียญคงเหลือของบัญชี (อ่านจากฐานข้อมูล ไม่ใช่จากคำขอ) */
  coins: number;
  /** จำนวนการ์ดที่มีอยู่ในคลังแล้ว */
  cardCount: number;
  /** เวลาของเซิร์ฟเวอร์ */
  now: Date;
}

export type ResolveMarketPurchaseOutcome =
  | {
      ok: true;
      /** การ์ดใบใหม่ที่ต้องเพิ่มเข้าคลัง */
      card: CardInstance;
      /** เหรียญที่เหลือหลังหักราคาแล้ว */
      coinsLeft: number;
      result: MarketPurchaseResult;
    }
  | { ok: false; reason: MarketRejection; message: string };

/** บันทึกคำขอซื้อหนึ่งใบ (accounts/{uid}/marketPurchases/{requestId}) — กันยิงซ้ำ */
export interface MarketPurchaseRecord {
  requestId: string;
  listingId: string;
  result: MarketPurchaseResult;
  at: string;
}

const reject = (reason: MarketRejection, message: string): ResolveMarketPurchaseOutcome => ({
  ok: false,
  reason,
  message,
});

/**
 * ตัดสินคำขอซื้อหนึ่งครั้ง
 *
 * ลำดับการตรวจสำคัญ: เช็คว่าซื้อได้ก่อนแล้วค่อยคิดเงิน
 * และ "ทุกด่าน" ต้องผ่านก่อนถึงจะคืน ok — ผู้เรียกจะได้เขียนลงฐานข้อมูล
 * ในรายการเดียวโดยไม่ต้องตรวจอะไรเพิ่มอีก
 */
export const resolveMarketPurchase = ({
  listing,
  buyerUid,
  coins,
  cardCount,
  now,
}: ResolveMarketPurchaseInput): ResolveMarketPurchaseOutcome => {
  if (!listing) return reject('listing-not-found', 'ไม่พบประกาศนี้ในตลาดแล้ว');

  if (listing.status === 'SOLD') {
    return reject('listing-sold', 'นักเตะคนนี้เพิ่งถูกคนอื่นซื้อไปแล้ว');
  }

  if (!isListingLive(listing, now.getTime())) {
    return reject('listing-expired', 'ประกาศนี้หมดเวลาแล้ว');
  }

  // เตรียมไว้ให้ตลาดผู้เล่นต่อผู้เล่นในอนาคต — ซื้อของตัวเองไม่ได้
  if (listing.sellerUid && listing.sellerUid === buyerUid) {
    return reject('own-listing', 'ซื้อนักเตะที่ตัวเองวางขายไม่ได้');
  }

  const player = getBasePlayer(listing.playerId);
  if (!player) return reject('player-not-found', 'ไม่พบข้อมูลนักเตะของประกาศนี้');

  const price = Math.trunc(Number(listing.price));
  if (!Number.isFinite(price) || price <= 0) {
    return reject('bad-price', 'ราคาของประกาศนี้ไม่ถูกต้อง');
  }

  if (coins < price) {
    return reject(
      'insufficient-coins',
      `เหรียญไม่พอ — ต้องใช้ ${price.toLocaleString('en-US')} เหรียญ`,
    );
  }

  if (cardCount >= INVENTORY_CAPACITY) {
    return reject(
      'inventory-full',
      `คลังการ์ดเต็มแล้ว (${INVENTORY_CAPACITY} ใบ) เคลียร์การ์ดก่อนค่อยซื้อใหม่`,
    );
  }

  const card = createCardInstance({ playerId: listing.playerId, ownerId: buyerUid, now });
  const coinsLeft = coins - price;

  return {
    ok: true,
    card,
    coinsLeft,
    result: {
      listingId: listing.id,
      playerId: listing.playerId,
      price,
      coinsBefore: coins,
      coinsAfter: coinsLeft,
      cardId: card.id,
      at: now.toISOString(),
    },
  };
};
