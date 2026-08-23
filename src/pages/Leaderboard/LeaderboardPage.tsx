/** หน้า Leaderboard: ตารางอันดับผู้จัดการทีม (อัปเดตตามคะแนนที่เก็บได้จริง) */
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { ChampionTitle } from '@/components/rank/RankBadge';
import { cn } from '@/utils/helpers';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { useSeason } from '@/hooks/useSeason';

export const LeaderboardPage = () => {
  const { record } = useMatchmaking();
  const { season, daysLeft } = useSeason();
  const { enabled, connected, playerCount } = useOnline();

  const entries = useLeaderboard();
  const myRank = entries.find((entry) => entry.isCurrentUser)?.rank ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">ตารางอันดับ</h2>
          <p className="text-sm text-chalk/50">
            ซีซัน {season.number} · เหลืออีก {daysLeft} วัน · คุณอยู่อันดับ {myRank || '—'} ด้วย{' '}
            {record.points} คะแนน
          </p>

          {/* บอกให้รู้ว่ากำลังดูอันดับของผู้เล่นจริงอยู่ หรือยังเป็นตารางออฟไลน์ */}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-chalk/40">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connected ? 'bg-neon' : enabled ? 'bg-gold' : 'bg-chalk/30',
              )}
              aria-hidden
            />
            {connected
              ? `อันดับสดจากผู้เล่นจริง ${playerCount} คน`
              : enabled
                ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์…'
                : 'โหมดออฟไลน์ — ตารางนี้เป็นทีมจำลอง'}
          </p>
        </div>

        {/* ฉายาสีทองนี้เป็นของอันดับ 1 คนเดียวเท่านั้น */}
        {myRank === 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-chalk/60">ฉายาปัจจุบันของคุณ</span>
            <ChampionTitle size="md" />
          </div>
        )}
      </div>

      <LeaderboardTable entries={entries} />
    </div>
  );
};
