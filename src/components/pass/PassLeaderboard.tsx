/**
 * ตารางอันดับ "แต้มพาส (XP)" ข้างหน้า Pass
 *
 * ใช้ข้อมูลชุดเดียวกับตารางอันดับดาว (collection profiles) แต่เรียงด้วย passXp แทน
 * ไม่ได้ยิงคำขอเพิ่มเลย — โปรไฟล์ทุกใบถูกโหลดไว้แล้วตั้งแต่เปิดเกม
 *
 * สามอันดับแรกขึ้นเป็นแท่นโพเดียม (2-1-3 เหมือนโพเดียมจริง) ที่เหลือเป็นรายการเลื่อน
 * แถวของตัวเองถูกเน้นสีไว้เสมอ แม้จะอยู่อันดับลึก ๆ ก็ยังหาตัวเองเจอ
 */
import { Avatar } from '@/components/profile/Avatar';
import type { PublicProfile } from '@/services/firebase/profiles';
import { cn, formatNumber } from '@/utils/helpers';

interface PassLeaderboardProps {
  profiles: PublicProfile[];
  /** uid ของตัวเอง ใช้เน้นแถว */
  myUid?: string;
  /** XP ของตัวเอง — ใช้ตอนโปรไฟล์ยังประกาศไม่ทัน (เพิ่งได้ XP มาสด ๆ) */
  myXp: number;
  myName: string;
}

/** จำนวนแถวที่โชว์ในรายการ (ไม่รวมโพเดียม) */
const ROWS = 20;

export const PassLeaderboard = ({ profiles, myUid, myXp, myName }: PassLeaderboardProps) => {
  /*
   * XP ของตัวเองอ่านจากเครื่องเราเสมอ ไม่ใช่จากโปรไฟล์ที่ประกาศไป
   * เพราะการประกาศมีหน่วง 15 วินาที ถ้าใช้ค่าจากโปรไฟล์ ผู้เล่นจะเพิ่งได้ XP
   * แล้วเห็นตัวเลขในตารางไม่ขยับ นึกว่าระบบพัง
   */
  const ranked = [...profiles]
    .map((profile) =>
      profile.uid === myUid ? { ...profile, passXp: Math.max(profile.passXp, myXp) } : profile,
    )
    .sort((a, b) => b.passXp - a.passXp || b.points - a.points)
    .map((profile, index) => ({ ...profile, rank: index + 1 }));

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3, 3 + ROWS);
  const mine = ranked.find((entry) => entry.uid === myUid);

  return (
    <aside className="glass-panel flex min-h-0 flex-col gap-3 p-3 xl:w-[300px]">
      <p className="font-display text-lg uppercase">🏆 Leaderboard XP</p>

      {ranked.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/45">
          ยังไม่มีใครเก็บแต้มพาสในซีซันนี้
        </p>
      ) : (
        <>
          {/* ── โพเดียม: เรียง 2-1-3 ให้อันดับหนึ่งอยู่กลางและสูงที่สุด ── */}
          <div className="flex items-end justify-center gap-1.5">
            {[podium[1], podium[0], podium[2]].map((entry, index) =>
              entry ? (
                <PodiumStep
                  key={entry.uid}
                  entry={entry}
                  place={index === 1 ? 1 : index === 0 ? 2 : 3}
                  mine={entry.uid === myUid}
                />
              ) : (
                <span key={`empty-${index}`} className="w-[30%]" />
              ),
            )}
          </div>

          {/* ── อันดับที่เหลือ ── */}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
            {rest.map((entry) => (
              <Row key={entry.uid} entry={entry} mine={entry.uid === myUid} />
            ))}
          </div>

          {/* อันดับของตัวเองถ้าหลุดออกนอกรายการที่โชว์ */}
          {mine && mine.rank > 3 + ROWS && (
            <div className="border-t border-white/10 pt-2">
              <Row entry={mine} mine />
            </div>
          )}

          {!mine && (
            <p className="border-t border-white/10 pt-2 text-center font-mono text-[10px] text-chalk/40">
              {myName} · {formatNumber(myXp)} XP (ยังไม่ขึ้นตาราง)
            </p>
          )}
        </>
      )}
    </aside>
  );
};

/** สีประจำอันดับบนโพเดียม */
const PLACE_STYLE: Record<number, { box: string; text: string; height: string }> = {
  1: { box: 'bg-gold', text: 'text-ink-900', height: 'h-16' },
  2: { box: 'bg-chalk/70', text: 'text-ink-900', height: 'h-12' },
  3: { box: 'bg-[#C08050]', text: 'text-ink-900', height: 'h-10' },
};

const PodiumStep = ({
  entry,
  place,
  mine,
}: {
  entry: PublicProfile & { rank: number };
  place: number;
  mine: boolean;
}) => {
  const style = PLACE_STYLE[place];

  return (
    <div className="flex w-[30%] flex-col items-center gap-1">
      <Avatar src={entry.avatar} name={entry.managerName} size={place === 1 ? 'sm' : 'xs'} />
      <span
        className={cn(
          'w-full truncate text-center text-[10px] font-semibold',
          mine ? 'text-neon' : 'text-chalk/80',
        )}
      >
        {entry.managerName}
      </span>
      <span className="font-mono text-[10px] text-gold">{formatNumber(entry.passXp)} XP</span>
      <span
        className={cn(
          'flex w-full items-start justify-center rounded-t-lg pt-1 font-display text-xl',
          style.box,
          style.text,
          style.height,
        )}
      >
        {place}
      </span>
    </div>
  );
};

const Row = ({ entry, mine }: { entry: PublicProfile & { rank: number }; mine: boolean }) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-lg px-2 py-1.5',
      mine ? 'bg-neon/15 ring-1 ring-neon/40' : 'hover:bg-white/[0.04]',
    )}
  >
    <span className="w-5 shrink-0 text-center font-mono text-[10px] text-chalk/40">{entry.rank}</span>
    <Avatar src={entry.avatar} name={entry.managerName} size="xs" />
    <span className={cn('min-w-0 flex-1 truncate text-[11px]', mine && 'font-bold text-neon')}>
      {entry.managerName}
    </span>
    <span className="shrink-0 font-mono text-[11px] font-bold text-gold">
      {formatNumber(entry.passXp)}
    </span>
  </div>
);
