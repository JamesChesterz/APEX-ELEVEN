/**
 * FC ALLSTAR PASS ฝั่งผู้เล่น
 *
 * รวมสามอย่างเข้าด้วยกัน: ค่าตั้งของแอดมิน (useGameConfig) · XP และตั๋วในคลัง (usePlayers)
 * และความคืบหน้าส่วนตัว (สายที่ปลดล็อก + ของที่รับไปแล้ว) ที่เก็บลงบัญชีผ่าน patchState
 *
 * กติกาที่โค้ดนี้บังคับ:
 *   • สาย free รับได้เสมอโดยไม่ต้องปลดล็อกอะไร
 *   • ปลดล็อกสายไหนก็ได้ของสายที่ต่ำกว่าด้วย (plus ครอบ premium)
 *   • ปลดล็อกช้าไม่เสียของ — ซื้อ premium ตอนเลเวล 20 แล้วกดรับของเลเวล 1–20 ได้ทันที
 *     และโค้ดนี้กดรับให้เองตอนปลดล็อกสำเร็จ ไม่ต้องให้ผู้เล่นไปไล่กดทีละช่อง
 *   • ซีซันใหม่ (config.season เปลี่ยน) = ล้าง XP, สาย และของที่รับไปแล้วทั้งหมด
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import {
  claimableKeys,
  claimKey,
  createPassProgress,
  isPassClosed,
  normalizePassProgress,
  passStanding,
  rewardsForKeys,
  secondsUntilPassEnds,
  tierCovers,
  unlockCost,
} from '@/services/pass';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { PassReward, PassTier } from '@/types/pass';
import { createId } from '@/utils/helpers';

/** สรุปของที่เพิ่งรับมาในครั้งเดียว ใช้เปิดหน้าต่างสรุป */
export interface PassClaimResult {
  /** จำนวนช่องที่รับไป */
  cells: number;
  coins: number;
  points: number;
  upgradePoints: number;
  tickets: number;
  /** การ์ดที่ได้ (resolve นักเตะแล้ว) */
  cards: Array<{ card: PlayerCardData; playerId: string }>;
  at: string;
}

export const usePass = () => {
  const { account, patchState } = useAuth();
  const { pass: config } = useGameConfig();
  const {
    coins,
    spendCoins,
    addCoins,
    addPoints,
    addUpgradePoints,
    addCards,
    passXp,
    addPassXp,
    resetPassXp,
    passTickets,
    addPassTickets,
    spendPassTickets,
  } = usePlayers();

  const [progress, setProgress] = useState(() =>
    normalizePassProgress(account?.state.pass, config.season),
  );
  const [result, setResult] = useState<PassClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** นาฬิกาเดินทุกวินาที ใช้นับถอยหลังวันปิดซีซัน */
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** แอดมินขึ้นซีซันใหม่ = ล้างทั้ง XP และความคืบหน้าเก่าทิ้ง */
  useEffect(() => {
    if (progress.season === config.season) return;
    const fresh = createPassProgress(config.season);
    setProgress(fresh);
    resetPassXp();
    patchState({ pass: fresh, passXp: 0 });
  }, [config.season, patchState, progress.season, resetPassXp]);

  const now = nowSeconds * 1000;
  const closed = isPassClosed(config, now);
  const secondsLeft = secondsUntilPassEnds(config, now);

  const standing = useMemo(() => passStanding(config, passXp), [config, passXp]);
  const pending = useMemo(
    () => claimableKeys(config, progress, standing),
    [config, progress, standing],
  );

  const commit = useCallback(
    (next: typeof progress) => {
      setProgress(next);
      patchState({ pass: next });
    },
    [patchState],
  );

  /** จ่ายรางวัลก้อนหนึ่งเข้าคลัง แล้วคืนสรุปว่าได้อะไรไปบ้าง */
  const grant = useCallback(
    (rewards: PassReward[], cells: number): PassClaimResult => {
      let coinsGained = 0;
      let pointsGained = 0;
      let upgradeGained = 0;
      let ticketsGained = 0;
      const cards: PassClaimResult['cards'] = [];

      rewards.forEach((reward) => {
        if (reward.type === 'card') {
          const player = getPlayerById(reward.playerId ?? '');
          if (!player) return;

          cards.push({
            card: {
              id: createId('pass'),
              playerId: player.id,
              acquiredAt: new Date().toISOString(),
              level: 1,
              // ไม่ลงตัวจริงอัตโนมัติ ให้ผู้เล่นเลือกจัดเอง (กันชนกฎห้ามชื่อซ้ำ)
              inSquad: false,
            },
            playerId: player.id,
          });
          return;
        }

        const amount = Math.max(0, Math.floor(reward.amount ?? 0));
        if (reward.type === 'coins') coinsGained += amount;
        else if (reward.type === 'points') pointsGained += amount;
        else if (reward.type === 'upgradePoints') upgradeGained += amount;
        else ticketsGained += amount;
      });

      if (coinsGained > 0) addCoins(coinsGained);
      if (pointsGained > 0) addPoints(pointsGained);
      if (upgradeGained > 0) addUpgradePoints(upgradeGained);
      if (ticketsGained > 0) addPassTickets(ticketsGained);
      if (cards.length > 0) addCards(cards.map((entry) => entry.card));

      return {
        cells,
        coins: coinsGained,
        points: pointsGained,
        upgradePoints: upgradeGained,
        tickets: ticketsGained,
        cards,
        at: new Date().toISOString(),
      };
    },
    [addCards, addCoins, addPassTickets, addPoints, addUpgradePoints],
  );

  /** รับรางวัลตามคีย์ที่ระบุ — ใช้ทั้งกดทีละช่องและกดรับทั้งหมด */
  const claimKeys = useCallback(
    (keys: string[]): boolean => {
      const fresh = keys.filter((key) => !progress.claimed.includes(key));
      if (fresh.length === 0) return false;

      const rewards = rewardsForKeys(config, fresh);
      const summary = grant(rewards, fresh.length);

      commit({ ...progress, claimed: [...progress.claimed, ...fresh] });
      setError(null);
      setResult(summary);
      playSfx('rankUp');
      return true;
    },
    [commit, config, grant, progress],
  );

  /** กดรับช่องเดียว */
  const claimCell = useCallback(
    (tier: PassTier, level: number) => {
      const key = claimKey(tier, level);
      if (!pending.includes(key)) {
        setError('ช่องนี้ยังรับไม่ได้');
        playSfx('error');
        return false;
      }
      return claimKeys([key]);
    },
    [claimKeys, pending],
  );

  /**
   * ซื้อข้ามหนึ่งเลเวลด้วยเหรียญ (ปุ่ม "ซื้อเลเวล")
   * เติม XP ให้พอดีกับที่ขาดอยู่เท่านั้น ไม่ใช่เซ็ตเลเวลตรง ๆ
   * ความคืบหน้าจึงยังเป็น XP ก้อนเดียวเหมือนเดิม และรางวัลของเลเวลใหม่จะเข้าคิวรับตามปกติ
   */
  const buyLevel = useCallback((): boolean => {
    const price = config.levelUpCoins;

    if (price <= 0) {
      setError('ตอนนี้ปิดการซื้อเลเวลอยู่');
      playSfx('error');
      return false;
    }
    if (standing.maxed) {
      setError('ถึงเลเวลสูงสุดของซีซันนี้แล้ว');
      playSfx('error');
      return false;
    }
    if (closed) {
      setError('ซีซันนี้ปิดแล้ว — รอทีมงานเปิดซีซันใหม่');
      playSfx('error');
      return false;
    }
    if (!spendCoins(price)) {
      setError(`เหรียญไม่พอ — ต้องใช้ ${price.toLocaleString('en-US')} เหรียญ`);
      playSfx('error');
      return false;
    }

    addPassXp(standing.need);
    setError(null);
    playSfx('rankUp');
    return true;
  }, [addPassXp, closed, config.levelUpCoins, spendCoins, standing]);

  /** กดรับทั้งหมดที่ค้างอยู่ */
  const claimAll = useCallback(() => {
    if (pending.length === 0) {
      setError('ยังไม่มีรางวัลที่รับได้');
      playSfx('error');
      return false;
    }
    return claimKeys(pending);
  }, [claimKeys, pending]);

  /**
   * ปลดล็อกสาย premium หรือ plus ด้วยตั๋วหรือเหรียญ
   * ปลดล็อกสำเร็จแล้วกดรับของทุกเลเวลที่ถึงแล้วให้เลยในทีเดียว
   * (โจทย์: ซื้อตอนเลเวล 20 ต้องได้ของเลเวล 1–20 ย้อนหลังทันที)
   */
  const unlock = useCallback(
    (tier: PassTier, method: 'tickets' | 'coins'): boolean => {
      const cost = unlockCost(config, tier);
      if (!cost) return false;

      if (tierCovers(progress.tier, tier)) {
        setError('ปลดล็อกสายนี้ไปแล้ว');
        playSfx('error');
        return false;
      }

      if (closed) {
        setError('ซีซันนี้ปิดแล้ว — รอทีมงานเปิดซีซันใหม่');
        playSfx('error');
        return false;
      }

      const price = method === 'tickets' ? cost.tickets : cost.coins;
      if (price <= 0) {
        setError('ตอนนี้ปลดล็อกด้วยวิธีนี้ไม่ได้');
        playSfx('error');
        return false;
      }

      const paid = method === 'tickets' ? spendPassTickets(price) : spendCoins(price);
      if (!paid) {
        setError(
          method === 'tickets'
            ? `ตั๋วพาสไม่พอ — ต้องใช้ ${price} ใบ`
            : `เหรียญไม่พอ — ต้องใช้ ${price.toLocaleString('en-US')} เหรียญ`,
        );
        playSfx('error');
        return false;
      }

      // อัปสายก่อน แล้วค่อยคิดว่ามีอะไรค้างรับบ้างจากสายใหม่
      const upgraded = { ...progress, tier };
      const owed = claimableKeys(config, upgraded, standing);
      const rewards = rewardsForKeys(config, owed);
      const summary = grant(rewards, owed.length);

      commit({ ...upgraded, claimed: [...upgraded.claimed, ...owed] });
      setError(null);
      setResult(summary);
      playSfx('rankUp');
      return true;
    },
    [closed, commit, config, grant, progress, spendCoins, spendPassTickets, standing],
  );

  return {
    config,
    /** true = แอดมินเปิดพาสไว้ */
    open: config.enabled,
    closed,
    secondsLeft,
    /** เลเวล/ความคืบหน้า XP ปัจจุบัน */
    standing,
    progress,
    /** สายที่ปลดล็อกไว้ */
    tier: progress.tier,
    passXp,
    passTickets,
    coins,
    /** คีย์ของช่องที่กดรับได้ตอนนี้ */
    pending,
    result,
    error,
    claimCell,
    claimAll,
    buyLevel,
    unlock,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
