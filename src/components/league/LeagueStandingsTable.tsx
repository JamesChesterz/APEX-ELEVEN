/**
 * ตารางอันดับประจำวันของลีก (คะแนน 3-1-0 เหมือนลีกจริง)
 * แถวบนสุดคือคนที่จะได้รางวัลสูงสุดตอนจบวัน
 */
import { goalDiff, type LeagueStanding } from '@/services/league';
import { cn } from '@/utils/helpers';

interface LeagueStandingsTableProps {
  standings: LeagueStanding[];
}

const MEDAL_TONE: Record<number, string> = {
  1: 'text-gold',
  2: 'text-chalk/80',
  3: 'text-[#C88B4A]',
};

export const LeagueStandingsTable = ({ standings }: LeagueStandingsTableProps) => (
  <div className="panel overflow-x-auto">
    <table className="w-full min-w-[520px] text-sm">
      <thead>
        <tr className="border-b border-white/5 text-left">
          {['#', 'ทีม', 'ช', 'ส', 'พ', 'ประตู', 'คะแนน'].map((head) => (
            <th key={head} className="eyebrow px-3 py-2.5 font-normal">
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => (
          <tr
            key={row.teamName}
            className={cn(
              'border-b border-white/5 last:border-0',
              row.isCurrentUser && 'bg-kit/10',
              row.rank === 1 && 'bg-gradient-to-r from-gold/12 via-gold/4 to-transparent',
            )}
          >
            <td className={cn('px-3 py-2.5 font-display', MEDAL_TONE[row.rank] ?? 'text-chalk/60')}>
              {row.rank}
            </td>
            <td className="px-3 py-2.5">
              <p className="font-semibold">
                {row.teamName}
                {row.isCurrentUser && <span className="ml-1.5 text-xs text-neon">(คุณ)</span>}
              </p>
              <p className="font-mono text-[10px] text-chalk/40">OVR {row.ovr}</p>
            </td>
            <td className="px-3 py-2.5 font-mono text-chalk/70">{row.daily.wins}</td>
            <td className="px-3 py-2.5 font-mono text-chalk/70">{row.daily.draws}</td>
            <td className="px-3 py-2.5 font-mono text-chalk/70">{row.daily.losses}</td>
            <td className="px-3 py-2.5 font-mono text-chalk/60">
              {row.daily.goalsFor}:{row.daily.goalsAgainst}
              <span className={cn('ml-1', goalDiff(row.daily) >= 0 ? 'text-neon' : 'text-[#F0A070]')}>
                ({goalDiff(row.daily) >= 0 ? '+' : ''}
                {goalDiff(row.daily)})
              </span>
            </td>
            <td className="px-3 py-2.5 font-display text-lg text-kit">{row.daily.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
