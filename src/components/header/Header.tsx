/**
 * แถบบนสุด: ชื่อหน้า + สกุลเงินในเกม (เหรียญ/แต้ม) + ปุ่มเสียง + โปรไฟล์พร้อมระดับ
 *
 * ป้ายระดับ (BRONZE→CHAMPION) คิดจากคะแนน ranking สะสม
 * ส่วนฉายา 1ST CHAMPION สีทองจะขึ้นเฉพาะตอนผู้เล่นอยู่อันดับ 1 ของตารางเท่านั้น
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/profile/Avatar';
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
  /** รูปโปรไฟล์ (ไม่มี = โชว์ตัวอักษรแรกของชื่อ) */
  avatar?: string;
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
  avatar,
  onLogout,
}: HeaderProps) => (
  /*
   * มือถือ = 2 แถว (ชื่อหน้า+โปรไฟล์ / สกุลเงิน) เพราะยัดแถวเดียวแล้วตัวเลขถูกบีบจนอ่านไม่ออก
   * จอ lg ขึ้นไป = แถวเดียวเหมือนเดิม
   * pt-[env(safe-area-inset-top)] กันหัวข้อมุดใต้รอยบากตอนเปิดจากไอคอนบนจอโฮม
   */
  <header className="shrink-0 border-b border-white/5 bg-ink-800/70 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-6">
    <div className="flex min-h-[3.25rem] items-center gap-3 lg:h-16 lg:gap-4">
      <h1 className="truncate text-lg uppercase sm:text-xl lg:text-2xl">{title}</h1>

      <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
        <div className="hidden items-center gap-2 lg:flex">
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

        {/*
          * กดที่รูป/ชื่อ = ไปหน้าโปรไฟล์ (ที่ตั้งรูปและดูคลังการ์ด)
          * คนส่วนใหญ่กดที่รูปตัวเองเป็นสัญชาตญาณ ก่อนหน้านี้กดแล้วไม่มีอะไรเกิดขึ้น
          */}
        <Link
          to="/settings"
          title="ตั้งค่าบัญชีและเปลี่ยนรูปโปรไฟล์"
          className="flex items-center gap-2 rounded-lg pl-1 transition-colors hover:bg-white/5"
        >
          <Avatar src={avatar} name={username} size="sm" />
          <span className="hidden leading-tight lg:block">
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">{username}</span>
              {isChampion ? (
                <ChampionTitle size="xs" />
              ) : (
                <RankBadge points={rankPoints} size="xs" />
              )}
            </span>
            <span className="block text-[11px] text-chalk/50">{teamName}</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            onLogout();
          }}
          className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/60 transition-colors hover:border-gem/50 hover:text-gem lg:px-3"
        >
          ออก
        </button>
      </div>
    </div>

    {/* แถวสกุลเงินของมือถือ — เลื่อนแนวนอนได้เผื่อจอแคบมาก */}
    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:hidden" style={{ scrollbarWidth: 'none' }}>
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
      <span className="shrink-0 pl-1">
        {isChampion ? <ChampionTitle size="xs" /> : <RankBadge points={rankPoints} size="xs" />}
      </span>
    </div>
  </header>
);
