import { describe, expect, it } from 'vitest';
import {
  claimTrack, emptyLoginState, getTrackStatus, normalizeLoginBonus, normalizeLoginState, weekKeyOf,
} from '@/services/loginBonus';
import { grantReward, normalizeReward, isRewardValid } from '@/services/rewards';

describe('login bonus', () => {
  it('เติมช่องให้ครบ 7 และ 30 เสมอ', () => {
    const cfg = normalizeLoginBonus({ weekly: [{ kind: 'coins', amount: 5 }] });
    expect(cfg.weekly).toHaveLength(7);
    expect(cfg.monthly).toHaveLength(30);
  });

  it('กดได้วันละครั้งต่อปฏิทิน', () => {
    const now = new Date('2026-09-03T10:00:00');
    let state = emptyLoginState(now);
    expect(getTrackStatus(state, 'weekly', now).claimable).toBe(true);
    state = claimTrack(state, 'weekly', now);
    expect(getTrackStatus(state, 'weekly', now).claimable).toBe(false);
    // รายเดือนยังกดได้ เพราะเป็นคนละปฏิทิน
    expect(getTrackStatus(state, 'monthly', now).claimable).toBe(true);
    // วันถัดไปกดต่อได้
    const tomorrow = new Date('2026-09-04T10:00:00');
    expect(getTrackStatus(state, 'weekly', tomorrow).claimable).toBe(true);
  });

  it('ข้ามสัปดาห์แล้วล้างของรายสัปดาห์ แต่รายเดือนยังอยู่', () => {
    const mon = new Date('2026-09-07T10:00:00');
    let state = claimTrack(claimTrack(emptyLoginState(mon), 'weekly', mon), 'monthly', mon);
    const nextMon = new Date('2026-09-14T10:00:00');
    const rolled = normalizeLoginState(state, nextMon);
    expect(rolled.weeklyClaimed).toEqual([]);
    expect(rolled.monthlyClaimed).toEqual([0]);
    expect(weekKeyOf(mon)).not.toBe(weekKeyOf(nextMon));
  });

  it('รางวัลไอเทมจ่ายเข้าคลังไอเทม', () => {
    const got: string[] = [];
    const ok = grantReward(normalizeReward({ kind: 'item', itemId: 'protect', amount: 2 }), {
      addCoins: () => got.push('coins'),
      addPoints: () => {}, addUpgradePoints: () => {}, addPassTickets: () => {},
      addUpgradeItems: (a) => got.push(`item:${JSON.stringify(a)}`),
      addCard: () => got.push('card'),
    });
    expect(ok).toBe(true);
    expect(got).toEqual(['item:{"protect":2}']);
  });

  it('การ์ดที่ไม่ระบุนักเตะถือว่าตั้งค่าไม่ครบ', () => {
    expect(isRewardValid(normalizeReward({ kind: 'card' }))).toBe(false);
  });
});

/*
 * Firestore ปฏิเสธทั้งเอกสารทันทีที่เจอ undefined สักฟิลด์เดียว
 * บั๊กจริงที่เคยเจอ: normalizeReward คืน itemId/playerId/upgrade/image เป็น undefined
 * เมื่อรางวัลเป็นเหรียญ ทำให้บันทึกรางวัลล็อกอินไม่ผ่านทั้งชุด
 * แต่ UI กลับรายงานว่าเป็นปัญหาสิทธิ์ใน firestore.rules จนหลงไปไล่แก้ผิดจุด
 */
describe('รางวัลต้องไม่มีฟิลด์ undefined (Firestore เขียนไม่ผ่าน)', () => {
  const undefinedKeys = (value: object): string[] =>
    Object.entries(value)
      .filter(([, entry]) => entry === undefined)
      .map(([key]) => key);

  it('ทุกประเภทรางวัลไม่มีคีย์ที่เป็น undefined', () => {
    const samples = [
      { kind: 'coins', amount: 1000 },
      { kind: 'points', amount: 50 },
      { kind: 'upgradePoints', amount: 20 },
      { kind: 'passTicket', amount: 1 },
      { kind: 'item', itemId: 'protect', amount: 2 },
      { kind: 'card', playerId: 'p001', upgrade: 3 },
    ] as const;

    for (const sample of samples) {
      expect(undefinedKeys(normalizeReward(sample))).toEqual([]);
    }
  });

  it('ค่าตั้งทั้งชุดที่ส่งขึ้นเซิร์ฟเวอร์สะอาด', () => {
    const config = normalizeLoginBonus({
      weekly: [{ kind: 'coins', amount: 1000 }],
      monthly: [{ kind: 'card', playerId: 'p001' }],
    });

    const dirty = [...config.weekly, ...config.monthly].flatMap(undefinedKeys);
    expect(dirty).toEqual([]);
    // ผ่าน JSON ได้โดยไม่มีอะไรหาย = ปลอดภัยกับ Firestore
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});
