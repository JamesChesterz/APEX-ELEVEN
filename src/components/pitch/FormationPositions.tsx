/**
 * วางช่องผู้เล่นทั้ง 11 ช่องให้ตรงกับ
 * perspective ของสนามใน /public/pitch-background.png
 *
 * formations.ts ใช้พิกัดสนามแบบ normalized:
 *
 *   x = 0–100
 *       ซ้าย → ขวา
 *
 *   y = 0–100
 *       ประตูเรา → ประตูคู่แข่ง
 *
 * ในภาพ background:
 *
 *   y = 0
 *       อยู่ด้านล่างของภาพ
 *
 *   y = 100
 *       อยู่ด้านบนของภาพ
 *
 * ไม่ใช้ SVG perspective อีกต่อไป
 * เพราะ perspective ถูกสร้างอยู่ใน background image แล้ว
 */
import { PlayerSlot } from '@/components/pitch/PlayerSlot';
import type { CardDragPayload } from '@/components/pitch/dragData';
import type { RatedSlot } from '@/services/teamRating';
import type { SquadSlot } from '@/types/team';

export interface ProjectedPoint {
  /**
   * ตำแหน่งบนกรอบสนามเป็น %
   */
  x: number;
  y: number;

  /**
   * ขนาดการ์ดตามระยะ perspective
   *
   * 1 = ขนาดเต็ม
   * น้อยกว่า 1 = อยู่ไกลกล้อง
   */
  scale: number;
}

/**
 * ─────────────────────────────────────────────────
 * ขอบสนามใน pitch-background.png
 * ─────────────────────────────────────────────────
 *
 * ภาพสนามมี perspective อยู่แล้ว
 *
 * จุดอ้างอิงจากภาพ:
 *
 * ด้านไกล:
 *   topLeft  ≈ 20.8%, 13.1%
 *   topRight ≈ 79.0%, 13.1%
 *
 * ด้านใกล้:
 *   bottomLeft  ≈ 2.9%, 90.9%
 *   bottomRight ≈ 96.6%, 90.9%
 *
 * ค่าเหล่านี้เป็น percentage ของภาพทั้งหมด
 * ไม่ใช่ pixel
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
 * ขนาดการ์ดที่อยู่ด้านไกลสุด
 *
 * สนามใน background มี perspective อยู่แล้ว
 * เราจึงย่อเฉพาะ Player Card เท่านั้น
 */
const CARD_TOP_SCALE = 0.72;

/**
 * จำกัดค่าให้อยู่ระหว่าง 0–1
 */
const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

/**
 * แปลงพิกัดสนามจริงแบบ normalized
 * เป็นพิกัดบน background image
 *
 * ไม่ใช้ perspective formula แบบเดิม
 * แต่ interpolate ระหว่าง 4 มุมของสนามในภาพ
 */
export const projectToPitch = (
  x: number,
  y: number,
): ProjectedPoint => {
  /**
   * x:
   * 0 = ซ้าย
   * 1 = ขวา
   */
  const horizontal = clamp01(x / 100);

  /**
   * formations.ts:
   *
   * y = 0   → ประตูเรา / ด้านล่าง
   * y = 100 → ประตูคู่แข่ง / ด้านบน
   *
   * จึงต้องกลับทิศเป็น:
   *
   * imageDepth = 0 → ด้านล่าง
   * imageDepth = 1 → ด้านบน
   */
  const depth = clamp01(y / 100);

  /**
   * ขอบซ้ายของสนาม ณ ระยะนั้น
   */
  const leftX =
    PITCH_IMAGE.bottomLeft.x +
    (PITCH_IMAGE.topLeft.x -
      PITCH_IMAGE.bottomLeft.x) *
      depth;

  /**
   * ขอบขวาของสนาม ณ ระยะนั้น
   */
  const rightX =
    PITCH_IMAGE.bottomRight.x +
    (PITCH_IMAGE.topRight.x -
      PITCH_IMAGE.bottomRight.x) *
      depth;

  /**
   * ขอบบน/ล่างของสนาม
   *
   * ในภาพนี้เส้นด้านไกลและด้านใกล้
   * อยู่เกือบเป็นแนวนอน
   */
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

  /**
   * Interpolate จากซ้าย → ขวา
   */
  const projectedX =
    leftX +
    (rightX - leftX) *
      horizontal;

  const projectedY =
    leftY +
    (rightY - leftY) *
      horizontal;

  /**
   * การ์ดที่อยู่ใกล้ด้านบน/ไกลกล้อง
   * ต้องเล็กลง
   *
   * depth:
   * 0 = ใกล้กล้อง → 1.0
   * 1 = ไกลกล้อง → 0.72
   */
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

  /**
   * การ์ดที่อยู่ในแต่ละช่อง
   * ใช้สำหรับ drag & drop
   */
  squad: SquadSlot[];

  /**
   * ช่องที่ถูกเลือกอยู่
   */
  selectedSlotId?: string | null;

  onSlotClick?: (
    slotId: string,
  ) => void;

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
  <div className="pointer-events-none absolute inset-0 z-10">
    {slots.map(
      ({
        slot,
        player,
        level,
      }) => {
        const point =
          projectToPitch(
            slot.x,
            slot.y,
          );

        const cardId =
          squad.find(
            (entry) =>
              entry.slotId ===
              slot.id,
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
              selectedSlotId ===
              slot.id
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
      },
    )}
  </div>
);
