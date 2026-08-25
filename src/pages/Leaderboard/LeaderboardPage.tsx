/**
 * หน้า Leaderboard: ตารางอันดับผู้จัดการทีม (อัปเดตตามคะแนนที่เก็บได้จริง)
 *
 * บนสุดเป็นแถวการ์ดรางวัลของอันดับ 1–10 (ดู RankRewardShowcase)
 * ถัดลงมาเป็นตารางอันดับของผู้เล่นทุกคนที่สมัครเข้ามา แบ่งหน้าละ 20 แถว
 * อันดับถูกคำนวณจากรายชื่อทั้งหมดก่อนแบ่งหน้า เลขอันดับจึงเป็นอันดับจริงของทั้งเซิร์ฟเวอร์
 * ไม่ใช่ลำดับในหน้านั้น ๆ
 */
import { useEffect, useMemo, useState } from 'react';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Pagination } from '@/components/leaderboard/Pagination';
import { RankRewardShowcase } from '@/components/leaderboard/RankRewardShowcase';
import { SquadPreviewModal } from '@/components/leaderboard/SquadPreviewModal';
import { ChampionTitle } from '@/components/rank/RankBadge';
import { cn } from '@/utils/helpers';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useFreshProfile } from '@/hooks/useFreshProfile';
import { useOnline } from '@/hooks/useOnline';
import { useSeason } from '@/hooks/useSeason';

/** จำนวนแถวต่อหนึ่งหน้า */
const PAGE_SIZE = 20;

export const LeaderboardPage = () => {
  const { record } = useMatchmaking();
  const { season, daysLeft } = useSeason();
  const { enabled, connected, playerCount } = useOnline();
  /** uid ของทีมที่กำลังเปิดดูตัวจริง (null = ไม่ได้เปิด) */
  const [previewUid, setPreviewUid] = useState<string | null>(null);
  const preview = useFreshProfile(previewUid);
  const [page, setPage] = useState(1);

  const entries = useLeaderboard();
  const myRank = entries.find((entry) => entry.isCurrentUser)?.rank ?? 0;

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

  /**
   * จำนวนผู้เล่นลดลงได้ระหว่างเปิดหน้าค้างไว้ (เช่นซีซันรีเซ็ต)
   * ถ้าหน้าที่เปิดอยู่หายไปแล้วต้องดึงกลับมาหน้าสุดท้าย ไม่งั้นจะเห็นตารางว่างเปล่า
   */
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visible = useMemo(
    () => entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [entries, page],
  );

  /** หน้าที่มีแถวของเราอยู่ — ใช้กับปุ่มลัด "ไปอันดับของฉัน" */
  const myPage = myRank > 0 ? Math.ceil(myRank / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">ตารางอันดับ</h2>
          <p className="text-sm text-chalk/50">
            ซีซัน {season.number} · เหลืออีก {daysLeft} วัน · คุณอยู่อันดับ {myRank || '—'} ด้วย{' '}
            {record.points} ⭐
          </p>

          {/* บอกให้รู้ว่ากำลังดูอันดับของผู้เล่นจริงอยู่ หรือยังเป็นตารางออฟไลน์ */}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-chalk/40">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connected ? 'bg-neon' : enabled ? 'bg-gold' : 'bg-chalk/30',
              )}
              aria-hidden
            />
            {connected
              ? `ผู้เล่นทั้งหมด ${playerCount} คน · ตารางนี้แสดง ${entries.length} อันดับแรก`
              : enabled
                ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์…'
                : 'โหมดออฟไลน์ — ตารางนี้เป็นทีมจำลอง'}
          </p>
        </div>

        {/* ฉายาสีทองนี้เป็นของอันดับ 1 คนเดียวเท่านั้น */}
        {myRank === 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-chalk/60">ฉายาปัจจุบันของคุณ</span>
            <ChampionTitle size="md" />
          </div>
        )}
      </div>

      {/* การ์ดรางวัลอันดับ 1–10 — อันดับ 1 อยู่กลาง ไล่ออกซ้าย-ขวาเป็นอันดับ 2–10 */}
      <RankRewardShowcase myRank={myRank} />

      <LeaderboardTable entries={visible} onSelect={setPreviewUid} />

      <div className="flex flex-col items-center gap-3">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <p className="text-xs text-chalk/40">
          หน้า {page}/{totalPages} · แสดงอันดับ {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, entries.length)} จาก {entries.length} ทีม
          {myPage > 0 && myPage !== page && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setPage(myPage)}
                className="font-bold text-neon underline-offset-2 hover:underline"
              >
                ไปอันดับของฉัน (#{myRank})
              </button>
            </>
          )}
        </p>
      </div>

      {/* ดึงโปรไฟล์ใบเดียวใหม่ตอนกดเปิด — ตัวจริงที่เห็นจึงสดเสมอ ไม่ต้องรอรอบดึงตาราง */}
      <SquadPreviewModal profile={preview} onClose={() => setPreviewUid(null)} />
    </div>
  );
};
