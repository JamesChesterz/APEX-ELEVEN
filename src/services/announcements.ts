/**
 * ประกาศอัตโนมัติในห้องแชท (pure function ล้วน ห้าม import React)
 *
 * ตอนนี้มีสองเหตุการณ์ที่ประกาศ:
 *   • เปิดซองได้การ์ดระดับ mythical
 *   • ตีบวกติดถึง +ANNOUNCE_FROM_PLUS ขึ้นไป
 *
 * ประกาศถูกส่งจากเครื่องของ "คนที่ทำได้" ไม่ใช่จากเซิร์ฟเวอร์ เพราะเกมนี้ยังให้
 * เครื่องผู้เล่นเป็นคนตัดสินผลเปิดซอง/ตีบวก (ยกเว้นตอนเปิด SERVER_AUTHORITY)
 * ผลคือกฎใน firestore.rules ยังเป็นชุดเดิม — ข้อความต้องมี uid ตรงกับคนส่งเสมอ
 *
 * ⚠️ ข้อความประกาศไม่ต้องใส่ชื่อผู้จัดการ เพราะบรรทัดในแชทแสดงชื่อ + ป้ายแรงค์
 * ของคนส่งอยู่แล้ว ใส่ซ้ำจะกลายเป็น "ชื่อ: ชื่อ เปิดซองได้…"
 */

/** ชนิดของข้อความในห้องแชท */
export type ChatKind = 'chat' | 'mythical' | 'upgrade';

/** ตีบวกติดถึงระดับนี้ขึ้นไปถึงจะประกาศ */
export const ANNOUNCE_FROM_PLUS = 8;

/**
 * เว้นระยะระหว่างประกาศสองครั้งจากเครื่องเดียวกัน (มิลลิวินาที)
 *
 * ไม่ได้กันการโกง (คนแก้โค้ดยิงตรงยังทำได้) แต่กันเคสปกติที่เกิดจริง:
 * เปิดซองยกชุดแล้วได้ mythical หลายใบ หรือกดตีบวกรัว ๆ ติดกัน
 * — ห้องแชทไม่ควรถูกประกาศของคนเดียวดันจนข้อความคนอื่นหลุดจอ
 */
export const ANNOUNCE_COOLDOWN_MS = 3_000;

/** ข้อความตอนเปิดซองได้การ์ด mythical */
export const buildMythicalAnnouncement = (playerName: string): string =>
  `✨ เปิดซองได้ ${playerName} ระดับ MYTHICAL!`;

/** ข้อความตอนตีบวกติดถึงระดับที่ควรประกาศ */
export const buildUpgradeAnnouncement = (playerName: string, plus: number): string =>
  `🔥 ตี ${playerName} ขึ้น +${plus} สำเร็จ!`;

/** ตีบวกได้ระดับนี้แล้วควรประกาศไหม */
export const shouldAnnounceUpgrade = (plus: number): boolean => plus >= ANNOUNCE_FROM_PLUS;
