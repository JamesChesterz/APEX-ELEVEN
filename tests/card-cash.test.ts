import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@/data/players';
import {
  DEFAULT_CARD_CASH,
  getBulkBonusRate,
  getCardCashValue,
  getRemainingToday,
  normalizeCardCash,
  normalizeCardCashState,
  quoteExchange,
} from '@/services/cardCash';
import type { Player } from '@/types/player';

const make = (rarity: Player['rarity'], ovr: number): Player => ({
  ...PLAYERS[0],
  rarity,
  ovr,
});

describe('ราคาแลกการ์ดเป็นเงิน', () => {
  it('ระดับสูงกว่าแพงกว่าเสมอที่ OVR เท่ากัน', () => {
    const order = (['common', 'rare', 'epic', 'legendary', 'mythical'] as const).map((rarity) =>
      getCardCashValue(make(rarity, 90)),
    );

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('OVR สูงขึ้นราคาสูงขึ้น และค่าบวกสูงขึ้นราคาสูงขึ้น', () => {
    expect(getCardCashValue(make('epic', 120))).toBeGreaterThan(getCardCashValue(make('epic', 80)));
    expect(getCardCashValue(make('epic', 100), 9)).toBeGreaterThan(
      getCardCashValue(make('epic', 100), 1),
    );
  });

  it('mythical +8 OVR สูง แพงกว่า common +0 หลายร้อยเท่า', () => {
    const top = getCardCashValue(make('mythical', 150), 9);
    const bottom = getCardCashValue(make('common', 70), 1);

    expect(top / bottom).toBeGreaterThan(200);
  });

  it('ตัวคูณ rate ของแอดมินมีผลกับราคาโดยตรง', () => {
    const base = getCardCashValue(make('epic', 100), 1, DEFAULT_CARD_CASH);
    const doubled = getCardCashValue(make('epic', 100), 1, { ...DEFAULT_CARD_CASH, rate: 2 });

    // ราคาถูกปัดเป็นหลักร้อยเพื่อให้อ่านง่าย จึงเทียบเป็นสัดส่วน ไม่ใช่เท่ากันเป๊ะ
    expect(doubled / base).toBeCloseTo(2, 1);
  });
});

describe('โบนัสและเพดานรายวัน', () => {
  it('ยิ่งแลกหลายใบยิ่งได้โบนัสมาก', () => {
    expect(getBulkBonusRate(1)).toBe(0);
    expect(getBulkBonusRate(2)).toBe(0.05);
    expect(getBulkBonusRate(10)).toBe(0.1);
    expect(getBulkBonusRate(25)).toBe(0.15);
  });

  it('ยอดที่เกินเพดานถูกตัดออก และรายงานส่วนเกิน', () => {
    const entries = [{ player: make('mythical', 150), level: 9 }];
    const quote = quoteExchange(entries, DEFAULT_CARD_CASH, 5_000);

    expect(quote.total).toBe(5_000);
    expect(quote.capped).toBeGreaterThan(0);
  });

  it('เพดานเริ่มต้นคือ 1 ล้านต่อวัน และปรับได้', () => {
    expect(DEFAULT_CARD_CASH.dailyLimit).toBe(1_000_000);
    expect(normalizeCardCash({ dailyLimit: 250_000 }).dailyLimit).toBe(250_000);
  });

  it('ข้ามวันแล้วยอดที่แลกไปรีเซ็ตเอง', () => {
    const state = normalizeCardCashState(
      { date: '2020-01-01', earned: 900_000 },
      new Date('2026-09-03T10:00:00'),
    );

    expect(state.earned).toBe(0);
    expect(getRemainingToday(state, DEFAULT_CARD_CASH)).toBe(1_000_000);
  });
});
