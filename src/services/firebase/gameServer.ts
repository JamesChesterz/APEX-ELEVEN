/**
 * เรียกกติกาที่อยู่ฝั่งเซิร์ฟเวอร์ (Cloud Functions)
 *
 * ผลแมตช์และดาวถูกตัดสินที่เซิร์ฟเวอร์ทั้งหมด หน้าเว็บทำได้แค่ "ขอลงแข่ง"
 * แล้วเอาผลที่ได้กลับมาเล่นเทปถ่ายทอดสด — ตัวเลขที่หน้าเว็บส่งไปไม่มีผลกับแพ้ชนะเลย
 *
 * เปิด/ปิดด้วย VITE_SERVER_AUTHORITY (ดู .env.example)
 * ปิดอยู่ = ใช้ระบบเดิมที่คิดผลในเครื่อง ทำให้ deploy หน้าเว็บก่อน แล้วค่อยเปิดทีหลังได้
 * โดยเกมไม่สะดุดระหว่างทาง
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/services/firebase/config';
import type { DailySummary } from '@/services/league';
import type { LeagueState } from '@/types/account';
import type { MatchResult, RankRecord } from '@/types/match';

/** ภูมิภาคของฟังก์ชัน ต้องตรงกับ setGlobalOptions ใน functions/src/index.ts */
const REGION = 'asia-southeast1';

/**
 * true = ให้เซิร์ฟเวอร์เป็นคนตัดสินผลและแจกดาว
 * ต้อง deploy functions ให้เรียบร้อยก่อนถึงจะเปิดได้ ไม่งั้นลงแข่งไม่ได้เลย
 */
export const SERVER_AUTHORITY =
  String(import.meta.env.VITE_SERVER_AUTHORITY ?? '').trim() === '1';

/** ผลที่เซิร์ฟเวอร์ส่งกลับมาหลังแข่งหนึ่งนัด */
export interface PlayMatchResponse {
  result: MatchResult;
  record: RankRecord;
  teamOvr: number;
}

/** ผลที่เซิร์ฟเวอร์ส่งกลับมาหลังเดินรอบลีก */
export interface SyncLeagueResponse {
  /** true = ยังไม่ได้เข้าร่วมลีก ไม่มีอะไรให้คิด */
  skipped?: boolean;
  league?: LeagueState;
  /** สรุปยอดของเมื่อวาน (มีค่าเฉพาะตอนเพิ่งข้ามวัน) */
  summary?: DailySummary | null;
  matches?: MatchResult[];
  record?: RankRecord;
  /** เหรียญที่ได้จากรอบที่เพิ่งคิด — หน้าเว็บเป็นคนบวกเข้ากระเป๋าเอง */
  coinsEarned?: number;
}

/** แปลง error จากฟังก์ชันให้เป็นข้อความไทยที่ผู้เล่นอ่านรู้เรื่อง */
export const serverErrorMessage = (error: unknown): string => {
  const message = (error as { message?: string })?.message ?? '';
  if (message) return message;
  return 'ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง';
};

const call = <Request, Response>(name: string) => {
  return async (payload: Request): Promise<Response> => {
    const firebase = getFirebase();
    if (!firebase) throw new Error('ยังไม่ได้ตั้งค่า Firebase');

    const fn = httpsCallable<Request, Response>(getFunctions(firebase.app, REGION), name);
    const response = await fn(payload);
    return response.data;
  };
};

/** ขอลงแข่งหนึ่งนัดกับผู้เล่นคนหนึ่ง */
export const callPlayMatch = call<{ opponentUid: string }, PlayMatchResponse>('playMatch');

/** ขอให้เซิร์ฟเวอร์เดินรอบลีกที่ค้างอยู่ */
export const callSyncLeague = call<Record<string, never>, SyncLeagueResponse>('syncLeague');

/** เข้าร่วม/ออกจากลีก */
export const callSetLeagueJoined = call<{ joined: boolean }, { league: LeagueState }>(
  'setLeagueJoined',
);
