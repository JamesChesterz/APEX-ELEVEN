/**
 * โครงสร้างข้อมูลการ์ด: การ์ดที่ผู้เล่น "เป็นเจ้าของ" และซองการ์ด (Card Pack)
 */
import type { Rarity } from './player';

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
