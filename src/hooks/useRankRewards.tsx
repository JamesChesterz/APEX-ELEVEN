/**
 * การ์ดรางวัลของอันดับ 1–10 ในตารางอันดับ
 *
 * ลำดับความสำคัญของค่าที่ใช้:
 *   1. ค่าที่เจ้าของโปรเจคบันทึกไว้บนเซิร์ฟเวอร์ (config/rankRewards)
 *   2. ค่าเริ่มต้นในไฟล์ src/data/rankRewards.ts
 *
 * มีสองที่ที่ใช้ค่าชุดนี้ (หน้า Leaderboard และตอนสรุปซีซัน) จึงทำเป็น Context
 * เพื่อไม่ให้แต่ละที่ยิงอ่านเอกสารเดียวกันซ้ำ ๆ
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ONLINE } from '@/services/accountStore';
import { saveRankRewards, watchRankRewards } from '@/services/firebase/rankRewards';
import { isOwnerUsername, normalizeRankRewards } from '@/services/rankRewards';

interface RankRewardsContextValue {
  /** การ์ดรางวัลของอันดับ 1 → 10 (ยาว 10 ช่องเสมอ) */
  cards: string[];
  /** true = บัญชีนี้เป็นเจ้าของโปรเจค (เห็นปุ่มตั้งค่ารางวัล) */
  isOwner: boolean;
  /** true = ค่าที่ใช้อยู่มาจากเซิร์ฟเวอร์ (ไม่ใช่ค่าเริ่มต้นในไฟล์) */
  fromServer: boolean;
  /** uid ของบัญชีนี้ ใช้โชว์ให้เจ้าของก๊อปไปใส่ใน firestore.rules */
  uid: string | null;
  /** บันทึกค่าใหม่ คืนข้อความ error เมื่อไม่สำเร็จ (null = สำเร็จ) */
  save: (cards: string[]) => Promise<string | null>;
}

const RankRewardsContext = createContext<RankRewardsContextValue | null>(null);

export const RankRewardsProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const [serverCards, setServerCards] = useState<string[] | null>(null);

  useEffect(() => {
    if (!ONLINE) return undefined;
    return watchRankRewards(setServerCards);
  }, []);

  const cards = useMemo(() => normalizeRankRewards(serverCards ?? undefined), [serverCards]);
  const isOwner = isOwnerUsername(account?.username);
  const uid = account?.id ?? null;

  const save = useCallback(
    async (next: string[]): Promise<string | null> => {
      if (!uid) return 'ยังไม่ได้เข้าสู่ระบบ';
      if (!ONLINE) return 'โหมดออฟไลน์บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้ — แก้ที่ src/data/rankRewards.ts แทน';

      try {
        await saveRankRewards(uid, normalizeRankRewards(next));
        return null;
      } catch (error) {
        console.error('[rankRewards] บันทึกไม่สำเร็จ', error);
        return 'บันทึกไม่สำเร็จ — ต้องเพิ่ม uid ของคุณใน firestore.rules ก่อน (ดูวิธีในไฟล์นั้น)';
      }
    },
    [uid],
  );

  const value = useMemo<RankRewardsContextValue>(
    () => ({ cards, isOwner, fromServer: serverCards !== null, uid, save }),
    [cards, isOwner, save, serverCards, uid],
  );

  return <RankRewardsContext.Provider value={value}>{children}</RankRewardsContext.Provider>;
};

export const useRankRewards = (): RankRewardsContextValue => {
  const context = useContext(RankRewardsContext);
  if (!context) throw new Error('useRankRewards ต้องถูกใช้ภายใน <RankRewardsProvider>');
  return context;
};
