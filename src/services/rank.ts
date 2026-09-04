/**
 * ระบบระดับผู้เล่น (Rank) — คิดจากจำนวนดาว (⭐) สะสมของซีซัน
 * ดาวมาจากผลการแข่ง: ชนะ +1 · เสมอ 0 · แพ้ −1
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
  /** จำนวนดาวขั้นต่ำที่ต้องมีเพื่อเข้าระดับนี้ */
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
    minPoints: 10,
    color: '#F5B93E',
    accent: '#FFE7A8',
    description: 'ชนะสุทธิ 10 ดาว — เริ่มมีชื่อในวงการ',
  },
  {
    id: 'platinum',
    label: 'PLATINUM',
    minPoints: 25,
    color: '#7FD8E8',
    accent: '#D6F6FC',
    description: 'ชนะสุทธิ 25 ดาว — ทีมระดับหัวตาราง',
  },
  {
    id: 'legend',
    label: 'LEGEND',
    minPoints: 50,
    color: '#A46BF5',
    accent: '#E4CEFF',
    description: 'ชนะสุทธิ 50 ดาว — ตำนานประจำซีซัน',
  },
  {
    id: 'champion',
    label: 'CHAMPION',
    minPoints: 100,
    color: '#F5C445',
    accent: '#FFF6D0',
    description: 'ชนะสุทธิ 100 ดาว — ระดับสูงสุดของเกม',
  },
];

/** ฉายาประจำอันดับบนโพเดียม */
export interface ChampionTitle {
  label: string;
  /** สีหลักของป้าย */
  color: string;
  /** สีไฮไลต์ (หัวไล่เฉดของป้าย) */
  accent: string;
  /** สีตัวอักษร — ป้ายพื้นสว่าง ตัวอักษรจึงต้องเป็นสีเข้ม */
  ink: string;
}

/**
 * ฉายาของผู้เล่นสามอันดับแรกในตารางอันดับ
 *
 * ป้ายพวกนี้ "แทนที่" ป้ายระดับ (CHAMPION / LEGEND ฯลฯ) ในตารางอันดับ
 * ไม่ได้แสดงคู่กัน — สามอันดับแรกจึงมีป้ายเดียวที่บอกทั้งอันดับและความพิเศษ
 *
 * สีไล่ตามเหรียญ: ทอง → เงิน → ทองแดง ให้ตรงกับสีเลขอันดับใน LeaderboardTable
 */
export const CHAMPION_TITLES: Record<number, ChampionTitle> = {
  1: { label: '1ST CHAMPION', color: '#F5C445', accent: '#FFF3C4', ink: '#3A2A00' },
  2: { label: '2ND CHAMPION', color: '#C7CDD6', accent: '#F4F7FA', ink: '#23282E' },
  3: { label: '3RD CHAMPION', color: '#C88B4A', accent: '#F0CBA3', ink: '#33200C' },
};

/** ฉายาของอันดับนี้ (null = ไม่ได้อยู่สามอันดับแรก จึงใช้ป้ายระดับตามปกติ) */
export const getChampionTitle = (rank: number): ChampionTitle | null =>
  CHAMPION_TITLES[rank] ?? null;

/**
 * ฉายาของอันดับ 1
 * เก็บชื่อเดิมไว้ให้โค้ดที่อ้างถึงอยู่แล้วไม่ต้องแก้ตาม
 */
export const CHAMPION_TITLE = CHAMPION_TITLES[1];

/** ระดับปัจจุบันจากจำนวนดาวสะสม */
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
