/**
 * วางช่องผู้เล่นทั้ง 11 ช่องลงบนสนามที่มี perspective
 *
 * พิกัดใน formations.ts เป็นพิกัด "บนสนามจริง" (x 0–100 ซ้าย→ขวา, y 0–100 ประตูเรา→ประตูคู่แข่ง)
 * ฟังก์ชัน projectToPitch แปลงเป็นพิกัดบนหน้าจอ โดยบีบความกว้างและระยะห่างเมื่ออยู่ไกลกล้อง
 */
import { PlayerSlot } from '@/components/pitch/PlayerSlot';
import type { CardDragPayload } from '@/components/pitch/dragData';
import type { RatedSlot } from '@/services/teamRating';
import type { SquadSlot } from '@/types/team';

/** ความกว้างของขอบสนามด้านไกล เทียบกับด้านใกล้ (ยิ่งน้อยยิ่งเอียงมาก) */
export const TOP_SCALE = 0.72;

export interface ProjectedPoint {
  /** ตำแหน่งบนหน้าจอเป็น % ของกล่องสนาม */
  x: number;
  y: number;
  /** อัตราส่วนความกว้าง ณ ระยะนั้น ใช้ย่อขนาดการ์ด */
  scale: number;
}

/** แปลงพิกัดสนาม → พิกัดหน้าจอแบบ perspective */
export const projectToPitch = (x: number, y: number): ProjectedPoint => {
  const depth = y / 100;
  // สูตร perspective: ระยะไกลถูกบีบเข้าหาเส้นขอบฟ้า
  const v = depth / (TOP_SCALE + (1 - TOP_SCALE) * depth);
  const scale = 1 - (1 - TOP_SCALE) * v;

  return { x: 50 + (x - 50) * scale, y: (1 - v) * 100, scale };
};

/** เผื่อขอบบน-ล่างไม่ให้การ์ดล้นออกนอกกรอบสนาม */
const SAFE_TOP = 12;
const SAFE_BOTTOM = 7;

interface FormationPositionsProps {
  slots: RatedSlot[];
  /** การ์ดที่อยู่ในแต่ละช่อง ใช้เป็นข้อมูลตอนลาก */
  squad: SquadSlot[];
  /** ช่องที่ถูกเลือกไว้รอสลับตัว */
  selectedSlotId?: string | null;
  /** จำนวนนัดที่การ์ดใบหนึ่งยังติดโทษแบน (ไม่ส่งมา = ไม่ต้องโชว์ป้ายใบแดง) */
  suspensionRemaining?: (cardId: string) => number;
  onSlotClick?: (slotId: string) => void;
  onDropCard?: (slotId: string, payload: CardDragPayload) => void;
}

export const FormationPositions = ({
  slots,
  squad,
  selectedSlotId,
  suspensionRemaining,
  onSlotClick,
  onDropCard,
}: FormationPositionsProps) => (
  <div className="absolute inset-0">
    {slots.map(({ slot, player, level }) => {
      const point = projectToPitch(slot.x, slot.y);
      const top = SAFE_TOP + (point.y / 100) * (100 - SAFE_TOP - SAFE_BOTTOM);
      const cardId = squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null;

      return (
        <PlayerSlot
          key={slot.id}
          slotId={slot.id}
          position={slot.position}
          player={player}
          cardId={cardId}
          level={level}
          selected={selectedSlotId === slot.id}
          suspendedMatches={cardId ? (suspensionRemaining?.(cardId) ?? 0) : 0}
          depthScale={0.74 + point.scale * 0.26}
          style={{ left: `${point.x}%`, top: `${top}%` }}
          onClick={onSlotClick}
          onDropCard={onDropCard}
        />
      );
    })}
  </div>
);
