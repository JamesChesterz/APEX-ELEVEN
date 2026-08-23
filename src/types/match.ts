/**
 * โครงสร้างข้อมูลการแข่งขัน: คู่แข่ง, สถานะจับคู่, ผลการแข่ง, อันดับ และภารกิจ
 */
import type { FormationId } from './team';

/** ระดับความยากของคู่แข่ง */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'elite';

/**
 * สถานะของระบบ Matchmaking
 * idle → searching (หาคู่) → found (เจอคู่แล้ว รอกดเริ่ม) → playing (กำลังแข่ง) → finished (มีผล)
 */
export type MatchStatus = 'idle' | 'searching' | 'found' | 'playing' | 'finished';

/** ผลการแข่งจากมุมมองผู้เล่น */
export type MatchOutcome = 'win' | 'draw' | 'loss';

/** ทีมคู่แข่ง (ตอนนี้เป็น bot จาก mock data) */
export interface Opponent {
  id: string;
  name: string;
  manager: string;
  ovr: number;
  formationId: FormationId;
  difficulty: Difficulty;
  /** เหรียญที่ได้เมื่อชนะ */
  rewardCoins: number;
  /** true = บอทที่ระบบสุ่มสร้างขึ้นตอนหาคู่ (ไม่ได้อยู่ใน mock data) */
  isBot?: boolean;
}

/** โอกาสแพ้/เสมอ/ชนะที่คำนวณจากผลต่าง OVR (รวมกันได้ 1) */
export interface MatchOdds {
  win: number;
  draw: number;
  loss: number;
}

/** เหตุการณ์หนึ่งเหตุการณ์ในแมตช์ (ตอนนี้มีแค่ประตู เผื่อขยายเป็นใบเหลือง/เปลี่ยนตัวภายหลัง) */
export interface MatchEvent {
  /** นาทีที่เกิดเหตุการณ์ 1–90 */
  minute: number;
  /** ฝั่งที่ทำประตู */
  side: 'team' | 'opponent';
  /** ชื่อผู้ทำประตู (ฝั่งคู่แข่งเป็นชื่อสมมติ) */
  scorer: string;
  type: 'goal';
}

/** ผลการแข่งหนึ่งนัด */
export interface MatchResult {
  id: string;
  opponentId: string;
  teamScore: number;
  opponentScore: number;
  /** ชื่อคู่แข่ง เก็บติดผลไว้เลย เพราะบอทที่สุ่มมาไม่ได้อยู่ใน OPPONENTS */
  opponentName: string;
  opponentOvr: number;
  teamOvr: number;
  outcome: MatchOutcome;
  coinsEarned: number;
  /** คะแนน ranking ที่ได้/เสียจากนัดนี้ (ติดลบได้เมื่อแพ้) */
  rankingPoints: number;
  /** โอกาสชนะก่อนเริ่มแข่ง ใช้แสดงบนหน้าจอผลการแข่ง */
  odds: MatchOdds;
  /** ไทม์ไลน์ประตู เรียงตามนาที ใช้เล่นสดระหว่างแข่ง */
  events: MatchEvent[];
  /**
  * league    = ลีกประจำวัน
  * friendly  = แมตช์ที่เรากดหาคู่เอง
  * defense   = ถูกผู้เล่นคนอื่นท้า (ผลเข้ามาทางกล่องผลการแข่ง ไม่ว่าตอนนั้นจะออนไลน์อยู่หรือไม่)
  */
  mode?: 'league' | 'friendly' | 'defense';
  /** คะแนนลีกที่ได้จากนัดนี้ (3/1/0) — มีเฉพาะนัดในลีก */
  leaguePoints?: number;
  playedAt: string;
}

/** สถิติสะสมของผู้เล่นในซีซันนี้ */
export interface RankRecord {
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

/** สถานะรวมของหน้า Match */
export interface MatchState {
  status: MatchStatus;
  opponent: Opponent | null;
  result: MatchResult | null;
  /** โอกาสชนะของคู่ที่กำลังจะแข่ง (null เมื่อยังไม่มีคู่แข่ง) */
  odds: MatchOdds | null;
}

/** สถานะการถ่ายทอดสดระหว่างแข่ง (มีค่าเฉพาะตอน status = 'playing' หรือ 'finished') */
export interface LiveMatch {
  /** นาทีในเกมตอนนี้ 0–90 */
  minute: number;
  teamScore: number;
  opponentScore: number;
  /** เหตุการณ์ที่เกิดไปแล้ว ใหม่สุดอยู่บน */
  events: MatchEvent[];
}

/** หนึ่งแถวในตาราง Leaderboard */
export interface LeaderboardEntry {
  rank: number;
  managerName: string;
  teamName: string;
  teamOvr: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** true สำหรับแถวของผู้เล่นเอง เพื่อไฮไลต์ใน UI */
  isCurrentUser?: boolean;
}

/** ภารกิจ (Missions) */
export interface Mission {
  id: string;
  title: string;
  description: string;
  /** ความคืบหน้าปัจจุบัน */
  progress: number;
  /** เป้าหมายที่ต้องทำให้ครบ */
  goal: number;
  rewardCoins: number;
  type: 'daily' | 'weekly' | 'season';
}
