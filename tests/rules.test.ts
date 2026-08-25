/**
 * เทสกติกาแกนหลัก: ระบบดาว, คูลดาวน์กันปั้มดาว, การหาคู่แบบคนจริงเท่านั้น,
 * การจัดลีกประจำวันจากผู้เล่นจริง และรางวัลการ์ดตามอันดับปลายซีซัน
 * เป็น pure function ทั้งหมด จึงเทสได้ตรง ๆ ไม่ต้องเปิดเบราว์เซอร์
 */
import { describe, expect, it } from 'vitest';
import { BULK_PACK_COUNT, CARD_PACKS } from '@/data/cards';
import {
  CONSOLATION_CARD_COUNT,
  REWARD_RANKS,
  REWARD_RANKS_RANGE,
  SHOP_PROTECTED_RANKS,
} from '@/data/rankRewards';
import {
  createEmptyPack,
  findEmptyRarities,
  normalizePacks,
  PACK_LIMITS,
  sumOdds,
} from '@/services/packConfig';
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
import { ALL_PANELS, SIDE_PANELS } from '@/hooks/useDashboardPanels';
import {
  chatCooldownLeft,
  CHAT_COOLDOWN_MS,
  CHAT_MAX_CHARS,
  cleanChatText,
  isSendableChat,
} from '@/services/chat';
import {
  formatCountdown,
  getRotationIndex,
  getRotationPlayers,
  PER_RARITY_LIMIT,
  ROTATION_HOURS,
  ROTATION_RARITIES,
  secondsToRotation,
} from '@/services/exchangeRotation';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { buildTimeline, findOpponent, getRankingPoints } from '@/services/matchmaking';
import { openPack } from '@/services/cardPack';
import { buildScorerPool } from '@/services/scorers';
import { PROFILE_TEAM_OVR_CAP } from '@/services/firebase/profiles';
import {
  canLevelUp,
  getLevelBonus,
  getUpgradeChance,
  getUpgradeCost,
  MAX_LEVEL,
  MAX_PLUS,
  OVR_PER_LEVEL,
} from '@/services/upgrade';
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
  buildShowcaseOrder,
  getRewardPlayer,
  getShopProtectedCards,
  normalizeRankRewards,
  resolveRewardCount,
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

  it('อันดับ 1 อยู่ตรงกลางแถวโชว์รางวัล และครบทุกอันดับ ไม่ซ้ำไม่ขาด', () => {
    // ตรวจหลายจำนวน เพราะแอดมินตั้งจำนวนรางวัลเองได้
    [1, 3, 10, 15].forEach((count) => {
      const order = buildShowcaseOrder(count);

      expect(order).toHaveLength(count);
      expect(order[Math.floor(count / 2)]).toBe(1);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, index) => index + 1),
      );
    });
  });

  it('ลำดับ 10 รางวัลตรงกับที่ออกแบบไว้ (ไล่ออกซ้าย-ขวาสลับกัน)', () => {
    expect(buildShowcaseOrder(REWARD_RANKS)).toEqual([10, 8, 6, 4, 2, 1, 3, 5, 7, 9]);
  });

  it('จำนวนรางวัลถูกบีบให้อยู่ในช่วงที่ตั้งได้', () => {
    expect(resolveRewardCount(0)).toBe(REWARD_RANKS_RANGE.min);
    expect(resolveRewardCount(999)).toBe(REWARD_RANKS_RANGE.max);
    expect(resolveRewardCount(undefined)).toBe(REWARD_RANKS);
    expect(resolveRewardCount(5)).toBe(5);
  });

  it('ตั้งจำนวนรางวัลเท่าไหร่ ก็ได้รายการยาวเท่านั้น', () => {
    expect(normalizeRankRewards([], 3)).toHaveLength(3);
    expect(normalizeRankRewards(['p061', 'p062'])).toHaveLength(2);
  });

  it('id การ์ดที่ตั้งผิดจะถอยไปใช้ค่าเริ่มต้น ไม่ทำให้เกมพัง', () => {
    const fixed = normalizeRankRewards(['ไม่มีจริง', undefined, 'p061'], REWARD_RANKS);
    expect(fixed).toHaveLength(REWARD_RANKS);
    expect(fixed[2]).toBe('p061');
    expect(getRewardPlayer(1, fixed)).toBeDefined();
  });

  it('อันดับที่มีรางวัลได้การ์ดที่กำหนดไว้ · นอกนั้นได้แพ็คสุ่ม', () => {
    const champion = buildRankReward(1, cards);
    expect(champion.featured).toBe(true);
    expect(champion.cards).toHaveLength(1);
    expect(champion.cards[0].playerId).toBe(cards[0]);

    const others = buildRankReward(cards.length + 1, cards);
    expect(others.featured).toBe(false);
    expect(others.cards).toHaveLength(CONSOLATION_CARD_COUNT);
  });

  it('ตั้งรางวัลแค่ 3 อันดับ = อันดับ 4 ได้แพ็คสุ่มแล้ว', () => {
    const three = normalizeRankRewards(cards, 3);

    expect(buildRankReward(3, three).featured).toBe(true);
    expect(buildRankReward(4, three).featured).toBe(false);
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

/* ── Live แชท ─────────────────────────────────────────────── */

describe('กติกาของแชท', () => {
  it('ตัดช่องว่างหัวท้าย และยุบบรรทัดว่างซ้อนกัน', () => {
    expect(cleanChatText('   สวัสดี   ')).toBe('สวัสดี');
    expect(cleanChatText('บน\n\n\n\nล่าง')).toBe('บน\nล่าง');
  });

  it('ข้อความยาวเกินถูกตัดตามเพดาน', () => {
    expect(cleanChatText('ก'.repeat(CHAT_MAX_CHARS + 100)).length).toBe(CHAT_MAX_CHARS);
  });

  it('ข้อความว่างหรือมีแต่ช่องว่างส่งไม่ได้', () => {
    expect(isSendableChat('')).toBe(false);
    expect(isSendableChat('    ')).toBe(false);
    expect(isSendableChat('\n\n')).toBe(false);
    expect(isSendableChat('ว')).toBe(true);
  });

  it('คูลดาวน์กันพิมพ์รัว', () => {
    const now = Date.now();
    expect(chatCooldownLeft(now, now)).toBe(CHAT_COOLDOWN_MS);
    expect(chatCooldownLeft(now - CHAT_COOLDOWN_MS, now)).toBe(0);
    // ยังไม่เคยพิมพ์ = พิมพ์ได้เลย ไม่ใช่ค้างตลอดกาล
    expect(chatCooldownLeft(null, now)).toBe(0);
  });
});

/* ── ซ่อน/แสดงการ์ดในแดชบอร์ด ─────────────────────────────── */

describe('รายการการ์ดที่ซ่อนได้ในหน้า MY TEAM', () => {
  it('คอลัมน์ขวามี 4 ใบ เรียงตามที่แสดงจริง และแชทมาแทนที่แผงตีบวก', () => {
    expect(SIDE_PANELS.map((panel) => panel.id)).toEqual([
      'teamOvr',
      'chemistry',
      'teamValue',
      'chat',
    ]);
  });

  it('id ห้ามซ้ำ เพราะใช้กุญแจเดียวกันตอนจำค่าลงเครื่อง', () => {
    const ids = ALL_PANELS.map((panel) => panel.id);

    expect(ids).toHaveLength(SIDE_PANELS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ทุกใบมีชื่อกำกับ ใช้บอกผู้เล่นว่ากดแล้วซ่อนอะไร', () => {
    ALL_PANELS.forEach((panel) => expect(panel.label.length).toBeGreaterThan(0));
  });
});

/* ── ซองการ์ดที่แอดมินสร้างเอง ─────────────────────────────── */

describe('ซองการ์ดในร้าน', () => {
  const base = createEmptyPack();

  it('ยังไม่เคยตั้ง = ใช้ชุดค่าเริ่มต้นในโค้ด', () => {
    expect(normalizePacks(null)).toEqual(CARD_PACKS);
    expect(normalizePacks([])).toEqual(CARD_PACKS);
  });

  it('id ซ้ำถูกเติมเลขให้ ไม่งั้นกดซองหลังจะได้ของซองแรก', () => {
    const packs = normalizePacks([
      { ...base, id: 'pack-mythic', name: 'A' },
      { ...base, id: 'pack-mythic', name: 'B' },
      { ...base, id: 'pack-mythic', name: 'C' },
    ]);

    expect(packs.map((pack) => pack.id)).toEqual(['pack-mythic', 'pack-mythic-2', 'pack-mythic-3']);
  });

  it('ค่าที่เกินกรอบถูกบีบกลับมา', () => {
    const [pack] = normalizePacks([
      { ...base, price: -500, cardCount: 999, name: 'ก'.repeat(200) },
    ]);

    expect(pack.price).toBe(0);
    expect(pack.cardCount).toBe(PACK_LIMITS.maxCardsPerPack);
    expect(pack.name.length).toBe(PACK_LIMITS.maxNameChars);
  });

  it('odds ว่างทั้งหมดถอยไปใช้ common ล้วน แทนที่จะสุ่มไม่ออกอะไรเลย', () => {
    const [pack] = normalizePacks([
      { ...base, odds: { common: 0, rare: 0, epic: 0, legendary: 0, mythical: 0 } },
    ]);

    expect(pack.odds.common).toBe(100);
    expect(sumOdds(pack.odds)).toBe(100);
  });

  it('การ์ดที่ไม่มีอยู่จริงและใบซ้ำถูกคัดออกจากซอง', () => {
    const [pack] = normalizePacks([
      { ...base, pool: ['p061', 'p061', 'ไม่มีจริง', 'p062'] },
    ]);

    expect(pack.pool).toEqual(['p061', 'p062']);
  });

  it('จำกัดจำนวนซองสูงสุด', () => {
    const many = Array.from({ length: 50 }, (_, index) => ({ ...base, id: `p${index}` }));
    expect(normalizePacks(many)).toHaveLength(PACK_LIMITS.maxPacks);
  });

  it('เตือนเมื่อตั้งโอกาสได้ระดับที่ไม่มีการ์ดอยู่ในซอง', () => {
    // p061 เป็น mythical — ซองนี้จึงไม่มีทางออก legendary ตามที่ตั้งไว้
    const pack = {
      ...base,
      odds: { common: 0, rare: 0, epic: 0, legendary: 50, mythical: 50 },
      pool: ['p061'],
    };

    expect(findEmptyRarities(pack)).toEqual(['legendary']);
    // ไม่กำหนดรายชื่อ = สุ่มจากทั้งเกม จึงไม่ต้องเตือน
    expect(findEmptyRarities({ ...pack, pool: [] })).toEqual([]);
  });
});

/* ── ชื่อคนยิงในไทม์ไลน์ ───────────────────────────────────── */

describe('ไทม์ไลน์ประตูต้องใช้ชื่อนักเตะจริง', () => {
  const formation = getFormationById('4-3-3');

  /** ตัวจริงครบ 11 คนจากนักเตะจริงในเกม */
  const squad = formation.slots.map((slot, index) => ({
    slotId: slot.id,
    playerId: PLAYERS[index].id,
    level: 1,
  }));

  it('ดึงชื่อจากตัวจริงของทีมนั้นจริง ๆ', () => {
    const pool = buildScorerPool('4-3-3', squad);
    const names = new Set(PLAYERS.slice(0, 11).map((player) => player.name));

    expect(pool.length).toBeGreaterThan(0);
    pool.forEach((name) => expect(names.has(name)).toBe(true));
  });

  it('ผู้รักษาประตูไม่ถูกใส่ในรายชื่อคนยิง', () => {
    const gkSlot = formation.slots.findIndex((slot) => slot.position === 'GK');
    const gkName = PLAYERS[gkSlot].name;

    expect(buildScorerPool('4-3-3', squad)).not.toContain(gkName);
  });

  it('ช่องว่างและการ์ดที่ไม่มีอยู่จริงถูกข้ามไป ไม่พัง', () => {
    expect(buildScorerPool('4-3-3', undefined)).toEqual([]);
    expect(buildScorerPool('4-3-3', [])).toEqual([]);
    expect(
      buildScorerPool('4-3-3', [{ slotId: 'ST1', playerId: 'ไม่มีจริง', level: 1 }]),
    ).toEqual([]);
  });

  it('ประตูของทั้งสองฝั่งใช้ชื่อจากทีมของฝั่งนั้น ไม่ปนกัน', () => {
    const events = buildTimeline(3, 2, ['เรา A', 'เรา B'], ['เขา A', 'เขา B']);

    expect(events.filter((event) => event.side === 'team')).toHaveLength(3);
    expect(events.filter((event) => event.side === 'opponent')).toHaveLength(2);

    events.forEach((event) => {
      const expected = event.side === 'team' ? ['เรา A', 'เรา B'] : ['เขา A', 'เขา B'];
      expect(expected).toContain(event.scorer);
    });
  });

  it('ไทม์ไลน์เรียงตามนาที และนาทีไม่ซ้ำกัน', () => {
    const events = buildTimeline(4, 3, ['เรา'], ['เขา']);
    const minutes = events.map((event) => event.minute);

    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(new Set(minutes).size).toBe(minutes.length);
  });
});

/* ── เพดานค่าพลังทีมในกฎ ───────────────────────────────────── */

describe('เพดานค่าพลังทีมที่กฎยอมรับ', () => {
  /**
   * ค่าพลังทีมสูงสุดที่ผู้เล่นทำได้จริง
   * = การ์ดแรงสุดในเกม + ตีบวกจนเต็ม + โบนัสเคมีสูงสุด
   */
  const maxAchievable =
    Math.max(...PLAYERS.map((player) => player.ovr)) + MAX_PLUS * OVR_PER_LEVEL + 3;

  it('เพดานต้องสูงกว่าค่าที่ทำได้จริง', () => {
    // เคยพลาดมาแล้ว: เพดานตั้งไว้ 120 แต่การ์ดแรงถึง 123
    // ทีมที่เกิน 120 จึงเขียนโปรไฟล์ไม่ผ่านทั้งหมด และค้างอยู่กับข้อมูลเก่าแบบเงียบ ๆ
    expect(maxAchievable).toBeLessThanOrEqual(PROFILE_TEAM_OVR_CAP);
  });

  it('เพดานไม่หลวมเกินไปจนยัดค่ามั่วได้', () => {
    expect(PROFILE_TEAM_OVR_CAP).toBeLessThan(maxAchievable * 3);
  });
});

/* ── กันการ์ดรางวัลอันดับต้นออกจากร้าน ─────────────────────── */

describe('การ์ดรางวัลอันดับ 1–3 ห้ามเข้าร้านแลกนักเตะ', () => {
  const rewardCards = normalizeRankRewards();
  const protectedCards = getShopProtectedCards(rewardCards);

  it('กันเฉพาะสามอันดับแรก อันดับ 4 ลงไปยังเข้าร้านได้', () => {
    expect(protectedCards.size).toBe(SHOP_PROTECTED_RANKS);
    expect(protectedCards.has(rewardCards[0])).toBe(true);
    expect(protectedCards.has(rewardCards[SHOP_PROTECTED_RANKS])).toBe(false);
  });

  it('ตั้งการ์ดใบเดียวกันให้หลายอันดับ ก็ยุบเหลือใบเดียว', () => {
    expect(getShopProtectedCards(['p061', 'p061', 'p061']).size).toBe(1);
  });

  it('การ์ดต้องห้ามไม่โผล่ในร้านทุกรอบที่สุ่ม', () => {
    // ตรวจหลายรอบ เพราะของในร้านเปลี่ยนไปตามเลขรอบ
    for (let round = 0; round < 40; round += 1) {
      const ids = getRotationPlayers(round, protectedCards).map((player) => player.id);
      ids.forEach((id) => expect(protectedCards.has(id)).toBe(false));
    }
  });

  it('คัดออกก่อนสุ่ม ของในร้านจึงไม่ลดจำนวนลงเพราะบังเอิญสุ่มติดใบต้องห้าม', () => {
    const withoutFilter = getRotationPlayers(7);
    const withFilter = getRotationPlayers(7, protectedCards);

    // ทั้งเกมมีนักเตะเหลือเฟือ จำนวนของในร้านจึงต้องเท่าเดิม
    expect(withFilter).toHaveLength(withoutFilter.length);
  });

  it('ไม่ส่งรายการต้องห้ามมา ร้านก็ทำงานเหมือนเดิม', () => {
    expect(getRotationPlayers(3).length).toBeGreaterThan(0);
  });
});

/* ── ตัวเลขในหน้าตีบวก ─────────────────────────────────────── */

describe('ค่าตีบวกต้องขยับตามเลเวลจริง', () => {
  it('ทุกขั้นมีราคาและโอกาสสำเร็จของตัวเอง ไม่ซ้ำกันทั้งหมด', () => {
    const levels = Array.from({ length: MAX_LEVEL }, (_, index) => index + 1);
    const chances = levels.map((level) => getUpgradeChance(level));
    const costs = levels.map((level) => getUpgradeCost(level));

    // ถ้าทุกขั้นเหมือนกันหมด แปลว่าหน้าจอที่ "ค้างค่าเดิม" จะดูไม่ออกว่าผิด
    expect(new Set(chances).size).toBeGreaterThan(1);
    expect(new Set(costs).size).toBeGreaterThan(1);
  });

  it('ยิ่งบวกสูงยิ่งยากขึ้นและแพงขึ้น', () => {
    expect(getUpgradeChance(2)).toBeLessThanOrEqual(getUpgradeChance(1));
    expect(getUpgradeCost(2)).toBeGreaterThanOrEqual(getUpgradeCost(1));
  });

  it('ค่าพลังเพิ่มขึ้นตามเลเวล และตันที่ +5', () => {
    expect(getLevelBonus(1)).toBe(0);
    expect(getLevelBonus(2)).toBe(OVR_PER_LEVEL);
    expect(getLevelBonus(MAX_LEVEL)).toBe(MAX_PLUS * OVR_PER_LEVEL);
    expect(canLevelUp(MAX_LEVEL)).toBe(false);
  });
});

/* ── ซื้อซองยกชุด ─────────────────────────────────────────── */

describe('เปิดซองทีละหลายซอง', () => {
  const pack = CARD_PACKS[0];

  it('ได้การ์ดครบตามจำนวนซอง × การ์ดต่อซอง', () => {
    expect(openPack(pack).cards).toHaveLength(pack.cardCount);
    expect(openPack(pack, BULK_PACK_COUNT).cards).toHaveLength(
      pack.cardCount * BULK_PACK_COUNT,
    );
  });

  it('บอกจำนวนซองที่เปิด เพื่อให้หน้าจอรู้ว่าต้องโชว์แบบไหน', () => {
    expect(openPack(pack).packCount).toBe(1);
    expect(openPack(pack, BULK_PACK_COUNT).packCount).toBe(BULK_PACK_COUNT);
  });

  it('การ์ดทุกใบมี id ไม่ซ้ำกัน แม้เปิดทีเดียวสิบซอง', () => {
    const ids = openPack(pack, BULK_PACK_COUNT).cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ค่าจำนวนซองที่เพี้ยนถูกบีบให้เปิดอย่างน้อยหนึ่งซอง', () => {
    expect(openPack(pack, 0).cards).toHaveLength(pack.cardCount);
    expect(openPack(pack, -5).cards).toHaveLength(pack.cardCount);
  });
});
