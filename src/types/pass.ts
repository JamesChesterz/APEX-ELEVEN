/**
 * FC ALLSTAR PASS — พาสประจำซีซัน (เมนู Pass อยู่ใต้ Exchange)
 *
 * หนึ่งซีซันมี 30 เลเวล แต่ละเลเวลมีรางวัลได้สามสาย:
 *   free    — ทุกคนได้ ไม่ต้องปลดล็อกอะไร
 *   premium — ต้องปลดล็อกด้วยตั๋วพาสหรือเหรียญ
 *   plus    — ชั้นบนสุด ได้ของสาย premium ด้วยทั้งหมด
 *
 * เลเวลขึ้นด้วย XP ที่ได้จากการลงแข่ง Matchmaking (แอดมินตั้งได้ว่านัดละกี่ XP)
 * และแอดมินกำหนดได้ว่าแต่ละเลเวลต้องใช้ XP สะสมเท่าไร
 *
 * ปลดล็อก premium ตอนเลเวล 20 = ได้รางวัล premium ของเลเวล 1–20 ย้อนหลังทันที
 * (ดู claimableKeys ใน services/pass.ts — รางวัลที่ "ถึงเลเวลแล้ว" ทุกใบเข้าเงื่อนไขรับได้หมด)
 */

/** สายของรางวัล เรียงจากล่างขึ้นบน — สายบนได้ของสายล่างทั้งหมดด้วย */
export type PassTier = 'free' | 'premium' | 'plus';

/** ประเภทของรางวัลหนึ่งชิ้น */
export type PassRewardType = 'coins' | 'points' | 'upgradePoints' | 'ticket' | 'card';

/** รางวัลหนึ่งชิ้นในช่องเลเวลหนึ่ง */
export interface PassReward {
  id: string;
  type: PassRewardType;
  /** จำนวนที่ได้รับ — ใช้กับทุกประเภทยกเว้น card */
  amount?: number;
  /** id นักเตะ — ใช้กับ type = 'card' */
  playerId?: string;
  /**
   * รูปที่จะโชว์แทนไอคอน (.png .webp .gif) — พาธใน public/ หรือ data URL
   * ใช้ตัวกรองความปลอดภัยชุดเดียวกับกล่องสุ่ม (services/luckyImage.ts)
   */
  image?: string;
}

/** เลเวลหนึ่งเลเวลในพาส */
export interface PassLevel {
  /** เลข 1–30 */
  level: number;
  /** XP สะสมที่ต้องมีถึงจะปลดล็อกเลเวลนี้ (เลเวล 1 เป็น 0 เสมอ) */
  xp: number;
  free: PassReward[];
  premium: PassReward[];
  plus: PassReward[];
}

/** ราคาปลดล็อกหนึ่งสาย — ใส่ 0 ในช่องไหน = ปิดทางนั้น (ต้องเหลืออย่างน้อยหนึ่งทาง) */
export interface PassUnlockCost {
  /** จำนวนตั๋วพาส */
  tickets: number;
  /** จำนวนเหรียญ */
  coins: number;
}

/** ค่าตั้งพาสทั้งซีซัน (config/pass — แอดมินเป็นคนกำหนด) */
export interface PassConfig {
  /** false = ซ่อนเมนู Pass จากผู้เล่นทั้งหมด */
  enabled: boolean;
  /** ชื่อที่โชว์บนหัวหน้า เช่น "FC ALLSTAR PASS" */
  title: string;
  /** ชื่อซีซัน เช่น "SEASON 1 — TEAM OF THE YEAR" */
  seasonName: string;
  /** รูปแบนเนอร์ของพาส โชว์บนแผงซ้าย */
  bannerImage?: string;
  /** เวลาที่ซีซันนี้ปิด (ISO) — ไม่ตั้ง = ไม่มีกำหนด */
  endsAt?: string;
  /**
   * เลขซีซัน แอดมินกด "เริ่มซีซันใหม่" เมื่อไหร่เลขนี้ +1
   * ความคืบหน้าของผู้เล่นที่ไม่ตรงเลขซีซัน (XP, สายที่ปลดล็อก, ของที่รับไปแล้ว) ถูกล้างทั้งหมด
   */
  season: number;
  /** ลงแข่ง Matchmaking จบหนึ่งนัดได้กี่ XP */
  xpPerMatch: number;
  /** ราคาซื้อข้ามหนึ่งเลเวลด้วยเหรียญ — 0 = ปิดปุ่ม "ซื้อเลเวล" */
  levelUpCoins: number;
  premiumCost: PassUnlockCost;
  plusCost: PassUnlockCost;
  /** 30 เลเวล เรียงจาก 1 ถึง 30 */
  levels: PassLevel[];
}

/** ความคืบหน้าของผู้เล่นหนึ่งคนในพาสซีซันนี้ (เก็บลงบัญชี) */
export interface PassProgress {
  /** ซีซันที่ตัวเลขชุดนี้เป็นของ — ไม่ตรงกับ config = เริ่มใหม่ทั้งชุด */
  season: number;
  /** สายที่ปลดล็อกไว้แล้ว */
  tier: PassTier;
  /** คีย์ของรางวัลที่รับไปแล้ว รูปแบบ "<tier>:<level>" เช่น "premium:20" */
  claimed: string[];
}
