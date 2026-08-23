/**
 * คอลัมน์ข้อมูลด้านขวาของหน้า MY TEAM
 * เหลือเฉพาะสรุปทีม: Team OVR, Chemistry, มูลค่าทีม, สรุปการตีบวก
 * (แผงจับคู่ย้ายลงไปอยู่แถวแดชบอร์ดล่างแล้ว เพื่อไม่ให้ล้นจอที่ซูม 100%)
 */
import { ChemistryPanel } from '@/components/team/ChemistryPanel';
import { TeamOvrPanel } from '@/components/team/TeamOvrPanel';
import { UpgradePanel } from '@/components/team/UpgradePanel';
import { TeamValuePanel } from '@/components/team/TeamValuePanel';
import type { TeamRating } from '@/types/team';

interface RightPanelProps {
  rating: TeamRating;
}

export const RightPanel = ({ rating }: RightPanelProps) => (
  <aside className="flex w-full flex-col gap-3 xl:w-[300px] xl:shrink-0">
    <TeamOvrPanel rating={rating} />
    <ChemistryPanel
      chemistry={rating.chemistry}
      maxChemistry={rating.maxChemistry}
      bonus={rating.chemistryBonus}
    />
    <TeamValuePanel value={rating.value} />
    <UpgradePanel />
  </aside>
);
