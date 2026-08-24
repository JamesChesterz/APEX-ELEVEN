/**
 * ระบบเปิดซองการ์ด: หักเหรียญ → สุ่มการ์ด → เพิ่มเข้าคลัง
 * แยกสถานะ isOpening ไว้ให้ UI เล่นแอนิเมชันก่อนเผยผล
 */
import { useCallback, useState } from 'react';
import { CARD_PACKS } from '@/data/cards';
import { usePlayers } from '@/hooks/usePlayers';
import { getPackById, openPack } from '@/services/cardPack';
import { playSfx } from '@/services/sound';
import type { PackOpenResult } from '@/types/card';

/** เวลาที่หมุนซองก่อนเผยการ์ด (มิลลิวินาที) */
const REVEAL_DELAY = 900;

export const useCardPack = () => {
  const { coins, spendCoins, addCards, reportPackOpened } = usePlayers();
  const [openingPackId, setOpeningPackId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PackOpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    (packId: string) => {
      const pack = getPackById(packId);
      if (!pack || openingPackId) return;

      if (!spendCoins(pack.price)) {
        setError('เหรียญไม่พอสำหรับซองนี้');
        playSfx('error');
        return;
      }

      // เสียงจ่ายเหรียญ แล้วให้ PackRevealOverlay รับช่วงเสียงฉากเปิดซองต่อ
      playSfx('packBuy');

      setError(null);
      setLastResult(null);
      setOpeningPackId(packId);

      window.setTimeout(() => {
        const result = openPack(pack);
        addCards(result.cards);
        // นับเข้าภารกิจ "เปิดซองการ์ด" ของวันนี้
        reportPackOpened(1);
        setLastResult(result);
        setOpeningPackId(null);
      }, REVEAL_DELAY);
    },
    [addCards, openingPackId, reportPackOpened, spendCoins],
  );

  return {
    packs: CARD_PACKS,
    coins,
    openingPackId,
    isOpening: openingPackId !== null,
    lastResult,
    error,
    open,
    dismissResult: () => setLastResult(null),
  };
};
