/**
 * รับของขวัญจากแอดมิน
 *
 * เฝ้ากล่อง gifts/{uid}/items ของตัวเอง มีใบใหม่เมื่อไหร่ก็เพิ่มของเข้าบัญชี
 * แล้วลบใบทิ้งทันที (ลบสำเร็จค่อยถือว่าจบ — ถ้าลบไม่ผ่านจะไม่เพิ่มซ้ำเพราะกันด้วย claimed ref)
 *
 * ตัวเลขในใบไม่เชื่อทั้งดุ้น — บีบด้วย clampGiftAmount ที่ฝั่งรับอีกชั้นเสมอ
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { usePlayers } from '@/hooks/usePlayers';
import { ONLINE } from '@/services/accountStore';
import { createCardInstance } from '@/services/cardInstance';
import { clampGiftAmount, clearGifts, watchGifts, type GiftDoc } from '@/services/firebase/gifts';
import { grantRewards } from '@/services/rewards';
import { playSfx } from '@/services/sound';
import type { PlayerCard } from '@/types/card';
import { createId } from '@/utils/helpers';

interface GiftsContextValue {
  /** ของขวัญที่เพิ่งเข้าบัญชี รอขึ้นแจ้งเตือน (ว่าง = ไม่มีของใหม่) */
  received: GiftDoc[];
  /** ปิดแจ้งเตือน */
  clearNotices: () => void;
}

const GiftsContext = createContext<GiftsContextValue>({ received: [], clearNotices: () => undefined });

export const GiftsProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const { addCoins, addPoints, addUpgradePoints, addPassTickets, addUpgradeItems, addCards } =
    usePlayers();

  const [received, setReceived] = useState<GiftDoc[]>([]);

  /** ใบที่รับไปแล้วในเซสชันนี้ — กัน snapshot เด้งซ้ำก่อนลบเสร็จแล้วได้ของสองรอบ */
  const claimed = useRef(new Set<string>());

  const uid = account?.id ?? null;

  useEffect(() => {
    if (!ONLINE || !uid) return undefined;

    return watchGifts(uid, (gifts) => {
      const fresh = gifts.filter((gift) => !claimed.current.has(gift.id));
      if (fresh.length === 0) return;

      fresh.forEach((gift) => claimed.current.add(gift.id));

      // ── เพิ่มของเข้าบัญชี ──
      const coins = fresh.reduce((sum, gift) => sum + clampGiftAmount(gift.coins), 0);
      const points = fresh.reduce((sum, gift) => sum + clampGiftAmount(gift.points), 0);
      const upgrade = fresh.reduce((sum, gift) => sum + clampGiftAmount(gift.upgradePoints), 0);

      const cards: PlayerCard[] = fresh.flatMap((gift) =>
        (gift.cardPlayerIds ?? [])
          // การ์ดที่ชี้ไปหานักเตะที่ไม่มีอยู่จริงถูกทิ้ง ไม่ให้คลังมีใบผี
          .filter((playerId) => Boolean(getPlayerById(playerId)))
          .map((playerId) => ({
            id: createId('c'),
            playerId,
            acquiredAt: new Date().toISOString(),
            level: 1,
            inSquad: false,
          })),
      );

      if (coins > 0) addCoins(coins);
      if (points > 0) addPoints(points);
      if (upgrade > 0) addUpgradePoints(upgrade);
      if (cards.length > 0) addCards(cards);

      /*
       * รางวัลแบบใหม่ (ไอเทม · ตั๋วพาส · การ์ดพร้อมค่าบวก ฯลฯ)
       * จ่ายผ่านทะเบียนกลาง ของที่เพิ่มเข้าเกมทีหลังจึงรับได้เองโดยไม่ต้องแก้ตรงนี้
       */
      const rewards = fresh.flatMap((gift) => gift.rewards ?? []);
      if (rewards.length > 0) {
        grantRewards(rewards, {
          addCoins,
          addPoints,
          addUpgradePoints,
          addPassTickets,
          addUpgradeItems,
          addCard: (playerId, upgradeLevel) =>
            addCards([createCardInstance({ playerId, ownerId: uid, upgrade: upgradeLevel })]),
        });
      }

      setReceived((current) => [...fresh, ...current].slice(0, 5));
      playSfx('rankUp');

      // ลบใบทิ้งเพื่อไม่ให้ได้ซ้ำตอนเปิดเกมครั้งหน้า
      clearGifts(uid, fresh.map((gift) => gift.id)).catch((error) =>
        console.error('[gifts] ลบใบของขวัญไม่สำเร็จ', error),
      );
    });
  }, [addCards, addCoins, addPassTickets, addPoints, addUpgradeItems, addUpgradePoints, uid]);

  const clearNotices = useCallback(() => setReceived([]), []);

  const value = useMemo<GiftsContextValue>(() => ({ received, clearNotices }), [clearNotices, received]);

  return <GiftsContext.Provider value={value}>{children}</GiftsContext.Provider>;
};

export const useGifts = (): GiftsContextValue => useContext(GiftsContext);
