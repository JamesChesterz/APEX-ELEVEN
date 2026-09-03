/**
 * รางวัลล็อกอิน — อ่านค่าตั้งจากแอดมิน + ความคืบหน้าของบัญชี แล้วจ่ายของให้
 *
 * ไม่ทำเป็น Provider เพราะมีที่ใช้ที่เดียว (หน้า Login Bonus)
 * และทุกอย่างที่ต้องใช้อยู่ใน context อื่นครบแล้ว
 */
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { createCardInstance } from '@/services/cardInstance';
import {
  claimTrack,
  getTrackStatus,
  normalizeLoginState,
  type Track,
} from '@/services/loginBonus';
import { describeReward, grantReward, type RewardGrantApi } from '@/services/rewards';
import { playSfx } from '@/services/sound';

export const useLoginBonus = () => {
  const { account, patchState } = useAuth();
  const { loginBonus } = useGameConfig();
  const { addCoins, addPoints, addUpgradePoints, addPassTickets, addUpgradeItems, addCards } =
    usePlayers();

  /** ความคืบหน้าที่บีบให้ตรงกับสัปดาห์/เดือนปัจจุบันแล้ว */
  const state = useMemo(
    () => normalizeLoginState(account?.state.loginBonus),
    [account?.state.loginBonus],
  );

  /** ช่องทางจ่ายของ ส่งให้ services/rewards เป็นตัวลงมือจริง */
  const api = useMemo<RewardGrantApi>(
    () => ({
      addCoins,
      addPoints,
      addUpgradePoints,
      addPassTickets,
      addUpgradeItems,
      addCard: (playerId, upgrade) =>
        addCards([createCardInstance({ playerId, ownerId: account?.id, upgrade })]),
    }),
    [account?.id, addCards, addCoins, addPassTickets, addPoints, addUpgradeItems, addUpgradePoints],
  );

  const weekly = getTrackStatus(state, 'weekly');
  const monthly = getTrackStatus(state, 'monthly');

  /**
   * กดรับรางวัลของปฏิทินหนึ่ง — คืนข้อความสรุป (null = กดไม่ได้)
   *
   * เขียนความคืบหน้าลงบัญชีก่อนแล้วค่อยจ่ายของ เพื่อกันกดรัวจนได้ของซ้ำ
   */
  const claim = useCallback(
    (track: Track): string | null => {
      const status = track === 'weekly' ? weekly : monthly;
      if (!status.claimable || status.next < 0) {
        playSfx('error');
        return null;
      }

      const reward = (track === 'weekly' ? loginBonus.weekly : loginBonus.monthly)[status.next];
      if (!reward) return null;

      patchState({ loginBonus: claimTrack(state, track) });

      if (!grantReward(reward, api)) {
        playSfx('error');
        return 'รางวัลช่องนี้ตั้งค่าไม่ครบ — แจ้งแอดมินให้ตรวจสอบ';
      }

      playSfx('levelUp');
      return `รับแล้ว: ${describeReward(reward)}`;
    },
    [api, loginBonus, monthly, patchState, state, weekly],
  );

  return { config: loginBonus, state, weekly, monthly, claim };
};
