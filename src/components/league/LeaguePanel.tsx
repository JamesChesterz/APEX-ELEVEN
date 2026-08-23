/**
 * แผงลีกประจำวัน: เข้าร่วม/ออก, นับถอยหลังรอบถัดไป, สรุปผลวันนี้ และสถานะล็อกทีม
 */
import { useLeague } from '@/hooks/useLeague';
import { useTeam } from '@/hooks/useTeam';
import { DAY_START_HOUR, goalDiff, ROUND_MINUTES, ROUNDS_PER_DAY } from '@/services/league';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

/** แปลงวินาทีเป็น mm:ss */
const clock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** แปลงเวลาเป็น HH:MM ตามเครื่องผู้เล่น */
const hhmm = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="rounded-lg bg-ink-700/50 px-2 py-1.5 text-center">
    <p className="eyebrow">{label}</p>
    <p className={cn('font-display text-lg leading-none', tone)}>{value}</p>
  </div>
);

export const LeaguePanel = () => {
  const { league, daily, rank, standings, nextRoundAt, secondsToNextRound, roundsPlayed, join, leave } =
    useLeague();
  const { rating } = useTeam();

  const squadIncomplete = rating.emptySlots > 0;

  /* ── ยังไม่ได้เข้าร่วม ── */
  if (!league.joined) {
    return (
      <section className="glass-panel p-5">
        <p className="panel-title">ลีกประจำวัน</p>
        <p className="mt-2 text-sm text-chalk/60">
          เข้าร่วมครั้งเดียว แล้วระบบจับคู่ให้เองทุก {ROUND_MINUTES} นาที ตลอดวัน (
          {String(DAY_START_HOUR).padStart(2, '0')}:00 ถึง 05:30 · รวม {ROUNDS_PER_DAY} รอบ)
          ครบวันแล้วสรุปอันดับและแจกรางวัลตามอันดับที่ทำได้
        </p>

        <ul className="mt-3 space-y-1.5 text-xs text-chalk/50">
          <li>· ไม่ต้องเปิดเกมค้างไว้ — รอบที่ผ่านไปจะถูกคำนวณให้ตอนกลับมา</li>
          <li>· ใช้ทีมชุดล่าสุดในหน้า MY TEAM เสมอ เปลี่ยนตัวได้ตลอด ไม่มีคูลดาวน์</li>
          <li>· รางวัล: เหรียญ + แต้มแลกนักเตะ อันดับยิ่งสูงยิ่งได้เยอะ</li>
        </ul>

        {squadIncomplete && (
          <p className="mt-3 text-xs text-[#F0A070]">
            จัดตัวให้ครบ 11 คนก่อน — ยังว่างอีก {rating.emptySlots} ช่อง
          </p>
        )}

        <button
          type="button"
          disabled={squadIncomplete}
          onClick={join}
          className="mt-4 w-full rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-chalk/40"
        >
          เข้าร่วมลีก
        </button>
      </section>
    );
  }

  /* ── เข้าร่วมอยู่ ── */
  return (
    <section className="glass-panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="panel-title">ลีกประจำวัน</p>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-neon">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" aria-hidden />
          กำลังแข่งอยู่
        </span>
      </div>

      {/* รอบถัดไป */}
      <div className="mt-3 rounded-xl border border-white/10 bg-ink-700/60 p-3 text-center">
        <p className="eyebrow">รอบถัดไป {hhmm(nextRoundAt)} น.</p>
        <p className="mt-1 font-display text-3xl leading-none text-neon">
          {clock(secondsToNextRound)}
        </p>
        <p className="mt-1 font-mono text-[10px] text-chalk/45">
          วันนี้แข่งไปแล้ว {roundsPlayed} / {ROUNDS_PER_DAY} รอบ
        </p>
      </div>

      {/* สรุปผลวันนี้ */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Stat label="อันดับ" value={`${rank}/${standings.length}`} tone="text-kit" />
        <Stat label="คะแนน" value={String(daily.points)} tone="text-neon" />
        <Stat label="ช/ส/พ" value={`${daily.wins}/${daily.draws}/${daily.losses}`} />
        <Stat
          label="ประตู"
          value={`${goalDiff(daily) >= 0 ? '+' : ''}${goalDiff(daily)}`}
          tone={goalDiff(daily) >= 0 ? 'text-neon' : 'text-[#F0A070]'}
        />
      </div>

      {/* ทีมที่ใช้แข่งคือทีมชุดล่าสุดของ MY TEAM เสมอ */}
      <p className="mt-3 rounded-lg border border-neon/40 bg-neon/10 px-3 py-2 text-xs text-neon">
        ✓ ใช้ทีมชุดล่าสุดจากหน้า MY TEAM · เปลี่ยนตัวได้ตลอด มีผลกับรอบถัดไปทันที
      </p>

      <button
        type="button"
        onClick={() => {
          playSfx('click');
          leave();
        }}
        className="mt-3 w-full rounded-lg border border-white/15 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 transition-colors hover:border-gem/50 hover:text-gem"
      >
        ออกจากลีก
      </button>
      <p className="mt-1.5 text-center text-[10px] text-chalk/35">
        ออกแล้วผลของวันนี้ยังอยู่ แต่จะไม่มีรอบใหม่จนกว่าจะกดเข้าร่วมอีกครั้ง
      </p>
    </section>
  );
};
