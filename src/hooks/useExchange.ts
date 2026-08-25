/**
 * ระบบแลกนักเตะด้วยแต้ม: หักแต้ม → สร้างการ์ดใหม่ → เข้าคลังทันที
 *
 * ของในร้านหมุนเวียนทุก 3 ชั่วโมง (ดู services/exchangeRotation.ts)
 * การ์ดรางวัลอันดับ 1–3 ของซีซันถูกกันไม่ให้เข้าร้าน — ต้องขึ้นอันดับเอาเท่านั้น
 * ฮุกนี้เดินนาฬิกาถอยหลังให้ด้วย และพอหมดเวลาก็สลับไปใช้ของรอบใหม่เอง
 * โดยไม่ต้องรีเฟรชหน้า
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayers } from '@/hooks/usePlayers';
import { useRankRewards } from '@/hooks/useRankRewards';
import { getExchangePrice } from '@/services/exchange';
import { getShopProtectedCards } from '@/services/rankRewards';
import {
  getRotationEnd,
  getRotationIndex,
  getRotationPlayers,
  secondsToRotation,
} from '@/services/exchangeRotation';
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
  /** การ์ดรางวัลอันดับ 1–3 — ห้ามโผล่ในร้าน ต้องขึ้นอันดับเอาเท่านั้น */
  const { cards: rewardCards } = useRankRewards();
  const protectedCards = useMemo(() => getShopProtectedCards(rewardCards), [rewardCards]);
  const [result, setResult] = useState<ExchangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** วินาทีที่เหลือก่อนของเปลี่ยนรอบ — เดินทุกวินาที */
  const [secondsLeft, setSecondsLeft] = useState(() => secondsToRotation());
  /** เลขรอบปัจจุบัน เปลี่ยนเมื่อไหร่ = ของในร้านเปลี่ยนตาม */
  const [rotationIndex, setRotationIndex] = useState(() => getRotationIndex());

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(secondsToRotation());
      // ถึงรอบใหม่แล้วสลับของให้เอง ไม่ต้องรอผู้เล่นรีเฟรช
      setRotationIndex((current) => {
        const next = getRotationIndex();
        return next === current ? current : next;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  /** นับจำนวนการ์ดที่มีอยู่แล้วของนักเตะแต่ละคน ไว้โชว์ป้าย "มีแล้ว" */
  const ownedByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    ownedCards.forEach(({ player }) => {
      counts.set(player.id, (counts.get(player.id) ?? 0) + 1);
    });
    return counts;
  }, [ownedCards]);

  /** ของที่แลกได้ตอนนี้ */
  const offers = useMemo<ExchangeOffer[]>(
    () =>
      getRotationPlayers(rotationIndex, protectedCards).map((player) => {
        const price = getExchangePrice(player);
        return {
          player,
          price,
          ownedCount: ownedByPlayer.get(player.id) ?? 0,
          affordable: points >= price,
        };
      }),
    [ownedByPlayer, points, protectedCards, rotationIndex],
  );

  /** ของที่จะเข้าร้านรอบถัดไป — โชว์ให้ผู้เล่นเก็บแต้มรอได้ */
  const nextOffers = useMemo<ExchangeOffer[]>(
    () =>
      getRotationPlayers(rotationIndex + 1, protectedCards).map((player) => ({
        player,
        price: getExchangePrice(player),
        ownedCount: ownedByPlayer.get(player.id) ?? 0,
        affordable: points >= getExchangePrice(player),
      })),
    [ownedByPlayer, points, protectedCards, rotationIndex],
  );

  const exchange = useCallback(
    (player: Player) => {
      // การ์ดรางวัลสามอันดับแรกแลกด้วยแต้มไม่ได้เด็ดขาด ต้องขึ้นอันดับเอาเท่านั้น
      if (protectedCards.has(player.id)) {
        setError('นักเตะคนนี้เป็นรางวัลอันดับ 1–3 ของซีซัน แลกด้วยแต้มไม่ได้');
        playSfx('error');
        return false;
      }

      // แลกได้เฉพาะของที่อยู่ในร้าน "รอบนี้" — กันการยิงแลกของรอบที่ยังไม่มา
      if (
        !getRotationPlayers(getRotationIndex(), protectedCards).some(
          (entry) => entry.id === player.id,
        )
      ) {
        setError('นักเตะคนนี้ไม่ได้อยู่ในร้านรอบนี้แล้ว');
        playSfx('error');
        return false;
      }

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
    [addCards, protectedCards, spendPoints],
  );

  return {
    points,
    offers,
    /** ของรอบถัดไป (ยังแลกไม่ได้) */
    nextOffers,
    /** วินาทีที่เหลือก่อนของเปลี่ยน */
    secondsLeft,
    /** เวลาที่ของชุดใหม่จะมา */
    rotationEndsAt: getRotationEnd(),
    result,
    error,
    exchange,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
