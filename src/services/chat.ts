/**
 * กติกาของ Live แชท (pure function ล้วน ห้าม import React)
 *
 * ที่ต้องคิดไว้ก่อน: แชทเป็นที่ที่คนพิมพ์อะไรก็ได้ ถี่แค่ไหนก็ได้
 * กฎทั้งหมดจึงอยู่ที่นี่ที่เดียว แล้วให้ทั้ง UI และ firestore.rules อ้างค่าชุดเดียวกัน
 */

/** ความยาวสูงสุดของหนึ่งข้อความ (ต้องตรงกับเพดานใน firestore.rules) */
export const CHAT_MAX_CHARS = 200;

/** พิมพ์ถี่กว่านี้ไม่ได้ (มิลลิวินาที) */
export const CHAT_COOLDOWN_MS = 4_000;

/**
 * เก็บข้อความล่าสุดไว้กี่ข้อความบนจอ
 * ตัวเลขนี้คือค่าอ่านที่ต้องจ่ายทุกครั้งที่เปิดเกม จึงไม่ควรตั้งสูงเกินจำเป็น
 */
export const CHAT_HISTORY_LIMIT = 30;

/** ข้อความหนึ่งบรรทัดในแชท */
export interface ChatMessage {
  id: string;
  uid: string;
  managerName: string;
  teamName: string;
  /** ค่าพลังทีมตอนที่พิมพ์ */
  teamOvr: number;
  /** ดาวตอนที่พิมพ์ — เอาไปคิดระดับแรงค์ตอนแสดงผล */
  points: number;
  text: string;
  /** เวลาที่ส่ง (ISO) */
  sentAt: string;
}

/**
 * ทำความสะอาดข้อความก่อนส่ง
 *
 * ตัดช่องว่างหัวท้าย · ยุบบรรทัดว่างซ้อน ๆ ให้เหลือหนึ่ง (กันคนสแปมบรรทัดว่างดันจอ)
 * · ตัดความยาวตามเพดาน
 */
export const cleanChatText = (raw: string): string =>
  raw
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, CHAT_MAX_CHARS);

/** ข้อความนี้ส่งได้ไหม (ว่างเปล่าส่งไม่ได้) */
export const isSendableChat = (raw: string): boolean => cleanChatText(raw).length > 0;

/** เหลือคูลดาวน์อีกกี่มิลลิวินาทีก่อนพิมพ์ได้อีกครั้ง (0 = พิมพ์ได้เลย) */
export const chatCooldownLeft = (lastSentAt: number | null, now: number): number => {
  if (!lastSentAt) return 0;
  return Math.max(0, CHAT_COOLDOWN_MS - (now - lastSentAt));
};

/** เวลาแบบ ชม:นาที ใช้แสดงข้างชื่อคนพิมพ์ */
export const formatChatTime = (iso: string): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  return at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};
