/**
 * คำสั่งที่แอดมินยิงตรงไปที่เซิร์ฟเวอร์ (นอกเหนือจากการตั้งค่าใน config/)
 *
 * มีสองเรื่อง: รีเซ็ตดาวทั้งกระดาน และส่อง/แก้บัญชีของผู้เล่นรายคน
 *
 * ทำไมแตะ profiles ได้แต่ accounts ไม่ได้:
 *   profiles = ข้อมูลสาธารณะ (ชื่อทีม/ค่าพลัง/ดาว) ไม่มีของมีค่าอยู่ในนั้น
 *   accounts = เซฟทั้งก้อน (เหรียญ, คลังการ์ด) — ปลดล็อกให้ใครเขียนของคนอื่นได้ถือว่าเสี่ยงเกิน
 * ตารางอันดับจึงกลายเป็นศูนย์ทันทีทั้งกระดาน ส่วนดาวในบัญชีจริงของแต่ละคน
 * จะถูกล้างตอนเขาเปิดเกมครั้งถัดไป (ดู hooks/useLadderReset.ts)
 */
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { COLLECTIONS, getFirebase } from '@/services/firebase/config';
import type { AccountState } from '@/types/account';
import type { RankRecord } from '@/types/match';

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

/* ── ส่องบัญชีผู้เล่น ──────────────────────────────────────── */

/** สิ่งที่แอดมินเห็นเมื่อเปิดดูบัญชีคนหนึ่ง */
export interface AdminAccountView {
  uid: string;
  username?: string;
  managerName?: string;
  teamName?: string;
  createdAt?: string;
  state?: AccountState;
}

/**
 * อ่านบัญชีของผู้เล่นคนหนึ่ง (เฉพาะเจ้าของโปรเจค)
 * กฎอนุญาตให้เจ้าของโปรเจคอ่านทุกบัญชี — ดู firestore.rules
 */
export const readAccountForAdmin = async (uid: string): Promise<AdminAccountView | null> => {
  const firebase = getFirebase();
  if (!firebase) return null;

  const snapshot = await getDoc(doc(firebase.db, COLLECTIONS.accounts, uid));
  if (!snapshot.exists()) return null;

  return { uid, ...(snapshot.data() as Omit<AdminAccountView, 'uid'>) };
};

/**
 * ตั้งดาวและสถิติแพ้-ชนะของผู้เล่นคนหนึ่งตรง ๆ
 *
 * เขียนสองที่พร้อมกัน: บัญชีจริง (ค่าที่เกมใช้) และโปรไฟล์ (ค่าที่ตารางอันดับอ่าน)
 * ถ้าเขียนที่เดียวจะกลายเป็นเลขสองชุดไม่ตรงกัน แล้วเด้งกลับตอนเจ้าตัวเปิดเกม
 */
export const setPlayerRecord = async (uid: string, record: RankRecord): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const safe: RankRecord = {
    points: Math.max(0, Math.round(record.points)),
    wins: Math.max(0, Math.round(record.wins)),
    draws: Math.max(0, Math.round(record.draws)),
    losses: Math.max(0, Math.round(record.losses)),
  };

  await Promise.all([
    updateDoc(doc(firebase.db, COLLECTIONS.accounts, uid), { 'state.record': safe }),
    setDoc(doc(firebase.db, COLLECTIONS.profiles, uid), { ...safe }, { merge: true }),
  ]);
};
