/**
 * วิดเจ็ตอันดับบนแดชบอร์ดล่าง: โชว์ 3 อันดับแรก (อันดับ 1 ติดฉายา 1ST CHAMPION)
 * กดแถวไหนก็ได้ หรือกด "ดูทั้งหมด" เพื่อเปิดตารางอันดับเต็มในหน้าต่างซ้อน
 */
import { useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { ChampionTitle } from '@/components/rank/RankBadge';
import type { LeaderboardEntry } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface LeaderboardWidgetProps {
  /** ตารางอันดับทั้งหมด — วิดเจ็ตตัดเอง 3 อันดับแรกมาแสดง */
  entries: LeaderboardEntry[];
}

const RANK_TONE = ['text-gold', 'text-chalk/70', 'text-[#C88B4A]'];

export const LeaderboardWidget = ({ entries }: LeaderboardWidgetProps) => {
  const [open, setOpen] = useState(false);
  const preview = entries.slice(0, 3);
  const me = entries.find((entry) => entry.isCurrentUser);

  return (
    <>
      <section className="glass-panel flex flex-col p-4">
        <p className="panel-title">Leaderboard</p>

        <ul className="mt-3 flex-1 space-y-2.5">
          {preview.map((entry, index) => (
            <li key={entry.rank}>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-0.5 text-left hover:bg-white/5',
                  entry.isCurrentUser && 'bg-kit/10',
                )}
              >
                <span
                  className={cn('w-3 font-display text-base', RANK_TONE[index] ?? 'text-chalk/60')}
                >
                  {entry.rank}
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-600 font-display text-[11px] ring-1 ring-white/10">
                  {entry.managerName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-xs font-semibold">{entry.managerName}</span>
                  {entry.rank === 1 ? (
                    <ChampionTitle size="xs" className="mt-0.5" />
                  ) : (
                    <span className="block font-mono text-[10px] text-chalk/45">
                      OVR {entry.teamOvr}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-gold">{formatNumber(entry.points)}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-chalk/80 hover:border-neon/40 hover:text-neon"
        >
          ดูทั้งหมด
        </button>
      </section>

      <Modal
        open={open}
        title="Leaderboard"
        subtitle={
          me
            ? `ทั้งหมด ${entries.length} ทีม · คุณอยู่อันดับ ${me.rank} ด้วย ${formatNumber(me.points)} คะแนน`
            : `ทั้งหมด ${entries.length} ทีม`
        }
        onClose={() => setOpen(false)}
      >
        <LeaderboardTable entries={entries} />
      </Modal>
    </>
  );
};
