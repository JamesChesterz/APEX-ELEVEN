/**
 * ตารางอันดับที่พร้อมใช้งาน — รวมคะแนนสดของเรากับผู้เล่นคนอื่นจากเซิร์ฟเวอร์
 *
 * แยกออกมาเป็นฮุกเดียวเพราะมีถึง 4 จุดที่ต้องใช้ตารางชุดเดียวกัน
 * (Header, หน้าตารางอันดับ, แดชบอร์ดหน้า MY TEAM และระบบซีซัน)
 * ถ้าแต่ละที่เรียก buildLeaderboard เองจะลืมส่งข้อมูลออนไลน์เข้าไปได้ง่าย
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { useTeam } from '@/hooks/useTeam';
import { botTickAt } from '@/services/bots';
import { buildLeaderboard } from '@/services/leaderboard';
import type { LeaderboardEntry } from '@/types/match';

/** อ้างอิงเดียวตลอดอายุแอป — ถ้าสร้าง {} ใหม่ทุกครั้ง useMemo จะพังทันที */
const EMPTY_DELTAS: Record<string, number> = {};

/** ความถี่ในการตรวจว่าโลกบอทขยับช่วงเวลาแล้วหรือยัง (ms) */
const CLOCK_CHECK_MS = 60_000;

/**
 * นาฬิกาของทีมจำลอง — ตัวเลขนี้ขยับทุก 6 ชั่วโมง (ดู BOT_TICK_MS)
 *
 * ตรวจทุกนาทีก็จริง แต่ setState ด้วยค่าเดิม React จะไม่ render ซ้ำให้
 * จึงแทบไม่มีต้นทุน และคนที่เปิดแอปค้างไว้ข้ามคืนจะเห็นตารางขยับเองโดยไม่ต้องรีเฟรช
 */
const useBotClock = (): number => {
  const [tick, setTick] = useState(() => botTickAt());

  useEffect(() => {
    const id = window.setInterval(() => setTick(botTickAt()), CLOCK_CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return tick;
};

export const useLeaderboard = (): LeaderboardEntry[] => {
  const { account } = useAuth();
  const { record } = useMatchmaking();
  const { team, rating } = useTeam();
  const { enabled, rivals } = useOnline();
  const { bots } = useGameConfig();
  const tick = useBotClock();

  return useMemo(
    () =>
      buildLeaderboard(
        record,
        team.name,
        rating.matchOvr,
        account?.managerName,
        enabled ? rivals : undefined,
        tick,
        bots,
        account?.state.botDeltas ?? EMPTY_DELTAS,
      ).map((entry) =>
        // แถวของเราเองยังไม่มี uid/รูปติดมา (buildLeaderboard เป็น pure function ที่ไม่รู้จักบัญชี)
        entry.isCurrentUser && account?.id
          ? { ...entry, uid: account.id, avatar: account.state.avatar }
          : entry,
      ),
    [
      account?.id,
      account?.state.botDeltas,
      bots,
      account?.managerName,
      account?.state.avatar,
      enabled,
      rating.matchOvr,
      record,
      rivals,
      team.name,
      tick,
    ],
  );
};

/** อันดับปัจจุบันของเราในตาราง (0 = หาไม่เจอ) */
export const useMyRank = (): number => {
  const entries = useLeaderboard();
  return entries.find((entry) => entry.isCurrentUser)?.rank ?? 0;
};
