/**
 * รูปแบบข้อมูลที่ส่งระหว่างลากการ์ด (HTML5 drag & drop)
 * ใช้ MIME เฉพาะของแอป เพื่อไม่ให้ชนกับการลากไฟล์หรือข้อความจากที่อื่น
 */
export const CARD_MIME = 'application/x-player-card';

export interface CardDragPayload {
  cardId: string;
  /** ช่องต้นทาง ถ้าลากมาจากสนาม (ไม่มี = ลากมาจากรายการตัวสำรอง) */
  fromSlotId?: string;
}

export const writeDrag = (event: React.DragEvent, payload: CardDragPayload): void => {
  event.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
};

export const readDrag = (event: React.DragEvent): CardDragPayload | null => {
  const raw = event.dataTransfer.getData(CARD_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CardDragPayload;
  } catch {
    return null;
  }
};

/** true เมื่อสิ่งที่กำลังลากอยู่คือการ์ดของเกม (ใช้ตอน dragover ที่อ่านข้อมูลไม่ได้) */
export const isCardDrag = (event: React.DragEvent): boolean =>
  event.dataTransfer.types.includes(CARD_MIME);
