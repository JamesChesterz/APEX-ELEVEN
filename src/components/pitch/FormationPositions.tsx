/**
 * วางช่องผู้เล่นทั้ง 11 ช่องให้ตรงกับ "สนามในภาพพื้นหลัง"
 *
 * formations.ts ใช้พิกัดสนามจริงแบบ normalized:
 * - x = 0–100 ซ้าย → ขวา
 * - y = 0–100 ประตูเรา (ด้านล่างของภาพ) → ประตูคู่แข่ง (ด้านบนของภาพ)
 *
 * สนามใน pitch-background.png เป็นสี่เหลี่ยมคางหมูอยู่แล้ว ดังนั้นไม่ควร
 * project แบบ perspective ซ้ำด้วย SVG อีกชั้น แต่ให้ map พิกัดลงบน
 * 4 มุมของเส้นรอบสนามในภาพโดยตรง
 */
import { PlayerSlot } from '@/components/pitch/PlayerSlot';
import type { CardDragPayload } from '@/components/pitch/dragData';
import type { RatedSlot } from '@/services/teamRating';
import type { SquadSlot } from '@/types/team';

export interface ProjectedPoint {
  /** ตำแหน่งบนหน้าจอเป็น % ของกรอบภาพ */
  x: number;
  y: number;
  /** อัตราส่วนขนาดการ์ดตาม perspective ของภาพพื้นหลัง */
  scale: number;
}

/**
 * ขอบสนามใน pitch-background.png (normalized เป็น % ของรูป)
 *
 * ภาพถูกสร้างที่ 1561 × 1008 px และเส้นรอบสนามอยู่ประมาณ:
 * - ด้านไกล: x 20.8–79.0%, y 13.1%
 * - ด้านใกล้: x 2.9–96.6%, y 90.9%
 *
 * ใช้ bilinear interpolation เพื่อให้ตำแหน่งนักเตะเดินไปตาม
 * perspective เดียวกับสนามจริงในภาพ
 */
const PITCH_IMAGE = {
  topLeft: { x: 20.8, y: 13.1 },
  topRight: { x: 79.0, y: 13.1 },
  bottomLeft: { x: 2.9, y: 90.9 },
  bottomRight: { x: 96.6, y: 90.9 },
};

const CARD_TOP_SCALE = 0.72;

/** แปลงพิกัดสนาม → พิกัดบนภาพ background โดยไม่ project ซ้ำ */
export const projectToPitch = (x: number, y: number): ProjectedPoint => {
  const horizontal = Math.max(0, Math.min(1, x / 100));
  // formations ใช้ y=0 เป็นประตูเรา ซึ่งอยู่ด้านล่างภาพ
  const depth = Math.max(0, Math.min(1, y / 100));

  const leftX =
    PITCH_IMAGE.bottomLeft.x + (PITCH_IMAGE.topLeft.x - PITCH_IMAGE.bottomLeft.x) * depth;
  const rightX =
    PITCH_IMAGE.bottomRight.x + (PITCH_IMAGE.topRight.x - PITCH_IMAGE.bottomRight.x) * depth;
  const leftY =
    PITCH_IMAGE.bottomLeft.y + (PITCH_IMAGE.topLeft.y - PITCH_IMAGE.bottomLeft.y) * depth;
  const rightY =
    PITCH_IMAGE.bottomRight.y + (PITCH_IMAGE.topRight.y - PITCH_IMAGE.bottomRight.y) * depth;

  const projectedX = leftX + (rightX - leftX) * horizontal;
  const projectedY = leftY + (rightY - leftY) * horizontal;

  // ด้านไกลของภาพแคบกว่าด้านใกล้ จึงย่อการ์ดตามระยะด้วย
  const scale = CARD_TOP_SCALE + (1 - CARD_TOP_SCALE) * (1 - depth);

  return { x: projectedX, y: projectedY, scale };
};

interface FormationPositionsProps {
  slots: RatedSlot[];
  /** การ์ดที่อยู่ในแต่ละช่อง ใช้เป็นข้อมูลตอนลาก */
  squad: SquadSlot[];
  /** ช่องที่ถูกเลือกไว้รอสลับตัว */
  selectedSlotId?: string | null;
  onSlotClick?: (slotId: string) => void;
  onDropCard?: (slotId: string, payload: CardDragPayload) => void;
}

export const FormationPositions = ({
  slots,
  squad,
  selectedSlotId,
  onSlotClick,
  onDropCard,
}: FormationPositionsProps) => (
  <div className="pointer-events-none absolute inset-0 z-10">
    {slots.map(({ slot, player, level }) => {
      const point = projectToPitch(slot.x, slot.y);

      return (
        <div
          key={slot.id}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <PlayerSlot
            slotId={slot.id}
            position={slot.position}
            player={player}
            cardId={squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null}
            level={level}
            selected={selectedSlotId === slot.id}
            depthScale={point.scale}
            onClick={onSlotClick}
            onDropCard={onDropCard}
          />
        </div>
      );
    })}
  </div>
);
