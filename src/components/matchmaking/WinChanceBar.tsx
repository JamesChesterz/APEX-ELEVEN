/**
 * แถบแสดงโอกาส ชนะ / เสมอ / แพ้ ที่คำนวณจากผลต่าง OVR ของสองทีม
 * ใช้ทั้งในแผงขวาและในรายการคู่แข่งของหน้า Match
 */
import type { MatchOdds } from '@/types/match';
import { cn } from '@/utils/helpers';

interface WinChanceBarProps {
  odds: MatchOdds;
  /** ซ่อนตัวเลขกำกับ ใช้เวลาพื้นที่แคบ */
  compact?: boolean;
  className?: string;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export const WinChanceBar = ({ odds, compact = false, className }: WinChanceBarProps) => (
  <div className={className}>
    {!compact && (
      <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider">
        <span className="text-neon">ชนะ {percent(odds.win)}</span>
        <span className="text-chalk/40">เสมอ {percent(odds.draw)}</span>
        <span className="text-[#F07070]">แพ้ {percent(odds.loss)}</span>
      </div>
    )}

    <div
      className={cn('flex overflow-hidden rounded-full bg-ink-600', compact ? 'h-1.5' : 'h-2')}
      role="img"
      aria-label={`โอกาสชนะ ${percent(odds.win)} เสมอ ${percent(odds.draw)} แพ้ ${percent(odds.loss)}`}
    >
      <span className="bg-neon" style={{ width: percent(odds.win) }} />
      <span className="bg-chalk/25" style={{ width: percent(odds.draw) }} />
      <span className="bg-[#D93A3A]" style={{ width: percent(odds.loss) }} />
    </div>
  </div>
);
