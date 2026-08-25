/**
 * หน้า MY TEAM — หน้าจอหลักของเกม
 * โครง: สนามตรงกลาง + คอลัมน์การ์ดด้านขวา (ซ่อนได้ทีละใบ)
 */
import { FootballPitch } from '@/components/pitch/FootballPitch';
import { RightPanel } from '@/components/layout/RightPanel';
import { useDashboardPanels } from '@/hooks/useDashboardPanels';
import { useTeam } from '@/hooks/useTeam';

export const MyTeamPage = () => {
  const { team, rating } = useTeam();

  /** สถานะซ่อน/แสดงการ์ดในคอลัมน์ขวา (จำไว้ในเครื่อง) */
  const panels = useDashboardPanels();

  return (
    <div className="flex h-full min-h-[720px] flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <div className="min-h-[460px] flex-1">
          <FootballPitch squadName={team.name} />
        </div>

        <RightPanel rating={rating} panels={panels} />
      </div>
    </div>
  );
};
