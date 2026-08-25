/**
 * แถวแดชบอร์ดด้านล่างของหน้า MY TEAM — เหลือแค่ Live แชท
 *
 * เดิมมี 4 การ์ด (แชท, คลังการ์ด, จับคู่, ตารางอันดับ) แต่สามใบหลังมีเมนูหลัก
 * ของตัวเองอยู่แล้ว จึงถอดออกไปให้สนามด้านบนได้ที่มากขึ้น
 * ส่วนแผงจับคู่ย้ายไปเป็นเมนู MATCHMAKING เต็มหน้า
 *
 * แชทซ่อนได้ด้วยปุ่ม ✕ มุมขวาบน แล้วเรียกกลับจากปุ่มที่ขึ้นแทน
 * ตัวเลือกถูกจำไว้ในเครื่อง (ดู useDashboardPanels)
 */
import { LiveChatPanel } from '@/components/chat/LiveChatPanel';
import { DashboardSlot } from '@/components/layout/DashboardSlot';
import type { useDashboardPanels } from '@/hooks/useDashboardPanels';
import { playSfx } from '@/services/sound';

interface BottomDashboardProps {
  /** สถานะซ่อน/แสดง ส่งมาจากหน้า MY TEAM เพื่อให้ใช้ชุดเดียวกับแผงขวา */
  panels: ReturnType<typeof useDashboardPanels>;
}

export const BottomDashboard = ({ panels }: BottomDashboardProps) => {
  const { isVisible, toggle, hide } = panels;

  // shrink-0: แถวนี้ห้ามถูกบีบ และห้ามดันสนามด้านบน
  if (!isVisible('chat')) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            toggle('chat');
          }}
          className="w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold uppercase tracking-wider text-chalk/45 transition-colors hover:border-neon/40 hover:text-neon"
        >
          ○ แสดง Live แชท
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <DashboardSlot label="Live แชท" onHide={() => hide('chat')}>
        {/* แชทอ่านทุกอย่างจากฮุกของตัวเองแล้ว จึงไม่ต้องส่ง props */}
        <LiveChatPanel />
      </DashboardSlot>
    </div>
  );
};
