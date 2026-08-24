/**
 * หน้า Match — แบ่งเป็นสองส่วน
 *   1. ลีกประจำวัน: เข้าร่วมครั้งเดียว ระบบแข่งให้เองทุก 30 นาที มีตารางอันดับประจำวัน
 *   2. แมตช์กระชับมิตร: กดท้าทีมในระบบเองเมื่อไหร่ก็ได้ ดูถ่ายทอดสดได้
 * ด้านล่างเป็นผลย้อนหลังของทั้งสองโหมด กดดูไทม์ไลน์ประตูรายนัดได้
 */
import { useState } from 'react';
import { LeaguePanel } from '@/components/league/LeaguePanel';
import { LeagueStandingsTable } from '@/components/league/LeagueStandingsTable';
import { MatchHistoryList } from '@/components/league/MatchHistoryList';
import { MatchLiveOverlay } from '@/components/matchmaking/MatchLiveOverlay';
import { RewardsPanel } from '@/components/league/RewardsPanel';
import { OpponentCard } from '@/components/matchmaking/OpponentCard';
import { useLeague } from '@/hooks/useLeague';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useTeam } from '@/hooks/useTeam';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

const TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'league', label: 'ลีก' },
  { key: 'friendly', label: 'กระชับมิตร' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export const MatchPage = () => {
  const { opponents, state, record, history, squadIncomplete, challenge } = useMatchmaking();
  const { standings, rank, roundsPlayed } = useLeague();
  const { rating } = useTeam();
  const [tab, setTab] = useState<Tab>('all');

  /** กำลังอยู่ในคิวหรือกำลังแข่ง = ห้ามท้าทีมอื่นซ้อน */
  const busy = state.status === 'searching' || state.status === 'playing';

  const visible = history.filter((match) => {
    if (tab === 'league') return match.mode === 'league';
    if (tab === 'friendly') return match.mode !== 'league';
    return true;
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl">การแข่งขัน</h2>
          <p className="text-sm text-chalk/50">
            ทีมของคุณ OVR {rating.matchOvr} · {record.points} ⭐ ในซีซันนี้ · วันนี้แข่งไปแล้ว{' '}
            {roundsPlayed} รอบ อยู่อันดับ {rank}
          </p>
        </div>

        <LeaguePanel />

        {/* ตารางอันดับประจำวัน */}
        <section className="space-y-2">
          <p className="eyebrow">ตารางอันดับประจำวัน · รีเซ็ตทุก 06:00 น.</p>
          <LeagueStandingsTable standings={standings} />
        </section>

        {/* แมตช์กระชับมิตร */}
        <section className="space-y-3">
          <div>
            <p className="eyebrow">แมตช์กระชับมิตร</p>
            <p className="text-xs text-chalk/45">
              ท้าทีมของผู้เล่นจริงได้ทุกเมื่อ ไม่ต้องรอให้เขาออนไลน์ · ชนะ +1 ⭐ แพ้ −1 ⭐
              · ท้าคนเดิมซ้ำได้อีกครั้งหลังพ้น 30 นาที · ใช้ทีมชุดล่าสุดจากหน้า MY TEAM
            </p>
          </div>
          {opponents.map((opponent) => (
            <OpponentCard
              key={opponent.id}
              opponent={opponent}
              teamOvr={rating.matchOvr}
              onChallenge={challenge}
              disabled={busy || squadIncomplete}
            />
          ))}
        </section>

        {/* ผลย้อนหลัง */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">ผลการแข่งย้อนหลัง ({history.length} นัด)</p>
            <div className="flex gap-1.5">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setTab(item.key);
                  }}
                  className={cn(
                    'rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    tab === item.key
                      ? 'bg-neon text-ink-900'
                      : 'bg-white/5 text-chalk/55 hover:text-chalk',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <MatchHistoryList matches={visible} />
        </section>
      </div>

      {/* คอลัมน์ขวา = รายละเอียดรางวัล เกาะขอบบนไว้ตอนเลื่อนอ่านผลย้อนหลัง */}
      <div className="xl:sticky xl:top-0 xl:self-start">
        <RewardsPanel />
      </div>

      {/* แผงจับคู่โผล่เป็นหน้าต่างลอยเฉพาะตอนมีแมตช์กระชับมิตรค้างอยู่ */}
      <MatchLiveOverlay />
    </div>
  );
};
