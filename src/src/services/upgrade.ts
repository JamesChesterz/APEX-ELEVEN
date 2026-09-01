/**
 * ระบบตีบวกนักเตะ (+0 → +8)
 *
 * ⚠️ ไฟล์นี้ไม่มีตัวเลขของตัวเองแล้ว — ราคา โอกาสสำเร็จ และค่าพลังที่ได้
 * ทั้งหมดอ่านจาก src/data/upgradeConfig.ts ที่เดียว (PHASE 13)
 * ไฟล์นี้เหลือหน้าที่แค่ "แปลง level ↔ ค่าบวก" ให้โค้ดเดิมทั้งโปรเจกต์เรียกได้เหมือนเดิม
 *
 * มีสองทางที่จะตีบวกการ์ดหนึ่งใบ:
 *   1. จ่ายแต้มตีบวก (+ เหรียญตั้งแต่ขั้น +6) — มีโอกาสล้มเหลว
 *   2. รวมร่างการ์ดซ้ำ — ใช้การ์ดของนักเตะคนเดียวกันอีกใบ ได้ +1 แน่นอน ไม่เสียแต้ม
 *
 * ทางที่ 2 มีไว้แก้ปัญหาที่เกิดจากกฎ "ห้ามนักเตะชื่อซ้ำใน 11 ตัวจริง" โดยตรง
 *
 * ⚠️ เก็บใน card.level โดยที่ level 1 = +0 ดังนั้น "ค่าบวก" = level − 1 เสมอ
 * ทั้งโปรเจกต์ใช้ convention นี้อยู่แล้ว จึงไม่เพิ่มฟิลด์ upgrade ซ้ำซ้อนเข้าไปอีก
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import {
  canUpgrade,
  getRemainingCoinCost,
  getRemainingMaterialCost,
  getUpgradeBonus,
  getUpgradeStep,
  MAX_UPGRADE,
  UPGRADE_STEPS,
} from '@/data/upgradeConfig';
import type { Player, PlayerStats } from '@/types/player';
import { clamp } from '@/utils/helpers';

/** ตีบวกได้สูงสุด +8 (มาจาก upgradeConfig) */
export const MAX_PLUS = MAX_UPGRADE;

/** เลเวลสูงสุดของการ์ดหนึ่งใบ (level 1 = +0) */
export const MAX_LEVEL = MAX_PLUS + 1;

/**
 * ค่าพลังที่เพิ่มขึ้นต่อ 1 ขั้นของการตีบวก
 * อ่านจากขั้นแรกในตาราง เพื่อไม่ให้ค่าคงที่ตัวนี้หลุดจาก config ได้อีก
 */
export const OVR_PER_LEVEL = UPGRADE_STEPS[0].statBonus;

/** แต้มตีบวกที่ต้องใช้เพื่อไปให้ถึง +N (คีย์คือเลขบวกปลายทาง) — สร้างจาก config */
export const PLUS_COST: Record<number, number> = Object.fromEntries(
  UPGRADE_STEPS.map((step) => [step.to, step.materialCost]),
);

/** เหรียญที่ต้องใช้เพื่อไปให้ถึง +N (0 = ขั้นนั้นไม่คิดเหรียญ) — สร้างจาก config */
export const PLUS_COIN_COST: Record<number, number> = Object.fromEntries(
  UPGRADE_STEPS.map((step) => [step.to, step.coinCost]),
);

/** โอกาสสำเร็จของการตีบวกไปให้ถึง +N (1 = 100%) — สร้างจาก config */
export const PLUS_CHANCE: Record<number, number> = Object.fromEntries(
  UPGRADE_STEPS.map((step) => [step.to, step.successRate]),
);

/** ค่าบวกปัจจุบันของการ์ด (0–8) */
export const getPlus = (level: number): number => clamp(level, 1, MAX_LEVEL) - 1;

/** แปลงค่าบวกกลับเป็นเลเวลที่เก็บในการ์ด */
export const levelFromPlus = (plus: number): number => clamp(plus, 0, MAX_PLUS) + 1;

/** true = การ์ดใบนี้ยังตีบวกได้อีก */
export const canLevelUp = (level: number): boolean => canUpgrade(getPlus(level));

/** ค่าพลังที่เพิ่มจากการตีบวก (+0 = 0) */
export const getLevelBonus = (level: number): number => getUpgradeBonus(getPlus(level));

/**
 * แต้มตีบวกที่ต้องจ่ายเพื่อขึ้นอีกหนึ่งขั้นจากเลเวลปัจจุบัน
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const getUpgradeCost = (level: number): number | null =>
  getUpgradeStep(getPlus(level))?.materialCost ?? null;

/**
 * เหรียญที่ต้องจ่ายเพื่อขึ้นอีกหนึ่งขั้น (0 = ขั้นนี้ไม่คิดเหรียญ)
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const getUpgradeCoinCost = (level: number): number | null =>
  getUpgradeStep(getPlus(level))?.coinCost ?? null;

/**
 * โอกาสสำเร็จของการตีบวกขั้นถัดไป (0–1)
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const getUpgradeChance = (level: number): number | null =>
  getUpgradeStep(getPlus(level))?.successRate ?? null;

/** สุ่มว่าการตีบวกขั้นนี้สำเร็จไหม — เรียกครั้งเดียวต่อการกด 1 ครั้งเท่านั้น */
export const rollUpgrade = (level: number): boolean => {
  const chance = getUpgradeChance(level);
  return chance === null ? false : Math.random() < chance;
};

/** แต้มรวมที่ต้องใช้ถ้าตีบวกสำเร็จรวดเดียวจนถึง +8 (ใช้โชว์เป้าหมายระยะยาว) */
export const getRemainingUpgradeCost = (level: number): number =>
  getRemainingMaterialCost(getPlus(level));

/** เหรียญรวมที่ต้องใช้ถ้าตีบวกสำเร็จรวดเดียวจนถึง +8 */
export const getRemainingUpgradeCoinCost = (level: number): number =>
  getRemainingCoinCost(getPlus(level));

/**
 * นักเตะหลังบวกโบนัสจากการตีบวก
 *
 * ⚠️ ตัวนี้เป็น "ทางลัด" ที่รับ Player มาตรง ๆ (ใช้กับทีมคู่แข่งที่มีแค่ level ติดมา)
 * ถ้ามีการ์ดอยู่ในมือ ให้เรียก getEffectivePlayer() ใน services/playerAttributes.ts แทน
 * เพราะตัวนั้นคิดโบนัสการฝึกซ้อมและค่าที่แอดมินแก้ให้ด้วย
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
