/**
 * ค่าตั้งกลางของเกมที่เจ้าของโปรเจคกำหนดเอง (collection `config`)
 *
 * ทุกเอกสารในนี้: ผู้เล่นที่ล็อกอินแล้ว "อ่านได้ทุกคน" แต่ "เขียนได้เฉพาะเจ้าของโปรเจค"
 * (ดูฟังก์ชัน isProjectOwner ใน firestore.rules)
 *
 * ตั้งใจให้เป็นตัวกลางบาง ๆ — ตัวไหนที่ต้องรู้โครงสร้างของข้อมูลจริง
 * ให้ไปทำที่ hooks/useGameConfig.tsx แทน ไฟล์นี้รู้แค่ "อ่าน/เขียนเอกสารตามชื่อ"
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';

/** ชื่อเอกสารทั้งหมดใน collection config */
export const CONFIG_DOCS = {
  /** การ์ดรางวัลอันดับ 1–10 (ดู services/firebase/rankRewards.ts) */
  rankRewards: 'rankRewards',
  /** คำสั่งรีเซ็ตดาว/ซีซันของทั้งเซิร์ฟเวอร์ */
  ladder: 'ladder',
  /** ประกาศกลางจอตอนเข้าเกม */
  announcement: 'announcement',
  /** รายชื่อบัญชีที่ถูกระงับ */
  bans: 'bans',
  /** ซองการ์ดในร้านที่เจ้าของโปรเจคสร้างเอง */
  packs: 'packs',
  /** ดีลแลกเปลี่ยนการ์ดที่เจ้าของโปรเจคสร้างเอง (เมนู Exchange → แลกด้วยการ์ด) */
  exchangeDeals: 'exchangeDeals',
  /** ประกาศอัปเดตล่าสุด (ฟีดข่าวบนหน้า HOME — ต่างจาก announcement ที่เป็นป็อปอัป) */
  news: 'news',
  /** รายชื่อการ์ดที่แอดมินเลือกให้โชว์เป็น "การ์ดใหม่ล่าสุด" บนหน้า HOME */
  featuredCards: 'featuredCards',
  /** แผนการเล่นที่เจ้าของโปรเจควาดเอง (เพิ่มจากแผนพื้นฐานในโค้ด ไม่ได้แทนที่) */
  formations: 'formations',
} as const;

const COLLECTION = 'config';

/** ติดตามเอกสารตั้งค่าหนึ่งใบแบบเรียลไทม์ (null = ยังไม่เคยตั้ง หรือเล่นออฟไลน์) */
export const watchConfigDoc = <T>(
  docId: string,
  onChange: (value: T | null) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(firebase.db, COLLECTION, docId),
    (snapshot) => onChange((snapshot.data() as T | undefined) ?? null),
    (error) => {
      console.error(`[firebase] อ่านค่าตั้ง ${docId} ไม่สำเร็จ`, error);
      onChange(null);
    },
  );
};

/** บันทึกเอกสารตั้งค่า (เฉพาะเจ้าของโปรเจค) — โยน error ให้ UI แสดงข้อความเอง */
export const saveConfigDoc = async (
  docId: string,
  value: Record<string, unknown>,
  uid: string,
): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  await setDoc(
    doc(firebase.db, COLLECTION, docId),
    { ...value, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
};
