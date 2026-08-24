/**
 * หน้าจอสรุปผลลีกประจำวัน — ขึ้นเองเมื่อข้ามเวลา 06:00 และต้องกดรับก่อนถึงเล่นต่อได้
 */
import { goalDiff, type DailySummary } from '@/services/league';
import { formatNumber } from '@/utils/helpers';

interface DailyRewardModalProps {
  summary: DailySummary;
  onClaim: () => void;
}

/** ป้ายวันที่ของวันแข่งที่เพิ่งจบ */
const dayLabel = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
};

export const DailyRewardModal = ({ summary, onClaim }: DailyRewardModalProps) => (
  <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
    <div className="glass-panel w-full max-w-md p-6 text-center">
      <p className="eyebrow">สรุปลีกประจำวัน · {dayLabel(summary.dayStartedAt)}</p>
      <h2 className="mt-1 font-display text-4xl uppercase leading-none text-kit">
        อันดับ {summary.rank}
        <span className="ml-1 text-lg text-chalk/40">/ {summary.totalTeams}</span>
      </h2>
      <p className="mt-2 text-sm text-neon">{summary.reward.label}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'คะแนนลีก', value: String(summary.daily.points) },
          {
            label: 'ช/ส/พ',
            value: `${summary.daily.wins}/${summary.daily.draws}/${summary.daily.losses}`,
          },
          {
            label: 'ประตู',
            value: `${goalDiff(summary.daily) >= 0 ? '+' : ''}${goalDiff(summary.daily)}`,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-ink-700/50 px-2 py-2">
            <p className="eyebrow">{item.label}</p>
            <p className="font-display text-lg leading-none">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-ink-700/50 p-4 text-left">
        <p className="eyebrow">รางวัลประจำวัน</p>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-chalk/55">เหรียญ</span>
          <span className="font-display text-xl text-gold">
            +{formatNumber(summary.reward.coins)}
          </span>
        </p>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-chalk/55">แต้มแลกนักเตะ</span>
          <span className="font-display text-xl text-token">
            +{formatNumber(summary.reward.points)}
          </span>
        </p>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-chalk/55">แต้มตีบวก</span>
          <span className="font-display text-xl text-kit">
            +{formatNumber(summary.reward.upgradePoints)}
          </span>
        </p>
      </div>

      <p className="mt-3 text-xs text-chalk/45">
        วันแข่งใหม่เริ่มแล้ว — สถิติประจำวันเริ่มนับใหม่จากศูนย์
      </p>

      <button
        type="button"
        onClick={onClaim}
        className="mt-4 w-full rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim"
      >
        รับรางวัล
      </button>
    </div>
  </div>
);
