/**
 * แถบปุ่มเปิด/ปิดการ์ดหนึ่งกลุ่ม (แผงสรุปทีมด้านขวา หรือแดชบอร์ดแถวล่าง)
 *
 * จุดทึบ = กำลังแสดง · จุดกลวง = ซ่อนอยู่
 * ปุ่มขวาสุดสลับระหว่างซ่อนทั้งกลุ่ม/แสดงทั้งกลุ่ม
 */
import type { DashboardPanelId } from '@/hooks/useDashboardPanels';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

interface PanelToggleBarProps {
  /** การ์ดในกลุ่มนี้ */
  panels: ReadonlyArray<{ id: DashboardPanelId; label: string }>;
  isVisible: (id: DashboardPanelId) => boolean;
  onToggle: (id: DashboardPanelId) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  /** จำนวนใบที่ยังแสดงอยู่ในกลุ่ม */
  visibleCount: number;
  /** id ที่ซ่อนไม่ได้ตอนนี้ พร้อมเหตุผล */
  locked?: Partial<Record<DashboardPanelId, string>>;
  className?: string;
}

export const PanelToggleBar = ({
  panels,
  isVisible,
  onToggle,
  onShowAll,
  onHideAll,
  visibleCount,
  locked,
  className,
}: PanelToggleBarProps) => (
  <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
    {panels.map((panel) => {
      const shown = isVisible(panel.id);
      const lockedReason = locked?.[panel.id];

      return (
        <button
          key={panel.id}
          type="button"
          disabled={Boolean(lockedReason)}
          title={lockedReason}
          onClick={() => {
            playSfx('click');
            onToggle(panel.id);
          }}
          className={cn(
            'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
            shown
              ? 'bg-white/10 text-chalk/80 hover:text-chalk'
              : 'bg-transparent text-chalk/35 ring-1 ring-inset ring-white/10 hover:text-chalk/60',
            lockedReason && 'cursor-not-allowed opacity-50',
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
        if (visibleCount === 0) onShowAll();
        else onHideAll();
      }}
      className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/45 transition-colors hover:text-chalk"
    >
      {visibleCount === 0 ? 'แสดงทั้งหมด' : 'ซ่อนทั้งหมด'}
    </button>
  </div>
);
