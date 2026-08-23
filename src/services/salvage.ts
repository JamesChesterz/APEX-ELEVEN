/**
 * ระบบย่อยการ์ด: แลกนักเตะที่ไม่ใช้แล้วเป็น "แต้ม"
 *
 * กติกา:
 *   - แต้มที่ได้คิดตามระดับการ์ด (rarity) เป็นฐาน แล้วบวกโบนัสตามค่าพลังและเลเวล
 *   - เพดานสูงสุดของการ์ดหนึ่งใบคือ 5,000 แต้ม ไม่ว่าจะเก่งแค่ไหน
 *   - การ์ดที่อยู่ใน 11 ตัวจริงย่อยไม่ได้ (ต้องเอาออกจากสนามก่อน)
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { Player, Rarity } from '@/types/player';
import { clamp } from '@/utils/helpers';

/**
 * เพดานแต้มต่อการ์ดหนึ่งใบ (ระดับ common–legendary)
 * mythical มีเพดานของตัวเองที่ MYTHICAL_MAX เพราะเป็นระดับที่หายากกว่ามาก
 */
export const SALVAGE_MAX = 5000;

/** เพดานแต้มของการ์ดระดับ mythical */
export const MYTHICAL_MAX = 9000;

/** เพดานแต้มแยกตามระดับการ์ด — เลข 4 ระดับเดิมคงค่าไว้ ไม่กระทบสมดุลของเดิม */
const RARITY_MAX: Record<Rarity, number> = {
  common: SALVAGE_MAX,
  rare: SALVAGE_MAX,
  epic: SALVAGE_MAX,
  legendary: SALVAGE_MAX,
  mythical: MYTHICAL_MAX,
};

/** ค่าฐานตามระดับการ์ด */
const BASE_POINTS: Record<Rarity, number> = {
  common: 300,
  rare: 900,
  epic: 2000,
  legendary: 3600,
  mythical: 6200,
};

/** แต้มที่ได้เพิ่มต่อ 1 OVR ที่เกินเกณฑ์ของระดับนั้น */
const OVR_BONUS: Record<Rarity, number> = {
  common: 6,
  rare: 12,
  epic: 20,
  legendary: 30,
  mythical: 48,
};

/** OVR ที่ถือว่า "พื้นฐาน" ของแต่ละระดับ ต่ำกว่านี้ไม่ได้โบนัส */
const OVR_FLOOR = 70;

/** แต้มที่ได้เพิ่มต่อ 1 เลเวลของการ์ด */
const LEVEL_BONUS = 120;

/** เพดานแต้มของการ์ดใบนี้ ขึ้นกับระดับการ์ด */
export const getSalvageCap = (player: Player): number => RARITY_MAX[player.rarity];

/**
 * แต้มที่จะได้จากการย่อยการ์ดหนึ่งใบ
 * ผลลัพธ์ถูกบีบไม่ให้เกินเพดานของระดับนั้นเสมอ
 */
export const getSalvageValue = (player: Player, level = 1): number => {
  const base = BASE_POINTS[player.rarity];
  const ovrBonus = Math.max(0, player.ovr - OVR_FLOOR) * OVR_BONUS[player.rarity];
  const levelBonus = Math.max(0, level - 1) * LEVEL_BONUS;

  return Math.round(clamp(base + ovrBonus + levelBonus, 0, getSalvageCap(player)));
};

/** true เมื่อการ์ดใบนี้ให้แต้มเต็มเพดานแล้ว (ใช้โชว์ป้าย "เต็มเพดาน" ใน UI) */
export const isMaxSalvage = (player: Player, level = 1): boolean =>
  getSalvageValue(player, level) >= getSalvageCap(player);

/** รวมแต้มของการ์ดหลายใบ ใช้ตอนเลือกย่อยพร้อมกัน */
export const getSalvageTotal = (entries: Array<{ player: Player; level?: number }>): number =>
  entries.reduce((total, entry) => total + getSalvageValue(entry.player, entry.level ?? 1), 0);
