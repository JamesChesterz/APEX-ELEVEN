/**
 * ═══════════════════════════════════════════════════════════════
 *  PLAYER ATTRIBUTE ENGINE (PHASE 11)
 * ═══════════════════════════════════════════════════════════════
 *
 * แหล่งเดียวที่ตอบคำถามว่า "การ์ดใบนี้แรงเท่าไรกันแน่"
 * ทุกระบบต้องเรียกผ่านที่นี่ ห้ามคิดสูตรเองแยกไว้ที่ UI หรือที่เซิร์ฟเวอร์
 *
 *   Base Player  (players.ts / roster.ts)
 *        ↓
 *   ค่าที่แอดมินแก้ทับ  (config/playerOverrides)
 *        ↓
 *   + โบนัสตีบวก        (upgradeConfig)
 *        ↓
 *   + โบนัสฝึกซ้อม      (TRAINING_BONUS_PER_LEVEL)
 *        ↓
 *   Effective Stats → Effective OVR
 *        ↓
 *   Position Adjustment (teamRating.effectiveOvrOf)
 *        ↓
 *   Team OVR → Match Engine
 *
 * ⚠️ เรื่อง OVR: เกมนี้คำนวณ "ค่าพลัง 6 ด้าน จาก OVR" (ดู STAT_PROFILE ใน autoPlayer.ts)
 * ไม่ใช่ทางกลับ และการ์ดใน roster มี OVR ถึง 122 ขณะที่ค่าพลังตันที่ 99
 * ถ้าเขียนสูตร stats → OVR ขึ้นมาใหม่ ตัวเลขจะไม่ตรงกับที่เกมใช้อยู่ทั้งระบบ
 * OVR ที่เชื่อถือได้จึงเป็น "OVR พื้นฐาน + โบนัส" เสมอ ไม่มีสูตรที่สอง
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById } from '@/data/players';
import { getUpgradeBonus } from '@/data/upgradeConfig';
import { effectiveOvrOf } from '@/services/teamRating';
import type { CardInstance } from '@/types/card';
import type { Player, PlayerStats, Position } from '@/types/player';
import { clamp } from '@/utils/helpers';

/* ── กฎค่าพลังของเกมนี้ ─────────────────────────────────────── */

/**
 * ค่าพลังแต่ละด้านอยู่ในช่วงนี้เสมอ
 * ตรงกับที่ buildStats ใน autoPlayer.ts กับ applyLevel เดิมใช้กันอยู่แล้ว
 */
export const MIN_STAT = 1;
export const MAX_STAT = 99;

/** ฝึกซ้อมได้สูงสุดกี่ระดับ */
export const MAX_TRAINING = 5;

/** ค่าพลังที่ได้ต่อการฝึกซ้อมหนึ่งระดับ */
export const TRAINING_BONUS_PER_LEVEL = 1;

/* ── ค่าที่แอดมินแก้ทับ ─────────────────────────────────────── */

/**
 * ค่าพื้นฐานที่แอดมินแก้จากหน้า ADMIN → ค่าพลังนักเตะ
 * เก็บที่ config/playerOverrides แล้ว useGameConfig เป็นคนโหลดมาใส่ที่นี่ตอนเปิดเกม
 *
 * ที่ต้องเป็น module state เพราะ Attribute Engine เป็น pure function ที่ถูกเรียก
 * จากทุกที่รวมถึงฝั่งเซิร์ฟเวอร์ ส่ง override เข้าไปทีละสายเรียกไม่ไหว
 */
export interface PlayerOverride {
  ovr?: number;
  stats?: Partial<PlayerStats>;
}

let PLAYER_OVERRIDES: Record<string, PlayerOverride> = {};

/** ใส่ค่าที่แอดมินแก้ทับทั้งชุด (เรียกจาก useGameConfig ตอนโหลดค่าตั้ง) */
export const setPlayerOverrides = (next: Record<string, PlayerOverride> | null): void => {
  PLAYER_OVERRIDES = next ?? {};
};

/** อ่านค่าที่แอดมินแก้ทับทั้งชุด (หน้า ADMIN ใช้แสดงว่าตอนนี้แก้อะไรไว้บ้าง) */
export const getPlayerOverrides = (): Record<string, PlayerOverride> => PLAYER_OVERRIDES;

/** ล้างค่าที่แก้ทับทั้งหมด (ใช้ในเทส) */
export const clearPlayerOverrides = (): void => {
  PLAYER_OVERRIDES = {};
};

/* ── ชั้นที่ 1: Base Player ─────────────────────────────────── */

/**
 * นักเตะพื้นฐานหลังใส่ค่าที่แอดมินแก้ทับแล้ว
 * นี่คือจุดเดียวที่ override ถูกนำมาใช้ — ที่อื่นไม่ต้องรู้ว่ามีระบบ override อยู่
 */
export const getBasePlayer = (playerId: string): Player | undefined => {
  const player = getPlayerById(playerId);
  if (!player) return undefined;

  const override = PLAYER_OVERRIDES[playerId];
  if (!override) return player;

  return {
    ...player,
    ovr: override.ovr ?? player.ovr,
    stats: { ...player.stats, ...override.stats },
  };
};

/** ค่าพลัง 6 ด้านพื้นฐานของนักเตะคนนี้ (ยังไม่คิดตีบวก/ฝึกซ้อม) */
export const getBasePlayerStats = (playerId: string): PlayerStats | undefined =>
  getBasePlayer(playerId)?.stats;

/* ── ชั้นที่ 2: โบนัสของการ์ดใบนั้น ─────────────────────────── */

/** โบนัสค่าพลังจากการตีบวก (+0 = 0) — ตัวเลขมาจาก upgradeConfig ที่เดียว */
export { getUpgradeBonus };

/** โบนัสค่าพลังจากการฝึกซ้อม */
export const getTrainingBonus = (training: number | undefined): number =>
  clamp(Math.trunc(training ?? 0) || 0, 0, MAX_TRAINING) * TRAINING_BONUS_PER_LEVEL;

/**
 * ค่าบวกของการ์ดใบนี้ (0–8)
 * ทำซ้ำไว้ที่นี่แทนการ import จาก cardInstance.ts เพื่อไม่ให้ import วนกัน —
 * cardInstance.ts เป็นฝ่ายเรียกไฟล์นี้
 */
const upgradeOf = (card: Pick<CardInstance, 'level'>): number =>
  Math.max(0, Math.trunc(card.level || 1) - 1);

/* ── ชั้นที่ 3: Effective Stats / OVR ───────────────────────── */

/**
 * โบนัสรวมทุกทางของการ์ดใบนี้ (ตีบวก + ฝึกซ้อม)
 * ใช้ตัวเดียวกันทั้งกับค่าพลังและ OVR เพื่อให้ตัวเลขบนการ์ดกับในสนามตรงกันเสมอ
 */
export const getCardBonus = (card: Pick<CardInstance, 'level' | 'training'>): number =>
  getUpgradeBonus(upgradeOf(card)) + getTrainingBonus(card.training);

/**
 * ค่าพลัง 6 ด้านจริงของการ์ดใบนี้
 *
 * สูตร: ค่าพื้นฐาน + ค่าที่ roster/แอดมินใส่ทับ + โบนัสตีบวก + โบนัสฝึกซ้อม
 * แล้วบีบให้อยู่ในช่วง 1–99 ตามกฎของเกม
 */
export const getEffectivePlayerStats = (
  card: Pick<CardInstance, 'playerId' | 'level' | 'training'>,
): PlayerStats | undefined => {
  const base = getBasePlayerStats(card.playerId);
  if (!base) return undefined;

  const bonus = getCardBonus(card);
  const boost = (value: number): number => clamp(value + bonus, MIN_STAT, MAX_STAT);

  return {
    pace: boost(base.pace),
    shooting: boost(base.shooting),
    passing: boost(base.passing),
    dribbling: boost(base.dribbling),
    defending: boost(base.defending),
    physical: boost(base.physical),
  };
};

/**
 * OVR จริงของการ์ดใบนี้ (ยังไม่คิดว่ายืนตำแหน่งไหน)
 * ไม่บีบเพดาน 99 เพราะการ์ดใน roster มี OVR เกิน 99 อยู่แล้วตั้งแต่ต้น
 */
export const getEffectivePlayerOvr = (
  card: Pick<CardInstance, 'playerId' | 'level' | 'training'>,
): number => {
  const base = getBasePlayer(card.playerId);
  if (!base) return 0;
  return Math.max(1, base.ovr + getCardBonus(card));
};

/**
 * นักเตะเต็มใบที่ค่าพลังและ OVR เป็นค่าจริงของการ์ดใบนี้แล้ว
 *
 * นี่คือฟังก์ชันที่ระบบอื่นควรเรียกมากที่สุด — จัดทีม, Team OVR, Match Engine
 * ล้วนรับ Player เข้าไป จึงแค่เปลี่ยนมาเอา Player จากตรงนี้ ทุกอย่างก็เห็นค่าที่ถูกต้อง
 *
 * ⚠️ ห้ามเอาผลลัพธ์ไปส่งต่อ applyLevel อีกรอบ โบนัสจะถูกบวกซ้ำ
 */
export const getEffectivePlayer = (
  card: Pick<CardInstance, 'playerId' | 'level' | 'training'>,
): Player | null => {
  const base = getBasePlayer(card.playerId);
  if (!base) return null;

  const stats = getEffectivePlayerStats(card);
  if (!stats) return null;

  return { ...base, ovr: getEffectivePlayerOvr(card), stats };
};

/**
 * OVR ของการ์ดใบนี้เมื่อยืนตำแหน่งที่กำหนด (หักค่าปรับผิดตำแหน่งแล้ว)
 *
 * ใช้ effectiveOvrOf ของ teamRating.ts ต่อ ไม่ได้เขียนค่าปรับตำแหน่งชุดใหม่
 * ตรงตำแหน่งหลัก = เต็ม · ตำแหน่งรอง = −1 · ผิดตำแหน่ง = −4
 */
export const getPositionOvr = (
  card: Pick<CardInstance, 'playerId' | 'level' | 'training'>,
  position: Position,
): number => effectiveOvrOf(getEffectivePlayer(card), position);

/**
 * ตัวอย่างค่าที่จะได้ถ้าตีบวกขึ้นอีกหนึ่งขั้น
 * ใช้ทั้งในหน้า UPGRADE (ช่อง NEXT) และหน้า ADMIN → พรีวิวการตีบวก
 * คืน null เมื่อตีบวกจนสุดแล้ว
 */
export const previewNextUpgrade = (
  card: Pick<CardInstance, 'playerId' | 'level' | 'training'>,
): { stats: PlayerStats; ovr: number } | null => {
  const next = { ...card, level: card.level + 1 };
  const stats = getEffectivePlayerStats(next);
  if (!stats) return null;
  if (getCardBonus(next) === getCardBonus(card)) return null;

  return { stats, ovr: getEffectivePlayerOvr(next) };
};
