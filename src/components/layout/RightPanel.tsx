/**
 * คอลัมน์ข้อมูลด้านขวาของหน้า MY TEAM
 * สรุปทีม: Team OVR, Chemistry, มูลค่าทีม, สรุปการตีบวก
 * (แผงจับคู่ย้ายลงไปอยู่แถวแดชบอร์ดล่างแล้ว เพื่อไม่ให้ล้นจอที่ซูม 100%)
 *
 * ทุกใบซ่อนได้ด้วยปุ่ม ✕ มุมขวาบน แล้วเรียกกลับจากแถบปุ่มด้านบน
 * ตัวเลือกถูกจำไว้ในเครื่อง (ดู useDashboardPanels)
 */
import { DashboardSlot } from '@/components/layout/DashboardSlot';
import { PanelToggleBar } from '@/components/layout/PanelToggleBar';
import { ChemistryPanel } from '@/components/team/ChemistryPanel';
import { TeamOvrPanel } from '@/components/team/TeamOvrPanel';
import { UpgradePanel } from '@/components/team/UpgradePanel';
import { TeamValuePanel } from '@/components/team/TeamValuePanel';
import { SIDE_PANELS, type useDashboardPanels } from '@/hooks/useDashboardPanels';
import type { TeamRating } from '@/types/team';

interface RightPanelProps {
  rating: TeamRating;
  /** สถานะซ่อน/แสดง ส่งมาจากหน้า MY TEAM เพื่อให้ใช้ชุดเดียวกับแดชบอร์ดล่าง */
  panels: ReturnType<typeof useDashboardPanels>;
}

/** id ของกลุ่มนี้ ใช้กับปุ่มซ่อน/แสดงทั้งกลุ่ม */
const IDS = SIDE_PANELS.map((panel) => panel.id);

export const RightPanel = ({ rating, panels }: RightPanelProps) => {
  const { isVisible, toggle, hide, showGroup, hideGroup, visibleIn } = panels;

  return (
    <aside className="flex w-full flex-col gap-2 xl:w-[300px] xl:shrink-0">
      <PanelToggleBar
        panels={SIDE_PANELS}
        isVisible={isVisible}
        onToggle={toggle}
        onShowAll={() => showGroup(IDS)}
        onHideAll={() => hideGroup(IDS)}
        visibleCount={visibleIn(IDS)}
      />

      <div className="flex flex-col gap-3">
        {isVisible('teamOvr') && (
          <DashboardSlot label="Team OVR" onHide={() => hide('teamOvr')}>
            <TeamOvrPanel rating={rating} />
          </DashboardSlot>
        )}

        {isVisible('chemistry') && (
          <DashboardSlot label="Chemistry" onHide={() => hide('chemistry')}>
            <ChemistryPanel
              chemistry={rating.chemistry}
              maxChemistry={rating.maxChemistry}
              bonus={rating.chemistryBonus}
            />
          </DashboardSlot>
        )}

        {isVisible('teamValue') && (
          <DashboardSlot label="Total Value" onHide={() => hide('teamValue')}>
            <TeamValuePanel value={rating.value} />
          </DashboardSlot>
        )}

        {isVisible('upgrade') && (
          <DashboardSlot label="Upgrade" onHide={() => hide('upgrade')}>
            <UpgradePanel />
          </DashboardSlot>
        )}
      </div>
    </aside>
  );
};
