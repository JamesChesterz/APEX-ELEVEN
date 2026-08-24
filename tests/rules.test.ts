/**
 * เทสกติกาแกนหลักที่เพิ่งเปลี่ยน: ระบบดาว, คูลดาวน์กันปั้มดาว, การหาคู่แบบคนจริงเท่านั้น
 * เป็น pure function ทั้งหมด จึงเทสได้ตรง ๆ ไม่ต้องเปิดเบราว์เซอร์
 */
import { describe, expect, it } from 'vitest';
import { findOpponent, getRankingPoints } from '@/services/matchmaking';
import { getRankTier } from '@/services/rank';
import { filterAvailable, isOnCooldown, rememberRival, RIVAL_COOLDOWN_MS } from '@/services/rivals';
import type { Opponent } from '@/types/match';

const rival = (id: string, ovr: number): Opponent => ({
  id,
  name: `ทีม ${id}`,
  manager: 'ผู้จัดการ',
  ovr,
  formationId: '4-3-3',
  difficulty: 'even',
  rewardCoins: 1000,
  isBot: false,
});

describe('ระบบดาว', () => {
  it('ชนะ +1 เสมอ 0 แพ้ −1', () => {
    expect(getRankingPoints('win')).toBe(1);
    expect(getRankingPoints('draw')).toBe(0);
    expect(getRankingPoints('loss')).toBe(-1);
  });

  it('ระดับเลื่อนตามจำนวนดาว', () => {
    expect(getRankTier(0).id).toBe('bronze');
    expect(getRankTier(9).id).toBe('bronze');
    expect(getRankTier(10).id).toBe('gold');
    expect(getRankTier(25).id).toBe('platinum');
    expect(getRankTier(50).id).toBe('legend');
    expect(getRankTier(100).id).toBe('champion');
  });
});

describe('หาคู่แข่ง', () => {
  it('โหมดออนไลน์ไม่มีคนจริง = ไม่จับคู่ (ไม่แอบใส่บอท)', () => {
    expect(findOpponent(80, [], false)).toBeNull();
  });

  it('เจอคนจริงที่พลังใกล้เคียงก่อน', () => {
    const pool = [rival('a', 80), rival('b', 40)];
    const picks = Array.from({ length: 30 }, () => findOpponent(80, pool, false)?.id);
    expect(picks.every((id) => id === 'a')).toBe(true);
  });

  it('ไม่มีใครพลังใกล้เคียงก็ยังจับคู่กับคนที่เหลือ ดีกว่าไม่ได้เล่น', () => {
    const found = findOpponent(80, [rival('far', 30)], false);
    expect(found?.id).toBe('far');
  });

  it('โหมดออฟไลน์ยังเจอบอทได้ (ไม่มีเซิร์ฟเวอร์ให้หาคน)', () => {
    expect(findOpponent(80, [], true)).not.toBeNull();
  });
});

describe('คูลดาวน์กันปั้มดาว', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z');

  it('เพิ่งเจอ = ยังท้าซ้ำไม่ได้', () => {
    const rivals = rememberRival([], 'a', now);
    expect(isOnCooldown(rivals, 'a', now + 60_000)).toBe(true);
  });

  it('พ้นเวลาแล้วเจอได้อีก', () => {
    const rivals = rememberRival([], 'a', now);
    expect(isOnCooldown(rivals, 'a', now + RIVAL_COOLDOWN_MS + 1)).toBe(false);
  });

  it('ตัดคนที่ติดคูลดาวน์ออกจากคิว', () => {
    const rivals = rememberRival([], 'a', now);
    const available = filterAvailable([rival('a', 80), rival('b', 80)], rivals, now + 1000);
    expect(available.map((entry) => entry.id)).toEqual(['b']);
  });

  it('เจอคนเดิมซ้ำไม่ทำให้รายการบวม', () => {
    const once = rememberRival([], 'a', now);
    const twice = rememberRival(once, 'a', now + 1000);
    expect(twice).toHaveLength(1);
  });
});
