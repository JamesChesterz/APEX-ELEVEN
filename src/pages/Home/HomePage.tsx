/** หน้าแรก: ประกาศอัปเดตล่าสุด, การ์ดใหม่, อันดับผู้เล่น, สรุปทีม และทางลัดไปหน้าอื่น */
import { Link } from 'react-router-dom';
import { LeaderboardPodium } from '@/components/home/LeaderboardPodium';
import { NewCardsRow } from '@/components/home/NewCardsRow';
import { NewsFeedPanel } from '@/components/home/NewsFeedPanel';
import { MissionList } from '@/components/missions/MissionList';
import { TeamOvrPanel } from '@/components/team/TeamOvrPanel';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';

const SHORTCUTS = [
  { to: '/my-team', label: 'จัดทีม', hint: 'สลับตัวจริงและเปลี่ยนแผน' },
  { to: '/card-pack', label: 'เปิดซองการ์ด', hint: 'เติมนักเตะใหม่' },
  { to: '/match', label: 'หาคู่แข่ง', hint: 'ลงแข่งเก็บเหรียญ' },
];

export const HomePage = () => {
  const { rating, formation } = useTeam();
  const { missions } = usePlayers();
  const { news, featuredCards } = useGameConfig();
  const leaderboard = useLeaderboard();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <TeamOvrPanel rating={rating} />

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className="panel flex flex-col justify-between p-5 transition-colors hover:border-kit/40"
            >
              <span className="font-display text-xl">{shortcut.label}</span>
              <span className="mt-2 text-xs text-chalk/45">{shortcut.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-4">
          <NewsFeedPanel news={news} />
          <NewCardsRow cardIds={featuredCards} />
        </div>

        <LeaderboardPodium entries={leaderboard} />
      </section>

      <section>
        <p className="eyebrow">แผนปัจจุบัน</p>
        <p className="text-sm text-chalk/60">
          {formation.name} — {formation.description}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Missions</h2>
        <MissionList missions={missions} />
      </section>
    </div>
  );
};
