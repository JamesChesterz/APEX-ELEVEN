/**
 * หน้ารางวัลล็อกอิน — ปฏิทินรายสัปดาห์ (7 ช่อง) และรายเดือน (30 ช่อง)
 *
 * เข้าเกมวันไหนกดรับได้ปฏิทินละ 1 ช่องของวันนั้น
 * ช่องที่กดได้จะเรืองเขียว ช่องที่เก็บแล้วขึ้นเครื่องหมายถูก
 *
 * รางวัลทุกช่องแอดมินตั้งเองได้จาก ADMIN → รางวัลล็อกอิน
 */
import { useState } from 'react';
import { RewardChip } from '@/components/rewards/RewardChip';
import { useLoginBonus } from '@/hooks/useLoginBonus';
import { MONTHLY_DAYS, WEEKLY_DAYS } from '@/types/loginBonus';
import type { GameReward } from '@/types/reward';
import { cn } from '@/utils/helpers';
import type { Track } from '@/services/loginBonus';

interface CalendarProps {
  rewards: GameReward[];
  claimed: number[];
  /** ช่องที่จะได้ถ้ากดตอนนี้ (−1 = ครบแล้ว) */
  next: number;
  claimable: boolean;
  columns: string;
}

const Calendar = ({ rewards, claimed, next, claimable, columns }: CalendarProps) => (
  <div className={cn('grid gap-2', columns)}>
    {rewards.map((reward, index) => {
      const done = claimed.includes(index);
      const isNext = index === next;

      return (
        <div
          key={index}
          className={cn(
            'relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors',
            done
              ? 'border-white/5 bg-black/30 opacity-45'
              : isNext && claimable
                ? 'border-neon bg-neon/10 shadow-[0_0_18px_-6px_rgba(49,224,109,0.9)]'
                : isNext
                  ? 'border-neon/40 bg-neon/[0.06]'
                  : 'border-white/10 bg-black/25',
          )}
        >
          <span className="font-mono text-[10px] text-chalk/40">วันที่ {index + 1}</span>
          <RewardChip reward={reward} size={40} />

          {done && (
            <span className="absolute right-1.5 top-1.5 text-xs text-neon" aria-label="รับแล้ว">
              ✓
            </span>
          )}
        </div>
      );
    })}
  </div>
);

export const LoginBonusPage = () => {
  const { config, state, weekly, monthly, claim } = useLoginBonus();
  const [tab, setTab] = useState<Track>('weekly');
  const [notice, setNotice] = useState('');

  if (!config.enabled) {
    return (
      <section className="glass-panel grid min-h-[320px] place-items-center p-8 text-center">
        <p className="text-sm text-chalk/45">ตอนนี้ยังไม่มีรางวัลล็อกอิน</p>
      </section>
    );
  }

  const active = tab === 'weekly' ? weekly : monthly;
  const claimed = tab === 'weekly' ? state.weeklyClaimed : state.monthlyClaimed;
  const rewards = tab === 'weekly' ? config.weekly : config.monthly;
  const total = tab === 'weekly' ? WEEKLY_DAYS : MONTHLY_DAYS;

  return (
    <div className="space-y-4">
      <section className="glass-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-xl tracking-wide">{config.title}</h2>
          <p className="mt-1 text-xs text-chalk/45">
            เข้าเกมวันละครั้งกดรับได้ปฏิทินละ 1 ช่อง · รายสัปดาห์รีเซ็ตทุกวันจันทร์ ·
            รายเดือนรีเซ็ตวันที่ 1
          </p>
        </div>

        <div className="flex gap-4 font-mono text-xs">
          <span className="text-chalk/50">
            สัปดาห์นี้{' '}
            <span className="text-neon">
              {state.weeklyClaimed.length}/{WEEKLY_DAYS}
            </span>
          </span>
          <span className="text-chalk/50">
            เดือนนี้{' '}
            <span className="text-neon">
              {state.monthlyClaimed.length}/{MONTHLY_DAYS}
            </span>
          </span>
        </div>
      </section>

      <div className="flex gap-1.5">
        {(
          [
            ['weekly', 'รายสัปดาห์'],
            ['monthly', 'รายเดือน'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setNotice('');
            }}
            className={cn(
              'rounded-lg px-6 py-2 text-sm transition-colors',
              tab === id
                ? 'bg-neon/15 font-semibold text-neon ring-1 ring-inset ring-neon/50'
                : 'text-chalk/45 hover:bg-white/5 hover:text-chalk/75',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="glass-panel space-y-4 p-4">
        <Calendar
          rewards={rewards}
          claimed={claimed}
          next={active.next}
          claimable={active.claimable}
          columns={
            tab === 'weekly'
              ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7'
              : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-10'
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className={cn('text-xs', active.claimable ? 'text-neon' : 'text-chalk/45')}>
            {notice ||
              active.reason ||
              `กดรับรางวัลวันที่ ${active.next + 1} จาก ${total} ได้เลย`}
          </p>

          <button
            type="button"
            disabled={!active.claimable}
            onClick={() => setNotice(claim(tab) ?? '')}
            className={cn(
              'rounded-lg px-8 py-2.5 text-sm font-bold transition-colors',
              active.claimable
                ? 'bg-neon text-ink-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/[0.06] text-chalk/30',
            )}
          >
            รับรางวัล
          </button>
        </div>
      </section>
    </div>
  );
};
