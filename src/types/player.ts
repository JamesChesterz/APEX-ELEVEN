/**
 * โครงสร้างข้อมูลนักเตะ (ข้อมูลดิบของตัวนักเตะ ไม่ใช่การ์ดที่ผู้เล่นเป็นเจ้าของ)
 */

/** ตำแหน่งในสนามทั้งหมดที่เกมรองรับ */
export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST';

/**
 * ตำแหน่งทั้งหมดในรูป array — ใช้ตอนที่ต้องวนครบทุกตำแหน่งหรือเช็คค่าที่มาจากเซิร์ฟเวอร์
 * (type union ข้างบนมีอยู่แค่ตอนคอมไพล์ ตรวจค่าตอนรันไทม์ไม่ได้)
 * เรียงจากหลังไปหน้าสนามให้ตรงกับที่คนเล่นบอลคุ้นเคย
 */
export const POSITIONS: Position[] = [
  'GK',
  'LB',
  'CB',
  'RB',
  'CDM',
  'LM',
  'CM',
  'RM',
  'CAM',
  'LW',
  'RW',
  'ST',
];

/**
 * ระดับความหายากของนักเตะ ใช้ทั้งใน Player Card และ Card Pack
 * เรียงจากต่ำไปสูง — mythical คือระดับสูงสุด หายากกว่า legendary
 */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';

/** ลำดับระดับการ์ดจากต่ำไปสูง ใช้เวลาต้องวนครบทุกระดับหรือเทียบว่าใบไหนดีกว่า */
export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythical'];

/** ค่าพลัง 6 ด้านมาตรฐาน (แสดงบนหน้าการ์ด) */
export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

/** นักเตะหนึ่งคนใน pool ของเกม */
export interface Player {
  id: string;
  name: string;
  club: string;
  nation: string;
  /** ตำแหน่งหลัก ใช้คิดโบนัส/ค่าปรับตอนวางลง Formation */
  position: Position;
  /** ตำแหน่งรองที่เล่นได้โดยไม่โดนหักคะแนน */
  altPositions: Position[];
  /** ค่าพลังรวม 1–99 */
  ovr: number;
  rarity: Rarity;
  stats: PlayerStats;
  /** ตัวเลือก: รูปนักเตะ ถ้าไม่มีให้ UI ใช้ placeholder */
  imageUrl?: string;
}

/** ตัวกรองที่ใช้ในหน้า My Cards / Squad Builder */
export interface PlayerFilter {
  search?: string;
  position?: Position;
  rarity?: Rarity;
  minOvr?: number;
}
