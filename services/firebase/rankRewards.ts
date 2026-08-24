/**
 * ค่าตั้งรางวัลของตารางอันดับที่เจ้าของโปรเจคเลือกไว้ (เอกสารเดียวทั้งเซิร์ฟเวอร์)
 *
 * เก็บที่ config/rankRewards — ผู้เล่นทุกคนที่ล็อกอินแล้ว "อ่านได้" แต่ "เขียนได้"
 * เฉพาะ uid ที่ระบุไว้ใน firestore.rules เท่านั้น (ดูคำอธิบายในไฟล์นั้น)
 *
 * ยังไม่เคยบันทึก หรือเล่นออฟไลน์ = ใช้ค่าเริ่มต้นจาก data/rankRewards.ts
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';

/** ชื่อเอกสารที่เก็บค่าตั้งรางวัล */
export const RANK_REWARDS_DOC = { collection: 'config', id: 'rankRewards' } as const;

/** ติดตามค่าตั้งรางวัลแบบเรียลไทม์ คืนฟังก์ชันสำหรับยกเลิกการติดตาม */
export const watchRankRewards = (
  onChange: (cards: string[] | null) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(firebase.db, RANK_REWARDS_DOC.collection, RANK_REWARDS_DOC.id),
    (snapshot) => {
      const data = snapshot.data() as { cards?: unknown } | undefined;
      onChange(Array.isArray(data?.cards) ? (data!.cards as string[]) : null);
    },
    (error) => {
      console.error('[firebase] อ่านค่าตั้งรางวัลไม่สำเร็จ', error);
      onChange(null);
    },
  );
};

/** บันทึกค่าตั้งรางวัล (เฉพาะเจ้าของโปรเจค) — โยน error ออกไปให้ UI แสดงข้อความเอง */
export const saveRankRewards = async (uid: string, cards: string[]): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  await setDoc(
    doc(firebase.db, RANK_REWARDS_DOC.collection, RANK_REWARDS_DOC.id),
    { cards, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
};
