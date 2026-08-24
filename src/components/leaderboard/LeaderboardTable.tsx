/**
 * ตารางอันดับผู้จัดการทีม
 *
 * แถวที่ 1 ได้ฉายา "1ST CHAMPION" สีทอง (มีได้คนเดียว) และแถบพื้นหลังทอง
 * คะแนนคือจำนวนดาว (⭐): ชนะ +1 · เสมอ 0 · แพ้ −1
 *
 * บนมือถือซ่อนคอลัมน์รอง (ระดับ / ช-ส-พ) แล้วย้ายไปไว้ใต้ชื่อทีมแทน
 * ตารางจึงพอดีจอ 360px โดยไม่ต้องเลื่อนแนวนอน — การเลื่อนแนวนอนบนมือถือ
 * ทำให้กดแถวพลาดง่าย เพราะนิ้วที่ตั้งใจปัดกลายเป็นการแตะ
 */
import { Avatar } from '@/components/profile/Avatar';
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import type { LeaderboardEntry } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  /** กดแถวเพื่อดูตัวจริง 11 คน — มีเฉพาะแถวของผู้เล่นจริง (ทีมจำลองไม่มี uid) */
  onSelect?: (uid: string) => void;
}

/** สีของเลขอันดับ 1–3 */
const MEDAL_TONE: Record<number, string> = { 1: 'text-gold', 2: 'text-chalk/80', 3: 'text-[#C88B4A]' };

/** หัวตาราง + คลาสที่คุมว่าคอลัมน์ไหนโผล่ที่ความกว้างเท่าไหร่ */
const COLUMNS: Array<{ label: string; className?: string }> = [
  { label: '#' },
  { label: 'ทีม' },
  { label: 'ระดับ', className: 'hidden sm:table-cell' },
  { label: 'OVR' },
  { label: 'ช/ส/พ', className: 'hidden md:table-cell' },
  { label: 'ดาว' },
  { label: '' },
];

export const LeaderboardTable = ({ entries, onSelect }: LeaderboardTableProps) => (
  <div className="panel overflow-x-auto">
    <table className="w-full text-sm md:min-w-[680px]">
      <thead>
        <tr className="border-b border-white/5 text-left">
          {COLUMNS.map((column, index) => (
            <th
              key={`${column.label}-${index}`}
              className={cn('eyebrow px-2 py-3 font-normal sm:px-4', column.className)}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const isChampion = entry.rank === 1;
          // ทีมจำลองไม่มี uid จึงกดดูไม่ได้ (ไม่มีตัวจริงจริง ๆ ให้ดู)
          const canPreview = Boolean(entry.uid && onSelect);

          return (
            <tr
              key={`${entry.rank}-${entry.teamName}`}
              onClick={() => entry.uid && onSelect?.(entry.uid)}
              className={cn(
                'border-b border-white/5 last:border-0',
                canPreview && 'cursor-pointer transition-colors hover:bg-white/[0.04]',
                entry.isCurrentUser && 'bg-kit/10',
                // แถบทองบาง ๆ ให้อันดับ 1 เด่นออกมาจากตารางทั้งหมด
                isChampion && 'bg-gradient-to-r from-gold/15 via-gold/5 to-transparent',
              )}
            >
              <td
                className={cn(
                  'px-2 py-3 font-display text-lg sm:px-4',
                  MEDAL_TONE[entry.rank] ?? 'text-chalk/60',
                )}
              >
                {entry.rank}
              </td>

              <td className="max-w-[11rem] px-2 py-3 sm:max-w-none sm:px-4">
                <div className="flex items-center gap-2">
                  <Avatar src={entry.avatar} name={entry.managerName} size="xs" />

                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                      <span className="truncate">{entry.teamName}</span>
                      {isChampion && <ChampionTitle size="xs" />}
                    </p>
                    <p className="truncate text-xs text-chalk/45">
                      {entry.managerName}
                      {entry.isCurrentUser && <span className="ml-1.5 text-neon">(คุณ)</span>}
                    </p>
                  </div>
                </div>

                {/* จอเล็ก: ยัดข้อมูลของคอลัมน์ที่ซ่อนไปไว้ใต้ชื่อทีมแทน */}
                <p className="mt-1 flex items-center gap-2 sm:hidden">
                  <RankBadge points={entry.points} size="xs" />
                  <span className="font-mono text-[10px] text-chalk/45">
                    {entry.wins}/{entry.draws}/{entry.losses}
                  </span>
                </p>
              </td>

              <td className="hidden px-2 py-3 sm:table-cell sm:px-4">
                <RankBadge points={entry.points} size="xs" />
              </td>

              <td className="px-2 py-3 font-mono sm:px-4">{entry.teamOvr}</td>

              <td className="hidden px-2 py-3 font-mono text-chalk/60 md:table-cell md:px-4">
                {entry.wins}/{entry.draws}/{entry.losses}
              </td>

              <td className="whitespace-nowrap px-2 py-3 font-display text-lg text-gold sm:px-4">
                ⭐ {formatNumber(entry.points)}
              </td>

              <td className="px-2 py-3 text-right sm:px-4">
                {canPreview && (
                  <>
                    {/* จอเล็กใช้ลูกศรแทนคำ เพื่อไม่ให้ตารางกว้างเกินจอ */}
                    <span className="text-chalk/40 sm:hidden" aria-hidden>
                      ›
                    </span>
                    <span className="hidden whitespace-nowrap rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/50 sm:inline">
                      ดูทีม
                    </span>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
