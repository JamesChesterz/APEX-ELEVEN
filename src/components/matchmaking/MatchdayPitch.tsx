/**
 * สนามแข่ง Matchmaking — ทั้งสองทีมยืนคนละครึ่งสนามหันหน้าเข้าหากันแบบ "ซ้าย-ขวา"
 * ตามมุมมอง perspective จริงของภาพพื้นหลัง (ใกล้กล้อง=ใหญ่ฝั่งซ้าย, ไกลกล้อง=เล็กฝั่งขวา)
 *
 * ฝั่งเรา (ซ้าย ใกล้กล้อง) ดึงจาก 11 ตัวจริงในหน้า MY TEAM ตรง ๆ
 * (มี cardId ติดมาด้วยเพื่อเช็คบาดเจ็บ/ใบแดง)
 * ฝั่งคู่แข่ง (ขวา ไกลกล้อง กลับด้าน) ดึงจากทีมจริงของเขาถ้ามี
 * ไม่มีก็ปั้นให้ใกล้เคียง OVR (ดู services/opponentSquad.ts)
 *
 * โทเค็นหนึ่งตัว = การ์ดนักเตะ + ป้ายชื่อใต้การ์ด (ค่าพลัง/ตำแหน่ง/ธงอยู่บนตัวรูปการ์ดอยู่แล้ว)
 * สกอร์ย้ายไปอยู่บนสกอร์บอร์ดของแถบบนแล้ว สนามจึงเหลือแต่ตัวนักเตะล้วน ๆ
 */
import { projectMatchday } from '@/components/matchmaking/matchdayProjection';
import { PlayerCard } from '@/components/player/PlayerCard';
import { SlotNameplate } from '@/components/player/SlotNameplate';
import type { OpponentSlot } from '@/services/opponentSquad';
import type { Player, Position } from '@/types/player';
import { cn } from '@/utils/helpers';

/** ช่องผู้เล่นฝั่งเราที่พร้อมสำหรับวาดบนสนาม (มี cardId ผูกมาด้วย ต่างจาก RatedSlot เดิม) */
export interface OurPitchSlot {
  slotId: string;
  x: number;
  y: number;
  player: Player | null;
  cardId: string | null;
  /** ป้ายตำแหน่งที่จะโชว์ใต้การ์ด เช่น LCB, RDM */
  label: string;
  /** ตำแหน่งจริงของช่อง — ใช้คิดค่าปรับผิดตำแหน่งให้เลข OVR ใต้การ์ดตรงกับหน้า MY TEAM */
  position: Position;
  /** เลเวลการ์ด (1 = +0) — ใช้ขึ้นป้ายค่าตีบวกมุมบนซ้ายของการ์ด */
  level?: number;
}

interface MatchdayPitchProps {
  ourSlots: OurPitchSlot[];
  opponentSlots: OpponentSlot[];
  /** รหัสการ์ดฝั่งเราที่โดนใบแดงไล่ออกในนัดนี้ — โชว์จางลงพร้อมไอคอน */
  sentOffCardIds: Set<string>;
  /** รหัสการ์ดฝั่งเราที่กำลังบาดเจ็บรอเปลี่ยนตัว */
  injuredCardId?: string | null;
  /** cardId ของกัปตันฝั่งเรา (ค่าพลังสูงสุดใน 11 ตัวจริง) */
  captainCardId?: string | null;
  /** ชื่อกัปตันฝั่งคู่แข่ง — ฝั่งนั้นเราไม่รู้ id การ์ด จึงเทียบด้วยชื่อ */
  awayCaptainName?: string | null;
  /** ป้ายตำแหน่งของช่องฝั่งคู่แข่ง (แผนของเขาอาจไม่เหมือนของเรา) */
  awayLabel?: (slotId: string) => string;
  /** true = ยังไม่เจอคู่แข่ง ให้ครึ่งสนามฝั่งขวาว่างไว้ */
  waiting: boolean;
}

/** โทเค็นนักเตะหนึ่งคนบนสนาม — การ์ดจิ๋ว + ป้ายชื่อ ไม่มีการโต้ตอบ (แค่ดูเลย์เอาต์) */
const PitchToken = ({
  player,
  label,
  position,
  level,
  scale,
  side,
  captain,
  sentOff,
  injured,
}: {
  player: Player | null;
  /** ป้ายตำแหน่งของช่องนี้ */
  label: string;
  /** ตำแหน่งจริงของช่อง ใช้คิดค่าปรับผิดตำแหน่ง */
  position: Position;
  level?: number;
  scale: number;
  side: 'home' | 'away';
  captain?: boolean;
  sentOff?: boolean;
  injured?: boolean;
}) => (
  <div
    style={{ transform: `scale(${0.72 + scale * 0.28})` }}
    className={cn(
      'flex origin-center flex-col items-center gap-1 transition-opacity',
      sentOff && 'opacity-35 grayscale',
    )}
  >
    <div className="relative">
      {player ? (
        // ส่ง level ไปด้วยเพื่อให้การ์ดที่ตีบวกแล้วขึ้นป้าย +N มุมบนซ้าย
        <PlayerCard player={player} size="xs" level={level} />
      ) : (
        <div className="flex h-[62px] w-[62px] items-center justify-center rounded-lg border border-dashed border-white/25 bg-black/40 text-[10px] text-white/40">
          ว่าง
        </div>
      )}

      {injured && (
        <span
          className="absolute -right-1.5 -top-1.5 rounded-full bg-[#E23A3A] px-1 text-[9px] leading-[14px] text-white shadow-card"
          title="บาดเจ็บ"
        >
          +
        </span>
      )}
      {sentOff && (
        <span
          className="absolute -right-1.5 -top-1.5 h-3.5 w-2.5 rounded-[2px] bg-[#E23A3A] shadow-card"
          title="โดนใบแดง"
        />
      )}
    </div>

    {/*
      ป้ายใต้การ์ด: ชื่อ · OVR · ตำแหน่ง — ใช้คอมโพเนนต์เดียวกับหน้า MY TEAM
      เลข OVR รวมโบนัสตีบวกและค่าปรับผิดตำแหน่งแล้ว จึงตรงกับที่เห็นตอนจัดทีมเป๊ะ
    */}
    <span className="relative flex flex-col items-center">
      <SlotNameplate
        player={player}
        slotPosition={position}
        label={label}
        level={level}
        side={side}
        compact
      />
      {captain && (
        <span
          className="absolute -right-2 top-0 font-mono text-[8px] font-bold text-gold"
          title="กัปตันทีม"
        >
          C
        </span>
      )}
    </span>
  </div>
);

export const MatchdayPitch = ({
  ourSlots,
  opponentSlots,
  sentOffCardIds,
  injuredCardId,
  captainCardId,
  awayCaptainName,
  awayLabel,
  waiting,
}: MatchdayPitchProps) => (
  <div className="relative h-full min-h-[340px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#05080A] shadow-glass">
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
    {opponentSlots.map(({ slot, player, level }) => {
      const point = projectMatchday(slot.x, slot.y, 'away');
      return (
        <div
          key={`away-${slot.id}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <PitchToken
            player={player}
            label={awayLabel?.(slot.id) ?? slot.position}
            position={slot.position}
            level={level}
            scale={point.scale}
            side="away"
            captain={Boolean(player && awayCaptainName && player.name === awayCaptainName)}
          />
        </div>
      );
    })}

    {/* ทีมเรา — ครึ่งซ้าย */}
    {ourSlots.map(({ slotId, x, y, player, cardId, label, position, level }) => {
      const point = projectMatchday(x, y, 'home');
      return (
        <div
          key={`home-${slotId}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <PitchToken
            player={player}
            label={label}
            position={position}
            level={level}
            scale={point.scale}
            side="home"
            captain={Boolean(cardId && captainCardId === cardId)}
            sentOff={Boolean(cardId && sentOffCardIds.has(cardId))}
            injured={Boolean(cardId && injuredCardId === cardId)}
          />
        </div>
      );
    })}

    {/* ยังไม่มีคู่แข่ง — บอกให้รู้ว่าครึ่งสนามฝั่งขวายังว่างอยู่ */}
    {waiting && (
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center justify-center">
        <p className="rounded-lg border border-white/10 bg-black/55 px-4 py-2 text-[11px] text-chalk/50 backdrop-blur-sm">
          รอคู่แข่งเข้าสนาม
        </p>
      </div>
    )}
  </div>
);
