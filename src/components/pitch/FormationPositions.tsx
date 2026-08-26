/**
 * วางช่องผู้เล่นทั้ง 11 ช่องให้ตรงกับ
 * perspective ของสนามใน /public/pitch-background.png
 *
 * formations.ts:
 *   x = 0–100 ซ้าย → ขวา
 *   y = 0–100 ประตูเรา → ประตูคู่แข่ง
 *
 * Background image มี perspective อยู่แล้ว
 * จึงไม่วาด SVG/perspective สนามซ้ำ
 */
import { PlayerSlot } from '@/components/pitch/PlayerSlot';
import type { CardDragPayload } from '@/components/pitch/dragData';
import type { RatedSlot } from '@/services/teamRating';
import type { SquadSlot } from '@/types/team';

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}

/**
 * ขอบสนามใน pitch-background.png
 *
 * ค่าทั้งหมดเป็นเปอร์เซ็นต์ของภาพ
 */
const PITCH_IMAGE = {
  topLeft: {
    x: 20.8,
    y: 13.1,
  },
  topRight: {
    x: 79.0,
    y: 13.1,
  },
  bottomLeft: {
    x: 2.9,
    y: 90.9,
  },
  bottomRight: {
    x: 96.6,
    y: 90.9,
  },
};

/**
 * ขนาดการ์ดที่ด้านไกลสุดของสนาม
 */
const CARD_TOP_SCALE = 0.72;

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

/**
 * แปลงพิกัด formation 0–100
 * เป็นพิกัดเปอร์เซ็นต์บน pitch-background.png
 *
 * y=0  = ด้านล่าง / ประตูเรา
 * y=100 = ด้านบน / ประตูคู่แข่ง
 */
export const projectToPitch = (
  x: number,
  y: number,
): ProjectedPoint => {
  const horizontal = clamp01(x / 100);
  const depth = clamp01(y / 100);

  const leftX =
    PITCH_IMAGE.bottomLeft.x +
    (PITCH_IMAGE.topLeft.x -
      PITCH_IMAGE.bottomLeft.x) *
      depth;

  const rightX =
    PITCH_IMAGE.bottomRight.x +
    (PITCH_IMAGE.topRight.x -
      PITCH_IMAGE.bottomRight.x) *
      depth;

  const leftY =
    PITCH_IMAGE.bottomLeft.y +
    (PITCH_IMAGE.topLeft.y -
      PITCH_IMAGE.bottomLeft.y) *
      depth;

  const rightY =
    PITCH_IMAGE.bottomRight.y +
    (PITCH_IMAGE.topRight.y -
      PITCH_IMAGE.bottomRight.y) *
      depth;

  const projectedX =
    leftX +
    (rightX - leftX) *
      horizontal;

  const projectedY =
    leftY +
    (rightY - leftY) *
      horizontal;

  const scale =
    CARD_TOP_SCALE +
    (1 - CARD_TOP_SCALE) *
      (1 - depth);

  return {
    x: projectedX,
    y: projectedY,
    scale,
  };
};

interface FormationPositionsProps {
  slots: RatedSlot[];
  squad: SquadSlot[];
  selectedSlotId?: string | null;
  onSlotClick?: (slotId: string) => void;
  onDropCard?: (
    slotId: string,
    payload: CardDragPayload,
  ) => void;
}

export const FormationPositions = ({
  slots,
  squad,
  selectedSlotId,
  onSlotClick,
  onDropCard,
}: FormationPositionsProps) => (
  /*
   * pointer-events-none ป้องกัน layer ว่าง ๆ บัง UI
   * แต่ PlayerSlot เปิด pointer-events-auto เอง
   */
  <div className="pointer-events-none absolute inset-0 z-10">
    {slots.map(({ slot, player, level }) => {
      const point = projectToPitch(
        slot.x,
        slot.y,
      );

      const cardId =
        squad.find(
          (entry) =>
            entry.slotId === slot.id,
        )?.cardId ?? null;

      return (
        <PlayerSlot
          key={slot.id}
          slotId={slot.id}
          position={slot.position}
          player={player}
          cardId={cardId}
          level={level}
          selected={
            selectedSlotId === slot.id
          }
          depthScale={point.scale}
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
          }}
          onClick={onSlotClick}
          onDropCard={onDropCard}
        />
      );
    })}
  </div>
);
