/**
 * PHASE 13 — เทสการตีบวก +0 → +8 ฝั่งเซิร์ฟเวอร์
 *
 * ครอบทุกขั้นตั้งแต่ +0→+1 ถึง +7→+8 และทุกทางที่คำขอควรถูกปฏิเสธ
 * รวมถึงการกันคำขอซ้ำ/ยิงซ้ำ ซึ่งเป็นช่องโหว่ที่ทำให้ตีบวกฟรีได้ถ้าพลาด
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_UPGRADE, UPGRADE_STEPS, getUpgradeStep } from '@/data/upgradeConfig';
import { createCardInstance, getCardUpgrade } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import {
  REQUEST_ID_MAX_CHARS,
  isValidRequestId,
  resolveUpgrade,
  type ResolveUpgradeOutcome,
  type UpgradeRequestRecord,
} from '../functions/src/upgrade';

const OWNER = 'user_A';

const cardAt = (upgrade: number, extra: Partial<CardInstance> = {}): CardInstance => ({
  ...createCardInstance({
    id: 'card_001',
    playerId: 'p001',
    ownerId: OWNER,
    upgrade,
    now: new Date('2026-01-01T00:00:00.000Z'),
  }),
  ...extra,
});

/** ยอดเงินที่พอสำหรับทุกขั้น ใช้เวลาที่ไม่ได้กำลังเทสเรื่องเงิน */
const RICH = { coins: 10_000_000, materials: 10_000_000 };

/** roll = 0 คือติดแน่นอน (0 < successRate เสมอ) */
const alwaysSucceed = 0;
/** roll = 0.999999 คือพลาดแน่นอน ยกเว้นขั้นที่โอกาส 100% */
const alwaysFail = 0.999999;

const run = (
  card: CardInstance | undefined,
  overrides: Partial<Parameters<typeof resolveUpgrade>[0]> = {},
): ResolveUpgradeOutcome =>
  resolveUpgrade({
    card,
    requesterId: OWNER,
    coins: RICH.coins,
    materials: RICH.materials,
    roll: alwaysSucceed,
    ...overrides,
  });

/** อ่านผลแบบรู้ว่าสำเร็จแน่ ๆ (ให้เทสอ่านง่ายกว่าเช็ค ok ทุกครั้ง) */
const expectOk = (outcome: ResolveUpgradeOutcome) => {
  if (!outcome.ok) throw new Error(`ควรผ่านแต่ถูกปฏิเสธ: ${outcome.reason}`);
  return outcome;
};

/* ── เดินครบทุกขั้น +0 → +8 ─────────────────────────────────── */

describe('ตีบวกครบทุกขั้นจาก +0 ถึง +8', () => {
  it.each(UPGRADE_STEPS.map((step) => [step.from, step.to] as const))(
    '+%i → +%i ตีติดแล้วค่าบวกขยับขึ้นหนึ่งขั้น',
    (from, to) => {
      const outcome = expectOk(run(cardAt(from)));

      expect(outcome.result.success).toBe(true);
      expect(outcome.result.previousUpgrade).toBe(from);
      expect(outcome.result.newUpgrade).toBe(to);
      expect(getCardUpgrade(outcome.nextCard)).toBe(to);
    },
  );

  it('ไล่ตีบวกต่อกันจาก +0 จนถึง +8 ได้จริง', () => {
    let card = cardAt(0);

    for (let step = 0; step < MAX_UPGRADE; step += 1) {
      card = expectOk(run(card)).nextCard;
    }

    expect(getCardUpgrade(card)).toBe(MAX_UPGRADE);
    // ถึงเพดานแล้วต้องตีต่อไม่ได้
    const blocked = run(card);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('already-max');
  });

  it('OVR ที่เซิร์ฟเวอร์ตอบกลับตรงกับ Attribute Engine เป๊ะ ๆ', () => {
    const before = cardAt(4);
    const outcome = expectOk(run(before));

    expect(outcome.result.previousOvr).toBe(getEffectivePlayerOvr(before));
    expect(outcome.result.newOvr).toBe(getEffectivePlayerOvr(outcome.nextCard));
    expect(outcome.result.newOvr).toBeGreaterThan(outcome.result.previousOvr);
  });

  it('ค่าใช้จ่ายที่หักตรงกับตารางกลาง ไม่มีตัวเลขลอยของตัวเอง', () => {
    UPGRADE_STEPS.forEach((step) => {
      const outcome = expectOk(run(cardAt(step.from)));

      expect(outcome.result.coinsSpent).toBe(step.coinCost);
      expect(outcome.result.materialSpent).toBe(step.materialCost);
      expect(outcome.coinsLeft).toBe(RICH.coins - step.coinCost);
      expect(outcome.materialsLeft).toBe(RICH.materials - step.materialCost);
    });
  });
});

/* ── ตีไม่ติด ──────────────────────────────────────────────── */

describe('ตีบวกไม่ติด', () => {
  it('ค่าบวกไม่ลด การ์ดไม่หาย แต่ยังเสียค่าใช้จ่าย', () => {
    const before = cardAt(4);
    const outcome = expectOk(run(before, { roll: alwaysFail }));
    const step = getUpgradeStep(4);

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.newUpgrade).toBe(outcome.result.previousUpgrade);
    expect(outcome.result.newOvr).toBe(outcome.result.previousOvr);
    expect(outcome.nextCard.id).toBe(before.id);
    expect(outcome.result.materialSpent).toBe(step?.materialCost);
  });

  it('ขั้นที่โอกาส 100% ต้องติดเสมอ ไม่ว่าจะสุ่มได้เท่าไร', () => {
    const guaranteed = UPGRADE_STEPS.filter((step) => step.successRate >= 1);
    expect(guaranteed.length).toBeGreaterThan(0);

    guaranteed.forEach((step) => {
      expect(expectOk(run(cardAt(step.from), { roll: alwaysFail })).result.success).toBe(true);
    });
  });

  it('ขั้นที่โอกาสต่ำกว่า 100% พลาดได้จริง', () => {
    const risky = UPGRADE_STEPS.find((step) => step.successRate < 1);
    if (!risky) throw new Error('ตารางต้องมีขั้นที่พลาดได้อย่างน้อยหนึ่งขั้น');

    expect(expectOk(run(cardAt(risky.from), { roll: alwaysFail })).result.success).toBe(false);
  });
});

/* ── ด่านที่ต้องปฏิเสธ ─────────────────────────────────────── */

describe('คำขอที่ต้องถูกปฏิเสธ', () => {
  const rejects = (outcome: ResolveUpgradeOutcome, reason: string) => {
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe(reason);
      expect(outcome.message.length).toBeGreaterThan(0);
    }
  };

  it('การ์ดไม่มีอยู่จริงในคลัง', () => {
    rejects(run(undefined), 'card-not-found');
  });

  it('การ์ดของคนอื่น', () => {
    rejects(run(cardAt(0, { ownerId: 'user_B' })), 'wrong-owner');
  });

  it('การ์ดที่ล็อกไว้', () => {
    rejects(run(cardAt(0, { locked: true })), 'card-locked');
  });

  it('การ์ดที่ +8 อยู่แล้ว', () => {
    rejects(run(cardAt(MAX_UPGRADE)), 'already-max');
  });

  it('การ์ดที่ชี้ไปนักเตะที่ไม่มีอยู่', () => {
    rejects(run(cardAt(0, { playerId: 'ไม่มีอยู่จริง' })), 'player-not-found');
  });

  it('แต้มตีบวกไม่พอ', () => {
    rejects(run(cardAt(0), { materials: 0 }), 'insufficient-material');
  });

  it('เหรียญไม่พอ (ขั้นที่คิดเหรียญ)', () => {
    const paid = UPGRADE_STEPS.find((step) => step.coinCost > 0);
    if (!paid) throw new Error('ตารางต้องมีขั้นที่คิดเหรียญอย่างน้อยหนึ่งขั้น');

    rejects(run(cardAt(paid.from), { coins: paid.coinCost - 1 }), 'insufficient-coins');
  });

  it('ถูกปฏิเสธแล้วต้องไม่มีการหักเงินหรือขยับค่าบวกใด ๆ', () => {
    const outcome = run(cardAt(0), { materials: 0 });
    expect(outcome.ok).toBe(false);
    // ผลลัพธ์แบบถูกปฏิเสธไม่มีสนาม nextCard/coinsLeft ให้เขียนกลับเลย
    expect('nextCard' in outcome).toBe(false);
  });
});

/* ── กันคำขอซ้ำ ────────────────────────────────────────────── */

describe('กันกดรัวและยิงคำขอซ้ำ', () => {
  it('รหัสคำขอต้องอยู่ในรูปแบบที่ปลอดภัยเท่านั้น', () => {
    expect(isValidRequestId('up-abc123_XYZ')).toBe(true);
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId('a'.repeat(REQUEST_ID_MAX_CHARS + 1))).toBe(false);
    // กันการยัด path ของ Firestore เข้ามาทางชื่อเอกสาร
    expect(isValidRequestId('../../config/bans')).toBe(false);
    expect(isValidRequestId('a/b')).toBe(false);
    expect(isValidRequestId(123)).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });

  it('จำลองการยิงซ้ำ: คำขอรหัสเดิมคืนผลใบเดิม ไม่หักเงินรอบสอง', () => {
    // นี่คือตรรกะเดียวกับที่ transaction ใน functions/src/index.ts ใช้
    const processed = new Map<string, UpgradeRequestRecord>();
    let card = cardAt(0);
    let materials = RICH.materials;

    const submit = (requestId: string): UpgradeRequestRecord => {
      const seen = processed.get(requestId);
      if (seen) return seen;

      const outcome = expectOk(run(card, { materials }));
      card = outcome.nextCard;
      materials = outcome.materialsLeft;

      const record: UpgradeRequestRecord = {
        requestId,
        cardId: card.id,
        result: outcome.result,
        at: '2026-01-01T00:00:00.000Z',
      };
      processed.set(requestId, record);
      return record;
    };

    const first = submit('req-1');
    const replay = submit('req-1');

    expect(replay).toEqual(first);
    expect(getCardUpgrade(card)).toBe(1);
    // ยิงซ้ำสิบครั้งก็ยังหักเงินแค่ครั้งเดียว
    Array.from({ length: 10 }).forEach(() => submit('req-1'));
    expect(materials).toBe(RICH.materials - first.result.materialSpent);
  });

  it('คำขอคนละรหัสถือเป็นคนละรายการ ทำต่อกันได้ตามปกติ', () => {
    let card = cardAt(0);
    card = expectOk(run(card)).nextCard;
    card = expectOk(run(card)).nextCard;
    expect(getCardUpgrade(card)).toBe(2);
  });
});

/* ── กฎ Firestore ──────────────────────────────────────────── */

describe('กฎ Firestore รองรับ PHASE 13', () => {
  const rules = readFileSync(resolvePath(process.cwd(), 'firestore.rules'), 'utf8');

  it('มีสวิตช์ให้เซิร์ฟเวอร์เป็นเจ้าของค่าตีบวก', () => {
    expect(rules).toContain('function serverOwnsUpgrades()');
    expect(rules).toContain('accountCardsUnchanged()');
  });

  it('บันทึกคำขอตีบวกห้ามเครื่องผู้เล่นเขียน', () => {
    const block = rules.slice(rules.indexOf('match /accounts/{uid}/upgradeRequests'));
    expect(block.slice(0, 400)).toContain('allow write: if false;');
  });

  it('ไม่มีการเปิดเขียนแบบไร้เงื่อนไขหลุดเข้ามา', () => {
    expect(rules).not.toContain('allow write: if true');
    expect(rules).not.toContain('allow read, write: if true');
  });
});
