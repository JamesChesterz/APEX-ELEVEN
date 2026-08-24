/**
 * คำสั่งที่แอดมินยิงตรงไปที่เซิร์ฟเวอร์ (นอกเหนือจากการตั้งค่าใน config/)
 *
 * ตอนนี้มีเรื่องเดียว: เขียนทับดาวในตารางอันดับของทุกคนให้เป็น 0 ทันที
 *
 * ทำไมแตะ profiles ได้แต่ accounts ไม่ได้:
 *   profiles = ข้อมูลสาธารณะ (ชื่อทีม/ค่าพลัง/ดาว) ไม่มีของมีค่าอยู่ในนั้น
 *   accounts = เซฟทั้งก้อน (เหรียญ, คลังการ์ด) — ปลดล็อกให้ใครเขียนของคนอื่นได้ถือว่าเสี่ยงเกิน
 * ตารางอันดับจึงกลายเป็นศูนย์ทันทีทั้งกระดาน ส่วนดาวในบัญชีจริงของแต่ละคน
 * จะถูกล้างตอนเขาเปิดเกมครั้งถัดไป (ดู hooks/useLadderReset.ts)
 */
import { doc, writeBatch } from 'firebase/firestore';
import { COLLECTIONS, getFirebase } from '@/services/firebase/config';

/** Firestore เขียนได้สูงสุด 500 operation ต่อหนึ่ง batch — เผื่อไว้ที่ 400 */
const BATCH_LIMIT = 400;

/** ดาวใหม่ของแต่ละ uid ที่จะเขียนทับลงตารางอันดับ */
export interface ProfilePointsUpdate {
  uid: string;
  points: number;
}

/**
 * เขียนทับดาว + สถิติแพ้-ชนะในตารางอันดับของหลายบัญชีพร้อมกัน
 * คืนจำนวนแถวที่เขียนสำเร็จ
 */
export const resetProfilePoints = async (updates: ProfilePointsUpdate[]): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase || updates.length === 0) return 0;

  let written = 0;

  for (let start = 0; start < updates.length; start += BATCH_LIMIT) {
    const chunk = updates.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(firebase.db);

    chunk.forEach((update) => {
      batch.set(
        doc(firebase.db, COLLECTIONS.profiles, update.uid),
        { points: Math.max(0, Math.round(update.points)), wins: 0, draws: 0, losses: 0 },
        { merge: true },
      );
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
};
