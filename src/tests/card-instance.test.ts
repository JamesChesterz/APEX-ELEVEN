/**
 * PHASE 12 — เทสระบบ Card Instance
 *
 * หัวใจที่ต้องพิสูจน์: Player ≠ Card Instance
 * ผู้เล่นหลายคนถือการ์ดของนักเตะคนเดียวกันได้ โดยสถานะของแต่ละใบแยกกันสิ้นเชิง
 */
import { describe, expect, it } from 'vitest';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import {
  auditRoster,
  canUpgradeCard,
  createCardInstance,
  getCardOwner,
  getCardTraining,
  getCardUpgrade,
  isCardLocked,
  isOwnedBy,
  levelForUpgrade,
  normalizeCardInstance,
  withUpgrade,
} from '@/services/cardInstance';
import { MAX_TRAINING, getEffectivePlayerOvr } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Player ≠ Card Instance', () => {
  it('สองคนถือการ์ดของนักเตะคนเดียวกันได้ โดยค่าบวกไม่เกี่ยวกัน', () => {
    const cardA = createCardInstance({
      id: 'card_001',
      playerId: 'p001',
      ownerId: 'user_A',
      upgrade: 8,
      training: 3,
      locked: true,
      now: at,
    });
    const cardB = createCardInstance({
      id: 'card_002',
      playerId: 'p001',
      ownerId: 'user_B',
      upgrade: 2,
      now: at,
    });

    // นักเตะคนเดียวกัน
    expect(cardA.playerId).toBe(cardB.playerId);
    // แต่เป็นคนละใบ คนละเจ้าของ คนละสถานะ
    expect(cardA.id).not.toBe(cardB.id);
    expect(getCardOwner(cardA, 'ไม่ควรถูกใช้')).toBe('user_A');
    expect(getCardOwner(cardB, 'ไม่ควรถูกใช้')).toBe('user_B');
    expect(getCardUpgrade(cardA)).toBe(8);
    expect(getCardUpgrade(cardB)).toBe(2);
    expect(isCardLocked(cardA)).toBe(true);
    expect(isCardLocked(cardB)).toBe(false);
    expect(getCardTraining(cardA)).toBe(3);
    expect(getCardTraining(cardB)).toBe(0);
  });

  it('ค่าพลังจริงของสองใบต่างกันตามค่าบวกของตัวเอง', () => {
    const strong = createCardInstance({ playerId: 'p001', upgrade: 8, now: at });
    const weak = createCardInstance({ playerId: 'p001', upgrade: 0, now: at });

    expect(getEffectivePlayerOvr(strong)).toBeGreaterThan(getEffectivePlayerOvr(weak));
  });

  it('การ์ดที่สร้างติด ๆ กันต้องได้ id ไม่ซ้ำกัน', () => {
    const ids = Array.from({ length: 50 }, () => createCardInstance({ playerId: 'p001' }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('การแปลงค่าบวก ↔ เลเวล', () => {
  it.each([0, 1, 4, 8])('+%i เก็บเป็น level ที่ถูกต้องและอ่านกลับได้ค่าเดิม', (plus) => {
    const level = levelForUpgrade(plus);
    expect(level).toBe(plus + 1);
    expect(getCardUpgrade({ level })).toBe(plus);
  });

  it('ค่าที่เพี้ยนจากเซฟเก่าถูกบีบเข้ากรอบ ไม่ทำให้ได้โบนัสฟรี', () => {
    expect(getCardUpgrade({ level: 0 })).toBe(0);
    expect(getCardUpgrade({ level: -99 })).toBe(0);
    expect(getCardUpgrade({ level: 9999 })).toBe(MAX_UPGRADE);
    expect(getCardTraining({ training: 9999 })).toBe(MAX_TRAINING);
    expect(getCardTraining({ training: -5 })).toBe(0);
  });
});

describe('เงื่อนไขว่าตีบวกต่อได้ไหม', () => {
  it('การ์ดที่ยังไม่เต็มและไม่ได้ล็อก ตีบวกต่อได้', () => {
    expect(canUpgradeCard({ level: 1, locked: false })).toBe(true);
    expect(canUpgradeCard({ level: 8 })).toBe(true);
  });

  it('การ์ดที่ +8 แล้วตีบวกต่อไม่ได้', () => {
    expect(canUpgradeCard({ level: levelForUpgrade(MAX_UPGRADE) })).toBe(false);
  });

  it('การ์ดที่ล็อกไว้ตีบวกไม่ได้ ต่อให้ยังไม่เต็ม', () => {
    expect(canUpgradeCard({ level: 1, locked: true })).toBe(false);
  });
});

describe('ซ่อมการ์ดจากเซฟเก่า', () => {
  it('การ์ดเก่าที่ยังไม่มีฟิลด์ของ PHASE 12 ถูกเติมให้ครบโดยไม่เสียข้อมูลเดิม', () => {
    const legacy: CardInstance = {
      id: 'card_legacy',
      playerId: 'p003',
      acquiredAt: '2025-06-01T00:00:00.000Z',
      level: 3,
      inSquad: true,
    };

    const fixed = normalizeCardInstance(legacy, 'user_A');

    expect(fixed.id).toBe(legacy.id);
    expect(fixed.inSquad).toBe(true);
    expect(fixed.level).toBe(3);
    expect(fixed.training).toBe(0);
    expect(fixed.locked).toBe(false);
    expect(fixed.ownerId).toBe('user_A');
    // ไม่มี createdAt ก็ใช้เวลาที่ได้การ์ดมาแทน ไม่ปล่อยว่าง
    expect(fixed.createdAt).toBe(legacy.acquiredAt);
  });

  it('การ์ดที่ไม่ได้ระบุเจ้าของ ถือว่าเป็นของบัญชีที่การ์ดอยู่', () => {
    const orphan: CardInstance = {
      id: 'card_x',
      playerId: 'p001',
      acquiredAt: at.toISOString(),
      level: 1,
      inSquad: false,
    };

    expect(getCardOwner(orphan, 'user_A')).toBe('user_A');
    expect(isOwnedBy(orphan, 'user_A')).toBe(true);
    expect(isOwnedBy({ ...orphan, ownerId: 'user_B' }, 'user_A', 'user_A')).toBe(false);
  });
});

describe('ขยับค่าบวกของการ์ด', () => {
  it('ได้ใบใหม่ที่ค่าบวกขยับ โดยใบเดิมไม่ถูกแตะ', () => {
    const before = createCardInstance({ playerId: 'p001', upgrade: 4, now: at });
    const after = withUpgrade(before, 5, new Date('2026-02-02T00:00:00.000Z'));

    expect(getCardUpgrade(before)).toBe(4);
    expect(getCardUpgrade(after)).toBe(5);
    expect(after.updatedAt).not.toBe(before.updatedAt);
    expect(after.id).toBe(before.id);
  });

  it('ดันเกิน +8 ไม่ได้', () => {
    const card = createCardInstance({ playerId: 'p001', upgrade: 8, now: at });
    expect(getCardUpgrade(withUpgrade(card, 99))).toBe(MAX_UPGRADE);
  });
});

/* ── ด่านตรวจก่อนย้ายข้อมูล (PHASE 12 ห้าม migrate อัตโนมัติ) ── */

describe('ตรวจ roster ก่อนย้ายข้อมูล', () => {
  const audit = auditRoster();

  it('อ่าน roster ได้ครบและไม่มี id ซ้ำ', () => {
    expect(audit.totalRosterEntries).toBeGreaterThan(0);
    expect(audit.uniquePlayerIds).toBe(audit.totalRosterEntries);
    expect(audit.duplicateIds).toEqual([]);
  });

  it('ทุกบรรทัดใน roster หานักเตะปลายทางเจอ', () => {
    expect(audit.missingPlayerIds).toEqual([]);
  });

  it('ไม่มีนักเตะที่ค่าพลังหายหรือ OVR เพี้ยน', () => {
    expect(audit.missingStats).toEqual([]);
    expect(audit.invalidOvr).toEqual([]);
  });

  it('สรุปผลรวมบอกว่าย้ายข้อมูลได้', () => {
    expect(audit.ok).toBe(true);
  });
});
