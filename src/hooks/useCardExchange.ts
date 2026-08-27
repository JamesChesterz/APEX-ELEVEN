/**
 * ระบบแลกเปลี่ยนการ์ดตามดีลที่แอดมินสร้างไว้: เอาการ์ดที่เข้าเงื่อนไขมาแลก → หายไปจากคลัง
 * → ได้การ์ดรางวัลของดีลนั้นเข้าคลังทันที (ดู services/exchangeDeals.ts สำหรับกติกา)
 *
 * ต่างจาก useExchange (ร้านแลกด้วยแต้ม): ตัวนี้จ่ายด้วยการ์ด ไม่ใช่แต้ม
 * และรายการดีลมาจากแอดมินล้วน ๆ ไม่มีการหมุนเวียนอัตโนมัติ
 */
import { useCallback, useMemo, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers, type OwnedPlayerCard } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { cardMatchesRequirement } from '@/services/exchangeDeals';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData, ExchangeDeal } from '@/types/card';
import type { Player } from '@/types/player';
import { createId } from '@/utils/helpers';

/** ผลลัพธ์ของการแลกหนึ่งครั้ง ใช้เปิดเอฟเฟกต์เผยการ์ด (ได้รางวัลได้มากกว่า 1 ใบ) */
export interface CardExchangeResult {
  cards: PlayerCardData[];
  players: Player[];
  deal: ExchangeDeal;
  usedCardIds: string[];
  at: string;
}

export const useCardExchange = () => {
  const { ownedCards, addCards, removeCards } = usePlayers();
  const { team } = useTeam();
  const { exchangeDeals } = useGameConfig();

  const [result, setResult] = useState<CardExchangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** การ์ดที่อยู่ในสนามตอนนี้ — ใช้แลกไม่ได้ ต้องเอาออกจากสนามก่อน (เหมือนกติกาย่อยการ์ด) */
  const starterIds = useMemo(
    () => new Set(team.squad.map((slot) => slot.cardId).filter(Boolean) as string[]),
    [team.squad],
  );

  /** ดีลที่เปิดใช้งานอยู่ตอนนี้ */
  const deals = useMemo(() => exchangeDeals.filter((deal) => deal.enabled), [exchangeDeals]);

  /** การ์ดในคลังที่หยิบมาใช้แลกดีลนี้ได้ (ยังไม่ได้เลือก แค่ "เข้าเงื่อนไข") */
  const qualifyingCards = useCallback(
    (deal: ExchangeDeal): OwnedPlayerCard[] =>
      ownedCards.filter(
        ({ card, player }) =>
          !starterIds.has(card.id) && cardMatchesRequirement(player, deal.requirement),
      ),
    [ownedCards, starterIds],
  );

  /**
   * ยืนยันแลก: ต้องเลือกการ์ดตรงจำนวนที่ดีลกำหนด และทุกใบต้องเข้าเงื่อนไขจริง
   * ตรวจให้ครบก่อนค่อยแตะ state — เอาการ์ดออกแล้วค่อยสร้างการ์ดรางวัลให้ในจังหวะเดียวกัน
   */
  const redeem = useCallback(
    (deal: ExchangeDeal, cardIds: string[]): boolean => {
      const uniqueIds = [...new Set(cardIds)];

      if (uniqueIds.length !== deal.requirement.count) {
        setError(`ต้องเลือกการ์ดให้ครบ ${deal.requirement.count} ใบ`);
        playSfx('error');
        return false;
      }

      const eligibleIds = new Set(qualifyingCards(deal).map(({ card }) => card.id));
      if (!uniqueIds.every((id) => eligibleIds.has(id))) {
        setError('มีการ์ดที่เลือกไม่ตรงเงื่อนไข หรือถูกใช้ไปแล้ว');
        playSfx('error');
        return false;
      }

      const players = deal.rewardPlayerIds
        .map((id) => getPlayerById(id))
        .filter((entry): entry is Player => Boolean(entry));

      if (players.length === 0) {
        setError('ไม่พบข้อมูลนักเตะรางวัลของดีลนี้');
        playSfx('error');
        return false;
      }

      removeCards(uniqueIds);

      const at = new Date().toISOString();
      const cards: PlayerCardData[] = players.map((player) => ({
        id: createId('ex'),
        playerId: player.id,
        acquiredAt: at,
        level: 1,
        inSquad: false,
      }));

      addCards(cards);
      setError(null);
      setResult({ cards, players, deal, usedCardIds: uniqueIds, at });
      return true;
    },
    [addCards, qualifyingCards, removeCards],
  );

  return {
    deals,
    starterIds,
    qualifyingCards,
    redeem,
    result,
    error,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
