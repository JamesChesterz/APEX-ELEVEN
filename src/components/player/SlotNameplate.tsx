/**
 * ป้ายใต้การ์ดบนสนาม — ชื่อ กับ ตำแหน่ง เท่านั้น
 *
 * ใช้ร่วมกันทั้งหน้า MY TEAM และสนาม Matchmaking เพื่อให้สองหน้าหน้าตาตรงกัน
 *
 * ไม่มีพื้นหลัง — ตัวอักษรลอยอยู่บนสนามตรง ๆ
 * จึงต้องพึ่งเงาดำใต้ตัวอักษร (.pitch-label) ให้อ่านออกทั้งบนหญ้าสว่างและพื้นมืด
 * ถ้าใช้แค่สีตัวอักษรอย่างเดียว ชื่อจะจมหายไปกับลายหญ้าในบางจุดของสนาม
 */
import type { Player, Position } from '@/types/player';
import { cn, lastName } from '@/utils/helpers';

interface SlotNameplateProps {
  player: Player | null;
  /** ตำแหน่งของช่องที่เขายืนอยู่ (ใช้เป็นป้ายเมื่อไม่ได้ส่ง label มา) */
  slotPosition: Position;
  /** ป้ายตำแหน่งที่จะโชว์ เช่น LCB, RDM (ไม่ใส่ = ใช้ slotPosition) */
  label?: string;
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
  side = 'home',
  compact = false,
  className,
}: SlotNameplateProps) => (
  <span
    className={cn(
      'pitch-label flex max-w-[104px] flex-col items-center gap-[1px] leading-none',
      className,
    )}
  >
    {/* ชื่อ */}
    <span
      className={cn(
        'w-full truncate text-center font-bold text-white',
        compact ? 'text-[9px]' : 'text-[10px]',
      )}
      title={player?.name}
    >
      {player ? (compact ? lastName(player.name) : player.name) : '—'}
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
