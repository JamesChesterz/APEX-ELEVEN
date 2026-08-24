/**
 * ระบบตีบวกนักเตะ (+1 → +5)
 *
 * มีสองทางที่จะตีบวกการ์ดหนึ่งใบ:
 *   1. จ่าย "แต้มตีบวก" — ราคาคงที่ตามขั้นที่จะไป และมีโอกาสล้มเหลว
 *   2. รวมร่างการ์ดซ้ำ — ใช้การ์ดของนักเตะคนเดียวกันอีกใบ ได้ +1 แน่นอน ไม่เสียแต้ม
 *
 * ทางที่ 2 มีไว้แก้ปัญหาที่เกิดจากกฎ "ห้ามนักเตะชื่อซ้ำใน 11 ตัวจริง" โดยตรง
 * เพราะเดิมทีเปิดซองได้คนเดิมซ้ำ = ได้ของที่ลงสนามพร้อมกันไม่ได้ ต้องย่อยทิ้งอย่างเดียว
 *
 * ⚠️ เก็บใน card.level โดยที่ level 1 = +0 ดังนั้น "ค่าบวก" = level − 1 เสมอ
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { Player, PlayerStats } from '@/types/player';
import { clamp } from '@/utils/helpers';

/** ตีบวกได้สูงสุด +5 */
export const MAX_PLUS = 5;

/** เลเวลสูงสุดของการ์ดหนึ่งใบ (level 1 = +0) */
export const MAX_LEVEL = MAX_PLUS + 1;

/** ค่าพลังที่เพิ่มขึ้นต่อ 1 ขั้นของการตีบวก */
export const OVR_PER_LEVEL = 2;

/** แต้มตีบวกที่ต้องใช้เพื่อไปให้ถึง +N (คีย์คือเลขบวกปลายทาง) */
export const PLUS_COST: Record<number, number> = {
  1: 500,
  2: 1_000,
  3: 2_000,
  4: 3_000,
  5: 5_000,
};

/** โอกาสสำเร็จของการตีบวกไปให้ถึง +N (1 = 100%) */
export const PLUS_CHANCE: Record<number, number> = {
  1: 1,
  2: 0.8,
  3: 0.7,
  4: 0.4,
  5: 0.3,
};

/** ค่าบวกปัจจุบันของการ์ด (0–5) */
export const getPlus = (level: number): number => clamp(level, 1, MAX_LEVEL) - 1;

/** true = การ์ดใบนี้ยังตีบวกได้อีก */
export const canLevelUp = (level: number): boolean => level < MAX_LEVEL;

/** ค่าพลังที่เพิ่มจากการตีบวก (+0 = 0) */
export const getLevelBonus = (level: number): number => getPlus(level) * OVR_PER_LEVEL;

/**
 * แต้มตีบวกที่ต้องจ่ายเพื่อขึ้นอีกหนึ่งขั้นจากเลเวลปัจจุบัน
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const getUpgradeCost = (level: number): number | null =>
  canLevelUp(level) ? PLUS_COST[getPlus(level) + 1] ?? null : null;

/**
 * โอกาสสำเร็จของการตีบวกขั้นถัดไป (0–1)
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const getUpgradeChance = (level: number): number | null =>
  canLevelUp(level) ? PLUS_CHANCE[getPlus(level) + 1] ?? null : null;

/** สุ่มว่าการตีบวกขั้นนี้สำเร็จไหม — เรียกครั้งเดียวต่อการกด 1 ครั้งเท่านั้น */
export const rollUpgrade = (level: number): boolean => {
  const chance = getUpgradeChance(level);
  return chance === null ? false : Math.random() < chance;
};

/** แต้มรวมที่ต้องใช้ถ้าตีบวกสำเร็จรวดเดียวจนถึง +5 (ใช้โชว์เป้าหมายระยะยาว) */
export const getRemainingUpgradeCost = (level: number): number => {
  let total = 0;
  for (let plus = getPlus(level) + 1; plus <= MAX_PLUS; plus += 1) {
    total += PLUS_COST[plus] ?? 0;
  }
  return total;
};

/**
 * นักเตะหลังบวกโบนัสจากการตีบวก
 *
 * ใช้ตรงจุดเดียวคือตอนแปลง "การ์ด" เป็น "นักเตะ" ใน useTeam
 * ทุกอย่างที่อยู่ถัดจากนั้น (Team OVR, เคมี, โอกาสชนะ, หน้าต่างเลือกตัว)
 * จึงเห็นค่าที่ตีบวกแล้วโดยอัตโนมัติ ไม่ต้องแก้ทีละที่
 *
 * ⚠️ อย่าเรียกซ้อนสองครั้งกับการ์ดใบเดียวกัน เพราะโบนัสจะถูกบวกซ้ำ
 * คลังการ์ด (ownedCards) จึงเก็บนักเตะแบบค่าดิบไว้เสมอ
 */
export const applyLevel = (player: Player, level: number): Player => {
  const bonus = getLevelBonus(level);
  if (bonus === 0) return player;

  const boost = (value: number): number => Math.min(99, value + bonus);
  const stats: PlayerStats = {
    pace: boost(player.stats.pace),
    shooting: boost(player.stats.shooting),
    passing: boost(player.stats.passing),
    dribbling: boost(player.stats.dribbling),
    defending: boost(player.stats.defending),
    physical: boost(player.stats.physical),
  };

  return { ...player, ovr: player.ovr + bonus, stats };
};

/** ค่าพลังของการ์ดใบนี้หลังตีบวกแล้ว (ใช้โชว์ตัวเลขบน UI) */
export const getLeveledOvr = (player: Player, level: number): number =>
  player.ovr + getLevelBonus(level);
