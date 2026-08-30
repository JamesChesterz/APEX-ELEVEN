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
import { useMemo } from 'react';
import { LiveMatchCanvas } from '@/components/matchmaking/LiveMatchCanvas';
import { MatchdayPitch, type OurPitchSlot } from '@/components/matchmaking/MatchdayPitch';
import type { OpponentSlot } from '@/services/opponentSquad';
import {
  buildAwayTeam,
  buildHomeTeam,
  isPlayableSession,
  type MatchSessionInput,
} from '@/services/matchSession';
import type { Opponent } from '@/types/match';
import type { Formation } from '@/types/team';

/**
 * นาทีในเกมที่เดินต่อ 1 วินาทีจริง
 * ต้องตรงกับ TICK_MS (130 ms ต่อนาที) ใน useMatchmaking ไม่งั้นนาฬิกาบนสนาม
 * กับนาฬิกาบนแถบบนจะเดินคนละจังหวะ (ถึงจะถูกดึงกลับให้ตรงทุกนาทีก็ตาม)
 */
const MINUTES_PER_SECOND = 1000 / 130;

interface MatchdayStageProps {
  /* ── ข้อมูลทีม (ใช้ร่วมกันทั้งสองโหมด) ── */
  ourSlots: OurPitchSlot[];
  opponentSlots: OpponentSlot[];
  teamId: string;
  teamName: string;
  formation: Formation;
  opponent: Opponent | null;
  opponentFormation: Formation | null;

  /* ── ของสนามการ์ดเดิม ── */
  sentOffCardIds: Set<string>;
  injuredCardId?: string | null;
  captainCardId?: string | null;
  awayCaptainName?: string | null;
  awayLabel?: (slotId: string) => string;
  waiting: boolean;

  /* ── ของสนามถ่ายทอดสด ── */
  /** true = กำลังแข่งอยู่ (หรือเพิ่งจบ) ให้สลับไปโหมดจำลอง */
  live: boolean;
  /** นาทีปัจจุบันจาก useMatchmaking */
  minute: number;
  /** true = หยุดรอเปลี่ยนตัวคนบาดเจ็บ */
  paused?: boolean;
}

export const MatchdayStage = ({
  ourSlots,
  opponentSlots,
  teamId,
  teamName,
  formation,
  opponent,
  opponentFormation,
  sentOffCardIds,
  injuredCardId,
  captainCardId,
  awayCaptainName,
  awayLabel,
  waiting,
  live,
  minute,
  paused = false,
}: MatchdayStageProps) => {
  /**
   * ทีมสองทีมในภาษาของเอนจิน
   *
   * sentOffCardIds ถูกส่งเข้าไปด้วย คนที่โดนใบแดงจึงหายจากสนามจริง ๆ (เหลือ 10 คน)
   * ไม่ใช่แค่จางลงเหมือนบนสนามการ์ด
   */
  const session = useMemo<MatchSessionInput | null>(() => {
    if (!opponent || !opponentFormation) return null;

    return {
      sessionId: `${teamId}-vs-${opponent.id}`,
      home: buildHomeTeam({
        teamId,
        teamName,
        formation,
        slots: ourSlots,
        excludeCardIds: sentOffCardIds,
      }),
      away: buildAwayTeam({ opponent, formation: opponentFormation, slots: opponentSlots }),
    };
  }, [
    formation,
    opponent,
    opponentFormation,
    opponentSlots,
    ourSlots,
    sentOffCardIds,
    teamId,
    teamName,
  ]);

  if (live && session && isPlayableSession(session)) {
    return (
      <LiveMatchCanvas
        home={session.home}
        away={session.away}
        sessionId={session.sessionId}
        minute={minute}
        paused={paused}
        minutesPerSecond={MINUTES_PER_SECOND}
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
