/**
 * แผงลีกประจำวัน: นับถอยหลังรอบถัดไป, สรุปผลวันนี้ และสถานะของลีกกลุ่มนี้
 *
 * ไม่มีปุ่มเข้าร่วม/ออกจากลีกแล้ว — ผู้เล่นทุกคนถูกจัดเข้าลีกให้อัตโนมัติตั้งแต่สมัคร
 * (ดู createLeagueState ใน services/league.ts และ effect เข้าร่วมอัตโนมัติใน hooks/useLeague.tsx)
 */
import { useLeague } from '@/hooks/useLeague';
import { useTeam } from '@/hooks/useTeam';
import { DAY_START_HOUR, goalDiff, LEAGUE_SIZE, ROUND_MINUTES, ROUNDS_PER_DAY } from '@/services/league';
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
  const {
    daily,
    rank,
    standings,
    members,
    realCount,
    nextRoundAt,
    secondsToNextRound,
    roundsPlayed,
  } = useLeague();
  const { rating } = useTeam();

  const squadIncomplete = rating.emptySlots > 0;

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

      {/* สถานะของลีกกลุ่มนี้ */}
      <p className="mt-2 rounded-lg border border-white/10 bg-ink-700/50 px-3 py-2 text-[11px] text-chalk/55">
        ลีกกลุ่มนี้มี {members.length} ทีม (ผู้เล่นจริง {realCount} คน) · ช่วง OVR{' '}
        {Math.min(...members.map((member) => member.ovr))}–
        {Math.max(...members.map((member) => member.ovr))}
        {realCount < LEAGUE_SIZE && ' · ลีกจะเต็มขึ้นเมื่อมีผู้เล่นค่าพลังใกล้กันเข้ามาเพิ่ม'}
      </p>

      {/* จัดตัวไม่ครบก็ยังแข่ง แต่ค่าพลังทีมจะต่ำกว่าที่ควรเป็น */}
      {squadIncomplete && (
        <p className="mt-2 rounded-lg border border-[#F0A070]/40 bg-[#F0A070]/10 px-3 py-2 text-xs text-[#F0A070]">
          ยังจัดตัวไม่ครบ 11 คน (ว่างอีก {rating.emptySlots} ช่อง) — ระบบยังส่งทีมนี้ลงแข่งทุกรอบ
          แต่ค่าพลังจะต่ำกว่าที่ควรเป็น
        </p>
      )}

      <p className="mt-3 text-center text-[10px] leading-relaxed text-chalk/35">
        ผู้เล่นทุกคนอยู่ในลีกโดยอัตโนมัติ ไม่ต้องกดเข้าร่วม · ระบบแข่งให้เองทุก{' '}
        {ROUND_MINUTES} นาที ตั้งแต่ {String(DAY_START_HOUR).padStart(2, '0')}:00
        ถึง 05:30 แม้ไม่ได้เปิดเกมค้างไว้
      </p>
    </section>
  );
};
