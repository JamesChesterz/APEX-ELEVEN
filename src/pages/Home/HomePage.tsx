/** หน้าแรก: ประกาศอัปเดตล่าสุด, การ์ดใหม่ล่าสุด และ Leaderboard */
import { LeaderboardPodium } from '@/components/home/LeaderboardPodium';
import { NewCardsRow } from '@/components/home/NewCardsRow';
import { NewsFeedPanel } from '@/components/home/NewsFeedPanel';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useLeaderboard } from '@/hooks/useLeaderboard';

export const HomePage = () => {
  const { news, featuredCards } = useGameConfig();
  const leaderboard = useLeaderboard();

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
      <div className="space-y-4">
        <NewsFeedPanel news={news} />
        <NewCardsRow cardIds={featuredCards} />
      </div>

      <LeaderboardPodium entries={leaderboard} />
    </div>
  );
};
