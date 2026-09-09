/**
 * ระบบผสมการ์ดนักเตะ (CARD FUSION)
 *
 * กติกาข้อเดียวจบ: เอาการ์ด "ระดับเดียวกัน" 3 ใบมาผสม → ได้การ์ดระดับเดิม 1 ใบ
 * แต่เป็นนักเตะคนใหม่ที่สุ่มมา พร้อมค่าตีบวก +1 ถึง +8 ที่สุ่มเช่นกัน
 *
 *   • ระดับ = rarity ของนักเตะ (common → mythical) ไม่ใช่ค่าตีบวก
 *     ผสม legendary 3 ใบ ก็ได้ legendary กลับมาเสมอ ระดับไม่มีทางตกหรือขึ้น
 *   • ค่าตีบวกของ "วัสดุ" มีผลกับโอกาส โดยดูจากใบที่บวกน้อยที่สุดในสามใบ
 *     (ดู getMaterialPlus) — เอาการ์ดบวกสูงมาผสม โอกาสได้ผลลัพธ์บวกสูงก็ขยับขึ้น
 *   • +8 ครบสามใบ → โอกาสออก +8 เท่ากับ 20% พอดี (แถวสุดท้ายของ FUSION_ODDS)
 *   • +7 ขึ้นไปครบสามใบ → มีโอกาสได้เงินก้อน 1–2 ล้านแถมมาด้วย
 *
 * ⚠️ ทำไมใช้ "ใบที่บวกน้อยที่สุด" ไม่ใช่ค่าเฉลี่ย
 * เพราะโจทย์พูดถึงเงื่อนไขแบบ "ครบ 3 ใบ" (+8 ครบ 3 ใบ / +7 ขึ้นไปครบ 3 ใบ)
 * ค่าต่ำสุดคือตัวเดียวที่ตอบคำถามนั้นได้ตรง ๆ ถ้าใช้ค่าเฉลี่ยจะเปิดช่องให้
 * เอา +8 สองใบ + ใบขยะหนึ่งใบมาไต่โอกาสได้ ซึ่งผิดเจตนาของกติกา
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { PLAYERS } from '@/data/players';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import type { Player, Rarity } from '@/types/player';
import { clamp, createId, pickRandom } from '@/utils/helpers';

/* ── ค่าคงที่ของระบบ ────────────────────────────────────────── */

/** ใช้การ์ดกี่ใบต่อการผสมหนึ่งครั้ง */
export const FUSION_MATERIALS = 3;

/** จำนวนการ์ดคว่ำที่โชว์ให้เลือกตอนลุ้นผล */
export const FUSION_CANDIDATES = 5;

/** ค่าตีบวกต่ำสุด/สูงสุดที่ผสมออกมาได้ (+0 ไม่มีทางออก เพราะผสมแล้วต้องได้อะไรกลับไปเสมอ) */
export const FUSION_MIN_PLUS = 1;
export const FUSION_MAX_PLUS = MAX_UPGRADE;

/** ต้องบวกอย่างน้อยเท่านี้ครบทุกใบ ถึงจะมีสิทธิ์ลุ้นเงินก้อน */
export const FUSION_CASH_MIN_PLUS = 7;
/** โอกาสได้เงินก้อนเมื่อเข้าเงื่อนไขข้างบนแล้ว */
export const FUSION_CASH_CHANCE = 0.3;
/** ช่วงเงินก้อนที่แถมมา (ปัดเป็นขั้นละ 1 แสน) */
export const FUSION_CASH_MIN = 1_000_000;
export const FUSION_CASH_MAX = 2_000_000;
export const FUSION_CASH_STEP = 100_000;

/**
 * ตารางโอกาสของค่าตีบวกที่จะออก — คีย์คือค่าบวกต่ำสุดของวัสดุ (0–8)
 * แต่ละแถวคือน้ำหนักของผลลัพธ์ +1, +2, … , +8 ตามลำดับ รวมกันได้ 100 พอดี
 *
 * แถว 8 คือข้อกำหนดตรง ๆ ของเกม: ใช้ +8 ครบสามใบ โอกาสออก +8 = 20%
 * แถวอื่นไล่ระดับลงมาให้โค้งต่อเนื่อง ไม่มีขั้นไหนกระโดด
 * อยากปรับความยาก แก้ที่ตารางนี้ที่เดียว โค้ดส่วนอื่นไม่มีตัวเลขของตัวเองเลย
 */
export const FUSION_ODDS: Record<number, number[]> = {
  0: [45, 27, 15, 8, 3, 1.4, 0.5, 0.1],
  1: [38, 28, 17, 9, 4.5, 2, 1, 0.5],
  2: [30, 27, 20, 12, 6, 3, 1.4, 0.6],
  3: [22, 24, 22, 15, 9, 5, 2, 1],
  4: [15, 20, 22, 18, 12, 8, 3.5, 1.5],
  5: [10, 15, 20, 20, 16, 11, 5, 3],
  6: [6, 10, 16, 20, 19, 15, 9, 5],
  7: [3, 6, 11, 16, 20, 20, 14, 10],
  8: [1, 3, 6, 11, 17, 20, 22, 20],
};

/* ── อ่านค่าจากชุดวัสดุ ─────────────────────────────────────── */

/**
 * ค่าบวกที่ใช้ตัดสินโอกาส = ใบที่บวกน้อยที่สุดในชุด
 * ชุดว่าง = 0 (ยังไม่ได้เลือกอะไร ให้โชว์แถวแย่ที่สุดไปก่อน)
 */
export const getMaterialPlus = (cards: Array<Pick<CardInstance, 'level'>>): number => {
  if (cards.length === 0) return 0;
  return cards.reduce((low, card) => Math.min(low, getCardUpgrade(card)), MAX_UPGRADE);
};

/** ระดับการ์ดของชุดนี้ — คืน null ถ้าระดับไม่ตรงกันหรือหานักเตะไม่เจอ */
export const getMaterialRarity = (
  cards: Array<Pick<CardInstance, 'playerId'>>,
): Rarity | null => {
  if (cards.length === 0) return null;

  const rarities = cards.map((card) => getBasePlayer(card.playerId)?.rarity);
  if (rarities.some((rarity) => !rarity)) return null;

  return rarities.every((rarity) => rarity === rarities[0]) ? (rarities[0] as Rarity) : null;
};

/** ตารางโอกาสของชุดวัสดุระดับนี้ ในรูปที่เอาไปโชว์บน UI ได้เลย */
export const getFusionOdds = (materialPlus: number): Array<{ plus: number; chance: number }> => {
  const row = FUSION_ODDS[clamp(Math.trunc(materialPlus), 0, MAX_UPGRADE)] ?? FUSION_ODDS[0];
  return row.map((chance, index) => ({ plus: FUSION_MIN_PLUS + index, chance }));
};

/** ชุดนี้มีสิทธิ์ลุ้นเงินก้อนไหม (ต้อง +7 ขึ้นไปครบทุกใบ) */
export const canWinCash = (materialPlus: number): boolean => materialPlus >= FUSION_CASH_MIN_PLUS;

/* ── กติกาว่าการ์ดใบไหนเอามาผสมได้ ──────────────────────────── */

/** เหตุผลที่การ์ดใบนี้ผสมไม่ได้ — null = ใช้ได้ */
export type FusionBlockReason = 'locked' | 'inSquad' | 'rarity';

export interface FusionEligibility {
  /** id ของการ์ดที่ลงสนาม/นั่งสำรองอยู่ (ห้ามเอามาผสม) */
  usedCardIds: Set<string>;
  /** ระดับที่ล็อกไว้แล้วจากใบแรกที่เลือก — null = ยังเลือกได้ทุกระดับ */
  rarity: Rarity | null;
}

/**
 * ตรวจว่าการ์ดใบนี้หย่อนลงช่องผสมได้ไหม
 * แยกออกมาเป็นฟังก์ชันเดียวเพราะทั้งหน้าเลือกการ์ดและตอนกดยืนยันต้องใช้กติกาชุดเดียวกัน
 */
export const getFusionBlockReason = (
  card: CardInstance,
  { usedCardIds, rarity }: FusionEligibility,
): FusionBlockReason | null => {
  if (isCardLocked(card)) return 'locked';
  if (usedCardIds.has(card.id)) return 'inSquad';

  const cardRarity = getBasePlayer(card.playerId)?.rarity;
  if (!cardRarity) return 'rarity';
  if (rarity && cardRarity !== rarity) return 'rarity';

  return null;
};

/** ข้อความอธิบายเหตุผลที่ใช้ใบนี้ไม่ได้ */
export const FUSION_BLOCK_TEXT: Record<FusionBlockReason, string> = {
  locked: 'การ์ดใบนี้ถูกล็อกไว้',
  inSquad: 'การ์ดใบนี้อยู่ในทีมตัวจริง/สำรอง',
  rarity: 'ต้องเป็นการ์ดระดับเดียวกันทั้ง 3 ใบ',
};

/* ── การสุ่มผลลัพธ์ ─────────────────────────────────────────── */

/** นักเตะทุกคนที่ผสมออกมาได้ในระดับนี้ */
export const getFusionPool = (rarity: Rarity): Player[] =>
  PLAYERS.filter((player) => player.rarity === rarity);

/** ผลที่ซ่อนอยู่ในการ์ดคว่ำหนึ่งใบ */
export interface FusionCandidate {
  id: string;
  playerId: string;
  /** ค่าตีบวกของการ์ดที่จะได้ (1–8) */
  plus: number;
  /** เงินก้อนที่แถมมา (0 = ไม่ได้) */
  cash: number;
}

/** สุ่มค่าตีบวกหนึ่งค่าตามตารางโอกาสของชุดวัสดุ */
export const rollFusionPlus = (materialPlus: number, random = Math.random): number => {
  const odds = getFusionOdds(materialPlus);
  const total = odds.reduce((sum, entry) => sum + entry.chance, 0);

  let ticket = random() * total;
  for (const entry of odds) {
    ticket -= entry.chance;
    if (ticket <= 0) return entry.plus;
  }
  return odds[odds.length - 1].plus;
};

/**
 * สุ่มเงินก้อนแถม — คืน 0 เมื่อไม่เข้าเงื่อนไขหรือดวงไม่ถึง
 * เรียกครั้งเดียวต่อการ์ดคว่ำหนึ่งใบ
 */
export const rollFusionCash = (materialPlus: number, random = Math.random): number => {
  if (!canWinCash(materialPlus)) return 0;
  if (random() >= FUSION_CASH_CHANCE) return 0;

  const steps = Math.floor((FUSION_CASH_MAX - FUSION_CASH_MIN) / FUSION_CASH_STEP) + 1;
  return FUSION_CASH_MIN + Math.floor(random() * steps) * FUSION_CASH_STEP;
};

/**
 * สุ่มผลของการ์ดคว่ำครบทุกใบในครั้งเดียว
 *
 * ⚠️ ทุกใบสุ่มด้วยตารางเดียวกันและเป็นอิสระต่อกัน ผู้เล่นจะเปิดใบไหนก่อนก็ได้
 * โอกาสเท่ากันหมด — การเลือกช่องเป็นเรื่องบรรยากาศล้วน ไม่มีใบไหน "ดีกว่า" ซ่อนอยู่
 */
export const rollFusionCandidates = (
  rarity: Rarity,
  materialPlus: number,
  count = FUSION_CANDIDATES,
  random = Math.random,
): FusionCandidate[] => {
  const pool = getFusionPool(rarity);
  const fallback = pool.length > 0 ? pool : PLAYERS;

  return Array.from({ length: count }, () => ({
    id: createId('fuse'),
    playerId: pickRandom(fallback).id,
    plus: rollFusionPlus(materialPlus, random),
    cash: rollFusionCash(materialPlus, random),
  }));
};
