/**
 * ระบบเปิดซองการ์ด: หักเหรียญ → สุ่มการ์ด → เพิ่มเข้าคลัง
 * แยกสถานะ isOpening ไว้ให้ UI เล่นแอนิเมชันก่อนเผยผล
 *
 * ซื้อได้ทั้งทีละซองและทีละชุดใหญ่ (BULK_PACK_COUNT ซอง) — ชุดใหญ่คิดราคาตรงตามจำนวน
 * ไม่มีส่วนลดและไม่มีการรับประกันของดี โอกาสเท่ากับเปิดทีละซองทุกประการ
 */
import { useCallback, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { useAnnounce } from '@/hooks/useAnnounce';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { openPack } from '@/services/cardPack';
import { buildMythicalAnnouncement } from '@/services/announcements';
import { isPackExpired } from '@/services/packConfig';
import { playSfx } from '@/services/sound';
import type { PackOpenResult } from '@/types/card';

/** เวลาที่หมุนซองก่อนเผยการ์ด (มิลลิวินาที) */
const REVEAL_DELAY = 900;

export const useCardPack = () => {
  const { coins, spendCoins, addCards, reportPackOpened } = usePlayers();
  /** ซองในร้านมาจากค่าตั้งกลาง (แอดมินสร้างเองได้) ไม่ใช่ค่าคงที่ในโค้ดอีกแล้ว */
  const { packs } = useGameConfig();
  /** ได้ของหายากแล้วประกาศให้ทั้งห้องแชทรู้ */
  const announce = useAnnounce();
  const [openingPackId, setOpeningPackId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PackOpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    (packId: string, packCount = 1) => {
      const pack = packs.find((entry) => entry.id === packId);
      if (!pack || openingPackId) return;

      const quantity = Math.max(1, Math.round(packCount));

      /*
       * กันกรณีเปิดหน้าค้างไว้ข้ามเวลาปิดการขาย
       * (ร้านกรองซองที่หมดเวลาออกทุก 30 วินาที ระหว่างนั้นปุ่มยังกดได้อยู่)
       * ต้องเช็กก่อนหักเหรียญเสมอ
       */
      if (isPackExpired(pack)) {
        setError('ซองนี้หมดเวลาขายแล้ว');
        playSfx('error');
        return;
      }

      if (!spendCoins(pack.price * quantity)) {
        setError(quantity > 1 ? 'เหรียญไม่พอสำหรับชุดนี้' : 'เหรียญไม่พอสำหรับซองนี้');
        playSfx('error');
        return;
      }

      // เสียงจ่ายเหรียญ แล้วให้ PackRevealOverlay รับช่วงเสียงฉากเปิดซองต่อ
      playSfx('packBuy');

      setError(null);
      setLastResult(null);
      setOpeningPackId(packId);

      window.setTimeout(() => {
        const result = openPack(pack, quantity);
        addCards(result.cards);

        /*
         * ได้ mythical = ประกาศเข้าห้องแชท
         * เปิดยกชุดแล้วได้หลายใบก็ประกาศใบเดียว (ใบแรกที่เจอ) ไม่รัวทีละใบ
         */
        const mythical = result.cards
          .map((card) => getPlayerById(card.playerId))
          .find((player) => player?.rarity === 'mythical');

        if (mythical) void announce('mythical', buildMythicalAnnouncement(mythical.name));

        // นับเข้าภารกิจ "เปิดซองการ์ด" ของวันนี้ — ซื้อ 10 ซองก็นับ 10
        reportPackOpened(quantity);
        setLastResult(result);
        setOpeningPackId(null);
      }, REVEAL_DELAY);
    },
    [addCards, announce, openingPackId, packs, reportPackOpened, spendCoins],
  );

  return {
    packs,
    coins,
    openingPackId,
    isOpening: openingPackId !== null,
    lastResult,
    error,
    open,
    dismissResult: () => setLastResult(null),
  };
};
