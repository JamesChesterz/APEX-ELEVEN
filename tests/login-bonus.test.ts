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
