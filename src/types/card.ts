/**
 * โครงสร้างข้อมูลการ์ด: การ์ดที่ผู้เล่น "เป็นเจ้าของ" และซองการ์ด (Card Pack)
 */
import type { Position, Rarity } from './player';

/** ประเภทซองการ์ด (mythic = ซองระดับสูงสุด มีโอกาสได้การ์ด mythical) */
export type PackTier = 'bronze' | 'silver' | 'gold' | 'special' | 'mythic';

/**
 * ═══════════════════════════════════════════════════════════════
 *  CARD INSTANCE — การ์ดหนึ่งใบที่ "ผู้เล่นคนหนึ่งเป็นเจ้าของ" (PHASE 12)
 * ═══════════════════════════════════════════════════════════════
 *
 * สามชั้นของข้อมูลนักเตะ อย่าสับสนกัน:
 *   1. Base Player      → src/data/players.ts   (ชื่อ ตำแหน่ง ค่าพลังพื้นฐาน)
 *   2. Roster Template  → src/data/roster.ts    (ระดับการ์ด รูป ค่าที่ใส่ทับ)
 *   3. Card Instance    → ไฟล์นี้               (ใครเป็นเจ้าของ ตีบวกเท่าไร ล็อกไหม)
 *
 * ผู้เล่นหลายคนถือการ์ดของนักเตะคนเดียวกันได้ โดยที่ค่าบวก/การฝึกซ้อม/สถานะล็อก
 * ของแต่ละใบแยกกันสิ้นเชิง — playerId ซ้ำได้ แต่ id ของการ์ดห้ามซ้ำ
 *
 * เก็บอยู่ใน accounts/{uid}.state.cards[] (ไม่ได้แยกเป็น collection ต่างหาก)
 * ownerId จึงเป็น optional: ถ้าไม่ใส่ ให้ถือว่าเจ้าของคือ uid ของเอกสารที่การ์ดอยู่
 */
export interface PlayerCard {
  id: string;
  playerId: string;
  /** เวลาที่ได้รับการ์ด (ISO string) ใช้เรียงลำดับ "ใหม่ล่าสุด" */
  acquiredAt: string;
  /**
   * ระดับอัปเกรดการ์ด — level 1 = +0 ดังนั้น "ค่าบวก" = level − 1 เสมอ
   * ทั้งโปรเจกต์ใช้ convention นี้ อย่าเพิ่มฟิลด์ upgrade ซ้ำเข้ามาอีกชุด
   * (อ่านค่าบวกด้วย getCardUpgrade ใน services/cardInstance.ts)
   */
  level: number;
  /** true เมื่อการ์ดถูกใช้อยู่ในทีมตัวจริง/สำรอง */
  inSquad: boolean;

  /* ── ฟิลด์ของ Card Instance (PHASE 12) ─────────────────── */

  /**
   * uid ของเจ้าของ — ไม่ใส่ = เจ้าของคือบัญชีที่การ์ดใบนี้อยู่
   * เซิร์ฟเวอร์เท่านั้นที่เขียนได้ (ดู functions/src/upgrade.ts)
   */
  ownerId?: string;
  /** ระดับการฝึกซ้อม 0–5 (ไม่ใส่ = 0) — เซิร์ฟเวอร์เท่านั้นที่เขียนได้ */
  training?: number;
  /** true = ล็อกไว้ ห้ามย่อย/ใช้รวมร่าง/ตีบวก */
  locked?: boolean;
  /** เวลาที่การ์ดใบนี้ถูกสร้าง (ISO) — ไม่ใส่ = ใช้ acquiredAt แทน */
  createdAt?: string;
  /** เวลาที่แก้ครั้งล่าสุด (ISO) — เซิร์ฟเวอร์เขียนทุกครั้งที่ตีบวกสำเร็จ */
  updatedAt?: string;
}

/**
 * ชื่อที่สื่อความหมายกว่าเวลาพูดถึง "การ์ดของใครคนหนึ่ง"
 * เป็น type เดียวกับ PlayerCard เป๊ะ ๆ ไม่ได้สร้างโครงสร้างใหม่ซ้อน
 */
export type CardInstance = PlayerCard;

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
 * เงื่อนไขของดีลแลกเปลี่ยนการ์ด — ใส่ได้พร้อมกันหลายอย่าง การ์ดแต่ละใบที่ใช้แลก
 * ต้องผ่านทุกเงื่อนไขที่ตั้งไว้ (AND กันหมด) เงื่อนไขไหนไม่ได้ตั้ง = ไม่บังคับเรื่องนั้น
 *   minOvr    = การ์ดแต่ละใบต้อง OVR ถึงขั้นต่ำที่กำหนด
 *   positions = การ์ดแต่ละใบต้องอยู่ตำแหน่งใดตำแหน่งหนึ่งในรายการนี้ (ใส่ได้หลายตำแหน่ง)
 *   samePlayerId = ต้องเป็นการ์ดของนักเตะคนนี้เท่านั้น (ใบซ้ำ)
 * count ต้องระบุเสมอ (จะใช้กี่ใบ)
 */
export interface ExchangeRequirement {
  /** จำนวนการ์ดที่ต้องใช้แลก */
  count: number;
  /** OVR ขั้นต่ำของการ์ดแต่ละใบที่ใช้แลก — ไม่ตั้ง = ไม่บังคับ */
  minOvr?: number;
  /** ตำแหน่งที่ยอมรับ (ใส่ได้หลายตำแหน่ง) — ไม่ตั้ง/ว่าง = ไม่บังคับ */
  positions?: Position[];
  /** ต้องเป็นการ์ดของนักเตะคนนี้เท่านั้น — ไม่ตั้ง = ไม่บังคับ */
  samePlayerId?: string;
}

/**
 * ดีลแลกเปลี่ยนการ์ดที่แอดมินสร้างเอง (หน้า ADMIN → แลกเปลี่ยนการ์ด)
 * ผู้เล่นเอาการ์ดที่เข้าเงื่อนไขมาแลก แล้วได้การ์ดรางวัลทุกใบใน rewardPlayerIds กลับไป
 */
export interface ExchangeDeal {
  id: string;
  /** นักเตะที่จะได้รับเมื่อแลกสำเร็จ (ได้ทุกใบพร้อมกันในครั้งเดียว) */
  rewardPlayerIds: string[];
  requirement: ExchangeRequirement;
  /** false = ปิดไว้ก่อน ยังไม่เปิดให้แลก */
  enabled: boolean;
  description: string;
}

/**
 * การ์ดหนึ่งใบในร้าน "แลกด้วยแต้ม" — แอดมินเลือกเองทุกใบ (หน้า ADMIN → แลกด้วยแต้ม)
 * ไม่มีการหมุนเวียนอัตโนมัติแล้ว: ใบไหนอยู่ในร้าน / ราคาเท่าไร / หายไปเมื่อไร แอดมินกำหนดล้วน
 */
export interface PointsExchangeItem {
  id: string;
  /** นักเตะที่วางขาย (id ของนักเตะ เช่น 'p061') */
  playerId: string;
  /** ราคาแลกเป็นแต้ม */
  price: number;
  /**
   * เวลาที่การ์ดใบนี้จะหายไปจากหน้าแลก (ISO string)
   * ไม่ใส่ = อยู่ในร้านไปเรื่อย ๆ จนกว่าแอดมินจะเอาออกเอง
   */
  expiresAt?: string;
  /** false = ซ่อนใบนี้ไว้ก่อน (ยังไม่ลบทิ้ง) */
  enabled: boolean;
}

/** ค่าตั้งทั้งหมดของร้านแลกด้วยแต้ม (config/pointsExchange) */
export interface PointsExchangeConfig {
  /** false = ปิดเมนู "แลกด้วยแต้ม" ทั้งแท็บ ผู้เล่นจะไม่เห็นเลย */
  enabled: boolean;
  items: PointsExchangeItem[];
}
