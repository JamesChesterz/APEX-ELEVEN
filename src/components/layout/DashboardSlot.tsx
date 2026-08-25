/**
 * กรอบครอบการ์ดหนึ่งใบในแดชบอร์ด — เพิ่มปุ่มซ่อนให้โดยไม่ต้องแก้ตัวการ์ดเอง
 *
 * ปุ่มลอยอยู่มุมขวาบน เยื้องออกนอกกรอบเล็กน้อยให้ไปอยู่ในช่องว่างระหว่างการ์ด
 * จึงไม่บังเนื้อหาของการ์ดใบไหนเลย (บางใบมีตัวเลขมุมขวาบนอยู่แล้ว)
 */
import type { ReactNode } from 'react';
import { playSfx } from '@/services/sound';

interface DashboardSlotProps {
  /** ชื่อการ์ด ใช้บอกผู้ใช้ว่ากดแล้วซ่อนอะไร */
  label: string;
  children: ReactNode;
  /** ซ่อนไม่ได้ตอนนี้ (เช่นกำลังแข่งอยู่) พร้อมเหตุผลที่จะขึ้นตอนเอาเมาส์ชี้ */
  lockedReason?: string;
  onHide: () => void;
}

export const DashboardSlot = ({ label, children, lockedReason, onHide }: DashboardSlotProps) => (
  <div className="relative">
    {children}

    <button
      type="button"
      disabled={Boolean(lockedReason)}
      title={lockedReason ?? `ซ่อน ${label}`}
      aria-label={lockedReason ?? `ซ่อน ${label}`}
      onClick={() => {
        playSfx('click');
        onHide();
      }}
      className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-ink-800 text-xs text-chalk/50 shadow transition-colors hover:border-[#F0A070]/60 hover:text-[#F0A070] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-chalk/50"
    >
      ✕
    </button>
  </div>
);
