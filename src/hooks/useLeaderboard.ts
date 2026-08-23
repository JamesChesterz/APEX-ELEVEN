/**
 * ตารางอันดับที่พร้อมใช้งาน — รวมคะแนนสดของเรากับผู้เล่นคนอื่นจากเซิร์ฟเวอร์
 *
 * แยกออกมาเป็นฮุกเดียวเพราะมีถึง 4 จุดที่ต้องใช้ตารางชุดเดียวกัน
 * (Header, หน้าตารางอันดับ, แดชบอร์ดหน้า MY TEAM และระบบซีซัน)
 * ถ้าแต่ละที่เรียก buildLeaderboard เองจะลืมส่งข้อมูลออนไลน์เข้าไปได้ง่าย
 */
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { useTeam } from '@/hooks/useTeam';
import { buildLeaderboard } from '@/services/leaderboard';
import type { LeaderboardEntry } from '@/types/match';

export const useLeaderboard = (): LeaderboardEntry[] => {
  const { account } = useAuth();
  const { record } = useMatchmaking();
  const { team, rating } = useTeam();
  const { enabled, rivals } = useOnline();

  return useMemo(
    () =>
      buildLeaderboard(
        record,
        team.name,
        rating.matchOvr,
        account?.managerName,
        enabled ? rivals : undefined,
      ),
    [account?.managerName, enabled, rating.matchOvr, record, rivals, team.name],
  );
};

/** อันดับปัจจุบันของเราในตาราง (0 = หาไม่เจอ) */
export const useMyRank = (): number => {
  const entries = useLeaderboard();
  return entries.find((entry) => entry.isCurrentUser)?.rank ?? 0;
};
