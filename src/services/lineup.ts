/**
 * กติกาว่านักเตะคนไหนยืนช่องไหนได้ และใครควรถูกเสนอให้เปลี่ยนตัวก่อน
 *
 * แยกมาไว้ที่เดียวเพราะมีสามที่ที่ต้องใช้กติกาชุดเดียวกันเป๊ะ ๆ:
 *   • หน้า MY TEAM ตอนลากการ์ดลงช่อง (useTeam)
 *   • การจัดตัวอัตโนมัติและการล้างเซฟเก่า (useTeam)
 *   • การเสนอตัวสำรองตอนมีคนบาดเจ็บกลางแมตช์ (MatchmakingPage)
 * ถ้าปล่อยให้แต่ละที่เขียนเงื่อนไขเอง สุดท้ายจะหลุดกันจนเกิดเคสประหลาด
 * เช่นระบบเสนอกองหน้าให้ไปยืนโกล
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { Player, Position } from '@/types/player';
import { POSITION_GROUP } from '@/utils/helpers';

/** ข้อมูลตำแหน่งเท่าที่กติกานี้ต้องใช้ (รับ Player เต็ม ๆ ก็ได้) */
export type PositionalPlayer = Pick<Player, 'position' | 'altPositions'>;

/** คนนี้เป็นผู้รักษาประตูไหม (ตำแหน่งหลักหรือตำแหน่งรองเป็น GK) */
export const isKeeper = (player: PositionalPlayer): boolean =>
  player.position === 'GK' || player.altPositions.includes('GK');

/** คนนี้ยืนตำแหน่งในสนามได้ไหม (ผู้รักษาประตูล้วน ๆ ยืนไม่ได้) */
const canPlayOutfield = (player: PositionalPlayer): boolean =>
  player.position !== 'GK' || player.altPositions.some((entry) => entry !== 'GK');

/**
 * นักเตะคนนี้ลงช่องนี้ได้ไหม
 *
 * ช่อง GK รับเฉพาะผู้รักษาประตู และผู้รักษาประตูล้วน ๆ ก็ออกไปยืนในสนามไม่ได้
 * ส่วนช่องอื่นในสนามยังสลับกันได้อิสระเหมือนเดิม (กองหลังไปยืนกองหน้าได้ แค่เสียโบนัสตำแหน่ง)
 * เกมนี้ให้อิสระเรื่องการจัดตัวสูงอยู่แล้ว กติกานี้จึงปิดเฉพาะเคสที่ผิดจนดูไม่ได้จริง ๆ
 */
export const canPlaySlot = (player: PositionalPlayer, slotPosition: Position): boolean =>
  slotPosition === 'GK' ? isKeeper(player) : canPlayOutfield(player);

/** เหตุผลที่ลงช่องนี้ไม่ได้ (null = ลงได้) — ใช้เป็นข้อความบอกผู้เล่นตรง ๆ */
export const slotBlockReason = (
  player: Player,
  slotPosition: Position,
): string | null => {
  if (canPlaySlot(player, slotPosition)) return null;

  return slotPosition === 'GK'
    ? `ช่องผู้รักษาประตูลงได้เฉพาะตำแหน่ง GK — ${player.name} เป็น ${player.position}`
    : `${player.name} เป็นผู้รักษาประตู ลงยืนตำแหน่งในสนามไม่ได้`;
};

/**
 * ความเข้ากันของนักเตะกับช่องหนึ่ง ยิ่งมากยิ่งควรถูกเสนอก่อน
 *
 *   3 = ตำแหน่งตรงกันเป๊ะ
 *   2 = เป็นตำแหน่งรองที่เขาเล่นได้
 *   1 = คนละตำแหน่งแต่จำพวกเดียวกัน (Defence / Midfield / Attack)
 *   0 = คนละจำพวก — ลงได้แต่เป็นทางเลือกสุดท้าย
 *  -1 = ลงช่องนี้ไม่ได้เลยตามกติกา
 */
export const positionFit = (player: PositionalPlayer, slotPosition: Position): number => {
  if (!canPlaySlot(player, slotPosition)) return -1;
  if (player.position === slotPosition) return 3;
  if (player.altPositions.includes(slotPosition)) return 2;

  const group = POSITION_GROUP[slotPosition];
  const sameGroup =
    POSITION_GROUP[player.position] === group ||
    player.altPositions.some((entry) => POSITION_GROUP[entry] === group);

  return sameGroup ? 1 : 0;
};

/** ป้ายสั้น ๆ บอกว่าทำไมถึงเสนอคนนี้ ใช้โชว์ในหน้าต่างเปลี่ยนตัว */
export const fitLabel = (fit: number): string => {
  if (fit >= 3) return 'ตำแหน่งตรงกัน';
  if (fit === 2) return 'เล่นตำแหน่งนี้ได้';
  if (fit === 1) return 'จำพวกเดียวกัน';
  return 'คนละจำพวก';
};

/**
 * เรียงตัวสำรองตามลำดับที่ควรเสนอ: ตำแหน่งตรงก่อน → จำพวกเดียวกัน → ที่เหลือ
 * เข้ากันเท่ากันค่อยตัดสินด้วยค่าพลัง
 */
export const compareForSlot = (
  a: { player: PositionalPlayer & { ovr: number } },
  b: { player: PositionalPlayer & { ovr: number } },
  slotPosition: Position,
): number => {
  const fit = positionFit(b.player, slotPosition) - positionFit(a.player, slotPosition);
  return fit !== 0 ? fit : b.player.ovr - a.player.ovr;
};
