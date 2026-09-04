/** หน้า Card Pack: ซื้อและเปิดซอง แล้วเผยการ์ดด้วยเอฟเฟกต์ walkout เต็มจอ */
import { useEffect, useMemo, useState } from 'react';
import { PackCard } from '@/components/pack/PackCard';
import { PackRevealOverlay, type RevealEntry } from '@/components/pack/PackRevealOverlay';
import { getPlayerById } from '@/data/players';
import { useCardPack } from '@/hooks/useCardPack';
import { getPackById } from '@/services/cardPack';
import { activePacks } from '@/services/packConfig';
import { formatNumber } from '@/utils/helpers';

export const CardPackPage = () => {
  const { packs, coins, openingPackId, isOpening, lastResult, error, open, dismissResult } =
    useCardPack();

  /*
   * เดินนาฬิกาทุก 30 วินาทีเพื่อให้ซองที่หมดเวลาหายจากร้านเองโดยไม่ต้องรีเฟรช
   * ไม่ต้องละเอียดกว่านี้ — ป้ายนับถอยหลังบนการ์ดนับวินาทีของตัวเองอยู่แล้ว
   * และ useCardPack กันการซื้อซองที่หมดเวลาไว้อีกชั้น
   */
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /** เฉพาะซองที่ยังไม่หมดเวลาขาย */
  const onSale = useMemo(() => activePacks(packs, nowMs), [nowMs, packs]);

  // useMemo: อาร์เรย์ต้องคงตัวระหว่างที่ฉากเผยการ์ดเปิดอยู่ ไม่งั้นไทม์ไลน์จะถูกรีเซ็ต
  const revealed: RevealEntry[] = useMemo(
    () =>
      (lastResult?.cards ?? []).flatMap((card) => {
        const player = getPlayerById(card.playerId);
        return player ? [{ card, player }] : [];
      }),
    [lastResult],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl">ร้านซองการ์ด</h2>
          <p className="text-sm text-chalk/50">การ์ดที่ได้จะเข้าคลังทันทีและใช้จัดทีมได้เลย</p>
        </div>
        <p className="font-mono text-sm text-gold">{formatNumber(coins)} เหรียญ</p>
      </div>

      {error && (
        <p className="rounded-lg border border-gem/40 bg-gem/10 px-4 py-2 text-sm text-gem">{error}</p>
      )}

      {onSale.length === 0 && (
        <p className="glass-panel px-4 py-8 text-center text-sm text-chalk/50">
          ตอนนี้ยังไม่มีซองเปิดขาย — รอรอบถัดไปได้เลย
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {onSale.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            coins={coins}
            opening={openingPackId === pack.id}
            disabled={isOpening}
            onOpen={open}
          />
        ))}
      </div>

      {revealed.length > 0 && (
        <PackRevealOverlay
          // key ผูกกับรอบการเปิด เพื่อให้แอนิเมชันเริ่มใหม่ทุกครั้งที่เปิดซอง
          key={lastResult?.openedAt}
          entries={revealed}
          // ซื้อยกชุด = เล่นเอฟเฟกต์ให้ใบที่ดีที่สุดใบเดียว ที่เหลือดูในหน้าสรุป
          featureBestOnly={(lastResult?.packCount ?? 1) > 1}
          packName={getPackById(lastResult?.packId ?? '')?.name ?? 'ซองการ์ด'}
          onClose={dismissResult}
        />
      )}
    </div>
  );
};
