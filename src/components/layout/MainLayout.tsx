/**
 * เลย์เอาต์หลัก: พื้นหลังสนามกีฬา + Sidebar ซ้าย + Header บน + พื้นที่เนื้อหา
 * ทุกหน้าใน pages/ ถูก render ผ่าน <Outlet /> ตรงกลาง
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/header/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { DailyRewardModal } from '@/components/league/DailyRewardModal';
import { SeasonSummaryModal } from '@/components/season/SeasonSummaryModal';
import { getPageTitle } from '@/components/sidebar/navItems';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { usePlayers } from '@/hooks/usePlayers';
import { useLeague } from '@/hooks/useLeague';
import { useSeason } from '@/hooks/useSeason';
import { useTeam } from '@/hooks/useTeam';
import { useMyRank } from '@/hooks/useLeaderboard';

export const MainLayout = () => {
  const { pathname } = useLocation();
  const { account, logout } = useAuth();
  const { coins, points, upgradePoints } = usePlayers();
  const { record } = useMatchmaking();
  const { team } = useTeam();
  const { summary, claim } = useSeason();
  const { summary: dailySummary, claimDaily } = useLeague();

  /** อยู่อันดับ 1 ของตารางไหม — ใช้ตัดสินว่าจะโชว์ฉายา 1ST CHAMPION หรือป้ายระดับปกติ */
  const isChampion = useMyRank() === 1;

  return (
    <div className="stadium-bg flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={getPageTitle(pathname)}
          coins={coins}
          points={points}
          upgradePoints={upgradePoints}
          rankPoints={record.points}
          isChampion={isChampion}
          username={account?.username ?? 'ผู้เล่น'}
          teamName={team.name}
          onLogout={logout}
        />

        <main className="flex-1 overflow-y-auto p-3 lg:p-4">
          <Outlet />
        </main>

        <MobileNav />
      </div>

      {/* จบซีซันแล้วต้องกดรับรางวัลก่อนถึงจะเล่นต่อได้ (มาก่อนรางวัลรายวัน) */}
      {summary ? (
        <SeasonSummaryModal summary={summary} onClaim={claim} />
      ) : (
        dailySummary && <DailyRewardModal summary={dailySummary} onClaim={claimDaily} />
      )}
    </div>
  );
};
