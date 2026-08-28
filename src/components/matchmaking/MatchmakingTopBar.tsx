/**
 * แถบบนสุดของหน้า MATCHMAKING
 *
 * ซ้าย  = ชื่อหน้า
 * กลาง  = สกอร์บอร์ดยกพื้น (ชื่อ + ค่าพลัง + ตราของทั้งสองทีม, สกอร์, นาฬิกา)
 * ขวา   = ปุ่มเสียง, โปรไฟล์พร้อมป้ายระดับ, ปุ่มออกจากหน้าจอแข่ง
 *
 * สกอร์บอร์ดโชว์ตลอดเวลา ตั้งแต่ยังไม่เจอคู่ (0–0, 00:00) ไปจนจบเกม
 * เพื่อให้ตำแหน่งของตัวเลขไม่ขยับระหว่างแมตช์
 */
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { TeamCrest } from '@/components/matchmaking/TeamCrest';
import { clockText } from '@/components/matchmaking/squadLabels';
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import { isMuted, onMuteChange, toggleMuted } from '@/services/sound';
import { cn } from '@/utils/helpers';

interface MatchmakingTopBarProps {
  teamName: string;
  teamOvr: number;
  opponentName: string | null;
  opponentOvr: number | null;
  teamScore: number;
  opponentScore: number;
  /** นาทีในเกมตอนนี้ (0 = ยังไม่เขี่ยบอล) */
  minute: number;
  /** true = กำลังแข่งอยู่ ใช้ทำจุดสีเขียวกะพริบข้างนาฬิกา */
  live: boolean;
  username: string;
  avatar?: string;
  rankPoints: number;
  isChampion: boolean;
  onExit: () => void;
}

/** ชื่อทีมกับค่าพลังฝั่งหนึ่งของสกอร์บอร์ด */
const ScoreTeam = ({
  name,
  ovr,
  align,
}: {
  name: string;
  ovr: number | null;
  align: 'left' | 'right';
}) => (
  <div
    className={cn(
      'flex min-w-0 items-center gap-2.5',
      align === 'right' && 'flex-row-reverse text-right',
    )}
  >
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-semibold leading-tight text-chalk">
        {name}
      </span>
      <span className="block font-mono text-[10px] leading-tight tabular-nums text-chalk/45">
        OVR {ovr ?? '—'}
      </span>
    </span>
    <TeamCrest name={name} size="md" />
  </div>
);

const SoundButton = () => {
  const [muted, setMuted] = useState(isMuted);
  useEffect(() => onMuteChange(setMuted), []);

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border text-base transition-colors',
        muted
          ? 'border-white/10 bg-white/5 text-chalk/40'
          : 'border-token/50 bg-token/10 text-token',
      )}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
};

export const MatchmakingTopBar = ({
  teamName,
  teamOvr,
  opponentName,
  opponentOvr,
  teamScore,
  opponentScore,
  minute,
  live,
  username,
  avatar,
  rankPoints,
  isChampion,
  onExit,
}: MatchmakingTopBarProps) => (
  <header className="relative z-20 flex shrink-0 items-start justify-between gap-3 px-4 pt-3 lg:min-h-[86px]">
    {/* ชื่อหน้า */}
    <div className="pt-1">
      <h1 className="font-display text-2xl uppercase leading-none tracking-wide text-chalk lg:text-[28px]">
        Matchmaking
      </h1>
      <p className="mt-1 text-[11px] leading-none text-chalk/45">ค้นหาคู่ต่อสู้</p>
    </div>

    {/* สกอร์บอร์ดยกพื้น — ห้อยลงมาจากขอบบนของจอ */}
    <div className="pointer-events-none absolute left-1/2 top-0 hidden -translate-x-1/2 lg:block">
      <div className="flex items-stretch gap-4 rounded-b-2xl border border-t-0 border-white/12 bg-[#080B11]/95 px-5 pb-2.5 pt-3 shadow-glass backdrop-blur-md">
        <div className="flex w-[190px] items-center justify-end">
          <ScoreTeam name={teamName} ovr={teamOvr} align="left" />
        </div>

        <div className="flex flex-col items-center justify-center border-x border-white/10 px-5">
          <p className="flex items-center gap-2 font-display text-[28px] leading-none tabular-nums text-chalk">
            <span>{teamScore}</span>
            <span className="text-chalk/25">-</span>
            <span>{opponentScore}</span>
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-[11px] leading-none tabular-nums text-chalk/45">
            {live && <span className="animate-pulse text-neon">●</span>}
            {clockText(minute)}
          </p>
        </div>

        <div className="flex w-[190px] items-center">
          <ScoreTeam name={opponentName ?? 'รอคู่แข่ง'} ovr={opponentOvr} align="right" />
        </div>
      </div>
    </div>

    {/* โปรไฟล์ + ปุ่มออก */}
    <div className="flex items-center gap-2.5 pt-0.5">
      <SoundButton />

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3">
        <Avatar src={avatar} name={username} size="sm" />
        <span className="hidden text-[12px] font-semibold text-chalk sm:block">{username}</span>
        {isChampion ? <ChampionTitle size="xs" /> : <RankBadge points={rankPoints} size="xs" />}
      </div>

      <button
        type="button"
        onClick={onExit}
        className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-[12px] font-semibold text-chalk/70 transition-colors hover:border-white/30 hover:text-chalk"
      >
        ออก
      </button>
    </div>
  </header>
);
