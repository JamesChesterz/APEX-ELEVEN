/**
 * โปรไฟล์สาธารณะของผู้เล่น — หัวใจของ "ความเป็นออนไลน์" ของเกมนี้
 *
 * ทุกบัญชีจะเขียนข้อมูลย่อ ๆ ของตัวเอง (ชื่อทีม, ค่าพลัง, คะแนน, สถิติ) ลง
 * collection `profiles` ซึ่งผู้เล่นทุกคนอ่านได้ ข้อมูลชุดนี้ถูกใช้สองอย่าง:
 *   1. ตารางอันดับ — เป็นอันดับของผู้เล่นจริงทั้งเซิร์ฟเวอร์ อัปเดตสด
 *   2. จับคู่แข่งขัน — สุ่มคู่จากทีมของผู้เล่นจริงที่ค่าพลังใกล้เคียงกัน
 *
 * ไม่มีข้อมูลลับอยู่ในนี้ (ไม่มีรหัสผ่าน ไม่มีคลังการ์ด) จึงเปิดให้อ่านได้ปลอดภัย
 */
import {
  collection,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from 'firebase/firestore';
import { COLLECTIONS, getFirebase } from '@/services/firebase/config';
import type { FormationId } from '@/types/team';

/**
 * ตัวจริงหนึ่งช่องที่เปิดให้คนอื่นดูได้
 * เก็บแค่ "ใครอยู่ช่องไหน + ตีบวกเท่าไหร่" ส่วนรายละเอียดนักเตะอ่านจาก data/players.ts
 * ของเครื่องคนดูเอง จึงไม่ต้องส่งข้อมูลก้อนใหญ่ข้ามเครื่อง
 */
export interface PublicSquadSlot {
  slotId: string;
  playerId: string;
  /** เลเวลการ์ด (1 = +0) */
  level: number;
}

/** ข้อมูลสาธารณะหนึ่งบัญชี */
export interface PublicProfile {
  uid: string;
  managerName: string;
  teamName: string;
  teamOvr: number;
  formationId: FormationId;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** ตัวจริงล่าสุดที่จัดไว้ (ว่าง = ยังไม่เคยประกาศ เช่นบัญชีที่เล่นก่อนมีระบบนี้) */
  squad: PublicSquadSlot[];
  /** เวลาอัปเดตล่าสุด (epoch ms) — ใช้ดูว่าใครยัง active */
  updatedAtMs: number;
}

/** ค่าที่ผู้เล่นส่งขึ้นไปประกาศตัวเอง */
export type ProfileUpdate = Omit<PublicProfile, 'uid' | 'updatedAtMs'>;

/** จำนวนอันดับสูงสุดที่ดึงมาแสดง (มากกว่านี้ตารางก็ยาวเกินอ่าน) */
export const LEADERBOARD_LIMIT = 100;

/** ประกาศ/อัปเดตโปรไฟล์สาธารณะของตัวเอง */
export const publishProfile = async (uid: string, update: ProfileUpdate): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  await setDoc(
    doc(firebase.db, COLLECTIONS.profiles, uid),
    { ...update, uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
};

/**
 * ติดตามตารางอันดับแบบเรียลไทม์ (เรียงตามคะแนนมาก → น้อย)
 * คืนฟังก์ชันสำหรับยกเลิกการติดตาม
 */
export const watchTopProfiles = (
  onChange: (profiles: PublicProfile[]) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange([]);
    return () => undefined;
  }

  const topPlayers = query(
    collection(firebase.db, COLLECTIONS.profiles),
    orderBy('points', 'desc'),
    fbLimit(LEADERBOARD_LIMIT),
  );

  return onSnapshot(
    topPlayers,
    (snapshot) => {
      const profiles = snapshot.docs.map((entry) => {
        const data = entry.data() as Partial<PublicProfile> & { updatedAt?: { toMillis?: () => number } };

        return {
          uid: entry.id,
          managerName: data.managerName ?? 'ผู้จัดการ',
          teamName: data.teamName ?? 'Unknown FC',
          teamOvr: data.teamOvr ?? 0,
          formationId: (data.formationId ?? '4-3-3') as FormationId,
          points: data.points ?? 0,
          wins: data.wins ?? 0,
          draws: data.draws ?? 0,
          losses: data.losses ?? 0,
          squad: Array.isArray(data.squad) ? data.squad.slice(0, 11) : [],
          updatedAtMs: data.updatedAt?.toMillis?.() ?? 0,
        } satisfies PublicProfile;
      });

      onChange(profiles);
    },
    (error) => {
      console.error('[firebase] ติดตามตารางอันดับไม่สำเร็จ', error);
      onError?.(error);
      onChange([]);
    },
  );
};
