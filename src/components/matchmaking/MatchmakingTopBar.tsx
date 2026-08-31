/**
 * แถบบนสุดของหน้า MATCHMAKING
 *
 * ซ้าย = ชื่อหน้า
 * ขวา  = ปุ่มเสียง, โปรไฟล์พร้อมป้ายระดับ, ปุ่มออกจากหน้าจอแข่ง
 *
 * สกอร์ระหว่างแข่งอยู่บนสนามจำลองแล้ว (วาดโดย match-renderer) แถบนี้จึงไม่ต้องมีสกอร์ซ้ำ
 * เหลือแค่ชื่อหน้า โปรไฟล์ผู้เล่น และปุ่มออก
 */
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import { isMuted, onMuteChange, toggleMuted } from '@/services/sound';
import { cn } from '@/utils/helpers';

interface MatchmakingTopBarProps {
  username: string;
  avatar?: string;
  rankPoints: number;
  isChampion: boolean;
  /** true = กำลังแข่งอยู่ ห้ามออกจากหน้าจอจนกว่าจะจบนัด */
  matchLocked?: boolean;
  onExit: () => void;
}

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
  username,
  avatar,
  rankPoints,
  isChampion,
  matchLocked = false,
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
        disabled={matchLocked}
        title={matchLocked ? 'กำลังแข่งอยู่ — ดูจนจบนัดก่อน' : undefined}
        className={cn(
          'rounded-lg border px-4 py-2 text-[12px] font-semibold transition-colors',
          matchLocked
            ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-chalk/25'
            : 'border-white/15 bg-white/[0.04] text-chalk/70 hover:border-white/30 hover:text-chalk',
        )}
      >
        {matchLocked ? '🔒 แข่งอยู่' : 'ออก'}
      </button>
    </div>
  </header>
);
