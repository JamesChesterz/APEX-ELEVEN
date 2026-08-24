/**
 * หน้า Match — โฟกัสที่ "ลีกประจำวัน" อย่างเดียว
 *
 *   1. แผงลีก: เข้าร่วมครั้งเดียว ระบบแข่งให้เองทุก 30 นาที
 *   2. ตารางอันดับประจำวันของลีกเรา (10 ทีม เป็นผู้เล่นจริงที่ค่าพลังใกล้กัน)
 *      กดที่แถวไหนก็ได้เพื่อส่องตัวจริง 11 คนของทีมนั้น
 *   3. ผลการแข่งย้อนหลัง — เฉพาะนัดในลีกประจำวัน
 *
 * แมตช์กระชับมิตรถูกย้ายออกจากหน้านี้แล้ว เพราะระบบ Matchmaking
 * อยู่ในหน้า MY TEAM (แถบแดชบอร์ดล่าง) อยู่แล้ว ไม่ต้องมีสองทางเข้า
 */
import { useState } from 'react';
import { SquadPreviewModal } from '@/components/leaderboard/SquadPreviewModal';
import { LeaguePanel } from '@/components/league/LeaguePanel';
import { LeagueStandingsTable } from '@/components/league/LeagueStandingsTable';
import { MatchHistoryList } from '@/components/league/MatchHistoryList';
import { RewardsPanel } from '@/components/league/RewardsPanel';
import { useLeague } from '@/hooks/useLeague';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { useTeam } from '@/hooks/useTeam';

export const MatchPage = () => {
  const { record, history } = useMatchmaking();
  const { standings, rank, roundsPlayed, members, realCount } = useLeague();
  const { profileByUid } = useOnline();
  const { rating } = useTeam();

  /** uid ของทีมที่กำลังเปิดดูตัวจริง (null = ไม่ได้เปิด) */
  const [previewUid, setPreviewUid] = useState<string | null>(null);

  /** ผลย้อนหลังของลีกเท่านั้น — นัดจับคู่เองดูได้ที่หน้า MY TEAM */
  const leagueHistory = history.filter((match) => match.mode === 'league');

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl">ลีกประจำวัน</h2>
          <p className="text-sm text-chalk/50">
            ทีมของคุณ OVR {rating.matchOvr} · {record.points} ⭐ ในซีซันนี้ · วันนี้แข่งไปแล้ว{' '}
            {roundsPlayed} รอบ อยู่อันดับ {rank}/{standings.length}
          </p>
        </div>

        <LeaguePanel />

        {/* ตารางอันดับประจำวัน */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">ตารางอันดับลีกของคุณ · รีเซ็ตทุก 06:00 น.</p>
            <p className="font-mono text-[10px] text-chalk/40">
              ผู้เล่นจริงในลีกนี้ {realCount}/{members.length} ทีม · กดที่แถวเพื่อดูทีมของเขา
            </p>
          </div>
          <LeagueStandingsTable standings={standings} onSelect={setPreviewUid} />
        </section>

        {/* ผลย้อนหลังของลีก */}
        <section className="space-y-2">
          <p className="eyebrow">ผลการแข่งลีกย้อนหลัง ({leagueHistory.length} นัด)</p>
          <MatchHistoryList matches={leagueHistory} />
        </section>
      </div>

      {/* คอลัมน์ขวา = รายละเอียดรางวัล เกาะขอบบนไว้ตอนเลื่อนอ่านผลย้อนหลัง */}
      <div className="xl:sticky xl:top-0 xl:self-start">
        <RewardsPanel />
      </div>

      {/* ส่องตัวจริง 11 คนของเพื่อนร่วมลีก */}
      <SquadPreviewModal
        profile={previewUid ? profileByUid[previewUid] ?? null : null}
        onClose={() => setPreviewUid(null)}
      />
    </div>
  );
};
