/**
 * ═══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET — โครงสร้างข้อมูลของ "ประกาศขายหนึ่งใบ"
 * ═══════════════════════════════════════════════════════════════
 *
 * ตอนนี้ของในตลาดมาจากระบบ (NPC) ทั้งหมด แต่ชนิดข้อมูลถูกออกแบบให้
 * รองรับตลาดผู้เล่นต่อผู้เล่นตั้งแต่วันแรก — เพิ่มได้โดยไม่ต้องรื้อ:
 *   sellerType = 'PLAYER' + sellerUid = uid ของคนขาย (+ cardId ของใบที่เอามาวาง)
 *
 * ค่าที่ denormalize ไว้ (rarity / ovr / position) จงใจเก็บซ้ำในเอกสารประกาศ
 * เพื่อให้หน้าตลาดกรองและเรียงได้โดยไม่ต้องโหลด pool นักเตะทั้งเกมมาก่อน
 * ราคาก็ถูกตรึงไว้ตั้งแต่ตอนสร้าง เซิร์ฟเวอร์จึงคิดเงินจากเลขในเอกสารนี้เสมอ
 */
import type { Position, Rarity } from '@/types/player';

/** ใครเป็นคนวางขาย — ตอนนี้มีแต่ NPC, PLAYER สงวนไว้ให้เฟสถัดไป */
export type MarketSellerType = 'NPC' | 'PLAYER';

/**
 * สถานะของประกาศ
 *   ACTIVE  = ซื้อได้อยู่
 *   SOLD    = มีคนซื้อไปแล้ว (เก็บไว้ ไม่ลบ เผื่อทำประวัติ/ตรวจสอบย้อนหลัง)
 *   EXPIRED = หมดเวลา ซื้อไม่ได้แล้ว และให้ระบบเอาช่องไปสร้างใบใหม่แทนได้
 */
export type MarketListingStatus = 'ACTIVE' | 'SOLD' | 'EXPIRED';

/** ประกาศขายหนึ่งใบ (เอกสารหนึ่งใบใน collection marketListings) */
export interface MarketListing {
  id: string;
  /** id ของนักเตะใน pool (เช่น 'p061') — การ์ดจริงถูกสร้างตอนซื้อสำเร็จเท่านั้น */
  playerId: string;
  sellerType: MarketSellerType;
  /** uid ของคนขาย — NPC = null */
  sellerUid: string | null;
  /** ราคาเป็นเหรียญ ตรึงไว้ตั้งแต่ตอนสร้าง (เครื่องผู้เล่นกำหนดไม่ได้) */
  price: number;
  /* ── ข้อมูลย่อของนักเตะ ไว้ให้หน้าตลาดกรอง/เรียงได้ทันที ── */
  rarity: Rarity;
  ovr: number;
  position: Position;
  status: MarketListingStatus;
  /** true = ใบเด่นประจำวัน (ทุกคนเห็นใบเดียวกัน) */
  featured: boolean;
  /** เลขรอบที่สร้างใบนี้ ใช้ทำ id ไม่ให้ชนกันและไว้ไล่ดูย้อนหลัง */
  windowIndex: number;
  /** ISO string ทั้งคู่ — เทียบกับนาฬิกาเซิร์ฟเวอร์เสมอตอนซื้อ */
  createdAt: string;
  expiresAt: string;
  /** uid ของคนที่ซื้อไป (ยังไม่ถูกซื้อ = null) */
  buyerUid?: string | null;
  soldAt?: string | null;
}

/** ตัวกรองในหน้าตลาด — ไม่ระบุ/ 'all' = ไม่กรองเรื่องนั้น */
export interface MarketFilter {
  position?: Position | 'all';
  rarity?: Rarity | 'all';
  /** OVR ขั้นต่ำ */
  minOvr?: number;
  /** ราคาสูงสุดที่ยอมจ่าย */
  maxPrice?: number;
}

/** ลำดับการเรียงของในตลาด */
export type MarketSort = 'price-asc' | 'price-desc' | 'ovr-desc' | 'expiry-asc';

/** ผลการซื้อหนึ่งครั้งที่เซิร์ฟเวอร์ตัดสินแล้ว (ใช้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ) */
export interface MarketPurchaseResult {
  listingId: string;
  playerId: string;
  /** ราคาที่หักไปจริง (อ่านจากเอกสารประกาศ ไม่ใช่จากเครื่องผู้เล่น) */
  price: number;
  coinsBefore: number;
  coinsAfter: number;
  /** id ของการ์ดใบใหม่ที่เข้าคลัง */
  cardId: string;
  at: string;
}
