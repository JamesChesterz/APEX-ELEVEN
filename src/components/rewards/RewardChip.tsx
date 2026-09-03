/**
 * ป้ายรางวัลหนึ่งชิ้น — ไอคอน/การ์ด + ชื่อและจำนวน
 *
 * ใช้ทั้งหน้ารางวัลล็อกอินและหน้าแอดมิน จะได้เห็นของหน้าตาเดียวกันทั้งสองฝั่ง
 * รางวัลชนิดไหนก็วาดได้ เพราะอ่านจากทะเบียนกลางใน services/rewards.ts
 *
 * ลำดับที่เลือกมาแสดง:
 *   1. รางวัลการ์ดนักเตะ → วาดการ์ดจริงของนักเตะคนนั้น
 *   2. มีรูป (แอดมินใส่เอง / ไอคอนไอเทม / ไอคอนตั้งต้นใน public/icons/) → ใช้รูป
 *   3. ไม่มีอะไรเลย → ถอยไปใช้สัญลักษณ์ตัวอักษรของประเภทนั้น
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import {
  describeReward,
  getRewardKind,
  rewardCardPlayer,
  rewardImage,
} from '@/services/rewards';
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
  const player = rewardCardPlayer(reward);
  const image = rewardImage(reward);

  return (
    <span className={cn('flex flex-col items-center gap-1 text-center', className)}>
      {player ? (
        /*
          การ์ดสูงกว่ากว้างตามสัดส่วนไฟล์รูป จึงบังคับความกว้างแล้วปล่อยความสูงตามจริง
          ห่อในกล่องสูงเท่าไอคอนอื่นไม่ได้ เพราะการ์ดจะถูกบีบจนอ่านชื่อไม่ออก
        */
        <PlayerCard
          player={player}
          size="xs"
          // ใส่ level เฉพาะการ์ดที่แจกมาพร้อมค่าบวก ไม่งั้นจะขึ้นป้าย "+0" รกเปล่า ๆ
          level={reward.upgrade ? reward.upgrade + 1 : undefined}
          style={{ width: size + 8 }}
        />
      ) : (
        <span
          style={{ width: size, height: size }}
          className="grid place-items-center rounded-lg bg-white/[0.06]"
        >
          {image ? (
            <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
          ) : (
            <span className={cn('font-display text-base leading-none', kind.tone)}>
              {kind.glyph}
            </span>
          )}
        </span>
      )}

      {showLabel && (
        <span className="w-full truncate font-mono text-[10px] text-chalk/60">
          {describeReward(reward)}
        </span>
      )}
    </span>
  );
};
