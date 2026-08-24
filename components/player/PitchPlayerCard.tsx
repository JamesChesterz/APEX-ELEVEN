/**
 * การ์ดที่วางบนสนาม = PlayerCard + สถานะ "ช่องว่าง" เมื่อยังไม่มีนักเตะในช่องนั้น
 */
import type { DragEvent } from 'react';
import { PlayerCard, type PlayerCardSize } from '@/components/player/PlayerCard';
import type { Player } from '@/types/player';

interface PitchPlayerCardProps {
  player: Player | null;
  /** ตำแหน่งของช่องนี้ ใช้แสดงเมื่อยังไม่มีนักเตะ */
  slotPosition: string;
  /** เลเวลการ์ดในช่องนี้ ใช้ขึ้นป้ายค่าตีบวกบนการ์ด */
  level?: number;
  size?: PlayerCardSize;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}

export const PitchPlayerCard = ({
  player,
  slotPosition,
  level,
  size = 'sm',
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: PitchPlayerCardProps) => {
  if (!player) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex aspect-square w-[84px] flex-col items-center justify-center rounded-lg border border-dashed border-white/40 bg-black/35 text-white/60"
      >
        <span className="font-display text-xl">+</span>
        <span className="font-mono text-[10px]">{slotPosition}</span>
      </button>
    );
  }

  return (
    <PlayerCard
      player={player}
      size={size}
      level={level}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onSelect={onClick ? () => onClick() : undefined}
    />
  );
};
