/**
 * ตัวเรียกตลาดซื้อขายที่อยู่ฝั่งเซิร์ฟเวอร์ (Cloud Functions)
 *
 * หน้าเว็บส่งไปได้แค่ listingId กับ requestId — ราคา เหรียญ และการ์ดที่ได้
 * เซิร์ฟเวอร์เป็นคนคิดและเป็นคนเขียนลงบัญชีเองทั้งหมด (ดู functions/src/index.ts)
 *
 * ตลาดนี้ "ไม่มีโหมดสำรองฝั่งเครื่องผู้เล่น" โดยตั้งใจ
 * ถ้าไม่ได้ตั้งค่า Firebase หรือยังไม่ได้ deploy functions ตลาดจะปิดไปเลย
 * ดีกว่าปล่อยให้มีทางสร้างการ์ด/หักเหรียญจากเครื่องผู้เล่นได้
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebase, isOnlineMode } from '@/services/firebase/config';
import type { CardInstance } from '@/types/card';
import type { MarketListing, MarketPurchaseResult } from '@/types/market';

/** ภูมิภาคของฟังก์ชัน ต้องตรงกับ setGlobalOptions ใน functions/src/index.ts */
const REGION = 'asia-southeast1';

/** true = เปิดตลาดได้ (ต่อออนไลน์อยู่) */
export const MARKET_AVAILABLE = isOnlineMode;

export interface MarketListingsResponse {
  listings: MarketListing[];
  /** เวลาที่ของชุดใหม่จะเข้ามา (ISO) */
  nextRefreshAt: string;
  /** เวลาของเซิร์ฟเวอร์ตอนตอบกลับ — ใช้เทียบนาฬิกาเครื่องผู้เล่น */
  serverTime: string;
}

export interface BuyListingResponse {
  result: MarketPurchaseResult;
  /** true = คำขอรหัสนี้เคยทำไปแล้ว นี่คือผลใบเดิม ไม่ได้หักเงินซ้ำ */
  replayed: boolean;
  /** ยอดเหรียญหลังทำรายการ — หน้าเว็บต้องเอาไปตั้งทับค่าในเครื่องทันที */
  coins?: number;
  /** การ์ดใบใหม่ที่เซิร์ฟเวอร์เพิ่มเข้าคลังให้แล้ว */
  card?: CardInstance;
}

/**
 * รหัสคำขอหนึ่งใบ — สร้าง "ครั้งเดียวต่อการกดหนึ่งครั้ง"
 * เน็ตหลุดแล้วยิงซ้ำด้วยรหัสเดิม เซิร์ฟเวอร์จะคืนผลใบเดิมโดยไม่หักเงินซ้ำ
 * รูปแบบต้องผ่าน isValidRequestId ฝั่งเซิร์ฟเวอร์ (A–Z a–z 0–9 _ - เท่านั้น)
 */
export const createMarketRequestId = (): string =>
  `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const call = <Request, Response>(name: string) => {
  return async (payload: Request): Promise<Response> => {
    const firebase = getFirebase();
    if (!firebase) throw new Error('ยังไม่ได้ตั้งค่า Firebase');

    const fn = httpsCallable<Request, Response>(getFunctions(firebase.app, REGION), name);
    return (await fn(payload)).data;
  };
};

/** ขอรายการของที่ซื้อได้ตอนนี้ (เซิร์ฟเวอร์เติมของให้เองถ้าถึงรอบ) */
export const callGetMarketListings = call<Record<string, never>, MarketListingsResponse>(
  'getMarketListings',
);

/** ขอซื้อหนึ่งใบ */
export const callBuyMarketListing = call<
  { listingId: string; requestId: string },
  BuyListingResponse
>('buyMarketListing');
