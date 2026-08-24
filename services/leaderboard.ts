/**
 * ประกอบตารางอันดับจากคะแนน ranking ปัจจุบันของผู้เล่น
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { LEADERBOARD } from '@/data/opponents';
import type { LeaderboardEntry, RankRecord } from '@/types/match';

/**
 * จำนวนแถวขั้นต่ำที่อยากให้ตารางมี
 * เซิร์ฟเวอร์ที่เพิ่งเปิดจะมีผู้เล่นจริงไม่กี่คน ถ้าโชว์แค่นั้นตารางจะโล่งจนดูพัง
 * จึงเติมทีมประจำระบบเข้าไปให้ครบ แล้วค่อย ๆ ถูกผู้เล่นจริงเบียดออกไปเองเมื่อคนเยอะขึ้น
 */
const MIN_ROWS = 12;

/**
 * รวมแถวของผู้เล่น (คะแนนสด) เข้ากับทีมอื่นในตาราง แล้วเรียงอันดับใหม่
 * ชนะแล้วอันดับขยับขึ้นทันทีโดยไม่ต้องแก้ mock data
 *
 * `rivals` คือผู้เล่นจริงจากเซิร์ฟเวอร์ (โหมดออนไลน์) — ไม่ส่งมาก็ใช้ mock data เหมือนเดิม
 * อันดับ 1 ของผลลัพธ์นี้คือผู้ที่ได้ฉายา 1ST CHAMPION (ดู components/rank/RankBadge)
 */
export const buildLeaderboard = (
  record: RankRecord,
  teamName: string,
  teamOvr: number,
  managerName = 'คุณผู้จัดการ',
  rivals?: LeaderboardEntry[],
): LeaderboardEntry[] => {
  const mock = LEADERBOARD.filter((entry) => !entry.isCurrentUser);

  // ออนไลน์: ใช้ผู้เล่นจริงก่อน แล้วเติมทีมระบบเฉพาะเมื่อแถวยังน้อยเกินไป
  const others = rivals
    ? [...rivals, ...mock.slice(0, Math.max(0, MIN_ROWS - rivals.length - 1))]
    : mock;

  const me: LeaderboardEntry = {
    rank: 0,
    managerName,
    teamName,
    teamOvr,
    points: record.points,
    wins: record.wins,
    draws: record.draws,
    losses: record.losses,
    isCurrentUser: true,
  };

  return [...others, me]
    .sort((a, b) => b.points - a.points || b.teamOvr - a.teamOvr)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};
