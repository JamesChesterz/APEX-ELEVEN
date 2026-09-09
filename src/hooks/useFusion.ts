/**
 * สถานะของหน้าผสมการ์ด — ต่อกติกาใน services/fusion.ts เข้ากับคลังการ์ดจริง
 *
 * จังหวะการทำงาน (สำคัญ อ่านก่อนแก้):
 *   select → เลือกการ์ด 3 ใบระดับเดียวกัน
 *   reveal → สุ่มผลของการ์ดคว่ำทั้ง 5 ใบไว้ล่วงหน้า แต่ "ยังไม่แตะคลังเลย"
 *   result → ผู้เล่นเปิดใบแรก = ตัดการ์ดวัสดุทิ้งและมอบรางวัลในจังหวะเดียวกัน
 *
 * ที่ยอมสุ่มก่อนแล้วค่อยตัดของ เพราะถ้าตัดตั้งแต่ตอนกดผสม ผู้เล่นที่ปิดหน้าจอ
 * ระหว่างลุ้นจะเสียการ์ดฟรีสามใบ ส่วนการ "ยกเลิกเพื่อสุ่มใหม่" ไม่ได้เปรียบอะไร
 * เพราะการ์ดยังคว่ำอยู่ทั้งหมด — ยังไม่มีข้อมูลให้ตัดสินใจตอนกดยกเลิก
 */
import { useCallback, useMemo, useState } from 'react';
import { usePlayers, type OwnedPlayerCard } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { createCardInstance } from '@/services/cardInstance';
import {
  FUSION_MATERIALS,
  getFusionBlockReason,
  getFusionOdds,
  getMaterialPlus,
  getMaterialRarity,
  rollFusionCandidates,
  canWinCash,
  type FusionCandidate,
} from '@/services/fusion';
import { getEffectivePlayer } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Player } from '@/types/player';

export type FusionPhase = 'select' | 'reveal' | 'result';

/** สิ่งที่ผู้เล่นได้จริงจากการผสมครั้งนี้ */
export interface FusionOutcome {
  card: PlayerCardData;
  player: Player;
  plus: number;
  cash: number;
  /** ช่องที่ผู้เล่นเลือกเปิด (0–4) */
  index: number;
}

export const useFusion = () => {
  const { ownedCards, addCards, removeCards, addCoins, getCard } = usePlayers();
  const { team } = useTeam();

  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<FusionPhase>('select');
  const [candidates, setCandidates] = useState<FusionCandidate[]>([]);
  const [openedIndexes, setOpenedIndexes] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<FusionOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** การ์ดที่ติดทีมอยู่ (ตัวจริง + สำรอง) — ห้ามเอามาผสม */
  const usedCardIds = useMemo(
    () =>
      new Set<string>([
        ...(team.squad.map((slot) => slot.cardId).filter(Boolean) as string[]),
        ...team.bench,
      ]),
    [team.bench, team.squad],
  );

  /** การ์ดที่เลือกไว้แล้ว เรียงตามลำดับที่กด */
  const materials = useMemo<OwnedPlayerCard[]>(
    () =>
      pickedIds.flatMap((id) => {
        const entry = ownedCards.find(({ card }) => card.id === id);
        return entry ? [entry] : [];
      }),
    [ownedCards, pickedIds],
  );

  /** ระดับที่ถูกล็อกไว้จากใบแรก — ใบที่เหลือต้องระดับนี้เท่านั้น */
  const rarity = materials.length > 0 ? materials[0].player.rarity : null;
  const materialPlus = getMaterialPlus(materials.map(({ card }) => card));
  const odds = useMemo(() => getFusionOdds(materialPlus), [materialPlus]);
  const cashUnlocked = materials.length === FUSION_MATERIALS && canWinCash(materialPlus);
  const ready = materials.length === FUSION_MATERIALS;

  /** ใบนี้หย่อนลงช่องได้ไหม (ใช้ทั้งในหน้าเลือกและตอนกดยืนยัน) */
  const blockReasonOf = useCallback(
    (card: PlayerCardData) => getFusionBlockReason(card, { usedCardIds, rarity }),
    [rarity, usedCardIds],
  );

  const toggle = useCallback(
    (cardId: string) => {
      setError(null);
      setPickedIds((current) => {
        if (current.includes(cardId)) {
          playSfx('click');
          return current.filter((id) => id !== cardId);
        }
        if (current.length >= FUSION_MATERIALS) return current;

        playSfx('click');
        return [...current, cardId];
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setPickedIds([]);
    setError(null);
  }, []);

  /** กดผสม: ตรวจครบทุกข้อ แล้วสุ่มผลของการ์ดคว่ำไว้รอ (ยังไม่หักการ์ด) */
  const startFusion = useCallback(() => {
    const cards = materials.map(({ card }) => card);

    if (cards.length !== FUSION_MATERIALS) {
      setError(`ต้องเลือกการ์ดให้ครบ ${FUSION_MATERIALS} ใบ`);
      playSfx('error');
      return false;
    }

    const materialRarity = getMaterialRarity(cards);
    if (!materialRarity) {
      setError('การ์ดทั้ง 3 ใบต้องเป็นระดับเดียวกัน');
      playSfx('error');
      return false;
    }

    if (cards.some((card) => blockReasonOf(card))) {
      setError('มีการ์ดที่ใช้ผสมไม่ได้ (ถูกล็อกหรืออยู่ในทีม)');
      playSfx('error');
      return false;
    }

    setCandidates(rollFusionCandidates(materialRarity, getMaterialPlus(cards)));
    setOpenedIndexes([]);
    setOutcome(null);
    setError(null);
    setPhase('reveal');
    playSfx('upgradeRoll');
    return true;
  }, [blockReasonOf, materials]);

  /**
   * เปิดการ์ดคว่ำหนึ่งใบ
   * ใบแรกที่เปิด = ผลจริง → หักการ์ดวัสดุและมอบรางวัลทันที
   * ใบต่อ ๆ ไปเป็นแค่การเปิดดูว่าพลาดอะไรไป ไม่มีผลกับคลัง
   */
  const openCandidate = useCallback(
    (index: number) => {
      const candidate = candidates[index];
      if (!candidate || openedIndexes.includes(index)) return;

      // เปิดใบที่สองเป็นต้นไป = ดูเฉย ๆ
      if (outcome) {
        playSfx('click');
        setOpenedIndexes((current) => [...current, index]);
        return;
      }

      // ตรวจซ้ำอีกรอบเผื่อการ์ดถูกจัดลงทีม/ล็อกไประหว่างที่ค้างหน้าลุ้นอยู่
      const cards = pickedIds.map((id) => getCard(id));
      if (cards.some((card) => !card || blockReasonOf(card))) {
        setError('การ์ดที่เลือกไว้เปลี่ยนสถานะไปแล้ว กรุณาเลือกใหม่');
        playSfx('error');
        setPhase('select');
        return;
      }

      const reward = createCardInstance({ playerId: candidate.playerId, upgrade: candidate.plus });
      const player = getEffectivePlayer(reward);
      if (!player) {
        setError('ไม่พบข้อมูลนักเตะของผลลัพธ์นี้');
        playSfx('error');
        return;
      }

      removeCards(pickedIds);
      addCards([reward]);
      if (candidate.cash > 0) addCoins(candidate.cash);

      setOpenedIndexes([index]);
      setOutcome({ card: reward, player, plus: candidate.plus, cash: candidate.cash, index });
      setPhase('result');
      setPickedIds([]);
      playSfx(candidate.plus >= 7 ? 'upgradeSuccess' : 'packBurst');
      if (candidate.cash > 0) playSfx('coin');
    },
    [
      addCards,
      addCoins,
      blockReasonOf,
      candidates,
      getCard,
      openedIndexes,
      outcome,
      pickedIds,
      removeCards,
    ],
  );

  /** เปิดใบที่เหลือทั้งหมดรวดเดียว (ดูอย่างเดียว) */
  const revealRest = useCallback(() => {
    playSfx('click');
    setOpenedIndexes(candidates.map((_, index) => index));
  }, [candidates]);

  /** ปิดฉากลุ้นแล้วกลับไปหน้าเลือกการ์ด */
  const close = useCallback(() => {
    setPhase('select');
    setCandidates([]);
    setOpenedIndexes([]);
    setOutcome(null);
  }, []);

  return {
    /* สถานะการเลือก */
    materials,
    pickedIds,
    rarity,
    materialPlus,
    odds,
    ready,
    cashUnlocked,
    usedCardIds,
    blockReasonOf,
    toggle,
    clear,

    /* ฉากลุ้นผล */
    phase,
    candidates,
    openedIndexes,
    outcome,
    startFusion,
    openCandidate,
    revealRest,
    close,

    error,
    clearError: () => setError(null),
  };
};
