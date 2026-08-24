/**
 * เทสกติกาแกนหลัก: ระบบดาว, คูลดาวน์กันปั้มดาว, การหาคู่แบบคนจริงเท่านั้น,
 * การจัดลีกประจำวันจากผู้เล่นจริง และรางวัลการ์ดตามอันดับปลายซีซัน
 * เป็น pure function ทั้งหมด จึงเทสได้ตรง ๆ ไม่ต้องเปิดเบราว์เซอร์
 */
import { describe, expect, it } from 'vitest';
import { CONSOLATION_CARD_COUNT, REWARD_RANKS } from '@/data/rankRewards';
import {
  buildLeagueMembers,
  buildRoundPairings,
  getRoundRival,
  LEAGUE_SIZE,
  type LeagueMember,
} from '@/services/league';
import { findOpponent, getRankingPoints } from '@/services/matchmaking';
import {
  buildRankReward,
  getRewardPlayer,
  normalizeRankRewards,
  SHOWCASE_ORDER,
} from '@/services/rankRewards';
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

/* ── ลีกประจำวันแบบผู้เล่นจริง ────────────────────────────── */

const member = (id: string, ovr: number): LeagueMember => ({
  id,
  teamName: `ทีม ${id}`,
  managerName: `ผู้จัดการ ${id}`,
  ovr,
  formationId: '4-3-3',
  isReal: true,
});

describe('การจัดลีกประจำวัน', () => {
  /** ผู้เล่นจริง 30 คน OVR ไล่จาก 70 ถึง 99 */
  const crowd = Array.from({ length: 30 }, (_, index) => member(`u${index}`, 70 + index));

  it('จับได้ 10 ทีมที่ OVR ใกล้เคียงกัน และมีเราอยู่ด้วยเสมอ', () => {
    const me = member('me', 85);
    const league = buildLeagueMembers(me, crowd);

    expect(league).toHaveLength(LEAGUE_SIZE);
    expect(league.some((row) => row.id === 'me')).toBe(true);

    // ช่วง OVR ของทั้งลีกต้องแคบ ไม่ใช่จับคนแกร่งสุดมาเจอคนอ่อนสุด
    const spread = Math.max(...league.map((r) => r.ovr)) - Math.min(...league.map((r) => r.ovr));
    expect(spread).toBeLessThanOrEqual(LEAGUE_SIZE);
  });

  it('OVR เปลี่ยน = ถูกย้ายไปลีกกลุ่มใหม่', () => {
    const before = buildLeagueMembers(member('me', 72), crowd).map((row) => row.id);
    const after = buildLeagueMembers(member('me', 97), crowd).map((row) => row.id);

    expect(before).not.toEqual(after);
    // ลีกของคนอ่อนกับคนแกร่งต้องไม่มีสมาชิกร่วมกันเลย
    expect(before.filter((id) => after.includes(id) && id !== 'me')).toHaveLength(0);
  });

  it('ผู้เล่นจริงยังไม่ถึง 10 คน ก็แข่งกันเท่าที่มี', () => {
    const league = buildLeagueMembers(member('me', 80), [member('a', 79), member('b', 81)]);
    expect(league).toHaveLength(3);
  });

  it('ตารางแข่งวนครบทุกคู่ และแต่ละรอบทุกทีมได้ลงเตะครั้งเดียว', () => {
    const league = buildLeagueMembers(member('me', 85), crowd);
    const seen = new Set<string>();

    for (let round = 0; round < LEAGUE_SIZE - 1; round += 1) {
      const pairs = buildRoundPairings(league, round);
      expect(pairs).toHaveLength(LEAGUE_SIZE / 2);

      // ไม่มีใครถูกจับคู่ซ้อนสองนัดในรอบเดียว
      const played = pairs.flatMap(([home, away]) => [home.id, away.id]);
      expect(new Set(played).size).toBe(LEAGUE_SIZE);

      pairs.forEach(([home, away]) => seen.add([home.id, away.id].sort().join('-')));
    }

    // 10 ทีมเจอกันครบทุกคู่ใน 9 รอบ = 45 คู่
    expect(seen.size).toBe((LEAGUE_SIZE * (LEAGUE_SIZE - 1)) / 2);
  });

  it('คู่แข่งของเราในแต่ละรอบไม่ใช่ตัวเราเอง', () => {
    const league = buildLeagueMembers(member('me', 85), crowd);

    for (let round = 0; round < 20; round += 1) {
      const rival = getRoundRival(league, 'me', round);
      expect(rival).not.toBeNull();
      expect(rival?.id).not.toBe('me');
    }
  });
});

/* ── รางวัลตามอันดับในตารางอันดับ ─────────────────────────── */

describe('รางวัลปลายซีซันตามอันดับ', () => {
  const cards = normalizeRankRewards();

  it('อันดับ 1 อยู่ตรงกลางแถวโชว์รางวัล', () => {
    expect(SHOWCASE_ORDER).toHaveLength(REWARD_RANKS);
    expect(SHOWCASE_ORDER[Math.floor(REWARD_RANKS / 2)]).toBe(1);
    // ครบทุกอันดับ 1–10 ไม่ซ้ำ ไม่ขาด
    expect([...SHOWCASE_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: REWARD_RANKS }, (_, index) => index + 1),
    );
  });

  it('id การ์ดที่ตั้งผิดจะถอยไปใช้ค่าเริ่มต้น ไม่ทำให้เกมพัง', () => {
    const fixed = normalizeRankRewards(['ไม่มีจริง', undefined, 'p061']);
    expect(fixed).toHaveLength(REWARD_RANKS);
    expect(fixed[2]).toBe('p061');
    expect(getRewardPlayer(1, fixed)).toBeDefined();
  });

  it('อันดับ 1–10 ได้การ์ดที่กำหนดไว้ · อันดับ 11 ลงไปได้แพ็คสุ่ม 10 ใบ', () => {
    const champion = buildRankReward(1, cards);
    expect(champion.featured).toBe(true);
    expect(champion.cards).toHaveLength(1);
    expect(champion.cards[0].playerId).toBe(cards[0]);

    const others = buildRankReward(11, cards);
    expect(others.featured).toBe(false);
    expect(others.cards).toHaveLength(CONSOLATION_CARD_COUNT);
  });
});
