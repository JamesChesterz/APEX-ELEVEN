/**
 * แถบบนสุด: ชื่อหน้า + สกุลเงินในเกม (เหรียญ/แต้ม) + ปุ่มเสียง + โปรไฟล์พร้อมระดับ
 *
 * ป้ายระดับ (BRONZE→CHAMPION) คิดจากคะแนน ranking สะสม
 * ส่วนฉายา 1ST CHAMPION สีทองจะขึ้นเฉพาะตอนผู้เล่นอยู่อันดับ 1 ของตารางเท่านั้น
 */
import { useEffect, useState } from 'react';
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import { isMuted, onMuteChange, playSfx, toggleMuted } from '@/services/sound';
import { formatNumber } from '@/utils/helpers';

interface HeaderProps {
  title: string;
  coins: number;
  /** แต้มแลกนักเตะ (จากการย่อยการ์ด) */
  points: number;
  /** แต้มตีบวก (จากภารกิจ/ลีก/ชนะ Matchmaking) */
  upgradePoints: number;
  /** คะแนน ranking สะสม ใช้คิดระดับ */
  rankPoints: number;
  /** true เมื่อผู้เล่นอยู่อันดับ 1 ของตารางอันดับ */
  isChampion: boolean;
  username: string;
  teamName: string;
  onLogout: () => void;
}

interface CurrencyPillProps {
  value: number;
  /** ป้ายกำกับภาษาอังกฤษที่แสดงจริงบนหัวข้อ เช่น MONEY */
  label: string;
  /** คลาสสีของป้ายกำกับ */
  tone: string;
  /** คำอธิบายภาษาไทยสำหรับ screen reader */
  description: string;
}

/**
 * ช่องสกุลเงินบนแถบบน — ใช้ข้อความกำกับแทนไอคอน
 * เพราะสามสกุล (เหรียญ / แต้มแลกนักเตะ / แต้มตีบวก) แยกกันด้วยไอคอนอย่างเดียวแล้วสับสน
 */
const CurrencyPill = ({ value, label, tone, description }: CurrencyPillProps) => (
  <div
    className="flex flex-col items-start rounded-lg border border-white/10 bg-ink-700/80 px-2.5 py-1 leading-none"
    title={description}
  >
    <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${tone}`}>{label}</span>
    <span
      className="mt-0.5 font-mono text-xs font-semibold tabular-nums"
      aria-label={description}
    >
      {formatNumber(value)}
    </span>
  </div>
);

/** ปุ่มเปิด/ปิดเสียงเอฟเฟกต์ (จำค่าไว้ในเครื่อง) */
const SoundButton = () => {
  const [muted, setMuted] = useState(isMuted);

  // สถานะเสียงเป็นค่ากลางของทั้งแอป จึงต้องฟังการเปลี่ยนจากที่อื่นด้วย
  useEffect(() => onMuteChange(setMuted), []);

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
      title={muted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-base transition-colors ${
        muted
          ? 'border-white/10 bg-ink-700/80 text-chalk/40'
          : 'border-neon/40 bg-neon/10 text-neon'
      }`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
};

export const Header = ({
  title,
  coins,
  points,
  upgradePoints,
  rankPoints,
  isChampion,
  username,
  teamName,
  onLogout,
}: HeaderProps) => (
  <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/5 bg-ink-800/70 px-4 backdrop-blur lg:px-6">
    <h1 className="text-xl uppercase lg:text-2xl">{title}</h1>

    <div className="ml-auto flex items-center gap-2 lg:gap-3">
      <div className="hidden items-center gap-2 md:flex">
        <CurrencyPill value={coins} label="Money" tone="text-gold" description="เหรียญ" />
        <CurrencyPill
          value={points}
          label="Exchange Point"
          tone="text-token"
          description="แต้มแลกนักเตะ"
        />
        <CurrencyPill
          value={upgradePoints}
          label="Upgrade Point"
          tone="text-kit"
          description="แต้มตีบวก"
        />
      </div>

      <SoundButton />

      <div className="flex items-center gap-2 pl-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-ink-500 to-ink-700 font-display text-sm ring-1 ring-white/10">
          {username.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold">{username}</span>
            {isChampion ? <ChampionTitle size="xs" /> : <RankBadge points={rankPoints} size="xs" />}
          </span>
          <span className="block text-[11px] text-chalk/50">{teamName}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          playSfx('click');
          onLogout();
        }}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/60 transition-colors hover:border-gem/50 hover:text-gem"
      >
        ออก
      </button>
    </div>
  </header>
);
