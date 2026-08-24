/**
 * กติกาฝั่งแอดมิน (pure function ล้วน ห้าม import React)
 *
 * รวมสองเรื่องที่ต้องคิดให้ตรงกันทั้งฝั่งแอดมินและฝั่งผู้เล่น:
 *   1. คำสั่งรีเซ็ตดาว/ซีซัน — แอดมินสั่งครั้งเดียว เครื่องของแต่ละคนมารีเซ็ตตัวเอง
 *   2. ประกาศกลางจอ — เวอร์ชันของประกาศใช้ตัดสินว่าใครยังไม่ได้อ่าน
 */

/* ── คำสั่งรีเซ็ตดาว / ซีซัน ───────────────────────────────── */

/**
 * คำสั่งที่แอดมินเขียนไว้ที่ config/ladder
 *
 * ทำงานแบบ "ประทับเวลา" ไม่ใช่สั่งตรง ๆ:
 * แอดมินบันทึกว่า "รีเซ็ตเมื่อเวลา X" แล้วเครื่องของผู้เล่นแต่ละคนเทียบกับเวลาที่
 * ตัวเองรีเซ็ตไปล่าสุด ถ้ายังไม่ถึง X ก็รีเซ็ตตัวเองแล้วจำเวลาไว้
 * ผลคือทุกคนรีเซ็ตแน่นอนหนึ่งครั้งต่อคำสั่งหนึ่งใบ ไม่ว่าจะเข้าเกมช้าแค่ไหน
 */
export interface LadderCommand {
  /** เวลาที่สั่งรีเซ็ตดาว (ISO) — ว่าง = ไม่เคยสั่ง */
  resetAt?: string;
  /** สัดส่วนดาวที่เก็บไว้ 0–1 (0 = ล้างหมด, 0.3 = เหลือ 30%) */
  keep?: number;
  /** true = ขึ้นเลขซีซันใหม่ให้ด้วยตอนรีเซ็ต */
  resetSeason?: boolean;
  /** จำนวนวันต่อหนึ่งซีซัน (ไม่ใส่ = ใช้ค่าเริ่มต้นในโค้ด) */
  seasonDays?: number;
}

/** ค่าเริ่มต้นเมื่อยังไม่เคยมีคำสั่ง */
export const EMPTY_LADDER: LadderCommand = {};

/** มีคำสั่งรีเซ็ตที่บัญชีนี้ยังไม่ได้ทำตามไหม */
export const hasPendingReset = (command: LadderCommand, appliedAt?: string): boolean => {
  if (!command.resetAt) return false;
  if (!appliedAt) return true;
  return new Date(command.resetAt).getTime() > new Date(appliedAt).getTime();
};

/** ดาวที่เหลือหลังทำตามคำสั่ง */
export const pointsAfterReset = (points: number, command: LadderCommand): number => {
  const keep = Math.min(Math.max(Number(command.keep) || 0, 0), 1);
  return Math.max(0, Math.round(points * keep));
};

/* ── ประกาศกลางจอ ─────────────────────────────────────────── */

/** ประกาศที่แอดมินเขียนไว้ที่ config/announcement */
export interface Announcement {
  /** หัวข้อ (ว่างได้) */
  title?: string;
  /** เนื้อหา — ว่าง = ไม่มีอะไรให้แสดง */
  message?: string;
  /** false = ปิดไว้ก่อน ยังไม่ให้ใครเห็น */
  enabled?: boolean;
  /**
   * เวอร์ชันของประกาศ (เปลี่ยนทุกครั้งที่กดบันทึก)
   * ใช้ตัดสินว่าใครยังไม่ได้อ่าน — แก้ข้อความแล้วทุกคนจะเห็นใหม่อีกครั้ง
   */
  version?: string;
}

/** ความยาวสูงสุดของประกาศ (ตรงกับที่กำหนดใน firestore.rules) */
export const ANNOUNCEMENT_MAX_CHARS = 1200;

/** ประกาศนี้ควรขึ้นให้คนที่อ่านล่าสุดถึงเวอร์ชัน seenVersion หรือยัง */
export const shouldShowAnnouncement = (
  announcement: Announcement | null,
  seenVersion: string | null,
): boolean => {
  if (!announcement?.enabled) return false;
  if (!announcement.message?.trim()) return false;
  return (announcement.version ?? '') !== (seenVersion ?? '');
};

/** กุญแจที่ใช้จำว่าเครื่องนี้อ่านประกาศเวอร์ชันไหนไปแล้ว (เก็บในเครื่อง ไม่ต้องเปลืองที่บนคลาวด์) */
export const announcementSeenKey = (uid: string): string => `apex:announcement:${uid}`;
