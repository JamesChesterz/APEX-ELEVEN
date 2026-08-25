/**
 * แถวแดชบอร์ดด้านล่างของหน้า MY TEAM
 * 4 การ์ด: Live แชท, คลังการ์ด, จับคู่แข่งขัน, ตารางอันดับ
 *
 * ทุกใบซ่อนได้ด้วยปุ่ม ✕ มุมขวาบน แล้วเรียกกลับมาจากแถบปุ่มด้านบน
 * (ซ่อนไว้เพื่อให้สนามด้านบนมีที่หายใจมากขึ้น โดยเฉพาะบนจอเล็ก)
 * ตัวเลือกถูกจำไว้ในเครื่อง เปิดใหม่ก็ยังเป็นแบบเดิม
 */
import { LiveChatPanel } from '@/components/chat/LiveChatPanel';
import { DashboardSlot } from '@/components/layout/DashboardSlot';
import { PanelToggleBar } from '@/components/layout/PanelToggleBar';
import { LeaderboardWidget } from '@/components/leaderboard/LeaderboardWidget';
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { MyCardsWidget } from '@/components/player/MyCardsWidget';
import { DASHBOARD_PANELS, useDashboardPanels } from '@/hooks/useDashboardPanels';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import type { LeaderboardEntry } from '@/types/match';

interface BottomDashboardProps {
  /** ตารางอันดับทั้งหมด — วิดเจ็ตตัด 3 อันดับแรกมาแสดงเอง */
  leaders: LeaderboardEntry[];
  /** สถานะซ่อน/แสดง ส่งมาจากหน้า MY TEAM เพื่อให้ใช้ชุดเดียวกับแผงขวา */
  panels: ReturnType<typeof useDashboardPanels>;
}

/** id ของกลุ่มนี้ ใช้กับปุ่มซ่อน/แสดงทั้งกลุ่ม */
const IDS = DASHBOARD_PANELS.map((panel) => panel.id);

export const BottomDashboard = ({ leaders, panels }: BottomDashboardProps) => {
  const { isVisible, toggle, hide, showGroup, hideGroup, visibleIn } = panels;
  const { state } = useMatchmaking();

  /**
   * กำลังหาคู่/แข่งอยู่ = ห้ามซ่อนแผงจับคู่ ไม่งั้นจะดูแมตช์ตัวเองไม่ได้
   * และถ้าซ่อนไว้ก่อนหน้านี้ ก็ดึงกลับมาโชว์ชั่วคราวจนกว่าแมตช์จะจบ
   */
  const matchRunning = state.status !== 'idle';
  const showMatchmaking = isVisible('matchmaking') || matchRunning;

  return (
    // shrink-0: แถวนี้ห้ามถูกบีบ และห้ามดันสนามด้านบน — แต่ละการ์ดคุมความสูงของตัวเอง
    <div className="shrink-0 space-y-2">
      <PanelToggleBar
        panels={DASHBOARD_PANELS}
        isVisible={(id) => (id === 'matchmaking' ? showMatchmaking : isVisible(id))}
        onToggle={toggle}
        onShowAll={() => showGroup(IDS)}
        onHideAll={() => hideGroup(IDS)}
        visibleCount={visibleIn(IDS)}
        locked={matchRunning ? { matchmaking: 'กำลังแข่งอยู่ ซ่อนไม่ได้' } : undefined}
      />

      {visibleIn(IDS) === 0 && (
        <p className="py-2 text-center text-xs text-chalk/35">
          ซ่อนไว้ทั้งหมด — กดปุ่มด้านบนเพื่อเรียกกลับมา
        </p>
      )}

      {/* ── การ์ด ── */}
      <div className="grid items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {isVisible('chat') && (
          <DashboardSlot label="Live แชท" onHide={() => hide('chat')}>
            {/* แชทอ่านทุกอย่างจากฮุกของตัวเองแล้ว จึงไม่ต้องส่ง props */}
            <LiveChatPanel />
          </DashboardSlot>
        )}

        {isVisible('inventory') && (
          <DashboardSlot label="Inventory" onHide={() => hide('inventory')}>
            <MyCardsWidget />
          </DashboardSlot>
        )}

        {showMatchmaking && (
          <DashboardSlot
            label="Matchmaking"
            lockedReason={matchRunning ? 'กำลังแข่งอยู่ ซ่อนไม่ได้' : undefined}
            onHide={() => hide('matchmaking')}
          >
            {/* แผงนี้อ่านสถานะจาก MatchmakingProvider เองแล้ว จึงไม่ต้องส่ง props */}
            <MatchmakingPanel compact />
          </DashboardSlot>
        )}

        {isVisible('leaderboard') && (
          <DashboardSlot label="Leaderboard" onHide={() => hide('leaderboard')}>
            <LeaderboardWidget entries={leaders} />
          </DashboardSlot>
        )}
      </div>
    </div>
  );
};
