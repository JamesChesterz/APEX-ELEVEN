/**
 * Mock data ฝั่งการแข่งขัน: ทีมคู่แข่ง, ตารางอันดับ และภารกิจ
 * (รวมไว้ไฟล์เดียวเพราะทั้งหมดเป็นข้อมูลรอบ ๆ ระบบ Match — แยกไฟล์ได้ภายหลังถ้าโตขึ้น)
 */
import type { LeaderboardEntry, Mission, Opponent } from '@/types/match';

export const OPPONENTS: Opponent[] = [
  {
    id: 'o001',
    name: 'Harbour Rovers',
    manager: 'T. Callahan',
    ovr: 74,
    formationId: '4-4-2',
    difficulty: 'easy',
    rewardCoins: 400,
  },
  {
    id: 'o002',
    name: 'Verde Motors',
    manager: 'R. Salgado',
    ovr: 79,
    formationId: '4-2-3-1',
    difficulty: 'normal',
    rewardCoins: 750,
  },
  {
    id: 'o003',
    name: 'Kanda Blue',
    manager: 'H. Ishikawa',
    ovr: 82,
    formationId: '4-3-3',
    difficulty: 'normal',
    rewardCoins: 900,
  },
  {
    id: 'o004',
    name: 'Siam Thunder',
    manager: 'P. Wongchai',
    ovr: 85,
    formationId: '3-5-2',
    difficulty: 'hard',
    rewardCoins: 1400,
  },
  {
    id: 'o005',
    name: 'Nordvik Iron',
    manager: 'E. Lund',
    ovr: 88,
    formationId: '4-4-2',
    difficulty: 'hard',
    rewardCoins: 1800,
  },
  {
    id: 'o006',
    name: 'Alba Immortals',
    manager: 'G. Ricci',
    ovr: 92,
    formationId: '4-3-3',
    difficulty: 'elite',
    rewardCoins: 3000,
  },
];

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, managerName: 'G. Ricci', teamName: 'Alba Immortals', teamOvr: 92, points: 2680, wins: 96, draws: 14, losses: 11 },
  { rank: 2, managerName: 'E. Lund', teamName: 'Nordvik Iron', teamOvr: 88, points: 2140, wins: 82, draws: 12, losses: 18 },
  { rank: 3, managerName: 'P. Wongchai', teamName: 'Siam Thunder', teamOvr: 85, points: 1720, wins: 66, draws: 13, losses: 22 },
  { rank: 4, managerName: 'H. Ishikawa', teamName: 'Kanda Blue', teamOvr: 82, points: 1180, wins: 47, draws: 11, losses: 26 },
  { rank: 5, managerName: 'R. Salgado', teamName: 'Verde Motors', teamOvr: 79, points: 860, wins: 34, draws: 10, losses: 29 },
  { rank: 6, managerName: 'T. Callahan', teamName: 'Harbour Rovers', teamOvr: 74, points: 520, wins: 21, draws: 11, losses: 33 },
  { rank: 7, managerName: 'M. Deniz', teamName: 'Bosphorus SK', teamOvr: 73, points: 310, wins: 13, draws: 10, losses: 38 },
  { rank: 8, managerName: 'K. Adeyemi', teamName: 'Accra Falcons', teamOvr: 71, points: 140, wins: 6, draws: 8, losses: 41 },
];

export const MISSIONS: Mission[] = [
  {
    id: 'm001',
    title: 'ลงแข่ง 3 นัด',
    description: 'เล่นแมตช์ให้ครบ 3 นัดในวันนี้',
    progress: 1,
    goal: 3,
    rewardCoins: 300,
    type: 'daily',
  },
  {
    id: 'm002',
    title: 'ชนะทีมที่ OVR สูงกว่า',
    description: 'เอาชนะคู่แข่งที่มีค่าพลังทีมสูงกว่าทีมของคุณ 1 นัด',
    progress: 0,
    goal: 1,
    rewardCoins: 800,
    type: 'daily',
  },
  {
    id: 'm003',
    title: 'เปิดซองการ์ด 5 ซอง',
    description: 'เปิดซองการ์ดแบบไหนก็ได้รวม 5 ซองภายในสัปดาห์นี้',
    progress: 2,
    goal: 5,
    rewardCoins: 1200,
    type: 'weekly',
  },
  {
    id: 'm004',
    title: 'ดันทีมแตะ OVR 86',
    description: 'จัดทีมตัวจริงให้ค่าพลังรวมถึง 86',
    progress: 84,
    goal: 86,
    rewardCoins: 2500,
    type: 'season',
  },
];

export const getOpponentById = (id: string): Opponent | undefined =>
  OPPONENTS.find((opponent) => opponent.id === id);
