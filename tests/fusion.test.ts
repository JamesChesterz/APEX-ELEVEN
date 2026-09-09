/**
 * เทสกติกาการผสมการ์ด — ยึดข้อกำหนดของเกมเป็นหลัก
 * ข้อไหนเป็นตัวเลขที่ตกลงกันไว้ (เช่น +8 ครบสามใบ = 20%) ต้องมีเทสล็อกไว้เสมอ
 */
import { describe, expect, it } from 'vitest';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { levelForUpgrade } from '@/services/cardInstance';
import {
  canWinCash,
  FUSION_CASH_MAX,
  FUSION_CASH_MIN,
  FUSION_CASH_MIN_PLUS,
  FUSION_CANDIDATES,
  FUSION_MATERIALS,
  FUSION_ODDS,
  getFusionOdds,
  getFusionPool,
  getMaterialPlus,
  getMaterialRarity,
  rollFusionCandidates,
  rollFusionCash,
  rollFusionPlus,
} from '@/services/fusion';
import { PLAYERS } from '@/data/players';
import type { CardInstance } from '@/types/card';

const card = (playerId: string, plus = 0): CardInstance => ({
  id: `card_${playerId}_${plus}`,
  playerId,
  acquiredAt: '2026-01-01T00:00:00.000Z',
  level: levelForUpgrade(plus),
  inSquad: false,
});

/** นักเตะสองคนที่ระดับต่างกัน ใช้เทสกติกา "ต้องระดับเดียวกัน" */
const byRarity = (index: number) => PLAYERS.filter((player) => player.rarity === PLAYERS[index].rarity);

describe('ตารางโอกาส', () => {
  it('ทุกแถวรวมกันได้ 100 พอดี', () => {
    Object.values(FUSION_ODDS).forEach((row) => {
      const total = row.reduce((sum, chance) => sum + chance, 0);
      expect(Number(total.toFixed(4))).toBe(100);
    });
  });

  it('ทุกแถวมีผลลัพธ์ครบ +1 ถึง +8', () => {
    Object.values(FUSION_ODDS).forEach((row) => expect(row).toHaveLength(MAX_UPGRADE));
    expect(getFusionOdds(0).map((entry) => entry.plus)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('ใช้ +8 ครบทั้ง 3 ใบ โอกาสออก +8 เท่ากับ 20%', () => {
    const odds = getFusionOdds(MAX_UPGRADE);
    expect(odds.find((entry) => entry.plus === MAX_UPGRADE)?.chance).toBe(20);
  });

  it('วัสดุยิ่งบวกสูง โอกาสออก +8 ยิ่งไม่ลดลง', () => {
    const chances = Array.from({ length: MAX_UPGRADE + 1 }, (_, plus) =>
      getFusionOdds(plus).find((entry) => entry.plus === MAX_UPGRADE)!.chance,
    );
    chances.slice(1).forEach((chance, index) => expect(chance).toBeGreaterThan(chances[index]));
  });
});

describe('ค่าบวกของชุดวัสดุ', () => {
  it('ใช้ใบที่บวกน้อยที่สุด ไม่ใช่ค่าเฉลี่ย', () => {
    const cards = [card('p001', 8), card('p002', 8), card('p003', 2)];
    expect(getMaterialPlus(cards)).toBe(2);
  });

  it('ชุดว่างคืน 0', () => {
    expect(getMaterialPlus([])).toBe(0);
  });
});

describe('กติกาเรื่องระดับการ์ด', () => {
  it('ระดับเดียวกันทั้งชุด → คืนระดับนั้น', () => {
    const same = byRarity(0).slice(0, FUSION_MATERIALS);
    expect(same.length).toBe(FUSION_MATERIALS);
    expect(getMaterialRarity(same.map((player) => card(player.id)))).toBe(same[0].rarity);
  });

  it('ระดับปนกัน → คืน null (ผสมไม่ได้)', () => {
    const first = PLAYERS[0];
    const other = PLAYERS.find((player) => player.rarity !== first.rarity);
    expect(other).toBeDefined();
    expect(getMaterialRarity([card(first.id), card(first.id), card(other!.id)])).toBeNull();
  });
});

describe('เงินโบนัส', () => {
  it('ต่ำกว่า +7 ไม่มีสิทธิ์ลุ้นเลย', () => {
    expect(canWinCash(FUSION_CASH_MIN_PLUS - 1)).toBe(false);
    expect(rollFusionCash(FUSION_CASH_MIN_PLUS - 1, () => 0)).toBe(0);
  });

  it('+7 ขึ้นไปและดวงถึง ได้เงินในช่วง 1–2 ล้าน', () => {
    const amount = rollFusionCash(FUSION_CASH_MIN_PLUS, () => 0);
    expect(amount).toBeGreaterThanOrEqual(FUSION_CASH_MIN);
    expect(amount).toBeLessThanOrEqual(FUSION_CASH_MAX);
  });

  it('ดวงไม่ถึงก็ยังได้ 0 แม้วัสดุจะครบเงื่อนไข', () => {
    expect(rollFusionCash(MAX_UPGRADE, () => 0.99)).toBe(0);
  });
});

describe('การสุ่มผลลัพธ์', () => {
  it('ค่าบวกที่ออกอยู่ในช่วง +1 ถึง +8 เสมอ', () => {
    for (let index = 0; index < 200; index += 1) {
      const plus = rollFusionPlus(index % (MAX_UPGRADE + 1));
      expect(plus).toBeGreaterThanOrEqual(1);
      expect(plus).toBeLessThanOrEqual(MAX_UPGRADE);
    }
  });

  it('การ์ดคว่ำครบจำนวน และทุกใบเป็นนักเตะระดับเดิม', () => {
    const rarity = PLAYERS[0].rarity;
    const candidates = rollFusionCandidates(rarity, MAX_UPGRADE);
    const pool = new Set(getFusionPool(rarity).map((player) => player.id));

    expect(candidates).toHaveLength(FUSION_CANDIDATES);
    candidates.forEach((candidate) => expect(pool.has(candidate.playerId)).toBe(true));
  });
});
