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
import { LeaderboardWidget } from '@/components/leaderboard/LeaderboardWidget';
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { MyCardsWidget } from '@/components/player/MyCardsWidget';
import { DASHBOARD_PANELS, useDashboardPanels } from '@/hooks/useDashboardPanels';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { playSfx } from '@/services/sound';
import type { LeaderboardEntry } from '@/types/match';
import { cn } from '@/utils/helpers';

interface BottomDashboardProps {
  /** ตารางอันดับทั้งหมด — วิดเจ็ตตัด 3 อันดับแรกมาแสดงเอง */
  leaders: LeaderboardEntry[];
}

export const BottomDashboard = ({ leaders }: BottomDashboardProps) => {
  const { hidden, visibleCount, isVisible, toggle, hide, showAll, hideAll } = useDashboardPanels();
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
      {/* ── แถบเปิด/ปิดการ์ด ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DASHBOARD_PANELS.map((panel) => {
          const shown = panel.id === 'matchmaking' ? showMatchmaking : isVisible(panel.id);
          const locked = panel.id === 'matchmaking' && matchRunning;

          return (
            <button
              key={panel.id}
              type="button"
              disabled={locked}
              title={locked ? 'กำลังแข่งอยู่ ซ่อนไม่ได้' : undefined}
              onClick={() => {
                playSfx('click');
                toggle(panel.id);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                shown
                  ? 'bg-white/10 text-chalk/80 hover:text-chalk'
                  : 'bg-transparent text-chalk/35 ring-1 ring-inset ring-white/10 hover:text-chalk/60',
                locked && 'cursor-not-allowed opacity-50',
              )}
            >
              {shown ? '●' : '○'} {panel.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            if (visibleCount === 0) showAll();
            else hideAll();
          }}
          className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk/45 transition-colors hover:text-chalk"
        >
          {visibleCount === 0 ? 'แสดงทั้งหมด' : 'ซ่อนทั้งหมด'}
        </button>
      </div>

      {hidden.length > 0 && visibleCount === 0 && (
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
