/**
 * กล่องผลการแข่ง — ทางที่ผลแมตช์เดินทางไปหาผู้เล่นอีกฝั่ง
 *
 * ปัญหาที่แก้: ผู้เล่นสองคนไม่ได้ออนไลน์พร้อมกัน ตอน A ท้าทีมของ B
 * ระบบจำลองผลที่เครื่อง A แต่ B ก็ควรได้รู้ว่า "โดนบุกตอนไม่อยู่" และคะแนนต้องขยับด้วย
 *
 * วิธีทำ: A เขียนใบรายงานผลลง `matchInbox/{uid ของ B}/items/{id}`
 * พอ B เปิดเกมเมื่อไหร่ก็อ่านใบที่ค้างอยู่ อัปเดตสถิติตัวเอง แล้วลบใบทิ้ง
 * ไม่ต้องใช้ Cloud Functions (ซึ่งต้องอัปเป็นแพลนเสียเงิน) และไม่ต้องรอให้ใครออนไลน์
 *
 * สกอร์ในใบรายงานเขียนจาก "มุมของผู้รับ" มาแล้ว ฝั่งรับจึงเอาไปใช้ได้เลยไม่ต้องกลับด้าน
 * แต่ฝั่งรับจะคำนวณคะแนน/เหรียญของตัวเองเสมอ ไม่เชื่อตัวเลขรางวัลจากผู้ส่ง
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
import type { MatchEvent } from '@/types/match';

/** ชื่อ collection ของกล่องผลการแข่ง */
const INBOX = 'matchInbox';

/** อ่านทีละไม่เกินกี่ใบต่อรอบ (หายไปนานแล้วกลับมาก็ไม่ค้างทั้งหมดรวดเดียว) */
const INBOX_LIMIT = 20;

/** ใบรายงานผลหนึ่งใบ (มุมมองของผู้รับ) */
export interface MatchReportDoc {
  id: string;
  /** uid ของคนที่มาท้า */
  fromUid: string;
  fromTeamName: string;
  fromManagerName: string;
  /** ค่าพลังทีมของผู้มาท้า ณ ตอนแข่ง */
  fromTeamOvr: number;
  /** ค่าพลังทีมของผู้รับ ณ ตอนที่ถูกท้า */
  toTeamOvr: number;
  /** สกอร์ของ "ผู้รับ" */
  teamScore: number;
  /** สกอร์ของผู้มาท้า */
  opponentScore: number;
  /** ไทม์ไลน์ประตู กลับด้านมาให้แล้ว (side = 'team' คือฝั่งผู้รับ) */
  events: MatchEvent[];
  /** เวลาที่แข่ง (ISO) */
  playedAt: string;
}

/**
 * ส่งใบรายงานผลไปให้คู่แข่ง
 * ล้มเหลวก็ไม่เป็นไร — ฝั่งเราบันทึกผลของตัวเองไปแล้ว จึงแค่ log ไว้
 */
export const sendMatchReport = async (
  targetUid: string,
  report: MatchReportDoc,
): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  await setDoc(doc(firebase.db, INBOX, targetUid, 'items', report.id), {
    ...report,
    createdAt: serverTimestamp(),
  });
};

/**
 * เฝ้ากล่องผลการแข่งของตัวเอง
 * เรียก callback ทุกครั้งที่มีใบใหม่เข้ามา (รวมถึงตอนเปิดเกมครั้งแรก)
 */
export const watchMatchInbox = (
  uid: string,
  onReports: (reports: MatchReportDoc[]) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) return () => undefined;

  const pending = query(
    collection(firebase.db, INBOX, uid, 'items'),
    orderBy('createdAt'),
    fbLimit(INBOX_LIMIT),
  );

  return onSnapshot(
    pending,
    (snapshot) => {
      onReports(
        snapshot.docs.map((entry) => ({ ...(entry.data() as MatchReportDoc), id: entry.id })),
      );
    },
    (error) => console.error('[firebase] อ่านกล่องผลการแข่งไม่สำเร็จ', error),
  );
};

/** ลบใบที่บันทึกลงสถิติเรียบร้อยแล้ว (ลบทีละใบ จำนวนน้อยอยู่แล้ว) */
export const clearMatchReports = async (uid: string, ids: string[]): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase || ids.length === 0) return;

  await Promise.all(
    ids.map((id) => deleteDoc(doc(firebase.db, INBOX, uid, 'items', id))),
  );
};
