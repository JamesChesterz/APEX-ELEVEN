/**
 * หน้าจอถ่ายทอดสดระหว่างแข่ง: นาฬิกา + สกอร์สด + ไทม์ไลน์ประตู
 *
 * ข้อมูลทั้งหมดมาจาก live ใน useMatchmaking ซึ่งเปิดเผยประตูทีละนาทีตามไทม์ไลน์
 * ที่สุ่มไว้ตั้งแต่ตอนเขี่ยบอล — ตัวคอมโพเนนต์นี้ทำหน้าที่แสดงผลอย่างเดียว
 *
 * ความสูงของแผงนี้ถูกล็อกไว้ (ไทม์ไลน์ประตูเลื่อนดูข้างในแทนการงอกลงล่าง)
 * เพราะถ้าปล่อยให้สูงตามจำนวนประตู แผงแม่จะดันเลย์เอาต์รอบ ๆ ทุกครั้งที่มีสกอร์
 */
import { MATCH_MINUTES } from '@/services/matchmaking';
import type { LiveMatch } from '@/types/match';
import { cn } from '@/utils/helpers';

interface LiveMatchPanelProps {
  live: LiveMatch;
  teamName: string;
  opponentName: string;
  /** true = จบเกมแล้ว (หยุดกะพริบและซ่อนปุ่มข้าม) */
  finished?: boolean;
  onSkip?: () => void;
  className?: string;
}

export const LiveMatchPanel = ({
  live,
  teamName,
  opponentName,
  finished = false,
  onSkip,
  className,
}: LiveMatchPanelProps) => {
  const progress = Math.min(100, (live.minute / MATCH_MINUTES) * 100);

  return (
    <div className={cn('rounded-xl border border-white/10 bg-ink-700/60 p-3', className)}>
      {/* นาฬิกา + สกอร์ */}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{teamName}</span>

        {/* กันไม่ให้ตัวเลขสกอร์ถูกบีบตอนชื่อทีมยาว */}
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-display text-2xl leading-none">{live.teamScore}</span>
          <span className="text-chalk/30">–</span>
          <span className="font-display text-2xl leading-none">{live.opponentScore}</span>
        </span>

        <span className="min-w-0 flex-1 truncate text-right text-xs font-semibold">
          {opponentName}
        </span>
      </div>

      <p className="mt-1 text-center font-mono text-[11px] text-chalk/50">
        {!finished && <span className="mr-1 text-neon">●</span>}
        {finished ? "จบเกม 90'" : `${live.minute}'`}
      </p>

      {/* หลอดเวลาการแข่ง */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-neon transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/*
        ไทม์ไลน์ประตู ใหม่สุดอยู่บน
        max-h ล็อกไว้ที่ ~3 บรรทัด: ประตูลูกใหม่จึงเลื่อนเข้ามาแทนที่จะดันแผงให้สูงขึ้น
      */}
      {live.events.length > 0 && (
        <ul className="mt-3 max-h-[84px] space-y-1 overflow-y-auto">
          {live.events.map((event) => (
            <li
              key={`${event.minute}-${event.scorer}`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1 text-xs',
                event.side === 'team' ? 'bg-neon/10' : 'bg-white/5',
              )}
            >
              <span className="shrink-0 font-mono text-[10px] text-chalk/50">{event.minute}'</span>
              <span aria-hidden>⚽</span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  event.side === 'team' ? 'text-neon' : 'text-chalk/60',
                )}
              >
                {event.scorer}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!finished && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 w-full rounded-lg border border-white/15 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/60 hover:border-white/40 hover:text-chalk"
        >
          ข้ามไปดูผล
        </button>
      )}
    </div>
  );
};
