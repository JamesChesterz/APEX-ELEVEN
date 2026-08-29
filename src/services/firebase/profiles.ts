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
  onSnapshot,
  getCountFromServer,
  getDoc,
  limit as fbLimit,
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
  /** แต้มพาส (XP) สะสมของซีซันปัจจุบัน — ใช้ทำตารางอันดับ XP ในหน้า Pass */
  passXp: number;
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
/*
 * จำนวนโปรไฟล์ที่ติดตามเพื่อทำตารางอันดับ
 *
 * ตัวเลขนี้คือค่าอ่านที่จ่ายตอนเปิดเกมครั้งแรก (ครั้งเดียว) หลังจากนั้นจ่ายเพิ่ม
 * เฉพาะเอกสารที่เปลี่ยนจริง ยิ่งตั้งน้อยยิ่งประหยัดทั้งตอนเปิดและตอนมีคนขยับ
 *
 * ตารางแสดงหน้าละ 20 และแทบไม่มีใครเลื่อนไปดูอันดับลึก ๆ
 */
export const LEADERBOARD_LIMIT = 60;

/**
 * เพดานค่าพลังทีมที่ firestore.rules ยอมรับ
 *
 * ต้องสูงกว่าค่าที่ผู้เล่นทำได้จริงเสมอ ไม่งั้นทีมที่แกร่งเกินเพดานจะเขียนโปรไฟล์
 * ไม่ผ่าน แล้วค้างอยู่กับข้อมูลเก่าแบบเงียบ ๆ (คนอื่นกดดูทีมก็เห็นของเก่า)
 *
 * ค่านี้ต้องตรงกับตัวเลขใน firestore.rules — มีเทสคุมไว้ว่าค่าที่ทำได้จริงห้ามเกิน
 */
export const PROFILE_TEAM_OVR_CAP = 200;

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
/** แปลงเอกสารหนึ่งใบให้เป็นโปรไฟล์ที่เกมใช้ได้ */
const toProfile = (
  id: string,
  data: Partial<PublicProfile> & { updatedAt?: { toMillis?: () => number } },
): PublicProfile => ({
  uid: id,
  managerName: data.managerName ?? 'ผู้จัดการ',
  teamName: data.teamName ?? 'Unknown FC',
  teamOvr: data.teamOvr ?? 0,
  formationId: (data.formationId ?? '4-3-3') as FormationId,
  points: data.points ?? 0,
  passXp: data.passXp ?? 0,
  wins: data.wins ?? 0,
  draws: data.draws ?? 0,
  losses: data.losses ?? 0,
  squad: Array.isArray(data.squad) ? data.squad.slice(0, 11) : [],
  // ตรวจความปลอดภัยตอนเอาไปแสดงจริง (components/profile/Avatar.tsx)
  avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
  updatedAtMs: data.updatedAt?.toMillis?.() ?? 0,
});

/**
 * นับจำนวนบัญชีที่มีโปรไฟล์อยู่บนเซิร์ฟเวอร์ทั้งหมด
 *
 * ใช้คำสั่งนับของ Firestore ที่ไม่ต้องโหลดเอกสารจริง — คิดค่าอ่านแค่
 * 1 ครั้งต่อทุก 1,000 เอกสาร (ผู้เล่นหลักร้อย = 1 การอ่าน) จึงเรียกได้สบาย
 *
 * ต่างจาก LEADERBOARD_LIMIT ที่จำกัดไว้ 120 เพื่อประหยัดค่าอ่าน —
 * ตัวเลขนี้คือจำนวนจริงทั้งหมด ไม่ตันที่ 120
 */
export const countProfiles = async (): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase) return 0;

  const snapshot = await getCountFromServer(collection(firebase.db, COLLECTIONS.profiles));
  return snapshot.data().count;
};

/**
 * ดึงโปรไฟล์ของคนเดียวแบบสด ๆ
 *
 * ใช้ตอนกดเปิดดูทีมของใครสักคน — ตารางอันดับดึงเป็นรอบทุกไม่กี่นาที
 * ข้อมูลในมือจึงอาจเก่าไปนิด แต่จังหวะที่คนอยากเห็นของสดที่สุดคือตอนกดดู
 *
 * ราคาแค่ 1 การอ่านต่อการกดหนึ่งครั้ง (เทียบกับทั้งตารางที่ดึงทีละร้อยกว่าใบ)
 * จึงเปิดให้สดตรงนี้ได้โดยแทบไม่กระทบโควตา
 */
export const fetchProfile = async (uid: string): Promise<PublicProfile | null> => {
  const firebase = getFirebase();
  if (!firebase) return null;

  const snapshot = await getDoc(doc(firebase.db, COLLECTIONS.profiles, uid));
  if (!snapshot.exists()) return null;

  return toProfile(snapshot.id, snapshot.data());
};

/**
 * ติดตามตารางอันดับแบบเรียลไทม์
 *
 * ⚠️ เรื่องค่าอ่านที่เคยเข้าใจผิด:
 *   onSnapshot คิดค่าอ่าน LEADERBOARD_LIMIT ครั้ง "ตอนเริ่มติดตาม" เท่านั้น
 *   หลังจากนั้นจ่ายเพิ่มเฉพาะเอกสารที่เปลี่ยนจริง — ไม่มีใครขยับก็ไม่เสียอะไรเลย
 *
 *   เคยเปลี่ยนไปดึงเป็นรอบทุก 3 นาทีเพื่อ "ประหยัด" ซึ่งแย่กว่ามาก
 *   เพราะจ่ายเต็มจำนวนทุกรอบไม่ว่าจะมีอะไรเปลี่ยนหรือไม่ (2,400 ครั้ง/ชม./คน)
 *
 *   ของเดิมที่เปลืองคือ limit 500 + ทุกคนเขียนโปรไฟล์ถี่ ไม่ใช่ตัว onSnapshot
 *   ตอนนี้ลด limit เหลือ 60 และหน่วงการเขียนเป็น 15 วินาทีแล้ว
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
    (snapshot) => onChange(snapshot.docs.map((entry) => toProfile(entry.id, entry.data()))),
    (error) => {
      console.error('[firebase] ติดตามตารางอันดับไม่สำเร็จ', error);
      onError?.(error);
    },
  );
};
