/**
 * หน้า MATCHMAKING — ท้าผู้เล่นจริงแบบเลือกเวลาเอง
 *
 * เดิมแผงนี้ซ่อนอยู่ในแดชบอร์ดล่างของหน้า MY TEAM ซึ่งแคบและต้องเลื่อนหา
 * ย้ายมาเป็นเมนูหลักเพื่อให้กดถึงได้ทันทีและมีที่พอสำหรับถ่ายทอดสดเต็มจอ
 *
 * ต่างจากลีกประจำวัน (เมนู MATCH) ตรงที่ลีกเดินรอบให้เองทุก 30 นาที
 * ส่วนหน้านี้คือการลงแข่งเมื่อไหร่ก็ได้ที่อยากลง
 */
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { MatchHistoryList } from '@/components/league/MatchHistoryList';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useTeam } from '@/hooks/useTeam';
import { formatNumber } from '@/utils/helpers';

export const MatchmakingPage = () => {
  const { record, history } = useMatchmaking();
  const { rating } = useTeam();

  /** ผลของนัดที่จับคู่เอง — นัดลีกดูได้ที่เมนู MATCH */
  const friendlyHistory = history.filter((match) => match.mode !== 'league');

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl">จับคู่แข่งขัน</h2>
          <p className="text-sm text-chalk/50">
            ทีมของคุณ OVR {rating.matchOvr} · {formatNumber(record.points)} ⭐ ในซีซันนี้ ·
            ชนะ {record.wins} เสมอ {record.draws} แพ้ {record.losses}
          </p>
        </div>

        <section className="space-y-2">
          <p className="eyebrow">ผลย้อนหลังของนัดที่จับคู่เอง ({friendlyHistory.length} นัด)</p>
          <MatchHistoryList matches={friendlyHistory} />
        </section>
      </div>

      {/* แผงจับคู่เกาะขอบบนไว้ตอนเลื่อนอ่านผลย้อนหลัง */}
      <div className="xl:sticky xl:top-0 xl:self-start">
        <MatchmakingPanel />
      </div>
    </div>
  );
};
