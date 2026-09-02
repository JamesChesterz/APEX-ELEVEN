/**
 * ป้ายค่าตีบวก — กล่องสี่เหลี่ยมโชว์ตัวเลขล้วน (ไม่มีเครื่องหมาย +)
 *
 * แยกออกมาเป็นคอมโพเนนต์เดียวเพราะป้ายนี้โผล่หลายที่ (บนการ์ด, ลิสต์เลือกตัวสำรอง,
 * รายการการ์ดซ้ำ) ถ้าปล่อยให้ก๊อปสไตล์ไปวางทีละที่ พอแก้สีทีเดียวจะลืมแก้ให้ครบ
 *
 * ระดับสีบอกความหายากของใบนั้นตั้งแต่มองไกล ๆ:
 *   +1 ถึง +5  เงิน
 *   +6 ถึง +7  ทอง
 *   +8         ทอง + แสงทองเข้มวิ่งวนรอบกรอบ
 */
import { MAX_PLUS, getPlus } from '@/services/upgrade';
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

  const maxed = plus >= MAX_PLUS;
  /** +6 ขึ้นไปเป็นทอง (รวมใบที่ตันแล้วด้วย) */
  const golden = plus > SILVER_MAX_PLUS;

  return (
    <span
      /* บอกความหมายให้โปรแกรมอ่านหน้าจอ — เลขลอย ๆ บนการ์ดไม่สื่ออะไรเลย */
      aria-label={`ตีบวก +${plus}`}
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-md border border-black/45',
        'font-display leading-none text-ink-900 shadow-card',
        compact ? 'h-4 min-w-4 text-[10px]' : 'h-5 min-w-5 text-xs',
        maxed
          ? 'animate-max-glow bg-gold p-[2px] shadow-[0_0_12px_rgba(245,185,62,0.9)]'
          : golden
            ? 'bg-gold px-1'
            : 'bg-silver px-1',
        className,
      )}
    >
      {maxed ? (
        <>
          {/*
            แสงทองเข้มวิ่งวนรอบกรอบ
            เลเยอร์ conic-gradient หมุนอยู่ข้างหลัง แล้วพื้นทองทึบทับตรงกลางไว้
            เหลือให้เห็นเฉพาะขอบ 2px = แสงวิ่งรอบเลข
          */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[280%] w-[280%] animate-max-halo bg-[conic-gradient(from_0deg,transparent_0deg,transparent_195deg,rgba(122,74,0,0.55)_240deg,#7A4A00_285deg,#C97A00_315deg,#FFB020_338deg,#C97A00_352deg,transparent_360deg)]"
          />
          <span className="relative flex h-full w-full items-center justify-center rounded-[3px] bg-gold px-1">
            {plus}
          </span>
        </>
      ) : (
        plus
      )}
    </span>
  );
};
