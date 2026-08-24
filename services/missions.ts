/**
 * ภารกิจประจำวัน — สร้างจากตัวนับรายวันจริง ไม่ใช่ข้อมูลตายตัว
 * ทำครบทุกข้อแล้วกดรับได้ 1 ครั้งต่อวัน (ได้เหรียญรวม + แต้มตีบวก)
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { MISSION_CLEAR_POINTS } from '@/services/upgradePoints';
import type { UpgradeDaily } from '@/types/account';
import type { Mission } from '@/types/match';

/** แต้มตีบวกที่ได้เมื่อเคลียร์ครบทุกภารกิจ */
export const MISSION_ALL_REWARD = MISSION_CLEAR_POINTS;

/** ภารกิจของวันนี้ พร้อมความคืบหน้าที่คิดจากตัวนับจริง */
export const buildDailyMissions = (daily: UpgradeDaily): Mission[] => [
  {
    id: 'm-play',
    title: 'ลงแข่ง 3 นัด',
    description: 'ลงแข่งนัดไหนก็ได้ (Matchmaking หรือลีกประจำวัน) รวม 3 นัด',
    progress: Math.min(daily.matchesPlayed, 3),
    goal: 3,
    rewardCoins: 300,
    type: 'daily',
  },
  {
    id: 'm-win',
    title: 'ชนะ 3 นัด',
    description: 'เก็บชัยชนะให้ครบ 3 นัดภายในวันแข่งนี้',
    progress: Math.min(daily.wins, 3),
    goal: 3,
    rewardCoins: 800,
    type: 'daily',
  },
  {
    id: 'm-upset',
    title: 'ชนะทีมที่ OVR สูงกว่า',
    description: 'เอาชนะคู่แข่งที่มีค่าพลังทีมสูงกว่าทีมของคุณ 1 นัด',
    progress: Math.min(daily.winsOverStronger, 1),
    goal: 1,
    rewardCoins: 1_200,
    type: 'daily',
  },
  {
    id: 'm-pack',
    title: 'เปิดซองการ์ด 3 ซอง',
    description: 'เปิดซองการ์ดแบบไหนก็ได้รวม 3 ซองในวันนี้',
    progress: Math.min(daily.packsOpened, 3),
    goal: 3,
    rewardCoins: 2_500,
    type: 'daily',
  },
];

/** ทำครบทุกข้อแล้วหรือยัง */
export const allMissionsDone = (missions: Mission[]): boolean =>
  missions.every((mission) => mission.progress >= mission.goal);

/** เหรียญรวมของทุกภารกิจ (จ่ายพร้อมกันตอนกดรับ) */
export const missionCoinTotal = (missions: Mission[]): number =>
  missions.reduce((total, mission) => total + mission.rewardCoins, 0);
