/**
 * ของแถมตอนสมัครไอดีใหม่
 *
 * ผู้เล่นใหม่จะได้:
 *   - เหรียญเริ่มต้น 1,000,000
 *   - ชุดนักเตะเริ่มต้น 16 คน (พอจัด 11 ตัวจริง + สำรอง 5)
 *
 * ชุดเริ่มต้นเลือกจากนักเตะระดับ common ที่เขียนมือไว้ (p001–p016)
 * ครบทุกตำแหน่งของแผน 4-3-3 และ "ไม่มีชื่อซ้ำกัน" ตามกติกาการจัดตัวจริง
 */
import { getPlayerById } from '@/data/players';
import type { PlayerCard } from '@/types/card';

/** เหรียญเริ่มต้นของบัญชีใหม่ */
export const STARTING_COINS = 1_000_000;

/** แต้มแลกนักเตะเริ่มต้น (ได้จากการย่อยการ์ดเท่านั้น จึงเริ่มที่ 0) */
export const STARTING_POINTS = 0;

/** แต้มตีบวกเริ่มต้น — แถมพอตีบวก +1 ได้หนึ่งครั้ง จะได้เห็นระบบตั้งแต่วันแรก */
export const STARTING_UPGRADE_POINTS = 500;

/**
 * รายชื่อนักเตะที่แถมให้ตอนสมัคร
 * ครอบคลุม: GK×2, CB×3, LB×1, RB×1, CDM×1, CM×2, CAM×1, LW×1, RW×1, RM×1, ST×2
 */
const STARTER_PLAYER_IDS = [
  'p006', // GK
  'p016', // GK สำรอง
  'p004', // CB
  'p008', // CB
  'p014', // CB สำรอง
  'p009', // LB
  'p010', // RB
  'p005', // CDM
  'p011', // CM
  'p013', // CM สำรอง
  'p002', // CAM
  'p019', // CAM สำรอง
  'p003', // LW
  'p007', // RW
  'p015', // RM สำรอง
  'p001', // ST
  'p012', // ST สำรอง
] as const;

/**
 * สร้างชุดการ์ดเริ่มต้นสำหรับบัญชีใหม่
 * เรียกใหม่ทุกครั้งที่สมัคร เพื่อให้แต่ละบัญชีมี id การ์ดของตัวเอง
 */
export const createStarterCards = (): PlayerCard[] => {
  const acquiredAt = new Date().toISOString();

  return STARTER_PLAYER_IDS.filter((playerId) => getPlayerById(playerId)).map(
    (playerId, index) => ({
      id: `sc${String(index + 1).padStart(3, '0')}`,
      playerId,
      acquiredAt,
      level: 1,
      // ให้ระบบจัดตัวอัตโนมัติเลือกลงสนามเองตามแผนการเล่นเริ่มต้น
      inSquad: true,
    }),
  );
};
