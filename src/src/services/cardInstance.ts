/**
 * ═══════════════════════════════════════════════════════════════
 *  CARD INSTANCE (PHASE 12)
 * ═══════════════════════════════════════════════════════════════
 *
 * Player ≠ Card Instance
 *
 *   Player       = "Marco Belline" มีอยู่คนเดียวในเกม (src/data/players.ts)
 *   Roster       = การ์ดต้นแบบของเขา ระดับไหน รูปอะไร (src/data/roster.ts)
 *   CardInstance = ใบที่ผู้เล่นคนหนึ่งถืออยู่ ตีบวก +7 ฝึกมา 3 ล็อกไว้แล้ว
 *
 * user_A กับ user_B ถือการ์ดของ p001 คนละใบได้ โดยค่าบวกไม่เกี่ยวกันเลย
 *
 * เก็บอยู่ใน accounts/{uid}.state.cards[] ตามสถาปัตยกรรมเดิม
 * ไม่ได้แยกเป็น collection cards/{cardId} ใหม่ เพราะทั้งเกม (เปิดซอง ย่อยการ์ด
 * แลกเปลี่ยน จัดทีม) อ่านคลังจากเซฟก้อนเดียวอยู่แล้ว การแยกออกไปจะต้องรื้อทั้งระบบ
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { ROSTER } from '@/data/roster';
import { buildPlayerFromRoster } from '@/data/autoPlayer';
import { getPlayerById } from '@/data/players';
import { MAX_UPGRADE, clampUpgrade } from '@/data/upgradeConfig';
import { getBasePlayer, MAX_TRAINING } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import { clamp, createId } from '@/utils/helpers';

/* ── อ่านค่าจากการ์ดหนึ่งใบ ─────────────────────────────────── */

/**
 * ค่าบวกของการ์ด (0–8)
 * เก็บจริงเป็น level โดย level 1 = +0 — ทุกที่ที่อยากรู้ "ค่าบวก" ต้องผ่านตัวนี้
 */
export const getCardUpgrade = (card: Pick<CardInstance, 'level'>): number =>
  clampUpgrade(Math.trunc(card.level || 1) - 1);

/** เลเวลที่ควรเก็บลงการ์ดเมื่อรู้ค่าบวก */
export const levelForUpgrade = (upgrade: number): number => clampUpgrade(upgrade) + 1;

/** ระดับการฝึกซ้อมของการ์ด (0–5) */
export const getCardTraining = (card: Pick<CardInstance, 'training'>): number =>
  clamp(Math.trunc(card.training ?? 0) || 0, 0, MAX_TRAINING);

/** การ์ดใบนี้ถูกล็อกไว้ไหม (ล็อกแล้วห้ามย่อย/รวมร่าง/ตีบวก) */
export const isCardLocked = (card: Pick<CardInstance, 'locked'>): boolean => card.locked === true;

/** การ์ดใบนี้ยังตีบวกได้อีกไหม */
export const canUpgradeCard = (card: Pick<CardInstance, 'level' | 'locked'>): boolean =>
  !isCardLocked(card) && getCardUpgrade(card) < MAX_UPGRADE;

/**
 * uid ของเจ้าของการ์ด
 * ไม่ได้ระบุไว้ = เจ้าของคือบัญชีที่การ์ดใบนี้อยู่ (การ์ดเก่าก่อนมี PHASE 12)
 */
export const getCardOwner = (card: CardInstance, fallbackOwnerId: string): string =>
  card.ownerId || fallbackOwnerId;

/** การ์ดใบนี้เป็นของ uid นี้จริงไหม */
export const isOwnedBy = (card: CardInstance, ownerId: string, fallbackOwnerId = ownerId): boolean =>
  getCardOwner(card, fallbackOwnerId) === ownerId;

/* ── สร้าง / ปรับข้อมูลการ์ด ────────────────────────────────── */

export interface CreateCardInput {
  playerId: string;
  ownerId?: string;
  upgrade?: number;
  training?: number;
  locked?: boolean;
  /** ใส่เองได้ตอนต้องการ id ที่กำหนดไว้แล้ว (เช่นตอนย้ายข้อมูล) */
  id?: string;
  now?: Date;
}

/**
 * สร้างการ์ดใบใหม่ให้ผู้เล่นคนหนึ่ง
 * ทุกทางที่ทำให้ได้การ์ด (เปิดซอง แลกแต้ม ของขวัญแอดมิน) ควรเรียกผ่านตัวนี้
 * จะได้ไม่มีใบไหนขาดฟิลด์ไปเงียบ ๆ
 */
export const createCardInstance = (input: CreateCardInput): CardInstance => {
  const at = (input.now ?? new Date()).toISOString();

  return {
    id: input.id ?? createId('card'),
    playerId: input.playerId,
    acquiredAt: at,
    createdAt: at,
    updatedAt: at,
    level: levelForUpgrade(input.upgrade ?? 0),
    inSquad: false,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.training ? { training: clamp(input.training, 0, MAX_TRAINING) } : {}),
    ...(input.locked ? { locked: true } : {}),
  };
};

/**
 * ซ่อมการ์ดที่อ่านมาจากเซฟให้อยู่ในกรอบที่ระบบยอมรับ
 * เซฟเก่ามีการ์ดที่ level เพี้ยน/ไม่มี training มาตั้งแต่ก่อนมีระบบนี้
 */
export const normalizeCardInstance = (
  card: CardInstance,
  fallbackOwnerId?: string,
): CardInstance => ({
  ...card,
  level: levelForUpgrade(getCardUpgrade(card)),
  training: getCardTraining(card),
  locked: isCardLocked(card),
  ownerId: card.ownerId || fallbackOwnerId,
  createdAt: card.createdAt ?? card.acquiredAt,
});

/** การ์ดใบเดิมที่ค่าบวกขยับขึ้นหนึ่งขั้น (ไม่แตะใบเดิม) */
export const withUpgrade = (card: CardInstance, upgrade: number, now = new Date()): CardInstance => ({
  ...card,
  level: levelForUpgrade(upgrade),
  updatedAt: now.toISOString(),
});

/* ── กติกาการ์ดช่วยตีบวก ────────────────────────────────────── */

/**
 * การ์ดใบนี้แรงพอจะเอามาช่วยตีบวกใบเป้าหมายไหม
 *
 * กติกา: OVR ของการ์ดช่วยต้อง "เท่ากันหรือมากกว่า" ใบที่กำลังตี
 * เอาการ์ดอ่อน ๆ มาถมเพื่อดันใบเก่งไม่ได้ ต้องยอมเผาของดีจริง
 *
 * ⚠️ เทียบด้วย OVR พื้นฐานของตัวนักเตะ ไม่ใช่ OVR หลังตีบวก
 * ถ้าเทียบค่าหลังตีบวก พอใบเป้าหมายไต่ไปสูง ๆ จะไม่เหลือใบไหนผ่านเกณฑ์เลย
 * และผู้เล่นจะถูกบังคับให้ไปตีบวกใบที่จะเอามาเผาก่อน ซึ่งไม่มีเหตุผล
 */
export const isStrongEnoughMaterial = (
  target: Pick<CardInstance, 'playerId'>,
  material: Pick<CardInstance, 'playerId'>,
): boolean => {
  const targetOvr = getBasePlayer(target.playerId)?.ovr;
  const materialOvr = getBasePlayer(material.playerId)?.ovr;
  if (targetOvr === undefined || materialOvr === undefined) return false;

  return materialOvr >= targetOvr;
};

/* ── ตรวจ roster ก่อนย้ายข้อมูล ─────────────────────────────── */

/** ผลตรวจความสมบูรณ์ของ roster (ต้องผ่านก่อนคิดจะ migrate อะไรเข้า Firestore) */
export interface RosterAudit {
  /** จำนวนบรรทัดใน roster.ts */
  totalRosterEntries: number;
  /** จำนวนนักเตะทั้งหมดใน pool (roster + ที่เขียนมือ) */
  totalPlayers: number;
  /** จำนวน id ที่ไม่ซ้ำกัน */
  uniquePlayerIds: number;
  /** id ที่โผล่มากกว่าหนึ่งครั้งใน roster */
  duplicateIds: string[];
  /** บรรทัดใน roster ที่หา Player ปลายทางไม่เจอ */
  missingPlayerIds: string[];
  /** นักเตะที่ค่าพลังไม่ครบ 6 ด้าน */
  missingStats: string[];
  /** บรรทัดใน roster ที่ไม่มีรูป */
  missingImages: string[];
  /** นักเตะที่ OVR ไม่ใช่ตัวเลขที่ใช้ได้ */
  invalidOvr: string[];
  /** true = ไม่มีปัญหาเลย ย้ายข้อมูลได้ */
  ok: boolean;
}

const STAT_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;

/**
 * ตรวจ roster ทั้งชุด — เรียกจากหน้า ADMIN → การ์ดต้นแบบ และจากเทส
 *
 * PHASE 12 ห้าม migrate roster เข้า Firestore อัตโนมัติ ต้องเห็นผลตรวจนี้ก่อน
 * แล้วค่อยตัดสินใจเอง ระบบไม่แตะข้อมูลจริงให้เด็ดขาด
 */
export const auditRoster = (): RosterAudit => {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const missingPlayerIds: string[] = [];
  const missingImages: string[] = [];
  const missingStats: string[] = [];
  const invalidOvr: string[] = [];

  ROSTER.forEach((entry) => {
    const template = buildPlayerFromRoster(entry);
    const id = template.id;

    if (seen.has(id)) duplicateIds.push(id);
    seen.add(id);

    // players.ts เป็นคนรวม roster เข้า pool — หาไม่เจอแปลว่ามีอะไรผิดจริง ๆ
    const player = getPlayerById(id);
    if (!player) {
      missingPlayerIds.push(id);
      return;
    }

    if (!player.imageUrl && !entry.file) missingImages.push(id);
    if (!Number.isFinite(player.ovr) || player.ovr <= 0) invalidOvr.push(id);
    if (STAT_KEYS.some((key) => !Number.isFinite(player.stats[key]))) missingStats.push(id);
  });

  return {
    totalRosterEntries: ROSTER.length,
    totalPlayers: seen.size + 0,
    uniquePlayerIds: seen.size,
    duplicateIds,
    missingPlayerIds,
    missingStats,
    missingImages,
    invalidOvr,
    ok:
      duplicateIds.length === 0 &&
      missingPlayerIds.length === 0 &&
      missingStats.length === 0 &&
      invalidOvr.length === 0,
  };
};
