/**
 * ป้ายรางวัลหนึ่งชิ้น — ไอคอน + ชื่อ/จำนวน
 *
 * ใช้ทั้งหน้ารางวัลล็อกอินและหน้าแอดมิน จะได้เห็นของหน้าตาเดียวกันทั้งสองฝั่ง
 * รางวัลชนิดไหนก็วาดได้ เพราะอ่านจากทะเบียนกลางใน services/rewards.ts
 */
import { getRewardKind, rewardImage, describeReward } from '@/services/rewards';
import type { GameReward } from '@/types/reward';
import { cn } from '@/utils/helpers';

interface RewardChipProps {
  reward: GameReward;
  /** ขนาดไอคอนเป็น px */
  size?: number;
  /** แสดงข้อความใต้ไอคอนไหม */
  showLabel?: boolean;
  className?: string;
}

export const RewardChip = ({
  reward,
  size = 44,
  showLabel = true,
  className,
}: RewardChipProps) => {
  const kind = getRewardKind(reward.kind);
  const image = rewardImage(reward);

  return (
    <span className={cn('flex flex-col items-center gap-1 text-center', className)}>
      <span
        style={{ width: size, height: size }}
        className="grid place-items-center rounded-lg bg-white/[0.06]"
      >
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
        ) : (
          <span className={cn('font-display text-base leading-none', kind.tone)}>{kind.glyph}</span>
        )}
      </span>

      {showLabel && (
        <span className="w-full truncate font-mono text-[10px] text-chalk/60">
          {describeReward(reward)}
        </span>
      )}
    </span>
  );
};
