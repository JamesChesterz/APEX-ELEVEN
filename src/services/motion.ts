/**
 * ตัวเลือกเอฟเฟกต์การเคลื่อนไหวในเกม (ตอนนี้ใช้กับวงวิ่งรูเล็ตของ Lucky Box)
 *
 * ทำไมต้องมี: เดิมเกมเช็ค `prefers-reduced-motion` ของระบบปฏิบัติการอย่างเดียว
 * ถ้าเครื่องตั้ง "ลดการเคลื่อนไหว" ไว้ เอฟเฟกต์จะถูกข้ามแบบเงียบ ๆ
 * ผู้เล่นจะเห็นแค่รางวัลเด้งขึ้นมาทันที เหมือนระบบรูเล็ตหายไปเฉย ๆ โดยไม่มีอะไรบอก
 *
 * Windows ตั้งค่านี้ไว้ที่ Settings → Accessibility → Visual effects → Animation effects
 * และหลายเครื่องปิดไว้ตั้งแต่แรกเพื่อความลื่น เจ้าของเครื่องเองก็มักไม่รู้ว่าปิดอยู่
 *
 * ทางแก้: ให้ผู้เล่นเลือกเองได้สามแบบ โดยค่าเริ่มต้นยังเคารพการตั้งค่าของระบบเหมือนเดิม
 *   system — ตามการตั้งค่าของเครื่อง (ค่าเริ่มต้น)
 *   on     — เปิดเอฟเฟกต์เสมอ แม้ระบบจะสั่งลดการเคลื่อนไหว
 *   off    — ปิดเอฟเฟกต์เสมอ
 */

export type MotionPref = 'system' | 'on' | 'off';

const STORAGE_KEY = 'fcallstar.motion.v1';

const listeners = new Set<(pref: MotionPref) => void>();

const read = (): MotionPref => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'on' || saved === 'off' ? saved : 'system';
  } catch {
    /* localStorage ใช้ไม่ได้ (โหมดส่วนตัว) — ถือว่าใช้ค่าตามระบบ */
    return 'system';
  }
};

let pref: MotionPref = read();

/** ตัวเลือกที่ผู้เล่นตั้งไว้ */
export const motionPref = (): MotionPref => pref;

/** เครื่องนี้สั่ง "ลดการเคลื่อนไหว" ไว้ไหม */
export const systemReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * ควรเล่นเอฟเฟกต์การเคลื่อนไหวไหม
 * เรียกทุกครั้งที่จะใช้ ไม่เก็บผลไว้ เพราะผู้เล่นเปลี่ยนค่าระหว่างเล่นได้
 */
export const shouldAnimate = (): boolean => {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return !systemReducedMotion();
};

export const setMotionPref = (next: MotionPref): void => {
  pref = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* เขียนไม่ได้ก็ยังใช้ค่าในหน่วยความจำต่อได้จนกว่าจะปิดแท็บ */
  }
  listeners.forEach((listener) => listener(next));
};

/** สมัครรับการเปลี่ยนค่า คืนฟังก์ชันสำหรับยกเลิก */
export const onMotionPrefChange = (listener: (pref: MotionPref) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
