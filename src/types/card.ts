/**
 * โครงสร้างข้อมูลการ์ด: การ์ดที่ผู้เล่น "เป็นเจ้าของ" และซองการ์ด (Card Pack)
 */
import type { Position, Rarity } from './player';

/** ประเภทซองการ์ด (mythic = ซองระดับสูงสุด มีโอกาสได้การ์ด mythical) */
export type PackTier = 'bronze' | 'silver' | 'gold' | 'special' | 'mythic';

/**
 * การ์ดหนึ่งใบในคลังของผู้เล่น (My Cards)
 * หมายเหตุ: การ์ดหลายใบสามารถอ้างถึง playerId เดียวกันได้
 */
export interface PlayerCard {
  id: string;
  playerId: string;
  /** เวลาที่ได้รับการ์ด (ISO string) ใช้เรียงลำดับ "ใหม่ล่าสุด" */
  acquiredAt: string;
  /** ระดับอัปเกรดการ์ด เผื่อระบบพัฒนานักเตะในอนาคต */
  level: number;
  /** true เมื่อการ์ดถูกใช้อยู่ในทีมตัวจริง/สำรอง */
  inSquad: boolean;
}

/** นิยามซองการ์ดที่ขายในร้าน */
export interface CardPack {
  id: string;
  name: string;
  tier: PackTier;
  /** ราคาเป็นเหรียญในเกม */
  price: number;
  /** จำนวนการ์ดต่อซอง */
  cardCount: number;
  /** น้ำหนักการสุ่ม rarity รวมกันได้ 100 */
  odds: Record<Rarity, number>;
  /**
   * รายชื่อนักเตะที่ "ใส่ไว้ในซองนี้" (id ของนักเตะ เช่น 'p061')
   * ไม่ใส่ = ซองนี้สุ่มจากนักเตะทั้งเกมตาม odds ตามปกติ
   * ใส่ = ซองนี้ออกได้เฉพาะคนในรายชื่อนี้เท่านั้น (ยังสุ่ม rarity ตาม odds เหมือนเดิม)
   */
  pool?: string[];
  description: string;
}

/** ผลลัพธ์หลังเปิดซอง — ใช้ในแอนิเมชันหน้า Card Pack */
export interface PackOpenResult {
  packId: string;
  cards: PlayerCard[];
  openedAt: string;
  /** จำนวนซองที่เปิดในครั้งนี้ (1 = ซองเดียว, >1 = ซื้อยกชุด) */
  packCount: number;
}

/**
 * เงื่อนไขของดีลแลกเปลี่ยนการ์ด — ต้องเลือกอย่างใดอย่างหนึ่งเท่านั้น
 *   quantity   = ใช้การ์ดอะไรก็ได้ตามจำนวนที่กำหนด
 *   minOvr     = การ์ดแต่ละใบที่ใช้แลกต้อง OVR ถึงขั้นต่ำที่กำหนด
 *   position   = การ์ดแต่ละใบที่ใช้แลกต้องอยู่ตำแหน่งที่กำหนด
 *   samePlayer = ต้องเป็นการ์ดของนักเตะคนเดียวกันตามที่กำหนด (ใบซ้ำ)
 * ทุกประเภทยังต้องระบุ count เสมอ (จะใช้กี่ใบ)
 */
export type ExchangeRequirementType = 'quantity' | 'minOvr' | 'position' | 'samePlayer';

export interface ExchangeRequirement {
  type: ExchangeRequirementType;
  /** จำนวนการ์ดที่ต้องใช้แลก */
  count: number;
  /** ใช้กับ type = 'minOvr' */
  minOvr?: number;
  /** ใช้กับ type = 'position' */
  position?: Position;
  /** ใช้กับ type = 'samePlayer' — id นักเตะที่ต้องใช้ */
  samePlayerId?: string;
}

/**
 * ดีลแลกเปลี่ยนการ์ดที่แอดมินสร้างเอง (หน้า ADMIN → แลกเปลี่ยนการ์ด)
 * ผู้เล่นเอาการ์ดที่เข้าเงื่อนไขมาแลก แล้วได้การ์ดของ rewardPlayerId กลับไปหนึ่งใบ
 */
export interface ExchangeDeal {
  id: string;
  /** นักเตะที่จะได้รับเมื่อแลกสำเร็จ */
  rewardPlayerId: string;
  requirement: ExchangeRequirement;
  /** false = ปิดไว้ก่อน ยังไม่เปิดให้แลก */
  enabled: boolean;
  description: string;
}
