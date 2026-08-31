/**
 * ช่องกลางของหน้า MATCHMAKING — ตัดสินว่าจะโชว์อะไรตามสถานะของแมตช์
 *
 *   ก่อนเขี่ยบอล  → MatchdayPitch เดิม (การ์ดนักเตะสองทีมยืนหันหน้าเข้าหากัน)
 *   ระหว่างแข่ง   → LiveMatchCanvas (สนาม 2D มุมบน นักเตะ 22 คนวิ่งจริง)
 *
 * ตั้งใจแยกไฟล์นี้ออกมาเพื่อให้หน้า MatchmakingPage เปลี่ยนน้อยที่สุด
 * ระบบ Manager / Squad / Formation / Player Data เดิมไม่ถูกแตะเลย
 * และถ้าข้อมูลไม่พร้อมจำลอง (จัดตัวไม่ครบ) ก็ถอยกลับไปใช้สนามการ์ดแบบเดิมเสมอ
 */
import { LiveMatchCanvas } from '@/components/matchmaking/LiveMatchCanvas';
import { MatchdayPitch, type OurPitchSlot } from '@/components/matchmaking/MatchdayPitch';
import type { MatchEngine } from '@/match-engine';
import type { OpponentSlot } from '@/services/opponentSquad';

interface MatchdayStageProps {
  /* ── ของสนามการ์ดเดิม (ก่อนเขี่ยบอล) ── */
  ourSlots: OurPitchSlot[];
  opponentSlots: OpponentSlot[];
  sentOffCardIds: Set<string>;
  injuredCardId?: string | null;
  captainCardId?: string | null;
  awayCaptainName?: string | null;
  awayLabel?: (slotId: string) => string;
  waiting: boolean;

  /**
   * เอนจินของนัดที่กำลังแข่ง (null = ยังไม่เริ่มแข่ง)
   * มีค่าเมื่อไหร่ก็สลับไปโหมดสนามจำลองทันที — ไม่ต้องปั้นทีมซ้ำที่นี่อีก
   * เพราะ useMatchmaking เป็นเจ้าของเอนจินตัวเดียวของนัดนั้นอยู่แล้ว
   */
  engine: MatchEngine | null;
  /** นักเตะที่ถูกเลือกอยู่บนสนาม (เรื่องของ UI ล้วน) */
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string | null) => void;
}

export const MatchdayStage = ({
  ourSlots,
  opponentSlots,
  sentOffCardIds,
  injuredCardId,
  captainCardId,
  awayCaptainName,
  awayLabel,
  waiting,
  engine,
  selectedPlayerId = null,
  onSelectPlayer,
}: MatchdayStageProps) => {
  if (engine) {
    return (
      <LiveMatchCanvas
        engine={engine}
        selectedId={selectedPlayerId}
        onSelect={onSelectPlayer}
        // ชื่อจริงจากการ์ดที่ผู้เล่นจัดลงสนาม — ไหลมาจาก player.name ของข้อมูลเกมโดยตรง
        showNames
      />
    );
  }

  return (
    <MatchdayPitch
      ourSlots={ourSlots}
      opponentSlots={opponentSlots}
      sentOffCardIds={sentOffCardIds}
      injuredCardId={injuredCardId}
      captainCardId={captainCardId}
      awayCaptainName={awayCaptainName}
      awayLabel={awayLabel}
      waiting={waiting}
    />
  );
};
