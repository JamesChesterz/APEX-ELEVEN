/**
 * "แต้มตีบวก" — สกุลเงินที่ใช้ตีบวกนักเตะเท่านั้น (คนละกองกับแต้มแลกนักเตะ)
 *
 * หาได้ 3 ทาง:
 *   1. จบลีกประจำวัน — อันดับ 1–5 ได้ 8,000 → 4,000 ส่วนอันดับอื่นได้ 2,000 ทุกคน
 *      (ตารางรางวัลอยู่ใน services/league.ts → getLeagueUpgradePoints)
 *   2. ทำภารกิจประจำวันครบทุกข้อ — 500
 *   3. ชนะ Matchmaking — นัดละ 20 แต้ม นับได้สูงสุด 30 นัดต่อวัน
 *
 * ตัวนับรายวันใช้ "วันแข่ง" ชุดเดียวกับลีก (เริ่ม 06:00) เพื่อให้รีเซ็ตพร้อมกัน
 *
 * ทั้งไฟล์เป็น pure function ห้าม import React หรือแตะ state
 */
import { getDayKey, getDayStart } from '@/services/league';
import type { UpgradeDaily } from '@/types/account';

/** แต้มตีบวกที่ได้ต่อการชนะ Matchmaking 1 นัด */
export const MATCH_WIN_POINTS = 20;

/** ชนะแล้วได้แต้มสูงสุดกี่นัดต่อวัน */
export const MATCH_WIN_DAILY_LIMIT = 30;

/** ทำภารกิจประจำวันครบทุกข้อได้เท่าไร */
export const MISSION_CLEAR_POINTS = 500;

/** กุญแจของวันแข่งปัจจุบัน (เปลี่ยนตอน 06:00) */
export const currentDayKey = (now = new Date()): string => getDayKey(getDayStart(now));

/** ตัวนับรายวันชุดใหม่ (ทุกค่าเริ่มจากศูนย์) */
export const createUpgradeDaily = (now = new Date()): UpgradeDaily => ({
  dayKey: currentDayKey(now),
  matchesPlayed: 0,
  wins: 0,
  winsOverStronger: 0,
  packsOpened: 0,
  rewardedWins: 0,
  missionsClaimed: false,
});

/**
 * ตัวนับของ "วันนี้" — ถ้าข้อมูลที่เก็บไว้เป็นของวันก่อน จะได้ชุดใหม่กลับไป
 * เรียกก่อนอ่านหรือเขียนตัวนับทุกครั้ง เพื่อให้รีเซ็ตเองโดยไม่ต้องมี timer
 */
export const rollDaily = (daily: UpgradeDaily | undefined, now = new Date()): UpgradeDaily => {
  const today = currentDayKey(now);
  return daily && daily.dayKey === today ? daily : createUpgradeDaily(now);
};

/** ชนะนัดนี้แล้วยังได้แต้มอยู่ไหม (ยังไม่ชนเพดาน 30 นัด) */
export const canEarnMatchPoints = (daily: UpgradeDaily): boolean =>
  daily.rewardedWins < MATCH_WIN_DAILY_LIMIT;

/** เหลือโควตารับแต้มจากการชนะอีกกี่นัดวันนี้ */
export const remainingMatchQuota = (daily: UpgradeDaily): number =>
  Math.max(0, MATCH_WIN_DAILY_LIMIT - daily.rewardedWins);
