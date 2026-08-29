/**
 * ป้ายใต้การ์ดบนสนาม — ชื่อ / OVR / ตำแหน่ง (เรียงจากบนลงล่าง)
 *
 * ใช้ร่วมกันทั้งหน้า MY TEAM และสนาม Matchmaking เพื่อให้ตัวเลขที่ผู้เล่นเห็นตรงกันเป๊ะ
 * ถ้าปล่อยให้สองหน้าคำนวณเอง สุดท้ายจะหลุดกันจนผู้เล่นสับสนว่าอันไหนจริง
 *
 * เลข OVR ที่โชว์คือ "ค่าพลังรวมทุกอย่างแล้ว" — ค่าพื้นฐาน + โบนัสตีบวก ± ค่าปรับตำแหน่ง
 * ตัวเลขจึงขยับจริงเมื่อย้ายนักเตะไปยืนผิดตำแหน่ง และเป็นเลขเดียวกับที่ใช้คิด Team OVR
 * (ยกเว้นโบนัสเคมี ซึ่งเป็นของทั้งทีมไม่ใช่ของรายคน)
 */
import { getPlus, MAX_PLUS } from '@/services/upgrade';
import { effectiveOvrOf } from '@/services/teamRating';
import type { Player, Position } from '@/types/player';
import { cn, lastName } from '@/utils/helpers';

interface SlotNameplateProps {
  player: Player | null;
  /** ตำแหน่งของช่องที่เขายืนอยู่ — ใช้คิดค่าปรับผิดตำแหน่ง */
  slotPosition: Position;
  /** ป้ายตำแหน่งที่จะโชว์ เช่น LCB, RDM (ไม่ใส่ = ใช้ slotPosition) */
  label?: string;
  /** เลเวลการ์ด (1 = +0) — ตีบวกจนสุดแล้วชื่อจะเป็นสีรุ้งวิ่ง */
  level?: number;
  /** ฝั่งของทีม ใช้เลือกสีป้ายตำแหน่ง */
  side?: 'home' | 'away';
  /** true = ย่อชื่อเหลือนามสกุล (สนามแข่งที่พื้นที่แคบ) */
  compact?: boolean;
  className?: string;
}

export const SlotNameplate = ({
  player,
  slotPosition,
  label,
  level,
  side = 'home',
  compact = false,
  className,
}: SlotNameplateProps) => {
  const ovr = effectiveOvrOf(player, slotPosition);
  /** ตีบวกจนสุดแล้ว = ให้ชื่อเป็นสีรุ้งวิ่ง เห็นแต่ไกลว่าใบนี้สุดแล้ว */
  const maxed = level !== undefined && getPlus(level) >= MAX_PLUS;

  return (
    <span
      className={cn(
        'flex flex-col items-center gap-[1px] rounded-[4px] bg-[#0B0F15]/95 px-1.5 py-[3px] leading-none ring-1 ring-white/10',
        compact ? 'max-w-[104px]' : 'max-w-[96px]',
        className,
      )}
    >
      {/* ชื่อ */}
      <span
        className={cn(
          'w-full truncate text-center font-bold',
          compact ? 'text-[9px]' : 'text-[10px]',
          maxed ? 'name-rgb' : 'text-chalk/90',
        )}
        title={player?.name}
      >
        {player ? (compact ? lastName(player.name) : player.name) : '—'}
      </span>

      {/* OVR รวมแล้ว */}
      <span
        className={cn(
          'font-mono font-bold tabular-nums text-gold',
          compact ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        OVR {player ? ovr : '—'}
      </span>

      {/* ตำแหน่งของช่อง */}
      <span
        className={cn(
          'font-mono font-bold uppercase tracking-wider',
          compact ? 'text-[8px]' : 'text-[9px]',
          side === 'home' ? 'text-neon' : 'text-[#5AA9F0]',
        )}
      >
        {label ?? slotPosition}
      </span>
    </span>
  );
};
