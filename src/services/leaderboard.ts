/**
 * ประกอบตารางอันดับจากคะแนน ranking ปัจจุบันของผู้เล่น
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { botTickAt, buildBotEntries, BOT_TABLE_ROWS } from '@/services/bots';
import type { LeaderboardEntry, RankRecord } from '@/types/match';

/**
 * รวมแถวของผู้เล่น (คะแนนสด) เข้ากับทีมอื่นในตาราง แล้วเรียงอันดับใหม่
 * ชนะแล้วอันดับขยับขึ้นทันทีโดยไม่ต้องแก้ mock data
 *
 * `rivals` คือผู้เล่นจริงจากเซิร์ฟเวอร์ (โหมดออนไลน์) — ไม่ส่งมาก็มีแต่ทีมจำลอง
 * อันดับ 1 ของผลลัพธ์นี้คือผู้ที่ได้ฉายา 1ST CHAMPION (ดู components/rank/RankBadge)
 *
 * แถวที่เหลือเติมด้วยทีมจำลองที่ค่าพลังและคะแนนขยับเองตามเวลา (services/bots.ts)
 * เซิร์ฟเวอร์ที่เพิ่งเปิดจึงไม่ดูร้าง และทีมจำลองจะถูกผู้เล่นจริงเบียดออกไปเอง
 * เมื่อคนเยอะขึ้น เพราะโควตาแถวของบอท = BOT_TABLE_ROWS − จำนวนคนจริง
 *
 * `tick` คือนาฬิกาของโลกบอท (ดู botTickAt) — ส่งเข้ามาเพื่อให้ผลคงที่ในเทส
 */
export const buildLeaderboard = (
  record: RankRecord,
  teamName: string,
  teamOvr: number,
  managerName = 'คุณผู้จัดการ',
  rivals?: LeaderboardEntry[],
  tick: number = botTickAt(),
): LeaderboardEntry[] => {
  const humans = rivals ?? [];

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

  // เพดานคะแนนของบอทอิงคนที่เก่งที่สุดในตาราง บอทจึงไม่มีวันแซงอันดับ 1 ของคนจริง
  const anchor = [...humans, me].reduce((max, entry) => Math.max(max, entry.points), 0);
  const bots = buildBotEntries(anchor, BOT_TABLE_ROWS - humans.length - 1, tick);

  return [...humans, ...bots, me]
    .sort((a, b) => b.points - a.points || b.teamOvr - a.teamOvr)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};
