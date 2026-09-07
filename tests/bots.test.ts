/**
 * ทีมจำลองประจำเซิร์ฟเวอร์ — สามเรื่องที่พลาดแล้วพัง
 *
 *   1. ต้อง deterministic จริง: ทุกเครื่องที่เวลาเดียวกันต้องเห็นตารางเดียวกัน
 *      (ถ้าหลุด Math.random เข้าไปเมื่อไหร่ เทสนี้จะจับได้)
 *   2. ต้องโตตามเวลาแล้วตันที่เพดาน ไม่ใช่โตไม่มีที่สิ้นสุดจนไม่มีใครตามทัน
 *   3. บอทห้ามแซงอันดับ 1 ของผู้เล่นจริง เพราะรางวัลปลายซีซันจ่ายตามอันดับ
 */
import { describe, expect, it } from 'vitest';
import {
  BOT_ROSTER,
  BOT_TABLE_ROWS,
  BOT_TICK_MS,
  botStateAt,
  botTickAt,
  buildBotEntries,
} from '@/services/bots';
import { buildLeaderboard } from '@/services/leaderboard';
import type { LeaderboardEntry, RankRecord } from '@/types/match';

/** หนึ่งวัน = 4 tick (tick ละ 6 ชั่วโมง) */
const DAY = 4;

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
    const first = buildBotEntries(50, BOT_TABLE_ROWS, 900);
    const second = buildBotEntries(50, BOT_TABLE_ROWS, 900);

    expect(second).toEqual(first);
  });

  it('เวลาเดินแล้วค่าขยับ — ไม่ใช่ตารางแช่อยู่กับที่', () => {
    const now = buildBotEntries(50, BOT_TABLE_ROWS, 900);
    const later = buildBotEntries(50, BOT_TABLE_ROWS, 900 + DAY * 5);

    expect(later).not.toEqual(now);
  });

  it('ค่าพลังโตขึ้นตามเวลาแต่ไม่เกินเพดานของตัวเอง', () => {
    BOT_ROSTER.forEach((bot) => {
      const young = botStateAt(bot, 0);
      const old = botStateAt(bot, DAY * 365 * 3);

      // −1/+1 เผื่อค่าแกว่งประจำช่วงเวลา (ดู wobble ใน botStateAt) ที่ตั้งใจให้มี
      expect(old.ovr).toBeGreaterThanOrEqual(young.ovr - 1);
      expect(old.ovr).toBeLessThanOrEqual(Math.ceil(bot.capOvr) + 1);
    });
  });

  it('สถิติสอดคล้องกับคะแนน (ชนะ − แพ้) และไม่มีค่าติดลบ', () => {
    buildBotEntries(80, BOT_TABLE_ROWS, 1_200).forEach((entry) => {
      expect(entry.wins).toBeGreaterThanOrEqual(0);
      expect(entry.draws).toBeGreaterThanOrEqual(0);
      expect(entry.losses).toBeGreaterThanOrEqual(0);
      expect(entry.points).toBe(entry.wins - entry.losses);
    });
  });

  it('คะแนนไม่วิ่งหนีไปเรื่อย ๆ เพราะมีรอบลาดเดอร์รีเซ็ต', () => {
    const strongest = (tick: number) =>
      buildBotEntries(10_000, BOT_TABLE_ROWS, tick)[0].points;

    // เทียบวันเดียวกันของรอบถัดไป ต้องอยู่ระดับเดิม ไม่ใช่ทบไปเรื่อย ๆ
    expect(strongest(DAY * 400)).toBeLessThan(strongest(DAY * 20) * 3);
  });
});

describe('ตารางอันดับที่มีทีมจำลองปน', () => {
  it('ผู้เล่นจริงที่คะแนนสูงสุดยังได้อันดับ 1 เสมอ', () => {
    const table = buildLeaderboard(record(60), 'ทีมของฉัน', 110, 'ฉัน', [rival('friend', 40)], 900);

    expect(table[0].isCurrentUser).toBe(true);
    expect(table[0].isBot).toBeUndefined();
  });

  it('คนจริงเยอะขึ้น ทีมจำลองถอยออกไปเอง', () => {
    const many = Array.from({ length: 25 }, (_unused, index) => rival(`p${index}`, index));
    const table = buildLeaderboard(record(5), 'ทีมของฉัน', 100, 'ฉัน', many, 900);
    const bots = table.filter((entry) => entry.isBot);

    expect(bots.length).toBe(BOT_TABLE_ROWS - many.length - 1);
  });

  it('เซิร์ฟเวอร์เพิ่งเปิด (ยังไม่มีใครมีคะแนน) ตารางก็ยังไม่ร้าง', () => {
    const table = buildLeaderboard(record(0), 'ทีมของฉัน', 80, 'ฉัน', [], 900);

    expect(table.length).toBe(BOT_TABLE_ROWS);
  });

  it('นาฬิกาโลกบอทเดินตามเวลาจริง', () => {
    const now = Date.now();

    expect(botTickAt(now + BOT_TICK_MS) - botTickAt(now)).toBe(1);
  });
});
