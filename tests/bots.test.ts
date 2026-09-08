/**
 * ทีมจำลองประจำเซิร์ฟเวอร์ — เรื่องที่พลาดแล้วพัง
 *
 *   1. ต้อง deterministic จริง: ทุกเครื่องที่เวลาเดียวกันต้องเห็นตารางเดียวกัน
 *      (ถ้าหลุด Math.random เข้าไปเมื่อไหร่ เทสนี้จะจับได้)
 *   2. ต้องโตตามเวลาแล้วตันที่เพดาน ไม่ใช่โตไม่มีที่สิ้นสุดจนไม่มีใครตามทัน
 *   3. บอทห้ามแซงอันดับ 1 ของผู้เล่นจริง เพราะรางวัลปลายซีซันจ่ายตามอันดับ
 *   4. ค่าที่แอดมินล็อกต้องชนะค่าที่ระบบสุ่มเสมอ และค่าเพี้ยนจากเซิร์ฟเวอร์ต้องถูกบีบ
 */
import { describe, expect, it } from 'vitest';
import {
  BOT_TICK_MS,
  DEFAULT_BOT_CONFIG,
  botAdminRows,
  botRoster,
  botStateAt,
  botTickAt,
  buildBotEntries,
  normalizeBotConfig,
} from '@/services/bots';
import { getUpgradeBonus } from '@/data/upgradeConfig';
import { getPlayerById } from '@/data/players';
import {
  botCardPool,
  botOpponentPool,
  botProfileById,
  botSquadSlots,
  isBotId,
} from '@/services/botSquad';
import { PLAYERS } from '@/data/players';
import { buildLeaderboard } from '@/services/leaderboard';
import type { BotConfig } from '@/types/bot';
import type { LeaderboardEntry, RankRecord } from '@/types/match';

/** หนึ่งวัน = 4 tick (tick ละ 6 ชั่วโมง) */
const DAY = 4;

const config = (patch: Partial<BotConfig> = {}): BotConfig =>
  normalizeBotConfig({ ...DEFAULT_BOT_CONFIG, ...patch });

const base = config();
const ROWS = base.tableRows;

const record = (points: number): RankRecord => ({
  points,
  wins: Math.max(points, 0),
  draws: 0,
  losses: 0,
});

const rival = (name: string, points: number): LeaderboardEntry => ({
  rank: 0,
  uid: name,
  managerName: name,
  teamName: `${name} FC`,
  teamOvr: 100,
  points,
  wins: points,
  draws: 0,
  losses: 0,
});

describe('ทีมจำลอง', () => {
  it('ให้ค่าเดิมเสมอเมื่อเวลาเท่ากัน (ทุกเครื่องเห็นตรงกัน)', () => {
    expect(buildBotEntries(50, ROWS, 900, base)).toEqual(buildBotEntries(50, ROWS, 900, base));
  });

  it('เวลาเดินแล้วค่าขยับ — ไม่ใช่ตารางแช่อยู่กับที่', () => {
    expect(buildBotEntries(50, ROWS, 900 + DAY * 5, base)).not.toEqual(
      buildBotEntries(50, ROWS, 900, base),
    );
  });

  it('ค่าพลังโตขึ้นตามเวลาแต่ไม่เกินเพดานของตัวเอง', () => {
    botRoster(base).forEach((bot) => {
      const young = botStateAt(bot, 0, base);
      const old = botStateAt(bot, DAY * 365 * 3, base);

      // −1/+1 เผื่อค่าแกว่งประจำช่วงเวลา (ดู wobble ใน botStateAt) ที่ตั้งใจให้มี
      expect(old.ovr).toBeGreaterThanOrEqual(young.ovr - 1);
      expect(old.ovr).toBeLessThanOrEqual(Math.ceil(bot.capOvr) + 1);
    });
  });

  it('สถิติสอดคล้องกับคะแนน (ชนะ − แพ้) และไม่มีค่าติดลบ', () => {
    buildBotEntries(80, ROWS, 1_200, base).forEach((entry) => {
      expect(entry.wins).toBeGreaterThanOrEqual(0);
      expect(entry.draws).toBeGreaterThanOrEqual(0);
      expect(entry.losses).toBeGreaterThanOrEqual(0);
      expect(entry.points).toBe(entry.wins - entry.losses);
    });
  });

  it('คะแนนไม่วิ่งหนีไปเรื่อย ๆ เพราะมีรอบลาดเดอร์รีเซ็ต', () => {
    const strongest = (tick: number) => buildBotEntries(10_000, ROWS, tick, base)[0].points;

    expect(strongest(DAY * 400)).toBeLessThan(strongest(DAY * 20) * 3);
  });

  it('นาฬิกาโลกบอทเดินตามเวลาจริง', () => {
    const now = Date.now();

    expect(botTickAt(now + BOT_TICK_MS) - botTickAt(now)).toBe(1);
  });
});

describe('ค่าที่แอดมินตั้ง', () => {
  it('ปิดระบบแล้วตารางเหลือแต่ผู้เล่นจริง', () => {
    const table = buildLeaderboard(
      record(5),
      'ทีมของฉัน',
      100,
      'ฉัน',
      [rival('friend', 3)],
      900,
      config({ enabled: false }),
    );

    expect(table).toHaveLength(2);
    expect(table.some((entry) => entry.isBot)).toBe(false);
  });

  it('ล็อกค่าพลังแล้วไม่โตตามเวลาอีก', () => {
    const locked = config({ overrides: { 'bot-001': { ovr: 111 } } });
    const bot = botRoster(locked)[0];

    expect(botStateAt(bot, 0, locked).ovr).toBe(111);
    expect(botStateAt(bot, DAY * 900, locked).ovr).toBe(111);
  });

  it('ตีบวกบวกค่าพลังตามตารางตีบวกชุดเดียวกับผู้เล่นจริง', () => {
    const plain = config({ overrides: { 'bot-001': { ovr: 100 } } });
    const upgraded = config({ overrides: { 'bot-001': { ovr: 100, plus: 5 } } });

    expect(botStateAt(botRoster(upgraded)[0], 0, upgraded).ovr).toBe(
      botStateAt(botRoster(plain)[0], 0, plain).ovr + getUpgradeBonus(5),
    );
  });

  it('ล็อกคะแนนแล้วได้เท่านั้นจริง และไม่ถูกเพดานย่อลง', () => {
    const locked = config({ overrides: { 'bot-002': { points: 77 } } });
    const entry = buildBotEntries(5, locked.tableRows, 900, locked).find(
      (row) => row.points === 77,
    );

    expect(entry).toBeDefined();
    expect(entry?.wins).toBe((entry?.losses ?? 0) + 77);
  });

  it('ทีมที่สั่งซ่อนหายจากตารางจริง แต่ยังเห็นในหน้าแอดมิน', () => {
    const hidden = config({ overrides: { 'bot-001': { hidden: true } } });
    const name = botRoster(hidden)[0].teamName;

    expect(buildBotEntries(50, 200, 900, hidden).some((row) => row.teamName === name)).toBe(false);
    expect(botAdminRows(900, hidden).some((row) => row.seed.teamName === name)).toBe(true);
  });

  it('เปลี่ยนชื่อทีมแล้วไม่ทำให้กลายเป็นทีมใหม่ (ค่าพลังคงเดิม)', () => {
    const renamed = config({ overrides: { 'bot-003': { teamName: 'ทีมของเพื่อน' } } });

    expect(botStateAt(botRoster(renamed)[2], 900, renamed).ovr).toBe(
      botStateAt(botRoster(base)[2], 900, base).ovr,
    );
  });

  it('ค่าเพี้ยนจากเซิร์ฟเวอร์ถูกบีบให้อยู่ในช่วงที่ปลอดภัย', () => {
    const dirty = normalizeBotConfig({
      rosterSize: 99_999,
      topShare: 12,
      baseOvrMax: 1,
      cycleDays: 0,
      overrides: { 'bot-001': { plus: 99, ovr: Number.NaN } } as never,
    } as never);

    expect(dirty.rosterSize).toBeLessThanOrEqual(120);
    expect(dirty.topShare).toBeLessThanOrEqual(1);
    // ค่าสูงสุดต้องไม่ต่ำกว่าค่าต่ำสุด ไม่งั้นช่วงสุ่มกลับด้าน
    expect(dirty.baseOvrMax).toBeGreaterThanOrEqual(dirty.baseOvrMin);
    expect(dirty.cycleDays).toBeGreaterThanOrEqual(3);
    expect(dirty.overrides['bot-001'].plus).toBe(8);
    expect(dirty.overrides['bot-001'].ovr).toBeUndefined();
  });
});

describe('ตารางอันดับที่มีทีมจำลองปน', () => {
  it('ผู้เล่นจริงที่คะแนนสูงสุดยังได้อันดับ 1 เสมอ', () => {
    const table = buildLeaderboard(
      record(60),
      'ทีมของฉัน',
      110,
      'ฉัน',
      [rival('friend', 40)],
      900,
      base,
    );

    expect(table[0].isCurrentUser).toBe(true);
  });

  it('คนจริงเยอะขึ้น ทีมจำลองถอยออกไปเอง', () => {
    const many = Array.from({ length: 25 }, (_unused, index) => rival(`p${index}`, index));
    const table = buildLeaderboard(record(5), 'ทีมของฉัน', 100, 'ฉัน', many, 900, base);

    expect(table.filter((entry) => entry.isBot)).toHaveLength(
      Math.max(base.minBots, ROWS - many.length - 1),
    );
  });

  it('คนจริงล้นตารางแล้ว ทีมจำลองก็ยังเหลือขั้นต่ำตามที่ตั้งไว้', () => {
    // เคสที่เคยพัง: บัญชีจริง 40 คน ทำให้โควตาบอทติดลบ ตารางเลยไม่มีบอทเลยสักตัว
    const crowd = Array.from({ length: 40 }, (_unused, index) => rival(`p${index}`, index));
    const table = buildLeaderboard(record(5), 'ทีมของฉัน', 100, 'ฉัน', crowd, 900, base);

    expect(table.filter((entry) => entry.isBot)).toHaveLength(base.minBots);
  });

  it('เซิร์ฟเวอร์เพิ่งเปิด (ยังไม่มีใครมีคะแนน) ตารางก็ยังไม่ร้าง', () => {
    expect(buildLeaderboard(record(0), 'ทีมของฉัน', 80, 'ฉัน', [], 900, base)).toHaveLength(ROWS);
  });
});

describe('ตัวจริง 11 คนของทีมจำลอง', () => {
  it('ทีมเดิมได้ผู้เล่นชุดเดิมทุกครั้ง (ไม่สุ่มใหม่ตอนเปิดดู)', () => {
    const bot = botRoster(base)[0];
    const state = botStateAt(bot, 900, base);

    expect(botSquadSlots(bot, state, base)).toEqual(botSquadSlots(bot, state, base));
  });

  it('จัดครบ 11 ช่องและไม่มีใครลงสองตำแหน่ง', () => {
    botRoster(base).forEach((bot) => {
      const squad = botSquadSlots(bot, botStateAt(bot, 900, base), base);

      expect(squad).toHaveLength(11);
      expect(new Set(squad.map((slot) => slot.playerId)).size).toBe(11);
    });
  });

  it('ค่าพลังเฉลี่ยของ 11 คนใกล้เคียงกับ OVR ที่โชว์ในตาราง', () => {
    botRoster(base).forEach((bot) => {
      const state = botStateAt(bot, 900, base);
      const squad = botSquadSlots(bot, state, base);
      const average =
        squad.reduce((sum, slot) => sum + (getPlayerById(slot.playerId)?.ovr ?? 0), 0) /
        squad.length;

      // ยอมให้ห่างได้พอสมควร เพราะคลังนักเตะไม่ได้มีทุกตำแหน่งที่ทุกค่าพลัง
      expect(Math.abs(average - state.ovr)).toBeLessThan(15);
    });
  });

  it('การ์ดทั้งชุดตีบวกตามที่แอดมินตั้งให้ทีมนั้น', () => {
    const upgraded = config({ overrides: { 'bot-001': { plus: 5 } } });
    const bot = botRoster(upgraded)[0];

    botSquadSlots(bot, botStateAt(bot, 900, upgraded), upgraded).forEach((slot) => {
      expect(slot.level).toBe(6); // level 1 = +0
    });
  });

  it('เปิดดูโปรไฟล์ทีมจำลองได้โดยไม่ต้องยิงเซิร์ฟเวอร์', () => {
    expect(isBotId('bot-001')).toBe(true);
    expect(isBotId('kJ2xQ...')).toBe(false);
    expect(botProfileById('bot-001', 900, base)?.squad).toHaveLength(11);
    expect(botProfileById('bot-999', 900, base)).toBeNull();
  });
});

describe('ทีมจำลองในระบบจับคู่', () => {
  it('ปิดสวิตช์จับคู่แล้วไม่มีบอทให้เจอ แต่ยังอยู่ในตารางอันดับ', () => {
    const offline = config({ matchmaking: false });

    expect(botOpponentPool(offline, 900, 100)).toHaveLength(0);
    expect(buildBotEntries(50, ROWS, 900, offline).length).toBeGreaterThan(0);
  });

  it('ทีมที่ซ่อนไว้ไม่ถูกจับมาเป็นคู่แข่ง', () => {
    const hidden = config({ overrides: { 'bot-001': { hidden: true } } });

    expect(botOpponentPool(hidden, 900, 100).some((entry) => entry.id === 'bot-001')).toBe(false);
  });

  it('id ของคู่แข่งคงที่ คูลดาวน์กันปั้มดาวจึงทำงานเหมือนคนจริง', () => {
    const first = botOpponentPool(base, 900, 100).map((entry) => entry.id);
    const later = botOpponentPool(base, 900 + DAY * 30, 100).map((entry) => entry.id);

    expect(later).toEqual(first);
  });
});

describe('ชนะทีมจำลองแล้วเขาเสียแต้ม', () => {
  const pointsOf = (deltas: Record<string, number>) =>
    buildBotEntries(500, 200, 900, base, deltas).find((entry) => entry.uid === 'bot-001')?.points ??
    0;

  it('ชนะแล้วคะแนนของเขาลดลงจริง และสถิติแพ้เพิ่มตาม', () => {
    const before = buildBotEntries(500, 200, 900, base).find((entry) => entry.uid === 'bot-001');
    const after = buildBotEntries(500, 200, 900, base, { 'bot-001': -3 }).find(
      (entry) => entry.uid === 'bot-001',
    );

    expect(after?.points).toBe((before?.points ?? 0) - 3);
    expect(after?.losses).toBe((before?.losses ?? 0) + 3);
  });

  it('ทีมที่แอดมินล็อกคะแนนไว้ไม่ขยับ ต่อให้เอาชนะได้', () => {
    const locked = config({ overrides: { 'bot-001': { points: 40 } } });
    const entry = buildBotEntries(500, 200, 900, locked, { 'bot-001': -9 }).find(
      (row) => row.uid === 'bot-001',
    );

    expect(entry?.points).toBe(40);
  });

  it('ไม่มีส่วนต่าง = ตารางเหมือนเดิมเป๊ะ', () => {
    expect(pointsOf({})).toBe(pointsOf({ 'bot-002': -5 }));
  });
});

describe('แอดมินคุมการ์ดในทีมจำลอง', () => {
  it('สุ่มตีบวกแล้วในทีมเดียวกันไม่เท่ากัน และอยู่ในช่วงที่ตั้งไว้', () => {
    const rolled = config({ plusRandom: true, plusMin: 1, plusMax: 8 });
    const levels = botRoster(rolled).flatMap((bot) =>
      botSquadSlots(bot, botStateAt(bot, 900, rolled), rolled).map((slot) => slot.level - 1),
    );

    expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(8);
    // อย่างน้อยหนึ่งทีมต้องมีค่าตีบวกไม่เท่ากันภายในทีม
    expect(
      botRoster(rolled).some((bot) => {
        const set = new Set(
          botSquadSlots(bot, botStateAt(bot, 900, rolled), rolled).map((slot) => slot.level),
        );
        return set.size > 1;
      }),
    ).toBe(true);
  });

  it('ปิดสุ่มตีบวกแล้วทั้งทีมเป็น +0 เหมือนเดิม', () => {
    const bot = botRoster(base)[0];

    botSquadSlots(bot, botStateAt(bot, 900, base), base).forEach((slot) => {
      expect(slot.level).toBe(1);
    });
  });

  it('การ์ดต้องห้ามไม่โผล่ในทีมไหนเลย', () => {
    const banned = PLAYERS.slice(0, 30).map((player) => player.id);
    const strict = config({ bannedPlayerIds: banned });

    botRoster(strict).forEach((bot) => {
      botSquadSlots(bot, botStateAt(bot, 900, strict), strict).forEach((slot) => {
        expect(banned).not.toContain(slot.playerId);
      });
    });
  });

  it('ช่วงค่าพลังการ์ดที่ตั้งไว้ถูกเคารพ', () => {
    const narrow = config({ cardOvrMin: 110, cardOvrMax: 124 });
    const bot = botRoster(narrow)[0];

    botSquadSlots(bot, botStateAt(bot, 900, narrow), narrow).forEach((slot) => {
      const ovr = PLAYERS.find((player) => player.id === slot.playerId)?.ovr ?? 0;
      expect(ovr).toBeGreaterThanOrEqual(110);
      expect(ovr).toBeLessThanOrEqual(124);
    });
  });

  it('กรองจนเหลือไม่ถึง 11 ใบ = ถอยไปใช้ทั้งคลัง ไม่ปล่อยทีมมีช่องว่าง', () => {
    const impossible = config({ cardOvrMin: 179, cardOvrMax: 180 });
    const bot = botRoster(impossible)[0];

    expect(botCardPool(impossible)).toHaveLength(PLAYERS.length);
    expect(botSquadSlots(bot, botStateAt(bot, 900, impossible), impossible)).toHaveLength(11);
  });

  it('กำหนดค่าพลังการ์ดรายทีมแล้วทีมนั้นใช้ค่านั้นแทนค่าพลังทีม', () => {
    const low = config({ overrides: { 'bot-001': { cardOvr: 80 } } });
    const bot = botRoster(low)[0];
    const squad = botSquadSlots(bot, botStateAt(bot, 900, low), low);
    const average =
      squad.reduce((sum, slot) => sum + (getPlayerById(slot.playerId)?.ovr ?? 0), 0) / squad.length;

    expect(Math.abs(average - 80)).toBeLessThan(15);
  });
});
