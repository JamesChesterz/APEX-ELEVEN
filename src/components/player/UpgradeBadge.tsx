/**
 * ป้ายค่าตีบวก — กล่องสี่เหลี่ยมโชว์ตัวเลขล้วน (ไม่มีเครื่องหมาย +)
 *
 * แยกออกมาเป็นคอมโพเนนต์เดียวเพราะป้ายนี้โผล่หลายที่ (บนการ์ด, ลิสต์เลือกตัวสำรอง,
 * รายการการ์ดซ้ำ) ถ้าปล่อยให้ก๊อปสไตล์ไปวางทีละที่ พอแก้สีทีเดียวจะลืมแก้ให้ครบ
 *
 * ระดับสีบอกความหายากของใบนั้นตั้งแต่มองไกล ๆ:
 *   +1 ถึง +5  เงิน
 *   +6 ขึ้นไป  ทอง
 */
import { getPlus } from '@/services/upgrade';
import { cn } from '@/utils/helpers';

/** ขั้นสูงสุดที่ยังใช้สีเงิน — เกินจากนี้ขึ้นเป็นทอง */
const SILVER_MAX_PLUS = 5;

interface UpgradeBadgeProps {
  /** เลเวลของการ์ด (level 1 = +0) — ป้ายจะไม่โผล่เลยถ้ายังไม่ได้ตีบวก */
  level: number | undefined;
  /** ป้ายเล็กพิเศษสำหรับการ์ดขนาด xs และลิสต์ */
  compact?: boolean;
  /** ใช้วางตำแหน่ง เช่น absolute บนการ์ด */
  className?: string;
}

export const UpgradeBadge = ({ level, compact = false, className }: UpgradeBadgeProps) => {
  if (level === undefined) return null;

  const plus = getPlus(level);
  if (plus <= 0) return null;

  /** +6 ขึ้นไปเป็นทอง */
  const golden = plus > SILVER_MAX_PLUS;

  return (
    <span
      /* บอกความหมายให้โปรแกรมอ่านหน้าจอ — เลขลอย ๆ บนการ์ดไม่สื่ออะไรเลย */
      aria-label={`ตีบวก +${plus}`}
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-md border border-black/45',
        'font-display leading-none text-ink-900 shadow-card',
        compact ? 'h-4 min-w-4 text-[10px]' : 'h-5 min-w-5 text-xs',
        golden ? 'bg-gold px-1' : 'bg-silver px-1',
        className,
      )}
    >
      {plus}
    </span>
  );
};
