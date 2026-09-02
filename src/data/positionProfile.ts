/**
 * สัดส่วนค่าพลังตามตำแหน่ง + เพดานค่าพลังของแต่ละด้าน
 *
 * ไฟล์นี้เป็นแหล่งเดียวที่ตอบว่า "ตำแหน่งนี้ควรเก่งด้านไหน แค่ไหน"
 * มีสองฝ่ายเรียกใช้:
 *   • data/autoPlayer.ts        — ตอนปั้นค่าพลังพื้นฐานจาก OVR
 *   • services/playerAttributes — ตอนบีบค่าพลังจริงของการ์ด (base + ตีบวก + ฝึกซ้อม)
 * แยกออกมาเป็นไฟล์กลางเพราะถ้าปล่อยให้ต่างฝ่ายต่างถือตาราง
 * ค่าที่ปั้นตอนแรกกับเพดานตอนคิดจริงจะหลุดจากกันทันที
 *
 * เป็น pure data + pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { PlayerStats, Position } from '@/types/player';

/** สัดส่วนค่าพลังแต่ละด้านเทียบกับ OVR แยกตามตำแหน่ง */
export const STAT_PROFILE: Record<Position, PlayerStats> = {
  GK:  { pace: 0.60, shooting: 0.25, passing: 0.72, dribbling: 0.55, defending: 1.00, physical: 0.95 },
  CB:  { pace: 0.78, shooting: 0.48, passing: 0.72, dribbling: 0.66, defending: 1.00, physical: 1.00 },
  LB:  { pace: 1.02, shooting: 0.65, passing: 0.88, dribbling: 0.87, defending: 0.95, physical: 0.87 },
  RB:  { pace: 1.02, shooting: 0.65, passing: 0.88, dribbling: 0.87, defending: 0.95, physical: 0.87 },
  CDM: { pace: 0.85, shooting: 0.72, passing: 0.95, dribbling: 0.86, defending: 1.00, physical: 1.00 },
  CM:  { pace: 0.86, shooting: 0.85, passing: 1.00, dribbling: 0.96, defending: 0.82, physical: 0.90 },
  CAM: { pace: 0.93, shooting: 0.93, passing: 1.00, dribbling: 1.03, defending: 0.55, physical: 0.78 },
  LM:  { pace: 1.05, shooting: 0.85, passing: 0.90, dribbling: 0.98, defending: 0.65, physical: 0.80 },
  RM:  { pace: 1.05, shooting: 0.85, passing: 0.90, dribbling: 0.98, defending: 0.65, physical: 0.80 },
  LW:  { pace: 1.08, shooting: 0.95, passing: 0.88, dribbling: 1.05, defending: 0.42, physical: 0.76 },
  RW:  { pace: 1.08, shooting: 0.95, passing: 0.88, dribbling: 1.05, defending: 0.42, physical: 0.76 },
  ST:  { pace: 1.02, shooting: 1.05, passing: 0.82, dribbling: 0.98, defending: 0.40, physical: 0.90 },
};

/* ── เพดานค่าพลัง ───────────────────────────────────────────── */

/** ค่าพลังต่ำสุดที่เป็นไปได้ */
export const MIN_STAT = 1;

/**
 * เพดานเดิมของเกม
 *
 * ⚠️ ไม่ใช่เพดานจริงอีกแล้ว แต่เป็น "พื้นขั้นต่ำ" ของเพดาน:
 * ทุกด้านของทุกตำแหน่งไปได้อย่างน้อยเท่านี้ ไม่มีใครถูกลดจากของเดิม
 */
export const BASE_MAX_STAT = 99;

/**
 * เพดานของด้านที่ตรงกับตำแหน่งมากที่สุด (เช่น การยิงของกองหน้า)
 *
 * ตั้งไว้สูงกว่าที่การ์ดแรงสุด +8 ฝึกเต็มจะไปถึงเล็กน้อยโดยตั้งใจ
 * ถ้าตั้งพอดีเป๊ะ การ์ดระดับบนทุกใบจะชนเพดานพร้อมกันแล้วเลขเท่ากันหมดอีก
 * ซึ่งก็คือปัญหาเดิมที่ทุกใบตันที่ 99 แค่ย้ายไปตันที่เลขใหม่
 */
export const ABSOLUTE_MAX_STAT = 165;

/**
 * "ความเหมาะสม" ของค่าพลังด้านนี้กับตำแหน่งนี้ — 0 ถึง 1
 *
 * คิดเทียบกับด้านที่เด่นที่สุดของตำแหน่งนั้นเอง ไม่ใช่เทียบข้ามตำแหน่ง
 * กองหน้าจึงได้ 1.00 ที่การยิง และผู้รักษาประตูได้ 1.00 ที่การป้องกัน
 * ทั้งที่ตัวเลขดิบในตารางไม่เท่ากัน
 */
export const getPositionFit = (position: Position, key: keyof PlayerStats): number => {
  const profile = STAT_PROFILE[position];
  const best = Math.max(...Object.values(profile));
  if (best <= 0) return 0;

  return Math.min(1, Math.max(0, profile[key] / best));
};

/**
 * เพดานค่าพลังของด้านนี้ สำหรับนักเตะตำแหน่งนี้
 *
 * ยิ่งด้านนั้นตรงกับตำแหน่งมาก ยิ่งทะลุ 99 ไปได้ไกล
 * ใช้กำลังสาม (fit³) เพราะสัดส่วนดิบในตารางเกาะกลุ่มกันแน่นเกินไป
 * ยกกำลังแล้วช่องว่างระหว่าง "ด้านหลัก" กับ "ด้านที่ไม่ใช่ทาง" ถึงจะเห็นชัด
 *
 * ตัวอย่างกองหน้า (ST): ยิง 165 · ความเร็ว 159 · เลี้ยง 152 · พละ 141 · ส่ง 139 · ป้องกัน 103
 */
export const getStatCeiling = (position: Position, key: keyof PlayerStats): number => {
  const fit = getPositionFit(position, key);
  const headroom = ABSOLUTE_MAX_STAT - BASE_MAX_STAT;

  return Math.round(BASE_MAX_STAT + headroom * fit ** 3);
};

/** เพดานครบทั้งหกด้านของตำแหน่งนี้ (ใช้ตอนต้องโชว์หรือวนทุกด้าน) */
export const getStatCeilings = (position: Position): PlayerStats => ({
  pace: getStatCeiling(position, 'pace'),
  shooting: getStatCeiling(position, 'shooting'),
  passing: getStatCeiling(position, 'passing'),
  dribbling: getStatCeiling(position, 'dribbling'),
  defending: getStatCeiling(position, 'defending'),
  physical: getStatCeiling(position, 'physical'),
});
