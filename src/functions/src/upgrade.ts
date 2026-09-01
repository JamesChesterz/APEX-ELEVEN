/**
 * ═══════════════════════════════════════════════════════════════
 *  PHASE 13 — กติกาการตีบวกฝั่งเซิร์ฟเวอร์ (pure function ล้วน)
 * ═══════════════════════════════════════════════════════════════
 *
 * แยกออกมาจาก index.ts เพื่อให้เทสได้โดยไม่ต้องต่อ Firebase
 * ตัวที่แตะฐานข้อมูลจริง (transaction + idempotency) อยู่ที่ index.ts
 *
 * หัวใจ: เครื่องผู้เล่นส่งมาได้แค่ cardId กับ requestId เท่านั้น
 * ผลสำเร็จ/ล้มเหลว ค่าบวกใหม่ OVR ใหม่ และค่าใช้จ่าย เซิร์ฟเวอร์คิดเองทั้งหมด
 * ตัวเลขทุกตัวอ่านจาก src/data/upgradeConfig.ts ชุดเดียวกับหน้าเว็บ
 *
 * ⚠️ ห้ามคัดลอกตารางตีบวกมาไว้ที่นี่อีกชุด วันหนึ่งสองที่จะไม่ตรงกันแล้วหาบั๊กไม่เจอ
 */
import {
  MATERIAL_CARD_SLOTS,
  getBoostedSuccessRate,
  getUpgradeStep,
} from '@/data/upgradeConfig';
import {
  canUpgradeCard,
  getCardOwner,
  getCardUpgrade,
  isCardLocked,
  isStrongEnoughMaterial,
  withUpgrade,
} from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';

/** ผลการตีบวกหนึ่งครั้ง — รูปแบบนี้คือสิ่งที่ส่งกลับไปให้หน้าเว็บโชว์ */
export interface UpgradeResult {
  success: boolean;
  previousUpgrade: number;
  newUpgrade: number;
  previousOvr: number;
  newOvr: number;
  coinsSpent: number;
  materialSpent: number;
  /** โอกาสสำเร็จที่ใช้ตัดสินครั้งนี้ (รวมโบนัสจากการ์ดช่วยแล้ว) */
  successRate: number;
  /** id ของการ์ดที่ถูกใช้เป็นของช่วย — หายจากคลังไม่ว่าจะติดหรือไม่ติด */
  consumedCardIds: string[];
  /** true = ตีไม่ติดแล้วการ์ดป้องกันทำงาน ค่าบวกจึงไม่ลด */
  protectUsed: boolean;
  /** ค่าบวกที่หายไปเพราะตีไม่ติด (0 = ไม่ลด) */
  droppedLevels: number;
}

/** เหตุผลที่คำขอถูกปฏิเสธ — ใช้เลือกข้อความและ error code ที่ index.ts */
export type UpgradeRejection =
  | 'card-not-found'
  | 'player-not-found'
  | 'wrong-owner'
  | 'card-locked'
  | 'already-max'
  | 'insufficient-coins'
  | 'insufficient-material'
  | 'too-many-material-cards'
  | 'bad-material-card'
  | 'weak-material-card'
  | 'no-protect-card';

export interface ResolveUpgradeInput {
  /** การ์ดที่ขอตีบวก (undefined = หาไม่เจอในคลัง) */
  card: CardInstance | undefined;
  /** uid ของคนที่กดขอ */
  requesterId: string;
  /** เหรียญคงเหลือของบัญชี */
  coins: number;
  /** แต้มตีบวกคงเหลือของบัญชี */
  materials: number;
  /**
   * การ์ดที่ผู้เล่นใส่มาช่วยเพิ่มโอกาสสำเร็จ (ใบละ +5%)
   * ถูกใช้ทิ้งทุกครั้งที่กด ไม่ว่าจะติดหรือไม่ติด
   */
  materialCards?: CardInstance[];
  /** true = ขอใช้การ์ดป้องกัน ตีไม่ติดแล้วค่าบวกจะไม่ลด */
  useProtect?: boolean;
  /** การ์ดป้องกันคงเหลือของบัญชี */
  protectCards?: number;
  /**
   * เลขสุ่ม 0–1 ที่ใช้ตัดสินว่าติดหรือไม่ติด
   * รับเข้ามาแทนการสุ่มเองข้างใน เพื่อให้เทสกำหนดผลได้แน่นอน
   * ที่ index.ts ส่ง Math.random() เข้ามา — เครื่องผู้เล่นแตะค่านี้ไม่ได้เลย
   */
  roll: number;
}

export type ResolveUpgradeOutcome =
  | {
      ok: true;
      result: UpgradeResult;
      /** การ์ดหลังทำรายการ (ล้มเหลว = ใบเดิม ค่าบวกไม่ลด) */
      nextCard: CardInstance;
      /** ยอดคงเหลือหลังหักค่าใช้จ่าย */
      coinsLeft: number;
      materialsLeft: number;
      protectCardsLeft: number;
    }
  | { ok: false; reason: UpgradeRejection; message: string };

/** ข้อความภาษาไทยของแต่ละเหตุผล — ใช้ทั้งที่เซิร์ฟเวอร์และแสดงบนหน้าเว็บ */
export const UPGRADE_REJECTION_MESSAGE: Record<UpgradeRejection, string> = {
  'card-not-found': 'ไม่พบการ์ดใบนี้ในคลัง',
  'player-not-found': 'การ์ดใบนี้ชี้ไปนักเตะที่ไม่มีอยู่ในระบบ',
  'wrong-owner': 'การ์ดใบนี้ไม่ใช่ของคุณ',
  'card-locked': 'การ์ดใบนี้ถูกล็อกไว้ ปลดล็อกก่อนถึงจะตีบวกได้',
  'already-max': 'การ์ดใบนี้ตีบวกจนสุดแล้ว',
  'insufficient-coins': 'เหรียญไม่พอ',
  'insufficient-material': 'แต้มตีบวกไม่พอ',
  'too-many-material-cards': `ใส่การ์ดช่วยได้ไม่เกิน ${MATERIAL_CARD_SLOTS} ใบ`,
  'bad-material-card':
    'การ์ดที่ใส่มาช่วยใช้ไม่ได้ — ต้องเป็นการ์ดของคุณ ไม่ได้ล็อกไว้ ไม่ได้อยู่ในทีม และไม่ใช่ใบที่กำลังตีบวก',
  'weak-material-card': 'การ์ดช่วยต้องมี OVR เท่ากับหรือมากกว่าใบที่กำลังตีบวก',
  'no-protect-card': 'ไม่มีการ์ดป้องกันเหลือ',
};

const reject = (reason: UpgradeRejection): ResolveUpgradeOutcome => ({
  ok: false,
  reason,
  message: UPGRADE_REJECTION_MESSAGE[reason],
});

/**
 * ตัดสินการตีบวกหนึ่งครั้ง
 *
 * ด่านที่ต้องผ่านตามลำดับ:
 *   1. การ์ดมีอยู่จริงในคลัง
 *   2. เป็นเจ้าของการ์ดใบนั้นจริง
 *   3. การ์ดไม่ได้ถูกล็อก
 *   4. ยังไม่ถึง +8
 *   5. นักเตะปลายทางมีอยู่จริง (ไว้คิด OVR)
 *   6. เหรียญพอ
 *   7. แต้มตีบวกพอ
 *
 * ผ่านครบแล้วถึงจะหักค่าใช้จ่ายและสุ่ม — ล้มเหลวก็เสียค่าใช้จ่าย แต่ค่าบวกเดิมไม่ลด
 * และการ์ดไม่หาย (กติกาเดิมของเกม ไม่ได้เปลี่ยน)
 */
export const resolveUpgrade = (input: ResolveUpgradeInput): ResolveUpgradeOutcome => {
  const { card, requesterId, coins, materials, roll } = input;
  const materialCards = input.materialCards ?? [];
  const protectCards = Math.max(0, Math.trunc(input.protectCards ?? 0) || 0);

  if (!card) return reject('card-not-found');
  if (getCardOwner(card, requesterId) !== requesterId) return reject('wrong-owner');
  if (isCardLocked(card)) return reject('card-locked');

  const previousUpgrade = getCardUpgrade(card);
  const step = getUpgradeStep(previousUpgrade);
  if (!step || !canUpgradeCard(card)) return reject('already-max');

  const previousOvr = getEffectivePlayerOvr(card);
  if (previousOvr === 0) return reject('player-not-found');

  /* ── การ์ดช่วยตีบวก ── */
  if (materialCards.length > MATERIAL_CARD_SLOTS) return reject('too-many-material-cards');

  const seen = new Set<string>();
  for (const fodder of materialCards) {
    // ใบที่กำลังตีบวกเอามาช่วยตัวเองไม่ได้ · ใบซ้ำนับสองรอบไม่ได้
    if (!fodder || fodder.id === card.id || seen.has(fodder.id)) return reject('bad-material-card');
    if (getCardOwner(fodder, requesterId) !== requesterId) return reject('bad-material-card');
    // ล็อกไว้หรืออยู่ในทีมอยู่ = กันเผลอเผาตัวจริงทิ้ง
    if (isCardLocked(fodder) || fodder.inSquad) return reject('bad-material-card');
    // ต้องแรงเท่ากันหรือมากกว่า จะได้ไม่เอาการ์ดขยะมาถมดันใบเก่ง
    if (!isStrongEnoughMaterial(card, fodder)) return reject('weak-material-card');
    seen.add(fodder.id);
  }

  /* ── การ์ดป้องกัน ── */
  const wantsProtect = input.useProtect === true;
  if (wantsProtect && protectCards < 1) return reject('no-protect-card');

  if (coins < step.coinCost) return reject('insufficient-coins');
  if (materials < step.materialCost) return reject('insufficient-material');

  const successRate = getBoostedSuccessRate(step.successRate, materialCards.length);
  const success = roll < successRate;

  /*
   * ตีไม่ติด: ค่าบวกลดตาม dropOnFail ของขั้นนั้น เว้นแต่ติดการ์ดป้องกันไว้
   * การ์ดป้องกันถูกใช้เฉพาะตอน "ไม่ติด และขั้นนี้ลดระดับจริง" เท่านั้น
   * ติดแล้วหรือขั้นที่ไม่ลดอยู่แล้ว ป้องกันไม่ถูกใช้ทิ้งฟรี
   */
  const wouldDrop = !success && step.dropOnFail > 0;
  const protectUsed = wouldDrop && wantsProtect;
  const droppedLevels = wouldDrop && !protectUsed ? Math.min(step.dropOnFail, previousUpgrade) : 0;

  const newUpgrade = success ? step.to : previousUpgrade - droppedLevels;
  const nextCard = newUpgrade === previousUpgrade ? card : withUpgrade(card, newUpgrade);

  return {
    ok: true,
    result: {
      success,
      previousUpgrade,
      newUpgrade,
      previousOvr,
      newOvr: newUpgrade === previousUpgrade ? previousOvr : getEffectivePlayerOvr(nextCard),
      coinsSpent: step.coinCost,
      materialSpent: step.materialCost,
      successRate,
      consumedCardIds: materialCards.map((fodder) => fodder.id),
      protectUsed,
      droppedLevels,
    },
    nextCard,
    coinsLeft: coins - step.coinCost,
    materialsLeft: materials - step.materialCost,
    protectCardsLeft: protectCards - (protectUsed ? 1 : 0),
  };
};

/* ── กันคำขอซ้ำ ────────────────────────────────────────────── */

/** ความยาวสูงสุดของ requestId ที่ยอมรับ */
export const REQUEST_ID_MAX_CHARS = 64;

/**
 * requestId ใช้เป็นชื่อเอกสารใน Firestore จึงต้องคุมรูปแบบให้แน่น
 * ยอมรับเฉพาะตัวอักษร ตัวเลข ขีด และขีดล่าง — กันการยัด path แปลก ๆ เข้ามา
 */
export const isValidRequestId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= REQUEST_ID_MAX_CHARS &&
  /^[A-Za-z0-9_-]+$/.test(value);

/** เอกสารที่จดไว้ว่าคำขอนี้ทำไปแล้ว (ใช้ตอบซ้ำเวลาคนกดรัวหรือเน็ตหลุดแล้วยิงใหม่) */
export interface UpgradeRequestRecord {
  requestId: string;
  cardId: string;
  result: UpgradeResult;
  /** ISO string ของเวลาที่ทำรายการจริง */
  at: string;
}
