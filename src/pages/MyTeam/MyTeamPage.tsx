/**
 * หน้า MY TEAM — หน้าจอหลักของเกม
 * โครง: สนามตรงกลาง + แผงข้อมูลขวา + แดชบอร์ดล่าง
 */
import { BottomDashboard } from '@/components/layout/BottomDashboard';
import { FootballPitch } from '@/components/pitch/FootballPitch';
import { RightPanel } from '@/components/layout/RightPanel';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useTeam } from '@/hooks/useTeam';

export const MyTeamPage = () => {
  const { team, rating } = useTeam();
  const leaders = useLeaderboard();

  return (
    <div className="flex h-full min-h-[720px] flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <div className="min-h-[460px] flex-1">
          <FootballPitch squadName={team.name} />
        </div>

        <RightPanel rating={rating} />
      </div>

      <BottomDashboard leaders={leaders} />
    </div>
  );
};
