/**
 * ช่องผู้เล่นหนึ่งช่องบนสนาม
 * - เป็นทั้งจุดปล่อย (drop target) และตัวลาก (drag source) ของการ์ดในช่องนั้น
 * - ไม่รู้เรื่องพิกัด: ผู้เรียกส่ง style ตำแหน่งเข้ามาให้
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { PitchPlayerCard } from '@/components/player/PitchPlayerCard';
import { isCardDrag, readDrag, writeDrag, type CardDragPayload } from '@/components/pitch/dragData';
import type { Player, Position } from '@/types/player';
import { cn } from '@/utils/helpers';

export interface PlayerSlotProps {
  slotId: string;
  position: Position;
  player: Player | null;
  /** การ์ดที่อยู่ในช่องนี้ (null = ว่าง) */
  cardId: string | null;
  /** เลเวลของการ์ดในช่องนี้ ใช้ขึ้นป้ายค่าตีบวก */
  level?: number;
  /** ย่อ/ขยายตามระยะลึกของสนาม (1 = ใกล้กล้องที่สุด) */
  depthScale?: number;
  /** true เมื่อช่องนี้ถูกเลือกไว้เพื่อรอสลับตัว */
  selected?: boolean;
  style?: CSSProperties;
  onClick?: (slotId: string) => void;
  /** เรียกเมื่อมีการ์ดถูกลากมาปล่อยที่ช่องนี้ */
  onDropCard?: (slotId: string, payload: CardDragPayload) => void;
  children?: ReactNode;
}

export const PlayerSlot = ({
  slotId,
  position,
  player,
  cardId,
  level,
  depthScale = 1,
  selected = false,
  style,
  onClick,
  onDropCard,
  children,
}: PlayerSlotProps) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      style={style}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      data-slot-id={slotId}
      data-position={position}
      onDragOver={(event) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const payload = readDrag(event);
        if (payload) onDropCard?.(slotId, payload);
      }}
    >
      <div
        style={{ transform: `scale(${depthScale})` }}
        className={cn(
          'flex origin-bottom flex-col items-center rounded-xl transition-shadow',
          (isOver || selected) && 'ring-2 ring-neon shadow-neon',
          selected && 'animate-pulse',
        )}
      >
        {children ?? (
          <PitchPlayerCard
            player={player}
            slotPosition={position}
            level={level}
            draggable={Boolean(cardId)}
            onDragStart={(event) => cardId && writeDrag(event, { cardId, fromSlotId: slotId })}
            onClick={() => onClick?.(slotId)}
          />
        )}

        {/* ป้ายตำแหน่งใต้การ์ด */}
        <span className="mt-1 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon ring-1 ring-neon/25">
          {position}
        </span>
      </div>
    </div>
  );
};
