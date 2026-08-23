/**
 * ระบบระดับผู้เล่น (Rank) — คิดจากคะแนน ranking สะสมของซีซัน
 *
 * 5 ระดับ: BRONZE → GOLD → PLATINUM → LEGEND → CHAMPION
 * อยากปรับความยาก แก้แค่ minPoints ในตารางนี้ที่เดียว
 *
 * แยกจาก "ฉายาอันดับ 1" (1ST CHAMPION) ซึ่งไม่ได้ขึ้นกับคะแนน
 * แต่ขึ้นกับว่าใครอยู่หัวตารางตอนนี้ — มีได้คนเดียวเท่านั้น
 */

export type RankTierId = 'bronze' | 'gold' | 'platinum' | 'legend' | 'champion';

export interface RankTier {
  id: RankTierId;
  /** ชื่อที่แสดงบนป้าย */
  label: string;
  /** คะแนนขั้นต่ำที่ต้องมีเพื่อเข้าระดับนี้ */
  minPoints: number;
  /** สีหลักของป้าย (ใช้เป็น inline style เพราะเป็นค่าจากข้อมูล ไม่ใช่คลาสคงที่) */
  color: string;
  /** สีรอง ใช้ไล่เฉดบนป้าย */
  accent: string;
  /** คำอธิบายสั้น ๆ ใช้ในหน้าโปรไฟล์ */
  description: string;
}

/** เรียงจากระดับต่ำสุดไปสูงสุดเสมอ — โค้ดด้านล่างพึ่งลำดับนี้ */
export const RANK_TIERS: RankTier[] = [
  {
    id: 'bronze',
    label: 'BRONZE',
    minPoints: 0,
    color: '#C8823C',
    accent: '#F0BE8A',
    description: 'ระดับเริ่มต้นของผู้จัดการทีมหน้าใหม่',
  },
  {
    id: 'gold',
    label: 'GOLD',
    minPoints: 300,
    color: '#F5B93E',
    accent: '#FFE7A8',
    description: 'เริ่มมีชื่อในวงการ ชนะสม่ำเสมอแล้ว',
  },
  {
    id: 'platinum',
    label: 'PLATINUM',
    minPoints: 800,
    color: '#7FD8E8',
    accent: '#D6F6FC',
    description: 'ทีมระดับหัวตาราง คู่แข่งเริ่มกลัว',
  },
  {
    id: 'legend',
    label: 'LEGEND',
    minPoints: 1500,
    color: '#A46BF5',
    accent: '#E4CEFF',
    description: 'ตำนานประจำซีซัน มีไม่กี่ทีมที่ไปถึง',
  },
  {
    id: 'champion',
    label: 'CHAMPION',
    minPoints: 2500,
    color: '#F5C445',
    accent: '#FFF6D0',
    description: 'ระดับสูงสุดของเกม สงวนไว้ให้ผู้จัดการทีมที่แกร่งที่สุด',
  },
];

/** ฉายาของผู้เล่นอันดับ 1 ในตารางอันดับ — สีทองพิเศษ มีได้คนเดียว */
export const CHAMPION_TITLE = {
  label: '1ST CHAMPION',
  color: '#F5C445',
  accent: '#FFF3C4',
} as const;

/** ระดับปัจจุบันจากคะแนนสะสม */
export const getRankTier = (points: number): RankTier => {
  // ไล่จากระดับสูงสุดลงมา เจอตัวแรกที่คะแนนถึงก็คือระดับปัจจุบัน
  for (let index = RANK_TIERS.length - 1; index >= 0; index -= 1) {
    if (points >= RANK_TIERS[index].minPoints) return RANK_TIERS[index];
  }
  return RANK_TIERS[0];
};

export interface RankProgress {
  tier: RankTier;
  /** ระดับถัดไป — null เมื่ออยู่ระดับสูงสุดแล้ว */
  next: RankTier | null;
  /** คะแนนที่ยังขาดอยู่เพื่อเลื่อนขั้น (0 เมื่อเต็มขั้นแล้ว) */
  remaining: number;
  /** ความคืบหน้าในระดับนี้ 0–100 (%) */
  percent: number;
}

/** ความคืบหน้าไปสู่ระดับถัดไป ใช้วาดหลอดในหน้าโปรไฟล์/Header */
export const getRankProgress = (points: number): RankProgress => {
  const tier = getRankTier(points);
  const tierIndex = RANK_TIERS.findIndex((entry) => entry.id === tier.id);
  const next = RANK_TIERS[tierIndex + 1] ?? null;

  if (!next) return { tier, next: null, remaining: 0, percent: 100 };

  const span = next.minPoints - tier.minPoints;
  const gained = points - tier.minPoints;

  return {
    tier,
    next,
    remaining: Math.max(0, next.minPoints - points),
    percent: Math.min(100, Math.max(0, (gained / span) * 100)),
  };
};
