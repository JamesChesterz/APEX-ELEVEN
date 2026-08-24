/**
 * ตารางอันดับประจำวันของลีก (คะแนน 3-1-0 เหมือนลีกจริง)
 *
 * ทุกแถวเป็นผู้เล่นจริงในลีกเดียวกับเรา กดที่แถวเพื่อเปิดดูตัวจริง 11 คนของทีมนั้นได้
 * (ทีมสำรองของโหมดออฟไลน์กดไม่ได้ เพราะไม่มีตัวจริงจริง ๆ ให้ดู)
 */
import { Avatar } from '@/components/profile/Avatar';
import { goalDiff, type LeagueStanding } from '@/services/league';
import { cn } from '@/utils/helpers';

interface LeagueStandingsTableProps {
  standings: LeagueStanding[];
  /** กดแถวเพื่อดูทีมของผู้เล่นคนนั้น */
  onSelect?: (uid: string) => void;
}

const MEDAL_TONE: Record<number, string> = {
  1: 'text-gold',
  2: 'text-chalk/80',
  3: 'text-[#C88B4A]',
};

export const LeagueStandingsTable = ({ standings, onSelect }: LeagueStandingsTableProps) => (
  <div className="panel overflow-x-auto">
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="border-b border-white/5 text-left">
          {['#', 'ทีม', 'ช', 'ส', 'พ', 'ประตู', 'คะแนน', ''].map((head, index) => (
            <th key={`${head}-${index}`} className="eyebrow px-3 py-2.5 font-normal">
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => {
          const canPreview = Boolean(row.isReal && !row.isCurrentUser && onSelect);

          return (
            <tr
              key={row.id}
              onClick={() => canPreview && onSelect?.(row.id)}
              className={cn(
                'border-b border-white/5 last:border-0',
                canPreview && 'cursor-pointer transition-colors hover:bg-white/[0.04]',
                row.isCurrentUser && 'bg-kit/10',
                row.rank === 1 && 'bg-gradient-to-r from-gold/12 via-gold/4 to-transparent',
              )}
            >
              <td className={cn('px-3 py-2.5 font-display', MEDAL_TONE[row.rank] ?? 'text-chalk/60')}>
                {row.rank}
              </td>

              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar src={row.avatar} name={row.managerName} size="xs" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {row.teamName}
                      {row.isCurrentUser && <span className="ml-1.5 text-xs text-neon">(คุณ)</span>}
                    </p>
                    <p className="truncate font-mono text-[10px] text-chalk/40">
                      {row.managerName} · OVR {row.ovr}
                    </p>
                  </div>
                </div>
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

              <td className="px-3 py-2.5 text-right">
                {canPreview && (
                  <span className="whitespace-nowrap rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/50">
                    ดูทีม
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
