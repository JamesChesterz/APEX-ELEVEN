/**
 * คูลดาวน์คู่แข่ง — กันการปั้มดาวด้วยการรัวท้าคนเดิมซ้ำ ๆ
 *
 * ปัญหา: ถ้าเจอคู่แข่งคนเดิมได้ไม่จำกัด ผู้เล่นสองคนนัดกันผลัดกันแพ้-ชนะ
 * หรือหาคนที่ทีมอ่อนกว่ามากแล้วรัวท้าจนดาวพุ่ง ตารางอันดับก็ไร้ความหมาย
 *
 * วิธีแก้: จำไว้ว่าเพิ่งเจอใครไปเมื่อไหร่ แล้วตัดคนนั้นออกจากคิวไปชั่วคราว
 * ข้อมูลนี้เก็บลงบัญชี (ตามไปทุกเครื่อง) จึงเลี่ยงด้วยการรีเฟรชหรือสลับเครื่องไม่ได้
 */
import type { RecentRival } from '@/types/account';

/** เจอคนเดิมซ้ำได้อีกครั้งหลังผ่านไปกี่มิลลิวินาที (30 นาที) */
export const RIVAL_COOLDOWN_MS = 30 * 60 * 1000;

/** จำคู่แข่งล่าสุดไว้กี่คน — มากกว่านี้ไม่มีประโยชน์เพราะคนแรก ๆ หมดคูลดาวน์ไปแล้ว */
const MAX_TRACKED = 30;

/** เพิ่งเจอคนนี้ไปหรือยัง (ยังห้ามเจอซ้ำ) */
export const isOnCooldown = (rivals: RecentRival[], opponentId: string, now = Date.now()): boolean =>
  rivals.some(
    (rival) => rival.id === opponentId && now - Date.parse(rival.at) < RIVAL_COOLDOWN_MS,
  );

/** เวลาที่เหลือก่อนเจอคนนี้ได้อีก (ms, 0 = เจอได้แล้ว) */
export const cooldownLeft = (
  rivals: RecentRival[],
  opponentId: string,
  now = Date.now(),
): number => {
  const rival = rivals.find((entry) => entry.id === opponentId);
  if (!rival) return 0;
  return Math.max(0, RIVAL_COOLDOWN_MS - (now - Date.parse(rival.at)));
};

/**
 * บันทึกว่าเพิ่งเจอคนนี้ พร้อมทิ้งรายการที่หมดคูลดาวน์แล้ว
 * คืนอาร์เรย์ชุดใหม่เสมอ (ไม่แก้ของเดิม)
 */
export const rememberRival = (
  rivals: RecentRival[],
  opponentId: string,
  now = Date.now(),
): RecentRival[] =>
  [
    { id: opponentId, at: new Date(now).toISOString() },
    ...rivals.filter(
      (rival) => rival.id !== opponentId && now - Date.parse(rival.at) < RIVAL_COOLDOWN_MS,
    ),
  ].slice(0, MAX_TRACKED);

/** ตัดคนที่ยังติดคูลดาวน์ออกจากรายชื่อคู่แข่ง */
export const filterAvailable = <T extends { id: string }>(
  candidates: T[],
  rivals: RecentRival[],
  now = Date.now(),
): T[] => candidates.filter((candidate) => !isOnCooldown(rivals, candidate.id, now));

/** ข้อความบอกเวลาที่เหลือแบบอ่านง่าย เช่น "12 นาที" */
export const formatCooldown = (ms: number): string => {
  const minutes = Math.ceil(ms / 60_000);
  return minutes >= 60 ? `${Math.ceil(minutes / 60)} ชั่วโมง` : `${minutes} นาที`;
};
