/**
 * ระบบแลกนักเตะด้วยแต้ม: หักแต้ม → สร้างการ์ดใหม่ → เข้าคลังทันที
 *
 * ของในร้านไม่หมุนเวียนอัตโนมัติแล้ว — แอดมินเป็นคนเลือกเองทุกใบ
 * (หน้า ADMIN → "แลกด้วยแต้ม" ดู services/pointsExchange.ts)
 *   • ปิดทั้งเมนูได้จากสวิตช์เดียว
 *   • ราคาแต้มของแต่ละใบแอดมินตั้งเอง
 *   • ตั้งเวลาที่แต่ละใบจะหายไปจากหน้าแลกได้ — หมดเวลาแล้วหายเองโดยไม่ต้องรีเฟรช
 *
 * การ์ดรางวัลอันดับ 1–3 ของซีซันยังถูกกันไม่ให้ขึ้นร้านเหมือนเดิม (ต้องขึ้นอันดับเอาเท่านั้น)
 * ต่อให้แอดมินเผลอเลือกมาก็ตาม — หน้า ADMIN จะขึ้นเตือนให้เห็นตั้งแต่ตอนตั้งค่า
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { useRankRewards } from '@/hooks/useRankRewards';
import { getPlayerById } from '@/data/players';
import { isItemLive, secondsUntilExpiry } from '@/services/pointsExchange';
import { getShopProtectedCards } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData, PointsExchangeItem } from '@/types/card';
import type { Player } from '@/types/player';
import { createId } from '@/utils/helpers';

/** นักเตะหนึ่งคนในร้าน พร้อมข้อมูลที่ UI ต้องใช้ */
export interface ExchangeOffer {
  /** id ของรายการในร้าน (ไม่ใช่ id นักเตะ — ใบเดียวกันวางซ้ำได้) */
  itemId: string;
  player: Player;
  /** ราคาที่แอดมินตั้งไว้ */
  price: number;
  /** มีการ์ดของนักเตะคนนี้ในคลังแล้วกี่ใบ */
  ownedCount: number;
  /** แต้มพอแลกไหม */
  affordable: boolean;
  /** วินาทีที่เหลือก่อนใบนี้หายจากร้าน — null = ไม่มีกำหนด */
  secondsLeft: number | null;
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
  const { pointsExchange } = useGameConfig();
  /** การ์ดรางวัลอันดับ 1–3 — ห้ามโผล่ในร้าน ต้องขึ้นอันดับเอาเท่านั้น */
  const { cards: rewardCards } = useRankRewards();
  const protectedCards = useMemo(() => getShopProtectedCards(rewardCards), [rewardCards]);
  const [result, setResult] = useState<ExchangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * นาฬิกาเดินทุกวินาที ใช้สองอย่าง: นับถอยหลังบนการ์ด และเขี่ยใบที่หมดเวลาออกเอง
   * เก็บเป็น "วินาที" ไม่ใช่มิลลิวินาที เพื่อให้ค่าเปลี่ยนแค่วินาทีละครั้ง
   */
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = nowSeconds * 1000;

  /** นับจำนวนการ์ดที่มีอยู่แล้วของนักเตะแต่ละคน ไว้โชว์ป้าย "มีแล้ว" */
  const ownedByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    ownedCards.forEach(({ player }) => {
      counts.set(player.id, (counts.get(player.id) ?? 0) + 1);
    });
    return counts;
  }, [ownedCards]);

  /** ของที่แลกได้ตอนนี้ — เรียงจากที่ใกล้หมดเวลาที่สุดขึ้นก่อน แล้วค่อยเรียงตามราคา */
  const offers = useMemo<ExchangeOffer[]>(() => {
    if (!pointsExchange.enabled) return [];

    return pointsExchange.items
      .filter((item) => isItemLive(item, now) && !protectedCards.has(item.playerId))
      .map((item) => {
        const player = getPlayerById(item.playerId);
        if (!player) return null;

        return {
          itemId: item.id,
          player,
          price: item.price,
          ownedCount: ownedByPlayer.get(player.id) ?? 0,
          affordable: points >= item.price,
          secondsLeft: secondsUntilExpiry(item, now),
        };
      })
      .filter((entry): entry is ExchangeOffer => entry !== null)
      .sort((a, b) => {
        // ใบที่มีนาฬิกาเดินอยู่ขึ้นก่อนใบที่อยู่ยาว — ผู้เล่นจะได้ไม่พลาดของจำกัดเวลา
        if (a.secondsLeft !== null && b.secondsLeft !== null) return a.secondsLeft - b.secondsLeft;
        if (a.secondsLeft !== null) return -1;
        if (b.secondsLeft !== null) return 1;
        return b.price - a.price || b.player.ovr - a.player.ovr;
      });
  }, [now, ownedByPlayer, points, pointsExchange, protectedCards]);

  const exchange = useCallback(
    (offer: ExchangeOffer) => {
      if (!pointsExchange.enabled) {
        setError('ตอนนี้ร้านแลกด้วยแต้มปิดอยู่');
        playSfx('error');
        return false;
      }

      // การ์ดรางวัลสามอันดับแรกแลกด้วยแต้มไม่ได้เด็ดขาด ต้องขึ้นอันดับเอาเท่านั้น
      if (protectedCards.has(offer.player.id)) {
        setError('นักเตะคนนี้เป็นรางวัลอันดับ 1–3 ของซีซัน แลกด้วยแต้มไม่ได้');
        playSfx('error');
        return false;
      }

      /*
       * เช็คกับค่าตั้งจริงอีกรอบ ณ วินาทีที่กด — ไม่ใช้ค่าใน offer ที่คำนวณไว้ตอนวาดจอ
       * กันเคสกดค้างไว้จนใบนั้นหมดเวลาพอดี หรือแอดมินเพิ่งเอาออกกลางคัน
       */
      const item: PointsExchangeItem | undefined = pointsExchange.items.find(
        (entry) => entry.id === offer.itemId,
      );

      if (!item || !isItemLive(item, Date.now())) {
        setError('การ์ดใบนี้หมดเวลาหรือถูกเอาออกจากร้านแล้ว');
        playSfx('error');
        return false;
      }

      if (!spendPoints(item.price)) {
        setError(`แต้มไม่พอ — ต้องใช้ ${item.price.toLocaleString('en-US')} แต้ม`);
        playSfx('error');
        return false;
      }

      const card: PlayerCardData = {
        id: createId('ex'),
        playerId: offer.player.id,
        acquiredAt: new Date().toISOString(),
        level: 1,
        // ไม่ลงตัวจริงอัตโนมัติ ให้ผู้เล่นเลือกจัดเอง (และกันชนกฎห้ามชื่อซ้ำ)
        inSquad: false,
      };

      addCards([card]);
      setError(null);
      setResult({ card, player: offer.player, price: item.price, at: new Date().toISOString() });
      return true;
    },
    [addCards, pointsExchange, protectedCards, spendPoints],
  );

  return {
    points,
    /** true = แอดมินเปิดเมนูแลกด้วยแต้มไว้ */
    shopOpen: pointsExchange.enabled,
    offers,
    result,
    error,
    exchange,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
