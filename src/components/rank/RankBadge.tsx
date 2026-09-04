/**
 * ป้ายแสดงระดับผู้เล่น (BRONZE / GOLD / PLATINUM / LEGEND / CHAMPION)
 * และป้ายฉายาของสามอันดับแรก (1ST / 2ND / 3RD CHAMPION — ทอง เงิน ทองแดง)
 *
 * ในตารางอันดับ ป้ายฉายา "แทนที่" ป้ายระดับของสามอันดับแรก ไม่ได้แสดงคู่กัน
 *
 * สีมาจากข้อมูลใน services/rank.ts จึงใช้ inline style ไม่ใช่คลาส Tailwind คงที่
 */
import { alpha } from '@/components/pack/rarityFx';
import { getChampionTitle, getRankProgress, getRankTier, type RankTier } from '@/services/rank';
import { cn, formatNumber } from '@/utils/helpers';

type BadgeSize = 'xs' | 'sm' | 'md';

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[9px] tracking-[0.12em]',
  sm: 'px-2 py-0.5 text-[10px] tracking-[0.14em]',
  md: 'px-3 py-1 text-xs tracking-[0.18em]',
};

interface RankBadgeProps {
  /** ส่งคะแนนมา แล้วให้ป้ายคิดระดับเอง */
  points?: number;
  /** หรือส่งระดับมาตรง ๆ ก็ได้ */
  tier?: RankTier;
  size?: BadgeSize;
  className?: string;
}

export const RankBadge = ({ points = 0, tier, size = 'sm', className }: RankBadgeProps) => {
  const resolved = tier ?? getRankTier(points);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-mono font-bold uppercase ring-1',
        SIZE_CLASS[size],
        className,
      )}
      style={{
        color: resolved.accent,
        backgroundColor: alpha(resolved.color, 0.16),
        boxShadow: `inset 0 0 0 1px ${alpha(resolved.color, 0.45)}`,
      }}
      title={resolved.description}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: resolved.color, boxShadow: `0 0 6px ${resolved.color}` }}
        aria-hidden
      />
      {resolved.label}
    </span>
  );
};

/**
 * ฉายาของสามอันดับแรก — ป้ายไล่เฉดสีเหรียญ มีแสงเรืองรอบป้าย
 *
 * ไม่ส่ง rank มา = อันดับ 1 (ค่าเดิมก่อนมีป้ายอันดับ 2–3 โค้ดเก่าจึงไม่ต้องแก้)
 * ส่งอันดับที่ไม่ได้อยู่ในสามอันดับแรกมา = ไม่แสดงอะไรเลย
 */
export const ChampionTitle = ({
  rank = 1,
  size = 'sm',
  className,
}: {
  /** อันดับในตาราง (1–3) */
  rank?: number;
  size?: BadgeSize;
  className?: string;
}) => {
  const title = getChampionTitle(rank);
  if (!title) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-mono font-bold uppercase',
        SIZE_CLASS[size],
        className,
      )}
      style={{
        color: title.ink,
        backgroundImage: `linear-gradient(135deg, ${title.accent} 0%, ${title.color} 45%, ${alpha(title.color, 0.85)} 100%)`,
        boxShadow: `0 0 0 1px ${alpha(title.color, 0.8)}, 0 0 14px ${alpha(title.color, 0.55)}`,
        textShadow: '0 1px 0 rgba(255,255,255,0.35)',
      }}
      title={`ฉายาของผู้เล่นอันดับ ${rank} ของตารางอันดับ`}
    >
      <span aria-hidden>★</span>
      {title.label}
    </span>
  );
};

/** หลอดความคืบหน้าไปสู่ระดับถัดไป ใช้ในหน้าโปรไฟล์ */
export const RankProgressBar = ({ points }: { points: number }) => {
  const { tier, next, remaining, percent } = getRankProgress(points);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <RankBadge tier={tier} size="md" />
        {next ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-chalk/45">
            อีก {formatNumber(remaining)} แต้ม → {next.label}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-gold">
            ระดับสูงสุดแล้ว
          </span>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${percent}%`,
            backgroundImage: `linear-gradient(90deg, ${tier.color}, ${tier.accent})`,
            boxShadow: `0 0 12px ${alpha(tier.color, 0.6)}`,
          }}
        />
      </div>
    </div>
  );
};
