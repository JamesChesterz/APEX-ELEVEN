/**
 * เรียกการตีบวกที่อยู่ฝั่งเซิร์ฟเวอร์ (PHASE 13)
 *
 * หน้าเว็บส่งไปได้แค่ cardId กับ requestId — ผลสำเร็จ/ล้มเหลว ค่าบวกใหม่
 * และค่าใช้จ่ายทั้งหมด เซิร์ฟเวอร์เป็นคนคิดและเป็นคนเขียนลงบัญชีเอง
 *
 * เปิด/ปิดด้วย VITE_SERVER_AUTHORITY ตัวเดียวกับผลแมตช์ (ดู gameServer.ts)
 * ปิดอยู่ = ใช้ระบบเดิมที่ตีบวกในเครื่อง จะได้ deploy หน้าเว็บก่อนแล้วค่อยเปิดทีหลังได้
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/services/firebase/config';
import type { CardInstance } from '@/types/card';

/** ภูมิภาคของฟังก์ชัน ต้องตรงกับ setGlobalOptions ใน functions/src/index.ts */
const REGION = 'asia-southeast1';

/** ผลการตีบวกที่เซิร์ฟเวอร์ส่งกลับมา (รูปแบบเดียวกับ functions/src/upgrade.ts) */
export interface ServerUpgradeResult {
  success: boolean;
  previousUpgrade: number;
  newUpgrade: number;
  previousOvr: number;
  newOvr: number;
  coinsSpent: number;
  materialSpent: number;
}

export interface UpgradeCardResponse {
  result: ServerUpgradeResult;
  /** true = คำขอรหัสนี้เคยทำไปแล้ว นี่คือผลใบเดิม ไม่ได้หักเงินซ้ำ */
  replayed: boolean;
  /** ยอดคงเหลือหลังทำรายการ — หน้าเว็บต้องเอาไปตั้งทับค่าในเครื่องทันที */
  coins?: number;
  upgradePoints?: number;
  card?: CardInstance;
}

/**
 * สร้างรหัสคำขอหนึ่งใบ — ต้องสร้าง "ครั้งเดียวต่อการกดหนึ่งครั้ง"
 * ถ้ายิงซ้ำเพราะเน็ตหลุด ให้ส่งรหัสเดิมไป เซิร์ฟเวอร์จะคืนผลใบเดิมโดยไม่หักเงินซ้ำ
 *
 * รูปแบบต้องผ่าน isValidRequestId ที่ฝั่งเซิร์ฟเวอร์ (A–Z a–z 0–9 _ - เท่านั้น)
 */
export const createUpgradeRequestId = (): string =>
  `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** ขอตีบวกการ์ดหนึ่งใบ */
export const callUpgradeCard = async (payload: {
  cardId: string;
  requestId: string;
}): Promise<UpgradeCardResponse> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('ยังไม่ได้ตั้งค่า Firebase');

  const fn = httpsCallable<typeof payload, UpgradeCardResponse>(
    getFunctions(firebase.app, REGION),
    'upgradeCard',
  );

  return (await fn(payload)).data;
};
