/**
 * แผงรายละเอียดรางวัล — อยู่คอลัมน์ขวาของหน้า MATCH (แทนแผงจับคู่เดิม)
 *
 * รวมทุกอย่างที่ผู้เล่นต้องรู้ว่า "แข่งแล้วได้อะไร" ไว้ที่เดียว:
 *   1. รางวัลปลายวันของลีกประจำวัน แยกตามอันดับที่จบ
 *   2. คะแนนลีกระหว่างวัน (ระบบ 3-1-0)
 *   3. ของที่ได้จากแมตช์กระชับมิตรรายนัด
 *
 * ตัวเลขทั้งหมดอ่านจาก services/league.ts และ services/matchmaking.ts โดยตรง
 * ปรับสมดุลที่ไฟล์ต้นทางแล้วแผงนี้เปลี่ยนตาม ไม่ต้องแก้สองที่
 */
import { useLeague } from '@/hooks/useLeague';
import { getDailyReward, ROUNDS_PER_DAY } from '@/services/league';
import { cn, formatNumber } from '@/utils/helpers';

/** อันดับตัวอย่างที่ยกมาโชว์ในตาราง — ครอบทุกชั้นของ REWARD_TABLE */
const SHOWCASE_RANKS = [1, 2, 3, 5, 10];

/** ป้ายเหรียญรางวัลของสามอันดับแรก */
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const Row = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="text-xs text-chalk/50">{label}</span>
    <span className={cn('font-mono text-xs', tone ?? 'text-chalk/80')}>{value}</span>
  </div>
);

export const RewardsPanel = () => {
  const { league, rank, standings, roundsPlayed } = useLeague();

  /** รางวัลที่จะได้ถ้าวันนี้จบด้วยอันดับปัจจุบัน */
  const projected = getDailyReward(rank);

  return (
    <section className="glass-panel flex flex-col gap-4 p-4">
      <div>
        <p className="panel-title">รางวัล</p>
        <p className="mt-1 text-xs text-chalk/45">
          ลีกประจำวันจ่ายรางวัลตอนจบวัน (06:00 น.) · กระชับมิตรจ่ายทันทีทุกนัด
        </p>
      </div>

      {/* ── รางวัลที่กำลังจะได้ตามอันดับตอนนี้ ── */}
      {league.joined && (
        <div className="rounded-xl border border-neon/25 bg-neon/[0.06] p-3">
          <p className="eyebrow text-neon">ถ้าจบวันนี้ที่อันดับ {rank}</p>
          <p className="mt-1 font-display text-lg leading-none text-neon">{projected.label}</p>
          <div className="mt-2 border-t border-white/10 pt-2">
            <Row label="เหรียญ" value={formatNumber(projected.coins)} tone="text-gold" />
            <Row label="แต้มแลกนักเตะ" value={formatNumber(projected.points)} tone="text-token" />
            <Row label="แต้มตีบวก" value={formatNumber(projected.upgradePoints)} tone="text-kit" />
          </div>
          <p className="mt-2 font-mono text-[10px] text-chalk/40">
            แข่งไปแล้ว {roundsPlayed}/{ROUNDS_PER_DAY} รอบ · อันดับยังขยับได้จนจบวัน
          </p>
        </div>
      )}

      {/* ── ตารางรางวัลปลายวัน ── */}
      <div>
        <p className="eyebrow">ตารางรางวัลลีกประจำวัน</p>
        <ul className="mt-2 space-y-1.5">
          {SHOWCASE_RANKS.map((showcase) => {
            const reward = getDailyReward(showcase);
            const isCurrent = league.joined && rank === showcase;

            return (
              <li
                key={showcase}
                className={cn(
                  'rounded-lg border px-2.5 py-2',
                  isCurrent
                    ? 'border-neon/40 bg-neon/10'
                    : 'border-white/8 bg-ink-700/40',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {MEDAL[showcase] ?? ''} {showcase <= 3 ? `อันดับ ${showcase}` : `อันดับ ≤ ${showcase}`}
                  </span>
                  <span className="font-mono text-[10px] text-chalk/40">{reward.label}</span>
                </div>
                <p className="mt-1 font-mono text-[11px]">
                  <span className="text-gold">{formatNumber(reward.coins)} เหรียญ</span>
                  {' · '}
                  <span className="text-token">{formatNumber(reward.points)} แต้ม</span>
                  {' · '}
                  <span className="text-kit">+{formatNumber(reward.upgradePoints)} ตีบวก</span>
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 font-mono text-[10px] text-chalk/35">
          ลีกมีทั้งหมด {standings.length} ทีม · อันดับ 6 ลงไปได้แต้มตีบวกเท่ากันหมด
        </p>
      </div>

      {/* ── คะแนนระหว่างวัน ── */}
      <div>
        <p className="eyebrow">คะแนนลีกต่อนัด</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'ชนะ', value: '+3', tone: 'text-neon' },
            { label: 'เสมอ', value: '+1', tone: 'text-kit' },
            { label: 'แพ้', value: '0', tone: 'text-chalk/50' },
          ].map((entry) => (
            <div key={entry.label} className="rounded-lg bg-ink-700/50 px-2 py-1.5">
              <p className="eyebrow">{entry.label}</p>
              <p className={cn('font-display text-lg leading-none', entry.tone)}>{entry.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-chalk/40">
          คะแนนเท่ากันตัดสินด้วยผลต่างประตู แล้วจึงดูประตูได้
        </p>
      </div>

      {/* ── รางวัลรายนัดของกระชับมิตร ── */}
      <div>
        <p className="eyebrow">แมตช์กระชับมิตร (ได้ทันทีทุกนัด)</p>
        <div className="mt-2 border-t border-white/10">
          <Row label="ชนะ" value="เหรียญเต็ม + คะแนนซีซัน 8–46" tone="text-neon" />
          <Row label="เสมอ" value="เหรียญ 40% + คะแนน 2–18" tone="text-kit" />
          <Row label="แพ้" value="เหรียญ 12% + คะแนนติดลบ" tone="text-[#F0A070]" />
          <Row label="ชนะเพิ่ม" value="+20 แต้มตีบวก (สูงสุด 30 นัด/วัน)" tone="text-kit" />
        </div>
        <p className="mt-2 text-[10px] text-chalk/40">
          ยิ่งคู่แข่ง OVR สูงกว่าเรา ยิ่งได้คะแนนเยอะเวลาชนะ และเสียน้อยเวลาแพ้
        </p>
      </div>
    </section>
  );
};
