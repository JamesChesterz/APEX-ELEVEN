/**
 * แผงภารกิจใต้รางพาส — ภารกิจประจำวัน (ซ้าย) และภารกิจพาส (ขวา)
 *
 * ทั้งสองแผงหน้าตาเหมือนกัน ต่างแค่ชุดข้อมูลกับหัวข้อ จึงใช้คอมโพเนนต์เดียวกัน
 * แต่ละแถวโชว์ ความคืบหน้า / หลอด / XP ที่จะได้ / ปุ่มกดรับ
 *
 * ปุ่มมีสามสถานะ: ยังทำไม่ครบ = "ไปทำ" (กดไม่ได้) · ครบแล้ว = "รับ XP" (เขียวเด่น)
 * · รับไปแล้ว = "รับแล้ว" (จาง) — สถานะกลางคือสถานะเดียวที่กดได้
 */
import { formatRemaining } from '@/services/pointsExchange';
import type { MissionView } from '@/services/passMissions';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

interface PassMissionsProps {
  daily: MissionView[];
  season: MissionView[];
  /** วินาทีที่เหลือก่อนภารกิจประจำวันรีเซ็ต */
  dailyResetIn: number;
  onClaim: (id: string) => void;
}

export const PassMissions = ({ daily, season, dailyResetIn, onClaim }: PassMissionsProps) => (
  <div className="grid gap-3 lg:grid-cols-2">
    <MissionBoard
      title="ภารกิจประจำวัน"
      note={`⏱ รีเซ็ตใน ${formatRemaining(dailyResetIn)}`}
      missions={daily}
      onClaim={onClaim}
    />
    <MissionBoard
      title="ภารกิจพาส"
      note="สะสมยาวทั้งซีซัน"
      missions={season}
      onClaim={onClaim}
    />
  </div>
);

const MissionBoard = ({
  title,
  note,
  missions,
  onClaim,
}: {
  title: string;
  note: string;
  missions: MissionView[];
  onClaim: (id: string) => void;
}) => (
  <section className="glass-panel space-y-2 p-3 sm:p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="font-display text-lg uppercase">{title}</p>
      <span className="font-mono text-[11px] text-chalk/45">{note}</span>
    </div>

    <div className="grid gap-2 sm:grid-cols-2">
      {missions.map((mission) => (
        <MissionRow key={mission.id} mission={mission} onClaim={onClaim} />
      ))}
    </div>
  </section>
);

const MissionRow = ({
  mission,
  onClaim,
}: {
  mission: MissionView;
  onClaim: (id: string) => void;
}) => {
  const ratio = mission.target > 0 ? Math.min(1, mission.progress / mission.target) : 1;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors',
        mission.claimable
          ? 'border-neon/50 bg-neon/10'
          : mission.claimed
            ? 'border-white/5 bg-ink-900/40 opacity-55'
            : 'border-white/10 bg-ink-900/40',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg',
          mission.claimable ? 'bg-neon/20' : 'bg-white/5',
        )}
        aria-hidden
      >
        {MISSION_ICON[mission.metric]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-tight">{mission.label}</p>

        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] text-chalk/45">
            {formatNumber(mission.progress)} / {formatNumber(mission.target)}
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className={cn(
                'block h-full rounded-full transition-[width] duration-500',
                mission.done ? 'bg-neon' : 'bg-kit',
              )}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] font-bold text-gold">+{mission.xp} XP</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!mission.claimable}
        onClick={() => {
          playSfx('click');
          onClaim(mission.id);
        }}
        className={cn(
          'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
          mission.claimable
            ? 'bg-neon text-ink-900 hover:bg-neon-dim'
            : mission.claimed
              ? 'cursor-not-allowed bg-neon/10 text-neon/60'
              : 'cursor-not-allowed bg-white/5 text-chalk/40',
        )}
      >
        {mission.claimed ? 'รับแล้ว' : mission.claimable ? 'รับ XP' : 'ไปทำ'}
      </button>
    </div>
  );
};

/** ไอคอนประจำตัวนับแต่ละแบบ */
const MISSION_ICON: Record<MissionView['metric'], string> = {
  login: '🎁',
  matches: '⚽',
  wins: '🏆',
  packs: '📦',
  cards: '🃏',
};
