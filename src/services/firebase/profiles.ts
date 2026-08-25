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

// นิยามย้ายไปอยู่ที่ types/profile.ts เพื่อให้ฝั่งเซิร์ฟเวอร์ใช้ร่วมได้
// (re-export ไว้เพื่อไม่ให้ไฟล์ที่ import จากที่นี่อยู่แล้วต้องแก้ตาม)
export type { PublicSquadSlot } from '@/types/profile';

import type { PublicSquadSlot } from '@/types/profile';

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
  /** รูปโปรไฟล์ (data URL ที่ย่อแล้ว) — ไม่มีก็แสดงตัวอักษรแรกของชื่อแทน */
  avatar?: string;
  /** เวลาอัปเดตล่าสุด (epoch ms) — ใช้ดูว่าใครยัง active */
  updatedAtMs: number;
}

/** ค่าที่ผู้เล่นส่งขึ้นไปประกาศตัวเอง */
export type ProfileUpdate = Omit<PublicProfile, 'uid' | 'updatedAtMs'>;

/**
 * เพดานจำนวนโปรไฟล์ที่ดึงมา — ตั้งใจให้สูงพอครอบคลุม "ทุกคนที่สมัครเข้ามา"
 * ไม่ใช่แค่ 100 อันดับแรก ตารางฝั่งหน้าเว็บแบ่งหน้าให้อ่านง่ายอยู่แล้ว
 *
 * ยังต้องมีเพดานอยู่ เพราะทุกโปรไฟล์ถูกโหลดมาทั้งก้อน (รวมรูปโปรไฟล์) ทุกครั้งที่เปิดเกม
 * ถ้าวันหนึ่งเซิร์ฟเวอร์มีผู้เล่นเกินตัวเลขนี้จริง ต้องเปลี่ยนไปดึงทีละหน้าจากเซิร์ฟเวอร์
 * (query แบบ startAfter) แทนการโหลดมาทั้งหมดแล้วแบ่งหน้าที่หน้าเว็บ
 */
export const LEADERBOARD_LIMIT = 500;

/** ประกาศ/อัปเดตโปรไฟล์สาธารณะของตัวเอง */
export const publishProfile = async (uid: string, update: ProfileUpdate): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  await setDoc(
    doc(firebase.db, COLLECTIONS.profiles, uid),
    {
      ...update,
      uid,
      updatedAt: serverTimestamp(),
      /*
       * เวลาที่ดาวขยับล่าสุด — ประทับจากนาฬิกาเซิร์ฟเวอร์ ไม่ใช่จากเครื่องผู้เล่น
       * กฎใน firestore.rules ใช้ค่านี้จำกัดว่าดาวโตได้เร็วแค่ไหน
       * (ดูหัวข้อ "เพดานอัตราการโตของดาว" ในไฟล์นั้น) แก้ค่านี้เองไม่ได้
       * เพราะกฎบังคับว่าต้องเท่ากับเวลาที่เซิร์ฟเวอร์รับคำขอเสมอ
       */
      pointsUpdatedAt: serverTimestamp(),
    },
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
          // ตรวจความปลอดภัยตอนเอาไปแสดงจริง (components/profile/Avatar.tsx)
          avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
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
