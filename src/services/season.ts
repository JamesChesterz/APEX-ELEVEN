/**
 * ระบบซีซัน: แข่งเป็นรอบ ๆ จบแล้วแจกรางวัลตามระดับที่ทำได้ แล้วรีเซ็ตขึ้นซีซันใหม่
 *
 * ทำไมต้องมี: เดิมคะแนนไต่ขึ้นอย่างเดียวไม่มีวันจบ พอถึง CHAMPION แล้วไม่มีอะไรทำต่อ
 * และฉายา 1ST CHAMPION ก็ค้างอยู่กับคนเดิมตลอดกาล
 *
 * รีเซ็ตแบบ "soft reset": เก็บคะแนนไว้ส่วนหนึ่ง คนที่เล่นเก่งจึงไม่ต้องเริ่มจากศูนย์ทุกครั้ง
 * แต่ก็ไม่ห่างจากผู้เล่นใหม่จนไล่ไม่ทัน
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getRankTier, type RankTier, type RankTierId } from '@/services/rank';
import type { SeasonState } from '@/types/account';
import type { RankRecord } from '@/types/match';

/** ความยาวของหนึ่งซีซัน (วัน) */
export const SEASON_DAYS = 14;

/** สัดส่วนคะแนนที่ถูกยกไปซีซันใหม่ (0.3 = เก็บไว้ 30%) */
export const CARRY_OVER = 0.3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** รางวัลปลายซีซันของแต่ละระดับ */
interface SeasonReward {
  coins: number;
  points: number;
}

const TIER_REWARD: Record<RankTierId, SeasonReward> = {
  bronze: { coins: 100_000, points: 500 },
  gold: { coins: 400_000, points: 2_000 },
  platinum: { coins: 900_000, points: 5_000 },
  legend: { coins: 1_800_000, points: 12_000 },
  champion: { coins: 3_000_000, points: 25_000 },
};

/** โบนัสพิเศษของผู้ที่จบซีซันในอันดับ 1 (เจ้าของฉายา 1ST CHAMPION) */
export const CHAMPION_BONUS: SeasonReward = { coins: 1_000_000, points: 10_000 };

/** สถานะซีซันเริ่มต้นของบัญชีใหม่ */
export const createSeasonState = (startedAt = new Date().toISOString()): SeasonState => ({
  number: 1,
  startedAt,
});

/** เวลาที่ซีซันนี้จะจบ */
export const getSeasonEnd = (season: SeasonState): Date =>
  new Date(new Date(season.startedAt).getTime() + SEASON_DAYS * DAY_MS);

/** จำนวนวันที่เหลือ (ปัดขึ้น, ไม่ต่ำกว่า 0) */
export const getDaysLeft = (season: SeasonState, now = new Date()): number =>
  Math.max(0, Math.ceil((getSeasonEnd(season).getTime() - now.getTime()) / DAY_MS));

/** ซีซันนี้หมดเวลาแล้วหรือยัง */
export const isSeasonOver = (season: SeasonState, now = new Date()): boolean =>
  now.getTime() >= getSeasonEnd(season).getTime();

/** สรุปผลปลายซีซันหนึ่งรอบ ใช้แสดงในหน้าต่างรับรางวัล */
export interface SeasonSummary {
  /** เลขซีซันที่เพิ่งจบ */
  number: number;
  tier: RankTier;
  /** อันดับสุดท้ายในตาราง */
  rank: number;
  /** true = จบซีซันในอันดับ 1 */
  wasChampion: boolean;
  record: RankRecord;
  reward: SeasonReward;
  /** สถิติชุดใหม่ที่จะใช้เริ่มซีซันถัดไป */
  nextRecord: RankRecord;
}

/**
 * สรุปผลและคำนวณรางวัลของซีซันที่จบไป
 * สถิติแพ้-ชนะเริ่มนับใหม่ ส่วนคะแนนยกมาบางส่วนตาม CARRY_OVER
 */
export const buildSeasonSummary = (
  season: SeasonState,
  record: RankRecord,
  rank: number,
): SeasonSummary => {
  const tier = getRankTier(record.points);
  const base = TIER_REWARD[tier.id];
  const wasChampion = rank === 1;

  return {
    number: season.number,
    tier,
    rank,
    wasChampion,
    record,
    reward: {
      coins: base.coins + (wasChampion ? CHAMPION_BONUS.coins : 0),
      points: base.points + (wasChampion ? CHAMPION_BONUS.points : 0),
    },
    nextRecord: {
      points: Math.round(record.points * CARRY_OVER),
      wins: 0,
      draws: 0,
      losses: 0,
    },
  };
};

/** สถานะซีซันถัดไป (เริ่มนับเวลาใหม่จากตอนกดรับรางวัล) */
export const nextSeason = (season: SeasonState): SeasonState => ({
  number: season.number + 1,
  startedAt: new Date().toISOString(),
});
