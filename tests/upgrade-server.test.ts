/**
 * PHASE 13 — เทสการตีบวก +0 → +8 ฝั่งเซิร์ฟเวอร์
 *
 * ครอบทุกขั้นตั้งแต่ +0→+1 ถึง +7→+8 และทุกทางที่คำขอควรถูกปฏิเสธ
 * รวมถึงการกันคำขอซ้ำ/ยิงซ้ำ ซึ่งเป็นช่องโหว่ที่ทำให้ตีบวกฟรีได้ถ้าพลาด
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MATERIAL_CARD_BOOST,
  MATERIAL_CARD_SLOTS,
  MAX_UPGRADE,
  UPGRADE_STEPS,
  getBoostedSuccessRate,
  getUpgradeStep,
} from '@/data/upgradeConfig';
import { PLAYERS } from '@/data/players';
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

/* ── การ์ดช่วยตีบวก ────────────────────────────────────────── */

describe('การ์ดช่วยตีบวก', () => {
  /**
   * การ์ดสำรองที่เอามาเผาได้
   * ใช้ p001 เหมือนใบเป้าหมาย OVR จึงเท่ากันพอดี ผ่านเกณฑ์ "เท่ากันหรือมากกว่า"
   */
  const fodder = (id: string, extra: Partial<CardInstance> = {}): CardInstance => ({
    ...createCardInstance({ id, playerId: 'p001', ownerId: OWNER, now: new Date(0) }),
    ...extra,
  });

  it('ใส่การ์ดช่วยแล้วโอกาสสำเร็จขยับขึ้นใบละ 5%', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    const outcome = expectOk(
      run(cardAt(4), { materialCards: [fodder('f1'), fodder('f2')], roll: alwaysSucceed }),
    );

    expect(outcome.result.successRate).toBeCloseTo(step.successRate + 2 * MATERIAL_CARD_BOOST, 5);
    expect(outcome.result.successRate).toBe(getBoostedSuccessRate(step.successRate, 2));
  });

  it('โอกาสสำเร็จไม่ทะลุ 100% ต่อให้ใส่เต็มทุกช่อง', () => {
    const outcome = expectOk(
      run(cardAt(0), {
        materialCards: Array.from({ length: MATERIAL_CARD_SLOTS }, (_, i) => fodder(`f${i}`)),
      }),
    );

    expect(outcome.result.successRate).toBeLessThanOrEqual(1);
  });

  it('การ์ดช่วยถูกเผาทิ้งทั้งตอนติดและตอนไม่ติด', () => {
    const cards = [fodder('f1'), fodder('f2')];

    const hit = expectOk(run(cardAt(4), { materialCards: cards, roll: alwaysSucceed }));
    const miss = expectOk(run(cardAt(4), { materialCards: cards, roll: alwaysFail }));

    expect(hit.result.consumedCardIds).toEqual(['f1', 'f2']);
    expect(miss.result.consumedCardIds).toEqual(['f1', 'f2']);
  });

  it('ใส่เกินจำนวนช่องไม่ได้', () => {
    const many = Array.from({ length: MATERIAL_CARD_SLOTS + 1 }, (_, i) => fodder(`f${i}`));
    const outcome = run(cardAt(4), { materialCards: many });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('too-many-material-cards');
  });

  it.each([
    ['ใบที่กำลังตีบวกเอง', () => cardAt(4)],
    ['การ์ดของคนอื่น', () => fodder('f1', { ownerId: 'user_B' })],
    ['การ์ดที่ล็อกไว้', () => fodder('f1', { locked: true })],
    ['การ์ดที่อยู่ในทีมตัวจริง', () => fodder('f1', { inSquad: true })],
  ])('เอา%sมาช่วยไม่ได้', (_label, build) => {
    const outcome = run(cardAt(4), { materialCards: [build()] });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('bad-material-card');
  });

  it('การ์ดที่ OVR ต่ำกว่าใบเป้าหมายเอามาช่วยไม่ได้', () => {
    // p002 (OVR 88) อ่อนกว่า p001 (OVR 91) — เอาการ์ดขยะมาถมดันใบเก่งไม่ได้
    const weak = { ...fodder('f1'), playerId: 'p002' };
    const outcome = run(cardAt(4), { materialCards: [weak] });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('weak-material-card');
  });

  it('การ์ดที่ OVR เท่ากันหรือมากกว่าใช้ได้', () => {
    const stronger = PLAYERS.filter((entry) => {
      const target = PLAYERS.find((item) => item.id === 'p001');
      return target ? entry.ovr > target.ovr : false;
    })[0];
    if (!stronger) throw new Error('ต้องมีนักเตะที่แรงกว่า p001 ใน pool');

    // เท่ากัน (p001) ผ่าน
    expect(expectOk(run(cardAt(4), { materialCards: [fodder('f1')] })).ok).toBe(true);
    // มากกว่า ก็ผ่าน
    const strong = { ...fodder('f2'), playerId: stronger.id };
    expect(expectOk(run(cardAt(4), { materialCards: [strong] })).ok).toBe(true);
  });

  it('เกณฑ์ OVR เทียบค่าพื้นฐาน ไม่ใช่ค่าหลังตีบวก', () => {
    /*
     * ใบเป้าหมายตีบวกไปสูงแล้ว OVR จริงพุ่งเกินการ์ดช่วยแน่นอน
     * ถ้าเผลอไปเทียบค่าหลังตีบวก ผู้เล่นจะหาการ์ดช่วยไม่ได้เลยตอนใกล้ +8
     */
    const outcome = run(cardAt(7), { materialCards: [fodder('f1')] });
    expect(outcome.ok).toBe(true);
  });

  it('ใส่การ์ดใบเดียวกันซ้ำสองช่องไม่ได้', () => {
    const outcome = run(cardAt(4), { materialCards: [fodder('f1'), fodder('f1')] });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('bad-material-card');
  });
});

/* ── ลดระดับตอนไม่ติด และการ์ดป้องกัน ─────────────────────── */

describe('ลดระดับตอนไม่ติด และการ์ดป้องกัน', () => {
  const risky = UPGRADE_STEPS.find((step) => step.dropOnFail > 0);
  const safe = UPGRADE_STEPS.find((step) => step.dropOnFail === 0 && step.successRate < 1);

  it('ขั้นที่ตั้งให้ลดระดับ ไม่ติดแล้วค่าบวกลดจริง', () => {
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับ');

    const outcome = expectOk(run(cardAt(risky.from), { roll: alwaysFail }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.droppedLevels).toBe(risky.dropOnFail);
    expect(outcome.result.newUpgrade).toBe(risky.from - risky.dropOnFail);
    expect(getCardUpgrade(outcome.nextCard)).toBe(risky.from - risky.dropOnFail);
    // OVR ต้องลดตามค่าบวกที่หายไปด้วย ไม่ใช่ค้างค่าเดิม
    expect(outcome.result.newOvr).toBeLessThan(outcome.result.previousOvr);
  });

  it('ขั้นที่ตั้งว่าไม่ลด ไม่ติดแล้วค่าบวกเท่าเดิม', () => {
    if (!safe) throw new Error('ตารางต้องมีขั้นที่ไม่ลดระดับ');

    const outcome = expectOk(run(cardAt(safe.from), { roll: alwaysFail }));

    expect(outcome.result.droppedLevels).toBe(0);
    expect(outcome.result.newUpgrade).toBe(safe.from);
  });

  it('ติดการ์ดป้องกันแล้วไม่ติด ค่าบวกไม่ลดและป้องกันถูกใช้ไปหนึ่งใบ', () => {
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับ');

    const outcome = expectOk(
      run(cardAt(risky.from), { roll: alwaysFail, useProtect: true, protectCards: 2 }),
    );

    expect(outcome.result.protectUsed).toBe(true);
    expect(outcome.result.droppedLevels).toBe(0);
    expect(outcome.result.newUpgrade).toBe(risky.from);
    expect(outcome.protectCardsLeft).toBe(1);
  });

  it('ตีติดแล้วการ์ดป้องกันไม่ถูกใช้ทิ้งฟรี', () => {
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับ');

    const outcome = expectOk(
      run(cardAt(risky.from), { roll: alwaysSucceed, useProtect: true, protectCards: 2 }),
    );

    expect(outcome.result.protectUsed).toBe(false);
    expect(outcome.protectCardsLeft).toBe(2);
  });

  it('ขั้นที่ไม่ลดระดับอยู่แล้ว การ์ดป้องกันก็ไม่ถูกใช้', () => {
    if (!safe) throw new Error('ตารางต้องมีขั้นที่ไม่ลดระดับ');

    const outcome = expectOk(
      run(cardAt(safe.from), { roll: alwaysFail, useProtect: true, protectCards: 1 }),
    );

    expect(outcome.result.protectUsed).toBe(false);
    expect(outcome.protectCardsLeft).toBe(1);
  });

  it('ขอใช้ป้องกันทั้งที่ไม่มีเหลือ = ถูกปฏิเสธ ไม่ใช่ปล่อยผ่านเงียบ ๆ', () => {
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับ');

    const outcome = run(cardAt(risky.from), { useProtect: true, protectCards: 0 });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('no-protect-card');
  });

  it('ค่าบวกลดต่ำกว่า +0 ไม่ได้', () => {
    const outcome = expectOk(run(cardAt(0), { roll: alwaysFail }));
    expect(outcome.result.newUpgrade).toBeGreaterThanOrEqual(0);
  });
});
