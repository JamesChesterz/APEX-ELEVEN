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
