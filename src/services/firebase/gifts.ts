/**
 * กล่องของขวัญ — ทางที่ของจากแอดมินเดินทางไปหาผู้เล่น
 *
 * ทำไมต้องมี: เบราว์เซอร์ของแอดมินเขียนบัญชีคนอื่นไม่ได้ (กฎล็อกไว้ว่าเจ้าของบัญชี
 * เท่านั้นที่แตะคลังการ์ด/เหรียญของตัวเองได้ และไม่ควรปลดล็อกเพราะเสี่ยงเกินไป)
 * แอดมินจึง "หย่อนใบสั่ง" ลงกล่องของผู้เล่นแทน พอเจ้าของเปิดเกมเมื่อไหร่
 * เครื่องเขาจะอ่านใบที่ค้างอยู่ เพิ่มของเข้าบัญชีตัวเอง แล้วลบใบทิ้ง
 *
 * ใช้โครงสร้างเดียวกับกล่องผลการแข่ง (matchInbox.ts) ที่พิสูจน์แล้วว่าใช้ได้จริง
 */
import {
  collection,
  deleteDoc,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';

/** ชื่อ collection ของกล่องของขวัญ */
const GIFTS = 'gifts';

/** อ่านทีละไม่เกินกี่ใบต่อรอบ */
const GIFT_LIMIT = 20;

/** เพดานต่อใบ — กันพิมพ์เลขพลาดจนเงินเฟ้อทั้งเซิร์ฟเวอร์ */
export const GIFT_MAX_AMOUNT = 100_000_000;

/**
 * จำนวนการ์ดสูงสุดต่อใบ
 * ตั้งให้มากกว่าจำนวนนักเตะทั้งเกม เพื่อให้ปุ่ม "ใส่การ์ดทั้งหมด" ส่งได้ในใบเดียว
 * ค่านี้ต้องตรงกับเพดานใน firestore.rules
 */
export const GIFT_MAX_CARDS = 200;

/** ใบของขวัญหนึ่งใบ */
export interface GiftDoc {
  id: string;
  /** uid ของแอดมินที่ส่ง */
  fromUid: string;
  /** ชื่อที่แสดงบนแจ้งเตือนของผู้รับ */
  fromName: string;
  coins: number;
  /** แต้มแลกนักเตะ */
  points: number;
  /** แต้มตีบวก */
  upgradePoints: number;
  /** id ของนักเตะที่แถมมา (การ์ดจะถูกสร้างที่เครื่องผู้รับ) */
  cardPlayerIds: string[];
  /** ข้อความถึงผู้รับ */
  note: string;
  /** เวลาที่ส่ง (ISO) */
  sentAt: string;
}

/** บีบค่าให้อยู่ในช่วงที่ยอมรับได้ ใช้ทั้งฝั่งส่งและฝั่งรับ (ฝั่งรับไม่เชื่อตัวเลขจากใบ) */
export const clampGiftAmount = (value: unknown): number => {
  const amount = Math.floor(Number(value) || 0);
  return Math.min(Math.max(amount, 0), GIFT_MAX_AMOUNT);
};

/** ส่งของขวัญเข้ากล่องของผู้เล่นคนหนึ่ง */
export const sendGift = async (targetUid: string, gift: GiftDoc): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  await setDoc(doc(firebase.db, GIFTS, targetUid, 'items', gift.id), {
    ...gift,
    coins: clampGiftAmount(gift.coins),
    points: clampGiftAmount(gift.points),
    upgradePoints: clampGiftAmount(gift.upgradePoints),
    cardPlayerIds: gift.cardPlayerIds.slice(0, GIFT_MAX_CARDS),
    createdAt: serverTimestamp(),
  });
};

/** เฝ้ากล่องของขวัญของตัวเอง */
export const watchGifts = (uid: string, onGifts: (gifts: GiftDoc[]) => void): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) return () => undefined;

  const pending = query(
    collection(firebase.db, GIFTS, uid, 'items'),
    orderBy('createdAt'),
    fbLimit(GIFT_LIMIT),
  );

  return onSnapshot(
    pending,
    (snapshot) => onGifts(snapshot.docs.map((entry) => ({ ...(entry.data() as GiftDoc), id: entry.id }))),
    (error) => console.error('[firebase] อ่านกล่องของขวัญไม่สำเร็จ', error),
  );
};

/** ลบใบที่รับของเข้าบัญชีเรียบร้อยแล้ว */
export const clearGifts = async (uid: string, ids: string[]): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase || ids.length === 0) return;

  await Promise.all(ids.map((id) => deleteDoc(doc(firebase.db, GIFTS, uid, 'items', id))));
};
