/**
 * ตารางค่าพลัง 6 ด้านของนักเตะหนึ่งคน
 *
 * แยกออกมาเป็นคอมโพเนนต์กลางเพราะถูกใช้หลายที่ (รายละเอียดการ์ด · เลือกตัวจริงในสนาม)
 * และกติกาเพดานรายด้านอยู่ใน data/positionProfile.ts ที่เดียว
 * ถ้าปล่อยให้แต่ละหน้าคำนวณเอง เลขบนจอจะเริ่มไม่ตรงกันทันทีที่แก้สูตร
 */
import { getStatCeiling } from '@/data/positionProfile';
import { getLevelBonus } from '@/services/upgrade';
import type { Player } from '@/types/player';
import { cn } from '@/utils/helpers';

const STATS = [
  ['PAC', 'pace'],
  ['SHO', 'shooting'],
  ['PAS', 'passing'],
  ['DRI', 'dribbling'],
  ['DEF', 'defending'],
  ['PHY', 'physical'],
] as const;

interface PlayerStatsGridProps {
  player: Player;
  /** เลเวลของการ์ด (1 = +0) — ไม่ใส่ = ค่าพลังพื้นฐานล้วน */
  level?: number;
  /** แสดงบรรทัด "สูงสุด N" ใต้ตัวเลขไหม */
  showCeiling?: boolean;
  className?: string;
}

export const PlayerStatsGrid = ({
  player,
  level = 1,
  showCeiling = true,
  className,
}: PlayerStatsGridProps) => {
  const bonus = getLevelBonus(level);

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {STATS.map(([label, key]) => {
        // เพดานต่างกันรายด้านตามตำแหน่ง ไม่ใช่ 99 เท่ากันหมด
        const ceiling = getStatCeiling(player.position, key);
        const value = Math.min(ceiling, player.stats[key] + bonus);

        return (
          <div key={label} className="rounded-lg bg-ink-700/40 px-2 py-1.5 text-center">
            <p className="eyebrow">{label}</p>
            <p
              className={cn(
                'font-display text-lg leading-none',
                // ด้านที่ดันจนทะลุเพดานเดิมของเกม ให้เห็นว่าพิเศษ
                value > 99 && 'text-neon',
              )}
            >
              {value}
            </p>
            {showCeiling && (
              <p className="font-mono text-[9px] text-chalk/30">สูงสุด {ceiling}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
