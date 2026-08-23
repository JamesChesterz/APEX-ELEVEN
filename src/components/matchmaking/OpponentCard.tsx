/** ทีมคู่แข่งหนึ่งทีมในหน้า Match พร้อมโอกาสชนะเทียบกับทีมของเรา */
import { WinChanceBar } from '@/components/matchmaking/WinChanceBar';
import { getMatchOdds } from '@/services/matchmaking';
import type { Opponent } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface OpponentCardProps {
  opponent: Opponent;
  /** ค่าพลังทีมของเรา ใช้คำนวณโอกาสชนะ */
  teamOvr: number;
  onChallenge?: (opponentId: string) => void;
  disabled?: boolean;
}

const DIFFICULTY_TONE: Record<Opponent['difficulty'], string> = {
  easy: 'text-neon',
  normal: 'text-chalk/60',
  hard: 'text-kit',
  elite: 'text-[#F07070]',
};

export const OpponentCard = ({
  opponent,
  teamOvr,
  onChallenge,
  disabled = false,
}: OpponentCardProps) => {
  const odds = getMatchOdds(teamOvr, opponent.ovr);

  return (
    <article className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={cn('eyebrow', DIFFICULTY_TONE[opponent.difficulty])}>{opponent.difficulty}</p>
        <h3 className="truncate text-lg">{opponent.name}</h3>
        <p className="truncate text-xs text-chalk/45">
          ผู้จัดการ {opponent.manager} · {opponent.formationId} · รางวัล{' '}
          {formatNumber(opponent.rewardCoins)} เหรียญ
        </p>
        <WinChanceBar odds={odds} className="mt-2 max-w-[260px]" />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="eyebrow">OVR</p>
          <p className="font-display text-2xl leading-none">{opponent.ovr}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChallenge?.(opponent.id)}
          className="rounded-lg border border-kit/50 px-3 py-2 text-sm font-semibold text-kit transition-colors hover:bg-kit/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ท้าแข่ง
        </button>
      </div>
    </article>
  );
};
