/**
 * โครงสร้างข้อมูลทีม: Formation, ช่องในสนาม, ทีมของผู้เล่น และ Team OVR
 */
import type { Position } from './player';

/**
 * รหัสแผนการเล่น
 *
 * เดิมเป็น union ตายตัว 4 ค่า แต่ตอนนี้แอดมินสร้างแผนเองได้จากหน้า ADMIN
 * รหัสจึงเป็นสตริงอะไรก็ได้ (แผนที่สร้างเองจะขึ้นต้นด้วย custom-)
 * ตัวที่การันตีว่ารหัสใช้ได้จริงคือ getFormationById ซึ่งถอยไปใช้แผนแรกเสมอถ้าหาไม่เจอ
 */
export type FormationId = string;

/** ช่องหนึ่งช่องในแผนการเล่น พร้อมพิกัดสำหรับวาดลงสนาม */
export interface FormationSlot {
  /** รหัสช่อง เช่น 'ST1', 'CB2' — ใช้ผูกกับการ์ดใน SquadSlot */
  id: string;
  position: Position;
  /** พิกัดแนวนอน 0–100 (%) วัดจากซ้ายของสนาม */
  x: number;
  /** พิกัดแนวตั้ง 0–100 (%) วัดจากเส้นประตูฝั่งเรา */
  y: number;
}

/** แผนการเล่นหนึ่งแบบ */
export interface Formation {
  id: FormationId;
  name: string;
  description: string;
  slots: FormationSlot[];
}

/** การจับคู่ระหว่างช่องในสนามกับการ์ดที่ลงเล่น */
export interface SquadSlot {
  slotId: string;
  /** null = ช่องว่าง ยังไม่ได้จัดตัว */
  cardId: string | null;
}

/** ทีมของผู้เล่น */
export interface Team {
  id: string;
  name: string;
  formationId: FormationId;
  /** 11 ช่องตัวจริง ตามแผนการเล่นที่เลือก */
  squad: SquadSlot[];
  /** รหัสการ์ดตัวสำรอง */
  bench: string[];
}

/** ผลการคำนวณค่าพลังทีม (คิดจาก services/teamRating.ts) */
export interface TeamRating {
  /** ค่าพลังทีมโดยรวม 1–99 (คิดจากค่าพลังจริงในช่อง = หักค่าปรับผิดตำแหน่งแล้ว) */
  ovr: number;
  /** โบนัส/ค่าปรับจากความเข้ากันของทีม (−5 ถึง +3) */
  chemistryBonus: number;
  /** ค่าพลังที่ใช้ตัดสินแพ้ชนะจริง = ovr + chemistryBonus */
  matchOvr: number;
  attack: number;
  midfield: number;
  defence: number;
  /** ความเข้ากันของทีม (0 = ผิดตำแหน่งทั้งหมด) */
  chemistry: number;
  /** ค่าความเข้ากันสูงสุดที่เป็นไปได้ของแผนนี้ */
  maxChemistry: number;
  /** มูลค่ารวมของทีม (เหรียญ) */
  value: number;
  /** จำนวนช่องที่ยังว่างอยู่ ใช้เตือนผู้เล่นก่อนลงแข่ง */
  emptySlots: number;
}
