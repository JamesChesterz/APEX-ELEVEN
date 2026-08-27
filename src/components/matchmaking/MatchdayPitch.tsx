/**
 * สนามแข่ง Matchmaking — ทั้งสองทีมยืนคนละครึ่งสนามหันหน้าเข้าหากันแบบ "ซ้าย-ขวา"
 * ฝั่งเรา (ครึ่งซ้าย) ดึงจาก 11 ตัวจริงในหน้า MY TEAM ตรง ๆ (มี cardId ติดมาด้วยเพื่อเช็คบาดเจ็บ/ใบแดง)
 * ฝั่งคู่แข่ง (ครึ่งขวา กลับด้าน) ดึงจากทีมจริงของเขาถ้ามี ไม่มีก็ปั้นให้ใกล้เคียง OVR (ดู services/opponentSquad.ts)
 *
 * สกอร์/สถานะอยู่กึ่งกลางด้านบนของกรอบสนามเสมอ ไม่ว่าจะยังไม่แข่ง กำลังแข่ง หรือจบแล้ว
 */
import { projectMatchday } from '@/components/matchmaking/matchdayProjection';
import { PlayerCard } from '@/components/player/PlayerCard';
import type { OpponentSlot } from '@/services/opponentSquad';
import type { Player } from '@/types/player';
import type { MatchStatus } from '@/types/match';
import { cn } from '@/utils/helpers';

/** ช่องผู้เล่นฝั่งเราที่พร้อมสำหรับวาดบนสนาม (มี cardId ผูกมาด้วย ต่างจาก RatedSlot เดิม) */
export interface OurPitchSlot {
  slotId: string;
  x: number;
  y: number;
  player: Player | null;
  cardId: string | null;
}

interface MatchdayPitchProps {
  ourSlots: OurPitchSlot[];
  opponentSlots: OpponentSlot[];
  /** รหัสการ์ดฝั่งเราที่โดนใบแดงไล่ออกในนัดนี้ — โชว์จางลงพร้อมไอคอน 🟥 */
  sentOffCardIds: Set<string>;
  /** รหัสการ์ดฝั่งเราที่กำลังบาดเจ็บรอเปลี่ยนตัว — โชว์ไอคอน 🚑 */
  injuredCardId?: string | null;
  status: MatchStatus;
  score: { team: number; opponent: number } | null;
  minute?: number;
}

/** โทเค็นนักเตะหนึ่งคนบนสนาม — การ์ดจิ๋ว + ป้ายชื่อ ไม่มีการโต้ตอบ (แค่ดูเลย์เอาต์) */
const PitchToken = ({
  player,
  sentOff,
  injured,
  muted,
}: {
  player: { name: string } | null;
  sentOff?: boolean;
  injured?: boolean;
  muted?: boolean;
}) => (
  <div
    className={cn(
      'flex flex-col items-center gap-0.5 transition-opacity',
      sentOff && 'opacity-40',
    )}
  >
    <div className="relative">
      {player ? (
        <PlayerCard player={player as Player} size="xs" />
      ) : (
        <div className="flex h-[62px] w-[62px] items-center justify-center rounded-lg border border-dashed border-white/30 bg-black/40 text-[10px] text-white/50">
          ว่าง
        </div>
      )}
      {injured && (
        <span
          className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1 text-[10px]"
          aria-hidden
        >
          🚑
        </span>
      )}
      {sentOff && (
        <span
          className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1 text-[10px]"
          aria-hidden
        >
          🟥
        </span>
      )}
    </div>
    <span
      className={cn(
        'max-w-[70px] truncate rounded bg-black/70 px-1.5 py-0.5 text-center font-mono text-[8px] font-bold uppercase tracking-wider ring-1',
        muted ? 'text-chalk/50 ring-white/15' : 'text-neon ring-neon/25',
      )}
    >
      {player?.name ?? '—'}
    </span>
  </div>
);

export const MatchdayPitch = ({
  ourSlots,
  opponentSlots,
  sentOffCardIds,
  injuredCardId,
  status,
  score,
  minute,
}: MatchdayPitchProps) => {
  const live = status === 'playing' || status === 'finished';

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#05080A] shadow-glass">
      {/* พื้นหลังสนามจริง */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/pitch/matchday.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_50%,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      {/* ทีมคู่แข่ง — ครึ่งขวา กลับด้าน */}
      {opponentSlots.map(({ slot, player }) => {
        const point = projectMatchday(slot.x, slot.y, 'away');
        return (
          <div
            key={`away-${slot.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <PitchToken player={player} muted />
          </div>
        );
      })}

      {/* ทีมเรา — ครึ่งซ้าย */}
      {ourSlots.map(({ slotId, x, y, player, cardId }) => {
        const point = projectMatchday(x, y, 'home');
        return (
          <div
            key={`home-${slotId}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <PitchToken
              player={player}
              sentOff={Boolean(cardId && sentOffCardIds.has(cardId))}
              injured={Boolean(cardId && injuredCardId === cardId)}
            />
          </div>
        );
      })}

      {/* สกอร์/สถานะ กึ่งกลางด้านบนเสมอ */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 py-2 backdrop-blur">
          {live ? (
            <>
              <span className="font-display text-2xl leading-none">{score?.team ?? 0}</span>
              <span className="text-chalk/30">–</span>
              <span className="font-display text-2xl leading-none">{score?.opponent ?? 0}</span>
              <span className="ml-2 font-mono text-[11px] text-chalk/50">
                {status === 'finished' ? (
                  "จบเกม 90'"
                ) : (
                  <>
                    <span className="mr-1 animate-pulse text-neon">●</span>
                    {minute ?? 0}'
                  </>
                )}
              </span>
            </>
          ) : (
            <span className="font-display text-lg text-chalk/60">VS</span>
          )}
        </div>
      </div>
    </div>
  );
};
