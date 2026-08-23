/**
 * ตารางอันดับผู้จัดการทีม
 *
 * แถวที่ 1 ได้ฉายา "1ST CHAMPION" สีทอง (มีได้คนเดียว) และแถบพื้นหลังทอง
 * ทุกแถวแสดงระดับ (BRONZE/GOLD/PLATINUM/LEGEND/CHAMPION) ที่คิดจากคะแนนสะสม
 */
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import type { LeaderboardEntry } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

/** สีของเลขอันดับ 1–3 */
const MEDAL_TONE: Record<number, string> = { 1: 'text-gold', 2: 'text-chalk/80', 3: 'text-[#C88B4A]' };

export const LeaderboardTable = ({ entries }: LeaderboardTableProps) => (
  <div className="panel overflow-x-auto">
    <table className="w-full min-w-[680px] text-sm">
      <thead>
        <tr className="border-b border-white/5 text-left">
          {['#', 'ทีม', 'ระดับ', 'OVR', 'ช/ส/พ', 'คะแนน'].map((head) => (
            <th key={head} className="eyebrow px-4 py-3 font-normal">
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const isChampion = entry.rank === 1;

          return (
            <tr
              key={`${entry.rank}-${entry.teamName}`}
              className={cn(
                'border-b border-white/5 last:border-0',
                entry.isCurrentUser && 'bg-kit/10',
                // แถบทองบาง ๆ ให้อันดับ 1 เด่นออกมาจากตารางทั้งหมด
                isChampion && 'bg-gradient-to-r from-gold/15 via-gold/5 to-transparent',
              )}
            >
              <td className={cn('px-4 py-3 font-display text-lg', MEDAL_TONE[entry.rank] ?? 'text-chalk/60')}>
                {entry.rank}
              </td>

              <td className="px-4 py-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {entry.teamName}
                  {isChampion && <ChampionTitle size="xs" />}
                </p>
                <p className="text-xs text-chalk/45">
                  {entry.managerName}
                  {entry.isCurrentUser && <span className="ml-1.5 text-neon">(คุณ)</span>}
                </p>
              </td>

              <td className="px-4 py-3">
                <RankBadge points={entry.points} size="xs" />
              </td>

              <td className="px-4 py-3 font-mono">{entry.teamOvr}</td>

              <td className="px-4 py-3 font-mono text-chalk/60">
                {entry.wins}/{entry.draws}/{entry.losses}
              </td>

              <td className="px-4 py-3 font-display text-lg text-kit">
                {formatNumber(entry.points)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
