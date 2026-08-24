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
import {
  addBan,
  banReason,
  BAN_REASON_MAX_CHARS,
  hasPendingReset,
  isBanned,
  pointsAfterReset,
  removeBan,
  shouldShowAnnouncement,
} from '@/services/admin';
import { clampGiftAmount, GIFT_MAX_AMOUNT } from '@/services/firebase/gifts';
import {
  formatCountdown,
  getRotationIndex,
  getRotationPlayers,
  PER_RARITY_LIMIT,
  ROTATION_HOURS,
  ROTATION_RARITIES,
  secondsToRotation,
} from '@/services/exchangeRotation';
import { findOpponent, getRankingPoints } from '@/services/matchmaking';
import { resolveSeasonDays, SEASON_DAYS } from '@/services/season';
import type { AccountState } from '@/types/account';
import {
  getServerRating,
  isSquadComplete,
  MATCH_INTERVAL_MS,
  matchCooldownLeft,
} from '../functions/src/gameplay';
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

/* ── คำสั่งของแอดมิน ──────────────────────────────────────── */

describe('รีเซ็ตดาวตามคำสั่งแอดมิน', () => {
  const command = { resetAt: '2026-08-24T10:00:00.000Z', keep: 0 };

  it('บัญชีที่ยังไม่เคยรีเซ็ต = ต้องรีเซ็ต', () => {
    expect(hasPendingReset(command, undefined)).toBe(true);
  });

  it('รีเซ็ตไปแล้วตามคำสั่งใบเดิม = ไม่ทำซ้ำ', () => {
    expect(hasPendingReset(command, command.resetAt)).toBe(false);
    expect(hasPendingReset(command, '2026-08-25T00:00:00.000Z')).toBe(false);
  });

  it('แอดมินสั่งใบใหม่ = รีเซ็ตอีกครั้ง', () => {
    expect(hasPendingReset(command, '2026-08-01T00:00:00.000Z')).toBe(true);
  });

  it('ไม่มีคำสั่งเลย = ไม่ต้องทำอะไร', () => {
    expect(hasPendingReset({}, undefined)).toBe(false);
  });

  it('เก็บดาวไว้ตามสัดส่วนที่สั่ง และไม่ติดลบ', () => {
    expect(pointsAfterReset(1000, { keep: 0 })).toBe(0);
    expect(pointsAfterReset(1000, { keep: 0.3 })).toBe(300);
    expect(pointsAfterReset(1000, {})).toBe(0);
    // ค่าเพี้ยนจากเซิร์ฟเวอร์ต้องไม่ทำให้ดาวพุ่งหรือติดลบ
    expect(pointsAfterReset(1000, { keep: 9 })).toBe(1000);
    expect(pointsAfterReset(-50, { keep: 1 })).toBe(0);
  });
});

describe('ประกาศกลางจอ', () => {
  const announcement = { title: 'ทดสอบ', message: 'สวัสดี', enabled: true, version: 'v2' };

  it('ยังไม่เคยอ่านเวอร์ชันนี้ = ต้องขึ้น', () => {
    expect(shouldShowAnnouncement(announcement, null)).toBe(true);
    expect(shouldShowAnnouncement(announcement, 'v1')).toBe(true);
  });

  it('อ่านเวอร์ชันนี้แล้ว = ไม่ขึ้นซ้ำ', () => {
    expect(shouldShowAnnouncement(announcement, 'v2')).toBe(false);
  });

  it('ปิดอยู่ หรือไม่มีข้อความ = ไม่ขึ้น', () => {
    expect(shouldShowAnnouncement({ ...announcement, enabled: false }, null)).toBe(false);
    expect(shouldShowAnnouncement({ ...announcement, message: '   ' }, null)).toBe(false);
    expect(shouldShowAnnouncement(null, null)).toBe(false);
  });
});

describe('ความยาวซีซันที่แอดมินตั้ง', () => {
  it('ไม่ได้ตั้ง = ใช้ค่าเริ่มต้น', () => {
    expect(resolveSeasonDays(undefined)).toBe(SEASON_DAYS);
  });

  it('ตั้งค่าเพี้ยนถูกบีบให้อยู่ในช่วงที่ปลอดภัย', () => {
    expect(resolveSeasonDays(0)).toBe(1);
    expect(resolveSeasonDays(9999)).toBe(365);
    expect(resolveSeasonDays(30)).toBe(30);
  });
});

describe('ของขวัญจากแอดมิน', () => {
  it('จำนวนถูกบีบให้เป็นจำนวนเต็มบวกเสมอ', () => {
    expect(clampGiftAmount(1500.7)).toBe(1500);
    expect(clampGiftAmount(-999)).toBe(0);
    expect(clampGiftAmount('ไม่ใช่ตัวเลข')).toBe(0);
    expect(clampGiftAmount(GIFT_MAX_AMOUNT * 10)).toBe(GIFT_MAX_AMOUNT);
  });
});

/* ── กติกาฝั่งเซิร์ฟเวอร์ (Cloud Functions) ────────────────── */

describe('ค่าพลังทีมที่เซิร์ฟเวอร์คำนวณเอง', () => {
  /** บัญชีเปล่า ๆ ที่ยังไม่ได้จัดตัว */
  const emptyState: AccountState = {
    coins: 0,
    points: 0,
    cards: [],
    record: { points: 0, wins: 0, draws: 0, losses: 0 },
    formationId: '4-3-3',
    squad: {},
  };

  it('ไม่มีการ์ดในคลัง = จัดตัวไม่ครบ ลงแข่งไม่ได้', () => {
    expect(isSquadComplete(emptyState)).toBe(false);
  });

  it('อ้างชื่อการ์ดที่ไม่มีอยู่จริง = ยังถือว่าช่องว่าง', () => {
    const faked: AccountState = {
      ...emptyState,
      squad: { ST1: 'การ์ดที่ไม่มีจริง', ST2: 'ปลอมอีกใบ' },
    };

    expect(isSquadComplete(faked)).toBe(false);
    // ค่าพลังต้องไม่ขยับตามการ์ดปลอม
    expect(getServerRating(faked).ovr).toBe(getServerRating(emptyState).ovr);
  });

  it('คูลดาวน์รายนัดกันการยิงคำขอรัว ๆ', () => {
    const now = Date.now();
    expect(matchCooldownLeft(new Date(now).toISOString(), now)).toBe(MATCH_INTERVAL_MS);
    expect(matchCooldownLeft(new Date(now - MATCH_INTERVAL_MS).toISOString(), now)).toBe(0);
    // ไม่เคยแข่ง หรือค่าเพี้ยน = ลงแข่งได้เลย ไม่ใช่ค้างตลอดกาล
    expect(matchCooldownLeft(undefined, now)).toBe(0);
    expect(matchCooldownLeft('ไม่ใช่วันที่', now)).toBe(0);
  });
});

/* ── ร้านแลกนักเตะแบบหมุนเวียน ─────────────────────────────── */

describe('ร้านแลกนักเตะหมุนเวียนทุก 3 ชั่วโมง', () => {
  const index = getRotationIndex(new Date('2026-08-24T10:00:00.000Z'));

  it('แต่ละระดับมีของไม่เกิน 5 ใบ และมีครบทุกระดับที่มีนักเตะอยู่', () => {
    const players = getRotationPlayers(index);

    ROTATION_RARITIES.forEach((rarity) => {
      const count = players.filter((player) => player.rarity === rarity).length;
      expect(count).toBeLessThanOrEqual(PER_RARITY_LIMIT);
      expect(count).toBeGreaterThan(0);
    });
  });

  it('ไม่มีนักเตะซ้ำในรอบเดียวกัน', () => {
    const ids = getRotationPlayers(index).map((player) => player.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('รอบเดิมได้ของชุดเดิมเสมอ (เปิดกี่เครื่องก็ตรงกัน)', () => {
    expect(getRotationPlayers(index).map((p) => p.id)).toEqual(
      getRotationPlayers(index).map((p) => p.id),
    );
  });

  it('คนละรอบได้ของคนละชุด', () => {
    expect(getRotationPlayers(index).map((p) => p.id)).not.toEqual(
      getRotationPlayers(index + 1).map((p) => p.id),
    );
  });

  it('เวลาในรอบเดียวกันให้เลขรอบเดียวกัน แล้วขยับเมื่อข้ามรอบ', () => {
    const start = new Date('2026-08-24T09:00:00.000Z');
    const sameRound = new Date('2026-08-24T11:59:00.000Z');
    const nextRound = new Date('2026-08-24T12:00:00.000Z');

    expect(getRotationIndex(sameRound)).toBe(getRotationIndex(start));
    expect(getRotationIndex(nextRound)).toBe(getRotationIndex(start) + 1);
  });

  it('นาฬิกาถอยหลังไม่เกินความยาวรอบ และไม่ติดลบ', () => {
    const left = secondsToRotation(new Date('2026-08-24T10:30:00.000Z'));
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(ROTATION_HOURS * 3600);
    expect(formatCountdown(left)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

/* ── รายชื่อบัญชีที่ถูกระงับ ────────────────────────────────── */

describe('ระบบแบนบัญชี', () => {
  const empty = {};

  it('ยังไม่มีใครถูกแบน = ทุกคนผ่าน', () => {
    expect(isBanned(empty, 'u1')).toBe(false);
    expect(isBanned(null, 'u1')).toBe(false);
    expect(isBanned({ uids: [] }, 'u1')).toBe(false);
  });

  it('แบนแล้วเจอชื่อ พร้อมเหตุผลที่ผู้ถูกแบนจะเห็น', () => {
    const bans = addBan(empty, 'u1', 'ยัดดาว');

    expect(isBanned(bans, 'u1')).toBe(true);
    expect(banReason(bans, 'u1')).toBe('ยัดดาว');
    // คนอื่นต้องไม่โดนหางเลข
    expect(isBanned(bans, 'u2')).toBe(false);
  });

  it('แบนคนเดิมซ้ำไม่ทำให้ชื่อซ้ำในรายการ', () => {
    const once = addBan(empty, 'u1', 'ครั้งแรก');
    const twice = addBan(once, 'u1', 'ครั้งที่สอง');

    expect(twice.uids).toEqual(['u1']);
    expect(banReason(twice, 'u1')).toBe('ครั้งที่สอง');
  });

  it('ปลดแบนแล้วลบทั้งชื่อและเหตุผล ไม่เหลือขยะค้าง', () => {
    const bans = addBan(addBan(empty, 'u1', 'a'), 'u2', 'b');
    const after = removeBan(bans, 'u1');

    expect(isBanned(after, 'u1')).toBe(false);
    expect(after.reasons?.u1).toBeUndefined();
    // คนอื่นในรายการต้องอยู่ครบเหมือนเดิม
    expect(isBanned(after, 'u2')).toBe(true);
    expect(banReason(after, 'u2')).toBe('b');
  });

  it('เหตุผลยาวเกินถูกตัดตามเพดาน', () => {
    const bans = addBan(empty, 'u1', 'ก'.repeat(BAN_REASON_MAX_CHARS + 50));
    expect(banReason(bans, 'u1').length).toBe(BAN_REASON_MAX_CHARS);
  });
});
