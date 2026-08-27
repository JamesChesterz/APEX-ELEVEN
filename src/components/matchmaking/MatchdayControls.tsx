/**
 * แถบควบคุมใต้สนาม Matchmaking — ปุ่มหลักอยู่กึ่งกลาง มีชื่อทีม + OVR ทั้งสองฝั่งกำกับไว้เสมอ
 */
import type { MatchOutcome, MatchStatus } from '@/types/match';
import { cn } from '@/utils/helpers';

const OUTCOME_STYLE: Record<MatchOutcome, { label: string; tone: string }> = {
  win: { label: 'ชนะ!', tone: 'text-neon' },
  draw: { label: 'เสมอ', tone: 'text-kit' },
  loss: { label: 'แพ้', tone: 'text-[#F07070]' },
};

const TeamLabel = ({
  name,
  ovr,
  align,
}: {
  name: string;
  ovr: number | null;
  align: 'left' | 'right';
}) => (
  <div className={cn('min-w-0 flex-1', align === 'left' ? 'text-left' : 'text-right')}>
    <p className="truncate text-sm font-semibold">{name}</p>
    <p className="font-mono text-[11px] text-chalk/50">{ovr === null ? 'OVR —' : `OVR ${ovr}`}</p>
  </div>
);

interface MatchdayControlsProps {
  status: MatchStatus;
  teamName: string;
  teamOvr: number;
  opponentName: string;
  opponentOvr: number | null;
  elapsed: number;
  squadIncomplete: boolean;
  squadHasSuspended: boolean;
  emptyReason: string | null;
  outcome?: MatchOutcome;
  onSearch: () => void;
  onCancel: () => void;
}

export const MatchdayControls = ({
  status,
  teamName,
  teamOvr,
  opponentName,
  opponentOvr,
  elapsed,
  squadIncomplete,
  squadHasSuspended,
  emptyReason,
  outcome,
  onSearch,
  onCancel,
}: MatchdayControlsProps) => {
  const blocked = squadIncomplete || squadHasSuspended;

  return (
    <div className="glass-panel space-y-3 p-4">
      <div className="flex items-center gap-3">
        <TeamLabel name={teamName} ovr={teamOvr} align="left" />
        <span className="font-display text-lg text-chalk/30">VS</span>
        <TeamLabel name={status === 'idle' ? 'รอคู่แข่ง' : opponentName} ovr={opponentOvr} align="right" />
      </div>

      <p className="text-center text-sm">
        {status === 'idle' && squadIncomplete && (
          <span className="text-[#F0A070]">จัดตัวไม่ครบ 11 คน — ไปที่ MY TEAM ก่อนลงแข่ง</span>
        )}
        {status === 'idle' && !squadIncomplete && squadHasSuspended && (
          <span className="text-[#F0A070]">
            มีนักเตะติดโทษแบนอยู่ในตัวจริง — เปลี่ยนตัวที่ MY TEAM ก่อนลงแข่ง
          </span>
        )}
        {status === 'idle' && !blocked && <span className="text-chalk/60">พร้อมลงแข่ง</span>}
        {status === 'searching' && (
          <span className="text-chalk/60">
            <span className="mr-1 animate-pulse text-neon">●</span>
            กำลังค้นหาคู่แข่ง... {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
            {String(elapsed % 60).padStart(2, '0')}
          </span>
        )}
        {status === 'empty' && emptyReason && (
          <span className="text-[#F0A070]">{emptyReason}</span>
        )}
        {status === 'found' && <span className="text-neon">เจอคู่แข่งแล้ว! กำลังเริ่มแข่ง...</span>}
        {status === 'playing' && (
          <span className="text-chalk/60">
            <span className="mr-1 animate-pulse text-neon">●</span>กำลังแข่งขัน...
          </span>
        )}
        {status === 'finished' && outcome && (
          <span className={cn('font-bold', OUTCOME_STYLE[outcome].tone)}>
            {OUTCOME_STYLE[outcome].label}
          </span>
        )}
      </p>

      <div className="mx-auto max-w-xs space-y-2">
        {status === 'idle' && (
          <button
            type="button"
            onClick={onSearch}
            disabled={blocked}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-chalk/40"
          >
            หาคู่แข่ง
          </button>
        )}
        {status === 'playing' && (
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-bold uppercase tracking-wider text-chalk/40"
          >
            กำลังแข่ง...
          </button>
        )}
        {status === 'finished' && (
          <button
            type="button"
            onClick={onSearch}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim"
          >
            หาคู่แข่งใหม่
          </button>
        )}
        {status === 'empty' && (
          <button
            type="button"
            onClick={onSearch}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim"
          >
            ลองหาใหม่
          </button>
        )}

        {(status === 'searching' || status === 'finished' || status === 'empty') && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg bg-[#D93A3A] py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#C22F2F]"
          >
            {status === 'finished' ? 'ปิด' : 'ยกเลิก'}
          </button>
        )}
      </div>
    </div>
  );
};
