/**
 * ช่องผู้เล่นหนึ่งช่องบนสนาม
 *
 * - เป็นทั้งจุดปล่อย (drop target) และตัวลาก (drag source)
 * - ไม่รู้เรื่องพิกัดสนาม: ผู้เรียกส่ง style ตำแหน่งเข้ามา
 */
import {
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { PitchPlayerCard } from '@/components/player/PitchPlayerCard';
import {
  isCardDrag,
  readDrag,
  writeDrag,
  type CardDragPayload,
} from '@/components/pitch/dragData';
import type {
  Player,
  Position,
} from '@/types/player';
import { cn } from '@/utils/helpers';

export interface PlayerSlotProps {
  slotId: string;
  position: Position;
  player: Player | null;
  cardId: string | null;
  level?: number;
  depthScale?: number;
  selected?: boolean;
  style?: CSSProperties;
  onClick?: (slotId: string) => void;
  onDoubleClick?: (slotId: string) => void;
  onDropCard?: (
    slotId: string,
    payload: CardDragPayload,
  ) => void;
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
  onDoubleClick,
  onDropCard,
  children,
}: PlayerSlotProps) => {
  const [isOver, setIsOver] =
    useState(false);

  return (
    <div
      style={style}
      /*
       * สำคัญ:
       * FormationPositions parent ใช้ pointer-events-none
       * ดังนั้น PlayerSlot ต้องเปิดรับ mouse/pointer event
       * เอง ไม่เช่นนั้น click / drag / drop จะไม่ทำงาน
       */
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      data-slot-id={slotId}
      data-position={position}
      onDoubleClick={() =>
        onDoubleClick?.(slotId)
      }
      onDragOver={(event) => {
        if (!isCardDrag(event)) return;

        event.preventDefault();
        event.dataTransfer.dropEffect =
          'move';
        setIsOver(true);
      }}
      onDragLeave={() =>
        setIsOver(false)
      }
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);

        const payload =
          readDrag(event);

        if (payload) {
          onDropCard?.(
            slotId,
            payload,
          );
        }
      }}
    >
      <div
        style={{
          transform: `scale(${depthScale})`,
        }}
        className={cn(
          'flex origin-bottom flex-col items-center rounded-xl transition-shadow',
          (isOver || selected) &&
            'ring-2 ring-neon shadow-neon',
          selected &&
            'animate-pulse',
        )}
      >
        {children ?? (
          <PitchPlayerCard
            player={player}
            slotPosition={position}
            level={level}
            draggable={Boolean(cardId)}
            onDragStart={(event) => {
              if (!cardId) return;

              writeDrag(event, {
                cardId,
                fromSlotId: slotId,
              });
            }}
            onClick={() =>
              onClick?.(slotId)
            }
          />
        )}

        <span className="mt-1 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon ring-1 ring-neon/25">
          {position}
        </span>
      </div>
    </div>
  );
};
