/**
 * ระบบแลกนักเตะด้วยแต้ม: หักแต้ม → สร้างการ์ดใหม่ → เข้าคลังทันที
 *
 * แยกออกมาจากหน้าจอเพื่อให้ตรรกะการหักแต้ม/ออกการ์ดอยู่ที่เดียว
 * และหน้าอื่น (เช่นอีเวนต์ในอนาคต) เรียกใช้ซ้ำได้
 */
import { useCallback, useMemo, useState } from 'react';
import { usePlayers } from '@/hooks/usePlayers';
import { getExchangeCatalogue, getExchangePrice } from '@/services/exchange';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Player } from '@/types/player';
import { createId } from '@/utils/helpers';

/** นักเตะหนึ่งคนในร้าน พร้อมข้อมูลที่ UI ต้องใช้ */
export interface ExchangeOffer {
  player: Player;
  price: number;
  /** มีการ์ดของนักเตะคนนี้ในคลังแล้วกี่ใบ */
  ownedCount: number;
  /** แต้มพอแลกไหม */
  affordable: boolean;
}

/** ผลลัพธ์ของการแลกหนึ่งครั้ง ใช้เปิดเอฟเฟกต์เผยการ์ด */
export interface ExchangeResult {
  card: PlayerCardData;
  player: Player;
  price: number;
  /** เวลาที่แลก ใช้เป็น key ให้แอนิเมชันเริ่มใหม่ทุกครั้ง */
  at: string;
}

export const useExchange = () => {
  const { points, spendPoints, addCards, ownedCards } = usePlayers();
  const [result, setResult] = useState<ExchangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** นับจำนวนการ์ดที่มีอยู่แล้วของนักเตะแต่ละคน ไว้โชว์ป้าย "มีแล้ว" */
  const ownedByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    ownedCards.forEach(({ player }) => {
      counts.set(player.id, (counts.get(player.id) ?? 0) + 1);
    });
    return counts;
  }, [ownedCards]);

  const offers = useMemo<ExchangeOffer[]>(
    () =>
      getExchangeCatalogue().map((player) => {
        const price = getExchangePrice(player);
        return {
          player,
          price,
          ownedCount: ownedByPlayer.get(player.id) ?? 0,
          affordable: points >= price,
        };
      }),
    [ownedByPlayer, points],
  );

  const exchange = useCallback(
    (player: Player) => {
      const price = getExchangePrice(player);

      if (!spendPoints(price)) {
        setError(`แต้มไม่พอ — ต้องใช้ ${price.toLocaleString('en-US')} แต้ม`);
        playSfx('error');
        return false;
      }

      const card: PlayerCardData = {
        id: createId('ex'),
        playerId: player.id,
        acquiredAt: new Date().toISOString(),
        level: 1,
        // ไม่ลงตัวจริงอัตโนมัติ ให้ผู้เล่นเลือกจัดเอง (และกันชนกฎห้ามชื่อซ้ำ)
        inSquad: false,
      };

      addCards([card]);
      setError(null);
      setResult({ card, player, price, at: new Date().toISOString() });
      return true;
    },
    [addCards, spendPoints],
  );

  return {
    points,
    offers,
    result,
    error,
    exchange,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
