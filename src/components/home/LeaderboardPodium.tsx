/**
 * แผง Leaderboard บนหน้า HOME — อันดับ 1–3 ยืนบนโพเดียมสีทอง เรียงลำดับ 2‑1‑3
 * (อันดับ 2 ซ้าย, อันดับ 1 กลางสูงสุด, อันดับ 3 ขวา) ต่อด้วยรายชื่ออันดับ 4 เป็นต้นไป
 */
import { useState } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { Modal } from '@/components/layout/Modal';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import type { LeaderboardEntry } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
}

/** ลำดับการวางบนโพเดียม: ซ้าย → กลาง → ขวา คือ อันดับ 2, 1, 3 */
const PODIUM_ORDER = [2, 1, 3];

const PODIUM_STYLE: Record<number, { height: string; base: string; ring: string; medal: string }> = {
  1: {
    height: 'h-24',
    base: 'bg-gradient-to-b from-gold to-[#C98A16]',
    ring: 'ring-gold',
    medal: 'text-gold',
  },
  2: {
    height: 'h-16',
    base: 'bg-gradient-to-b from-chalk/70 to-chalk/30',
    ring: 'ring-chalk/60',
    medal: 'text-chalk/80',
  },
  3: {
    height: 'h-12',
    base: 'bg-gradient-to-b from-[#C88B4A] to-[#8A5A2A]',
    ring: 'ring-[#C88B4A]',
    medal: 'text-[#C88B4A]',
  },
};

export const LeaderboardPodium = ({ entries }: LeaderboardPodiumProps) => {
  const [open, setOpen] = useState(false);
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 8);
  const me = entries.find((entry) => entry.isCurrentUser);

  const byRank = (rank: number) => top3.find((entry) => entry.rank === rank);

  return (
    <>
      <section className="glass-panel flex flex-col p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-gold">🏆</span>
          <p className="panel-title">Leaderboard</p>
        </div>

        {top3.length > 0 && (
          <div className="mt-4 flex items-end justify-center gap-3">
            {PODIUM_ORDER.map((rank) => {
              const entry = byRank(rank);
              const style = PODIUM_STYLE[rank];
              if (!entry) return <div key={rank} className="w-20" />;

              return (
                <div key={rank} className="flex w-20 flex-col items-center">
                  <Avatar
                    src={entry.avatar}
                    name={entry.managerName}
                    size="md"
                    className={cn('ring-2', style.ring)}
                  />
                  <p className="mt-1.5 w-full truncate text-center text-xs font-semibold">
                    {entry.managerName}
                  </p>
                  <p className="font-mono text-[10px] text-gold">{formatNumber(entry.points)} PTS</p>

                  <div
                    className={cn(
                      'mt-2 flex w-full items-start justify-center rounded-t-lg pt-1.5 shadow-card',
                      style.height,
                      style.base,
                    )}
                  >
                    <span className="font-display text-2xl text-ink-900">{rank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rest.length > 0 && (
          <ul className="mt-4 space-y-2">
            {rest.map((entry) => (
              <li key={entry.rank} className="flex items-center gap-2.5 px-1 py-0.5">
                <span className="w-4 font-mono text-xs text-chalk/50">{entry.rank}</span>
                <Avatar src={entry.avatar} name={entry.managerName} size="xs" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {entry.managerName}
                </span>
                <span className="font-mono text-[11px] text-gold">
                  {formatNumber(entry.points)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-chalk/80 hover:border-neon/40 hover:text-neon"
        >
          ดูอันดับทั้งหมด
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
