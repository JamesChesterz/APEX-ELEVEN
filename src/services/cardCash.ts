/**
 * สูตรตีราคาการ์ดเป็นเงิน + เพดานรายวัน
 *
 * ราคาคิดจากสามอย่างคูณกัน: ระดับการ์ด (rarity) × ค่าพลัง (OVR) × ค่าตีบวก
 * ใช้คูณไม่ใช่บวก เพราะอยากให้ "การ์ดดีทุกด้าน" แพงกว่าการ์ดที่ดีด้านเดียวมาก ๆ
 * ผลคือ mythical +8 OVR สูง แพงกว่าการ์ดธรรมดาหลายร้อยเท่า ไม่ใช่แค่ไม่กี่เท่า
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { dateKey } from '@/services/loginBonus';
import type { CardCashConfig, CardCashState } from '@/types/cardCash';
import type { Player, Rarity } from '@/types/player';

/** ค่าตั้งเริ่มต้นเมื่อแอดมินยังไม่เคยตั้ง */
export const DEFAULT_CARD_CASH: CardCashConfig = {
  enabled: true,
  // เพดานรายวัน 1 ล้าน ตามที่ตั้งไว้ตอนออกแบบระบบ — ปรับได้ในหน้าแอดมิน
  dailyLimit: 1_000_000,
  rate: 1,
  maxPerExchange: 100,
};

/** ราคาฐานตามระดับการ์ด (ที่ OVR 80 · ค่าบวก 0) */
const BASE_PRICE: Record<Rarity, number> = {
  common: 2_000,
  rare: 4_000,
  epic: 8_000,
  legendary: 15_000,
  /*
   * ตั้งไว้ให้การ์ด mythical +8 ใบเก่งสุดในเกมตอนนี้ราคาต่ำกว่าเพดานรายวัน (1 ล้าน) เล็กน้อย
   * ถ้าดันทะลุเพดาน ผู้เล่นจะขายใบเดียวแล้วเสียเงินส่วนเกินฟรี ๆ โดยไม่มีทางเลี่ยง
   * (ตัดใบอื่นออกก็ไม่ช่วย เพราะมีใบเดียว) — เจอกรณีนี้ให้ขยับเพดานในหน้าแอดมินขึ้นแทน
   */
  mythical: 26_000,
};

/** OVR ที่ถือเป็นเกณฑ์กลาง — สูงกว่านี้ราคาขึ้น ต่ำกว่าราคาลง */
const OVR_PIVOT = 80;

/**
 * ความชันของราคาตาม OVR
 *
 * ใช้ยกกำลังแทนการคูณตรง ๆ เพราะ OVR ในเกมนี้ไปได้ถึง 158
 * ถ้าคิดเป็นเส้นตรง การ์ด OVR 150 จะแพงกว่า OVR 80 แค่ไม่ถึงสองเท่า
 * ซึ่งไม่สะท้อนว่ามันหายากกว่ากันมากแค่ไหน
 */
const OVR_CURVE = 2.4;

/**
 * ตัวคูณตามค่าตีบวก (+0 → +8)
 *
 * โตแบบทบต้น ไม่ใช่เพิ่มทีละเท่ากัน เพราะขั้นท้าย ๆ ตีติดยากกว่าขั้นต้นมาก
 * ผลคือ +8 แพงกว่า +0 ราว 12 เท่า ซึ่งพอ ๆ กับต้นทุนการ์ดที่เผาไปจริง
 */
const UPGRADE_MULTIPLIER = [1, 1.25, 1.6, 2.1, 2.8, 3.9, 5.6, 8.2, 12];

/** ตัวคูณของค่าบวกนั้น (บีบให้อยู่ในตารางเสมอ) */
export const getUpgradeMultiplier = (plus: number): number =>
  UPGRADE_MULTIPLIER[Math.min(Math.max(Math.trunc(plus) || 0, 0), MAX_UPGRADE)] ?? 1;

/**
 * ราคาแลกเป็นเงินของการ์ดหนึ่งใบ
 *
 * @param level เลเวลการ์ด (1 = +0) ตามที่เก็บใน CardInstance
 */
export const getCardCashValue = (
  player: Player,
  level = 1,
  config: CardCashConfig = DEFAULT_CARD_CASH,
): number => {
  const plus = Math.max(0, (Math.trunc(level) || 1) - 1);
  const ovrFactor = Math.pow(Math.max(1, player.ovr) / OVR_PIVOT, OVR_CURVE);

  const value =
    BASE_PRICE[player.rarity] * ovrFactor * getUpgradeMultiplier(plus) * Math.max(0, config.rate);

  // ปัดเป็นหลักร้อย ตัวเลขบนหน้าจอจะได้อ่านง่าย ไม่ใช่ 12,347
  return Math.max(100, Math.round(value / 100) * 100);
};

/* ── โบนัสแลกทีละหลายใบ ─────────────────────────────────────── */

/**
 * ยิ่งแลกทีเดียวหลายใบยิ่งได้โบนัส
 * ตั้งใจให้ผู้เล่นเคลียร์คลังทีเดียว แทนที่จะมานั่งกดทีละใบวันละสิบรอบ
 */
const BULK_BONUS: Array<{ min: number; rate: number }> = [
  { min: 20, rate: 0.15 },
  { min: 10, rate: 0.1 },
  { min: 2, rate: 0.05 },
];

/** อัตราโบนัสของการแลกจำนวนนี้ (0 = ไม่มีโบนัส) */
export const getBulkBonusRate = (count: number): number =>
  BULK_BONUS.find((tier) => count >= tier.min)?.rate ?? 0;

export interface ExchangeQuote {
  /** จำนวนการ์ดที่เลือก */
  count: number;
  /** รวมมูลค่าการ์ดก่อนโบนัส */
  subtotal: number;
  /** อัตราโบนัส (0.05 = 5%) */
  bonusRate: number;
  /** เงินโบนัส */
  bonus: number;
  /** เงินที่จะได้จริงหลังหักเพดานรายวันแล้ว */
  total: number;
  /** ส่วนที่เกินเพดานรายวัน (0 = ไม่เกิน) */
  capped: number;
}

/** คิดยอดของรายการที่เลือก โดยดูเพดานรายวันที่เหลือด้วย */
export const quoteExchange = (
  entries: Array<{ player: Player; level?: number }>,
  config: CardCashConfig,
  remainingToday: number,
): ExchangeQuote => {
  const subtotal = entries.reduce(
    (sum, entry) => sum + getCardCashValue(entry.player, entry.level ?? 1, config),
    0,
  );

  const bonusRate = getBulkBonusRate(entries.length);
  const bonus = Math.round(subtotal * bonusRate);
  const gross = subtotal + bonus;

  // เกินเพดานแล้วได้แค่เท่าที่เหลือ ส่วนเกินหายไป — จึงต้องเตือนก่อนกดยืนยัน
  const total = Math.min(gross, Math.max(0, remainingToday));

  return {
    count: entries.length,
    subtotal,
    bonusRate,
    bonus,
    total,
    capped: gross - total,
  };
};

/* ── เพดานรายวัน ────────────────────────────────────────────── */

/** บีบค่าตั้งจากเซิร์ฟเวอร์ให้ใช้งานได้เสมอ */
export const normalizeCardCash = (
  raw: Partial<CardCashConfig> | null | undefined,
): CardCashConfig => {
  const num = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };

  return {
    enabled: raw?.enabled !== false,
    dailyLimit: Math.round(num(raw?.dailyLimit, DEFAULT_CARD_CASH.dailyLimit, 0, 1_000_000_000)),
    rate: num(raw?.rate, DEFAULT_CARD_CASH.rate, 0, 100),
    maxPerExchange: Math.round(num(raw?.maxPerExchange, DEFAULT_CARD_CASH.maxPerExchange, 1, 500)),
  };
};

/** ยอดของวันนี้ — คนละวันกับที่บันทึกไว้ = เริ่มนับใหม่จากศูนย์ */
export const normalizeCardCashState = (
  raw: Partial<CardCashState> | null | undefined,
  now = new Date(),
): CardCashState => {
  const today = dateKey(now);
  const earned = Math.max(0, Math.trunc(Number(raw?.earned)) || 0);

  return raw?.date === today ? { date: today, earned } : { date: today, earned: 0 };
};

/** เงินที่ยังแลกได้อีกวันนี้ */
export const getRemainingToday = (state: CardCashState, config: CardCashConfig): number =>
  Math.max(0, config.dailyLimit - state.earned);
