/**
 * แลกการ์ดเป็นเงิน — ต่อค่าตั้งของแอดมิน เพดานรายวัน และการหักการ์ดออกจากคลัง
 *
 * ไม่ทำเป็น Provider เพราะมีที่ใช้ที่เดียว (หน้า Exchange Card)
 */
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import {
  getRemainingToday,
  normalizeCardCashState,
  quoteExchange,
  type ExchangeQuote,
} from '@/services/cardCash';
import { dateKey } from '@/services/loginBonus';
import { playSfx } from '@/services/sound';
import type { Player } from '@/types/player';
import { formatNumber } from '@/utils/helpers';

export const useCardCash = () => {
  const { account, patchState } = useAuth();
  const { cardCash: config } = useGameConfig();
  const { ownedCards, addCoins, removeCards } = usePlayers();

  /** ยอดของวันนี้ — ข้ามวันแล้วเริ่มนับใหม่เอง */
  const state = useMemo(
    () => normalizeCardCashState(account?.state.cardCash),
    [account?.state.cardCash],
  );

  const remainingToday = getRemainingToday(state, config);

  /** คิดยอดของรายการที่เลือก (ยังไม่ทำอะไรกับคลัง) */
  const quote = useCallback(
    (entries: Array<{ player: Player; level?: number }>): ExchangeQuote =>
      quoteExchange(entries, config, remainingToday),
    [config, remainingToday],
  );

  /**
   * แลกจริง — เอาการ์ดออกจากคลัง เติมเงิน แล้วบันทึกยอดของวันนี้
   *
   * ⚠️ คิดยอดใหม่ในนี้อีกรอบจาก id ที่ส่งมา ไม่เชื่อยอดที่หน้าจอส่งมาให้
   * เพราะเวลาผ่านไประหว่างที่ผู้เล่นเปิดจอยืนยันค้างไว้ เพดานที่เหลืออาจเปลี่ยนไปแล้ว
   */
  const exchange = useCallback(
    (cardIds: string[]): { ok: boolean; gained: number; message: string } => {
      const picked = ownedCards.filter((entry) => cardIds.includes(entry.card.id));

      if (picked.length === 0) {
        playSfx('error');
        return { ok: false, gained: 0, message: 'ยังไม่ได้เลือกการ์ด' };
      }

      if (remainingToday <= 0) {
        playSfx('error');
        return {
          ok: false,
          gained: 0,
          message: 'วันนี้แลกครบเพดานแล้ว — พรุ่งนี้เริ่มนับใหม่',
        };
      }

      const result = quoteExchange(
        picked.map(({ card, player }) => ({ player, level: card.level })),
        config,
        remainingToday,
      );

      removeCards(picked.map(({ card }) => card.id));
      addCoins(result.total);
      patchState({
        cardCash: { date: dateKey(), earned: state.earned + result.total },
      });
      playSfx('levelUp');

      return {
        ok: true,
        gained: result.total,
        message:
          result.capped > 0
            ? `แลก ${result.count} ใบ ได้ ${formatNumber(result.total)} เงิน (ส่วนเกินเพดาน ${formatNumber(result.capped)} ไม่ได้รับ)`
            : `แลก ${result.count} ใบ ได้ ${formatNumber(result.total)} เงิน`,
      };
    },
    [addCoins, config, ownedCards, patchState, remainingToday, removeCards, state.earned],
  );

  return { config, state, earnedToday: state.earned, remainingToday, quote, exchange };
};
