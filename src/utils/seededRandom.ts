/**
 * ตัวสุ่มแบบมี seed — seed เดิมได้ผลเดิมเสมอ
 *
 * ใช้กับของที่ "ทุกคนต้องเห็นตรงกัน โดยไม่ต้องถามเซิร์ฟเวอร์"
 * เช่น ร้านแลกนักเตะที่หมุนเวียนทุก 3 ชั่วโมง หรือผลของทีมอื่นในตารางลีก
 * เปิดกี่ครั้ง เครื่องไหน ก็ได้ชุดเดิม เพราะ seed มาจากเวลาไม่ใช่จาก Math.random
 */

/** แปลงข้อความเป็นตัวเลข 32 บิต (FNV-1a) */
export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** สร้างตัวสุ่มจาก seed (mulberry32) — คืนค่า 0 ถึง 1 เหมือน Math.random */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * สลับลำดับรายการแบบมี seed (Fisher–Yates)
 * คืนอาร์เรย์ชุดใหม่เสมอ ไม่แก้ของเดิม
 */
export const seededShuffle = <T>(items: T[], seed: string): T[] => {
  const random = seededRandom(hashString(seed));
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }

  return result;
};
