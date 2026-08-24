/**
 * แผงค่าพลังทีม: ตราค่าพลังรวม + แยกเกมรุก/กลาง/รับ
 *
 * ตัวเลขบนตราคือค่าพลังพื้นฐาน (หักค่าปรับผิดตำแหน่งแล้ว)
 * ส่วนบรรทัดล่างคือค่าที่ใช้ตัดสินแพ้ชนะจริง = พื้นฐาน + โบนัสเคมี
 */
import type { TeamRating } from '@/types/team';
import { cn } from '@/utils/helpers';

interface TeamOvrPanelProps {
  rating: TeamRating;
}

const LINES = [
  { key: 'attack', label: 'Attack', tone: 'bg-gem/20 text-gem' },
  { key: 'midfield', label: 'Midfield', tone: 'bg-neon/20 text-neon' },
  { key: 'defense', label: 'Defense', tone: 'bg-sky-400/20 text-sky-300' },
] as const;

export const TeamOvrPanel = ({ rating }: TeamOvrPanelProps) => {
  const values = { attack: rating.attack, midfield: rating.midfield, defense: rating.defence };

  return (
    <section className="glass-panel p-4">
      <p className="panel-title">Team OVR</p>

      <div className="mt-3 flex items-center gap-4">
        {/* ตราค่าพลังรวม */}
        <div className="relative flex h-[76px] w-[64px] shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-[10px] bg-gradient-to-b from-[#3B6BD6] via-[#1E3E8F] to-[#0E1E4A] [clip-path:polygon(0_0,100%_0,100%_72%,50%_100%,0_72%)] ring-1 ring-gold/60" />
          <span className="relative font-display text-3xl leading-none">{rating.ovr}</span>
        </div>

        <dl className="flex-1 space-y-2">
          {LINES.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <dt className="flex flex-1 items-center gap-2 text-[11px] uppercase tracking-wide text-chalk/60">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${line.tone}`}
                  aria-hidden
                >
                  ●
                </span>
                {line.label}
              </dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{values[line.key]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ค่าพลังที่ใช้ลงแข่งจริง — ต่างจากตราด้านบนเมื่อเคมีดีหรือแย่กว่าปกติ */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
        <span className="eyebrow">พลังตอนลงแข่ง</span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-lg leading-none">{rating.matchOvr}</span>
          {rating.chemistryBonus !== 0 && (
            <span
              className={cn(
                'font-mono text-[11px]',
                rating.chemistryBonus > 0 ? 'text-neon' : 'text-[#F0A070]',
              )}
            >
              {rating.chemistryBonus > 0 ? '+' : ''}
              {rating.chemistryBonus} เคมี
            </span>
          )}
        </span>
      </div>
    </section>
  );
};
