/**
 * ═══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET — กติกาการซื้อหนึ่งครั้ง (pure function ล้วน)
 * ═══════════════════════════════════════════════════════════════
 *
 * แยกออกมาเป็นไฟล์เดียวโดยตั้งใจ เพราะนี่คือจุดเดียวที่ตัดสินว่า
 * "ซื้อได้ไหม · หักเท่าไร · ได้การ์ดใบไหน"
 *
 * ตอนนี้ถูกเรียกจากเครื่องผู้เล่น (hooks/useMarket.ts) เพราะโปรเจกต์นี้ยัง
 * ไม่ได้ deploy Cloud Functions — เหรียญและคลังการ์ดของทั้งเกมยังเป็นของ
 * เครื่องผู้เล่นอยู่แล้วทุกระบบ (เปิดซอง · ย่อยการ์ด · แลกเปลี่ยน)
 * ตลาดจึงเดินตามสถาปัตยกรรมเดิม ไม่ได้เปิดช่องใหม่ที่ไม่มีมาก่อน
 *
 * วันที่ย้ายไปฝั่งเซิร์ฟเวอร์: เอาไฟล์นี้ไปเรียกใน Cloud Function ได้เลย
 * ไม่ต้องแก้อะไรในนี้ และ UI ก็ไม่ต้องแก้ตาม เพราะเรียกผ่าน useMarket ตัวเดียว
 */
import { INVENTORY_CAPACITY, createCardInstance } from '@/services/cardInstance';
import { isListingLive } from '@/services/market';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import type { MarketListing, MarketPurchaseResult } from '@/types/market';

/** เหตุผลที่คำขอซื้อถูกปฏิเสธ */
export type MarketRejection =
  | 'listing-not-found'
  | 'listing-claimed'
  | 'listing-expired'
  | 'player-not-found'
  | 'own-listing'
  | 'bad-price'
  | 'insufficient-coins'
  | 'inventory-full';

export interface ResolveMarketPurchaseInput {
  /** ประกาศที่ขอซื้อ (undefined = หาไม่เจอแล้ว) */
  listing: MarketListing | undefined;
  /** uid (หรือ id บัญชี) ของคนกดซื้อ */
  buyerUid: string;
  /** เหรียญคงเหลือของบัญชี */
  coins: number;
  /** จำนวนการ์ดที่มีอยู่ในคลังแล้ว */
  cardCount: number;
  /** true = มีคนจองใบนี้ไปแล้ว (อ่านจาก marketClaims) */
  claimed?: boolean;
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

const reject = (reason: MarketRejection, message: string): ResolveMarketPurchaseOutcome => ({
  ok: false,
  reason,
  message,
});

/**
 * ตัดสินคำขอซื้อหนึ่งครั้ง
 *
 * ตรวจให้ครบทุกด่านก่อนแล้วค่อยคืน ok — ผู้เรียกจึงเอาผลไปเขียนลงบัญชี
 * ได้เลยโดยไม่ต้องตรวจอะไรซ้ำอีก
 */
export const resolveMarketPurchase = ({
  listing,
  buyerUid,
  coins,
  cardCount,
  claimed = false,
  now,
}: ResolveMarketPurchaseInput): ResolveMarketPurchaseOutcome => {
  if (!listing) return reject('listing-not-found', 'ไม่พบประกาศนี้ในตลาดแล้ว');

  if (claimed || listing.status === 'SOLD') {
    return reject('listing-claimed', 'นักเตะคนนี้เพิ่งถูกคนอื่นซื้อไปแล้ว');
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
