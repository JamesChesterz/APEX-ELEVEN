/**
 * คำนวณค่าพลังทีม (Team OVR)
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { Player } from '@/types/player';
import type { FormationSlot, TeamRating } from '@/types/team';
import { POSITION_GROUP, toInt } from '@/utils/helpers';

/** ช่องหนึ่งช่องพร้อมนักเตะที่ลงในช่องนั้น (null = ยังว่าง) */
export interface RatedSlot {
  slot: FormationSlot;
  player: Player | null;
  /** เลเวลของการ์ดในช่องนี้ (1 = +0) ใช้แสดงค่าตีบวกบน UI */
  level?: number;
}

/** ค่าปรับเมื่อนักเตะเล่นผิดตำแหน่ง */
const OUT_OF_POSITION_PENALTY = 4;

/**
 * เกณฑ์เคมีที่ถือว่า "กลาง ๆ" (ไม่ได้โบนัส ไม่โดนหัก)
 * 0.75 = ประมาณทีมที่จัดตรงตำแหน่งบ้าง ตำแหน่งรองบ้าง
 */
const CHEMISTRY_NEUTRAL = 0.75;

/** ตัวคูณแปลงส่วนต่างเคมีเป็นค่าพลัง แล้วบีบไม่ให้เกินช่วงนี้ */
const CHEMISTRY_SCALE = 12;
const CHEMISTRY_MIN = -5;
const CHEMISTRY_MAX = 3;

/** ค่าพลังจริงของนักเตะในช่องนั้น หลังหักค่าปรับผิดตำแหน่ง */
export const getEffectiveOvr = ({ slot, player }: RatedSlot): number => {
  if (!player) return 0;
  if (player.position === slot.position) return player.ovr;
  if (player.altPositions.includes(slot.position)) return player.ovr - 1;
  return player.ovr - OUT_OF_POSITION_PENALTY;
};

/** แต้มความเข้ากันของหนึ่งช่อง: ตรงตำแหน่ง 3, ตำแหน่งรอง 2, ผิดตำแหน่ง 0 */
export const getChemistryPoints = ({ slot, player }: RatedSlot): number => {
  if (!player) return 0;
  if (player.position === slot.position) return 3;
  if (player.altPositions.includes(slot.position)) return 2;
  return 0;
};

/**
 * โบนัส/ค่าปรับค่าพลังทีมที่มาจากความเข้ากัน
 *
 * ทีมที่จัดตรงตำแหน่งทั้ง 11 คนได้ +3, ทีมที่ยัดคนผิดตำแหน่งไปครึ่งทีมโดน −3 ถึง −5
 * ค่านี้ถูกบวกเข้ากับค่าพลังทีมเฉพาะตอนลงแข่ง (matchOvr) ไม่ใช่ค่าพลังพื้นฐาน
 * จึงอธิบายให้ผู้เล่นเข้าใจได้ว่า "นักเตะเก่งเท่าเดิม แต่ทีมเล่นเข้าขากันหรือไม่"
 */
export const getChemistryBonus = (chemistry: number, maxChemistry: number): number => {
  if (maxChemistry === 0) return 0;
  const ratio = chemistry / maxChemistry;
  const bonus = Math.round(
    Math.min(CHEMISTRY_MAX, Math.max(CHEMISTRY_MIN, (ratio - CHEMISTRY_NEUTRAL) * CHEMISTRY_SCALE)),
  );

  // || 0 กัน -0 ที่เกิดจาก Math.round ของค่าติดลบเล็ก ๆ (ไม่งั้น UI จะโชว์ "-0 เคมี")
  return bonus || 0;
};

/** มูลค่านักเตะประเมินจากค่าพลัง (สูตรชั่วคราวของเฟสนี้) */
export const getPlayerValue = (ovr: number): number => Math.round(ovr ** 4 / 6);

const averageOf = (values: number[]): number =>
  values.length === 0 ? 0 : toInt(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * คำนวณค่าพลังทีม
 *
 * Team OVR = ผลรวม "ค่าพลังจริงในช่องนั้น" ของตัวจริงทั้ง 11 คน หารด้วยจำนวนช่องในแผน
 * ใช้ getEffectiveOvr ไม่ใช่ player.ovr ดิบ — วางคนผิดตำแหน่งจึงทำให้ค่าพลังทีมลดลงจริง
 * (ช่องที่ยังว่างนับเป็น 0 ค่าพลังทีมจึงลดลงจริงเมื่อจัดตัวไม่ครบ)
 *
 * matchOvr = Team OVR + โบนัสเคมี เป็นตัวเลขที่ใช้ตัดสินแพ้ชนะจริงตอนลงแข่ง
 */
export const calculateTeamRating = (slots: RatedSlot[]): TeamRating => {
  const filled = slots.filter((entry) => entry.player !== null);

  const byGroup = (group: 'gk' | 'defence' | 'midfield' | 'attack'): number[] =>
    filled
      .filter((entry) => POSITION_GROUP[entry.slot.position] === group)
      .map((entry) => getEffectiveOvr(entry));

  const totalOvr = filled.reduce((sum, entry) => sum + getEffectiveOvr(entry), 0);

  const ovr = slots.length === 0 ? 0 : toInt(totalOvr / slots.length);
  const chemistry = slots.reduce((sum, entry) => sum + getChemistryPoints(entry), 0);
  const maxChemistry = slots.length * 3;
  const chemistryBonus = getChemistryBonus(chemistry, maxChemistry);

  return {
    ovr,
    chemistryBonus,
    // ค่าพลังตอนลงแข่ง ไม่ให้ต่ำกว่า 1 แม้เคมีจะพังแค่ไหน
    matchOvr: Math.max(1, ovr + chemistryBonus),
    attack: averageOf(byGroup('attack')),
    midfield: averageOf(byGroup('midfield')),
    defence: averageOf([...byGroup('defence'), ...byGroup('gk')]),
    chemistry,
    maxChemistry,
    value: filled.reduce((sum, entry) => sum + getPlayerValue(entry.player?.ovr ?? 0), 0),
    emptySlots: slots.length - filled.length,
  };
};
