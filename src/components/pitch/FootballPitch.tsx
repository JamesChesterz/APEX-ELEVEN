/**
 * สนามฟุตบอลหลักของหน้า MY TEAM
 * วาดด้วย SVG โดยส่งทุกพิกัดผ่าน projectToPitch เพื่อให้เส้นสนามเอียงตาม perspective เดียวกับการ์ดผู้เล่น
 * ประกอบด้วย: อัฒจันทร์มืด + สปอตไลต์ + แสงนีออนเขียว + เส้นสนามครบชุด + ช่องผู้เล่น 11 ช่อง
 */
import { useEffect, useMemo, useState } from 'react';
import { FormationPositions, projectToPitch } from '@/components/pitch/FormationPositions';
import { SlotPickerModal, type SlotCandidate } from '@/components/pitch/SlotPickerModal';
import { SubsDrawer } from '@/components/pitch/SubsDrawer';
import type { CardDragPayload } from '@/components/pitch/dragData';
import { FORMATIONS } from '@/data/formations';
import { useTeam } from '@/hooks/useTeam';
import type { FormationId } from '@/types/team';

interface FootballPitchProps {
  squadName: string;
  onSlotClick?: (slotId: string) => void;
}

/* ── เครื่องมือวาดรูปทรงบนสนาม ─────────────────────────────── */

/** แปลงรายการพิกัดสนามเป็น points ของ <polygon>/<polyline> */
const poly = (points: Array<[number, number]>): string =>
  points
    .map(([x, y]) => {
      const projected = projectToPitch(x, y);
      return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join(' ');

/** วงกลม/วงรีบนพื้นสนาม สร้างเป็นชุดจุดแล้วค่อย project ทีละจุด */
const ring = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  filter?: (x: number, y: number) => boolean,
): string =>
  poly(
    Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2;
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as [number, number];
    }).filter(([x, y]) => (filter ? filter(x, y) : true)),
  );

/** สี่เหลี่ยมบนพื้นสนาม (มุมทั้งสี่ถูก project แยกกัน จึงกลายเป็นสี่เหลี่ยมคางหมู) */
const box = (x1: number, y1: number, x2: number, y2: number): string =>
  poly([
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]);

/* สัดส่วนสนามจริงย่อลงมาเป็นสเกล 0–100 */
const TOUCH = { x1: 4, y1: 3, x2: 96, y2: 97 };
const PENALTY_DEPTH = 16;
const GOAL_DEPTH = 5.5;
const PENALTY_SPOT = 11;

export const FootballPitch = ({ squadName, onSlotClick }: FootballPitchProps) => {
  const {
    team,
    formation,
    ratedSlots,
    bench,
    changeFormation,
    assignCard,
    canAssign,
    swapSlots,
    clearSlot,
    squadLocked,
  } = useTeam();
  const [subsOpen, setSubsOpen] = useState(false);
  /** ข้อความเตือนกลางสนาม เช่น พยายามใส่นักเตะชื่อซ้ำ */
  const [notice, setNotice] = useState<string | null>(null);
  /** การ์ดตัวสำรองที่ถูกเลือกไว้รอส่งลงสนาม (โหมดจิ้มเร็ว) */
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  /** ช่องที่กำลังเปิดหน้าต่างเลือกนักเตะอยู่ */
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);

  // ข้อความเตือนหายเองใน 3 วินาที
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** จัดการ์ดลงช่อง แล้วโชว์เหตุผลถ้าระบบไม่ยอม (เช่น นักเตะชื่อซ้ำ) */
  const tryAssign = (slotId: string, cardId: string) => {
    const result = assignCard(slotId, cardId);
    setNotice(result.ok ? null : result.reason ?? 'จัดนักเตะคนนี้ลงช่องนี้ไม่ได้');
    return result.ok;
  };

  /** ปล่อยการ์ดลงช่องในสนาม: มาจากสนามด้วยกัน = สลับที่, มาจากตัวสำรอง = เปลี่ยนตัว */
  const handleDropOnSlot = (slotId: string, payload: CardDragPayload) => {
    if (payload.fromSlotId) {
      const result = swapSlots(payload.fromSlotId, slotId);
      if (!result.ok) setNotice(result.reason ?? null);
    } else {
      tryAssign(slotId, payload.cardId);
    }
    setPendingCardId(null);
  };

  /**
   * คลิกช่องในสนาม
   * - ถ้าเลือกตัวสำรองค้างไว้: ส่งลงช่องนั้นทันที (ทางลัด)
   * - ปกติ: เปิดหน้าต่างรายชื่อนักเตะที่เล่นตำแหน่งนี้ได้ เพื่อกดสลับ
   */
  const handleSlotClick = (slotId: string) => {
    if (pendingCardId) {
      // ถ้าใส่ไม่ได้ ให้คงการ์ดที่เลือกไว้ ผู้เล่นจะได้ลองช่องอื่นต่อได้เลย
      if (tryAssign(slotId, pendingCardId)) setPendingCardId(null);
      return;
    }
    setPickerSlotId(slotId);
  };

  /** คลิกการ์ดตัวสำรอง: เลือก/ยกเลิกการเลือก แล้วรอให้ผู้เล่นจิ้มช่องในสนาม */
  const handleBenchClick = (cardId: string) => {
    setPendingCardId((current) => (current === cardId ? null : cardId));
  };

  /* ── ข้อมูลสำหรับหน้าต่างเลือกนักเตะ ─────────────────────── */

  const pickerSlot = formation.slots.find((slot) => slot.id === pickerSlotId) ?? null;

  const currentInSlot =
    ratedSlots.find((entry) => entry.slot.id === pickerSlotId)?.player ?? null;

  /** ทุกคนที่เลือกลงช่องนี้ได้ = ตัวสำรองทั้งหมด + ตัวจริงในช่องอื่น */
  const pickerCandidates = useMemo<SlotCandidate[]>(() => {
    if (!pickerSlotId) return [];

    const fromBench: SlotCandidate[] = bench.map(({ card, player }) => ({
      cardId: card.id,
      player,
      level: card.level,
      // เช็คตั้งแต่ตอนสร้างรายการ เพื่อทำปุ่มจางให้เห็นก่อนกด
      blockedReason: canAssign(pickerSlotId, card.id).reason,
    }));

    const fromPitch: SlotCandidate[] = ratedSlots.flatMap(({ slot, player, level }) => {
      if (slot.id === pickerSlotId || !player) return [];
      const cardId = team.squad.find((entry) => entry.slotId === slot.id)?.cardId;
      return cardId ? [{ cardId, player, level, fromSlotId: slot.id }] : [];
    });

    return [...fromBench, ...fromPitch];
  }, [bench, canAssign, pickerSlotId, ratedSlots, team.squad]);

  return (
  <section className="flex h-full min-h-0 flex-col gap-3">
    {/* แถบควบคุมเหนือสนาม */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-700/80 px-3 py-2">
        <span className="text-sm font-semibold uppercase tracking-wide">{squadName}</span>
        <button type="button" aria-label="ล้างชุดทีม" className="text-chalk/40 hover:text-chalk">
          ✕
        </button>
      </div>

      <button
        type="button"
        aria-label="เปลี่ยนชื่อชุดทีม"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-700/80 text-chalk/60 hover:border-neon/40 hover:text-neon"
      >
        ✎
      </button>

      {squadLocked && (
        <span className="rounded-lg border border-kit/40 bg-kit/10 px-3 py-2 text-xs text-kit">
          🔒 อยู่ในลีก — เปลี่ยนตัวได้ทุก 1 ชั่วโมง
        </span>
      )}

      <label className="relative ml-1">
        <span className="sr-only">แผนการเล่น</span>
        <select
          value={team.formationId}
          onChange={(event) => {
            const result = changeFormation(event.target.value as FormationId);
            if (!result.ok) setNotice(result.reason ?? null);
          }}
          className="appearance-none rounded-lg border border-white/10 bg-ink-700/80 py-2 pl-3 pr-9 text-sm font-semibold focus:border-neon/50"
        >
          {FORMATIONS.map((formation) => (
            <option key={formation.id} value={formation.id} className="bg-ink-800">
              {formation.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-chalk/50">
          ▾
        </span>
      </label>
    </div>

    {/* กรอบสนาม */}
    <div className="relative min-h-[470px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#05080A] shadow-glass">
      {/* อัฒจันทร์มืดด้านหลัง + สปอตไลต์จากด้านบน */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,0.10), transparent 70%), repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 7px), linear-gradient(180deg, #10171B 0%, #070B0D 40%, #05080A 100%)',
        }}
      />
      {/* แสงนีออนเขียวบาง ๆ รอบสนาม */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(60% 35% at 50% 12%, rgba(49,224,109,0.16), transparent 70%), radial-gradient(80% 50% at 50% 100%, rgba(49,224,109,0.10), transparent 70%)',
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E8C45" />
            <stop offset="45%" stopColor="#26743A" />
            <stop offset="100%" stopColor="#164A26" />
          </linearGradient>
          <radialGradient id="floodlight" cx="50%" cy="8%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </radialGradient>
          <clipPath id="turfClip">
            <polygon points={box(-4, -4, 104, 104)} />
          </clipPath>
        </defs>

        {/* พื้นหญ้า (สี่เหลี่ยมคางหมูตาม perspective) */}
        <polygon points={box(-4, -4, 104, 104)} fill="url(#turf)" />

        {/* ลายตัดหญ้าขวางสนาม — แถบไกลจะบางลงเองตามสูตร perspective */}
        <g clipPath="url(#turfClip)">
          {Array.from({ length: 10 }, (_, index) => (
            <polygon
              key={index}
              points={box(-4, index * 10.8 - 4, 104, (index + 1) * 10.8 - 4)}
              fill="#FFFFFF"
              opacity={index % 2 === 0 ? 0.045 : 0}
            />
          ))}
        </g>

        {/* แสงไฟส่องลงกลางสนาม + ขอบมืด */}
        <polygon points={box(-4, -4, 104, 104)} fill="url(#floodlight)" />

        {/* เส้นสนามทั้งหมด */}
        <g
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        >
          {/* เส้นรอบสนาม */}
          <polygon points={box(TOUCH.x1, TOUCH.y1, TOUCH.x2, TOUCH.y2)} />

          {/* เส้นแบ่งแดนกลางสนาม */}
          <polyline points={poly([[TOUCH.x1, 50], [TOUCH.x2, 50]])} />

          {/* วงกลมกลางสนาม */}
          <polygon points={ring(50, 50, 13, 8.7)} />

          {/* เขตโทษฝั่งเรา / ฝั่งคู่แข่ง */}
          <polygon points={box(20.5, TOUCH.y1, 79.5, TOUCH.y1 + PENALTY_DEPTH)} />
          <polygon points={box(20.5, TOUCH.y2 - PENALTY_DEPTH, 79.5, TOUCH.y2)} />

          {/* เขตประตู */}
          <polygon points={box(36.5, TOUCH.y1, 63.5, TOUCH.y1 + GOAL_DEPTH)} />
          <polygon points={box(36.5, TOUCH.y2 - GOAL_DEPTH, 63.5, TOUCH.y2)} />

          {/* เส้นโค้งหน้าเขตโทษ (ตัดเฉพาะส่วนที่อยู่นอกกรอบ) */}
          <polyline
            points={ring(50, TOUCH.y1 + PENALTY_SPOT, 13, 8.7, (_, y) => y > TOUCH.y1 + PENALTY_DEPTH)}
          />
          <polyline
            points={ring(50, TOUCH.y2 - PENALTY_SPOT, 13, 8.7, (_, y) => y < TOUCH.y2 - PENALTY_DEPTH)}
          />
        </g>

        {/* จุดกลางสนามและจุดโทษ */}
        <g fill="#FFFFFF" fillOpacity="0.55">
          {[
            [50, 50],
            [50, TOUCH.y1 + PENALTY_SPOT],
            [50, TOUCH.y2 - PENALTY_SPOT],
          ].map(([x, y]) => {
            const point = projectToPitch(x, y);
            return (
              <ellipse
                key={`${x}-${y}`}
                cx={point.x}
                cy={point.y}
                rx={0.5 * point.scale}
                ry={0.35 * point.scale}
              />
            );
          })}
        </g>

        {/* กรอบประตูทั้งสองฝั่ง */}
        <g
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.4"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        >
          <polygon points={box(44, TOUCH.y1 - 2.5, 56, TOUCH.y1)} />
          <polygon points={box(44, TOUCH.y2, 56, TOUCH.y2 + 2.5)} />
        </g>
      </svg>

      {/* ขอบมืดรอบเฟรมให้ภาพจมลงในสเตเดียม */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      {/* ช่องผู้เล่นตาม Formation */}
      <FormationPositions
        slots={ratedSlots}
        squad={team.squad}
        selectedSlotId={pickerSlotId}
        onSlotClick={(slotId) => {
          handleSlotClick(slotId);
          onSlotClick?.(slotId);
        }}
        onDropCard={handleDropOnSlot}
      />

      {/* คำเตือนกฎห้ามชื่อซ้ำ มาก่อนคำใบ้เสมอ เพราะสำคัญกว่า */}
      {notice ? (
        <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] rounded-full border border-[#D93A3A]/50 bg-black/85 px-4 py-1.5 text-center text-xs text-[#FF8A8A] backdrop-blur">
          {notice}
        </p>
      ) : (
        pendingCardId && (
          <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/75 px-4 py-1.5 text-xs text-neon backdrop-blur">
            เลือกตัวสำรองไว้แล้ว — จิ้มช่องในสนามเพื่อส่งลง
          </p>
        )
      )}

      <SubsDrawer
        bench={bench}
        open={subsOpen}
        selectedCardId={pendingCardId}
        onToggle={() => setSubsOpen((current) => !current)}
        onSelectCard={handleBenchClick}
        onDropCard={(payload) => {
          if (payload.fromSlotId) {
            const result = clearSlot(payload.fromSlotId);
            if (!result.ok) setNotice(result.reason ?? null);
          }
          setPendingCardId(null);
        }}
      />
    </div>

    {/* กดช่องตัวจริง → เลือกนักเตะที่เรามีในตำแหน่งนั้นแล้วสลับได้ทันที */}
    {pickerSlot && (
      <SlotPickerModal
        open
        slotId={pickerSlot.id}
        position={pickerSlot.position}
        current={currentInSlot}
        candidates={pickerCandidates}
        onPick={(cardId) => {
          if (tryAssign(pickerSlot.id, cardId)) setPickerSlotId(null);
        }}
        onClear={() => {
          const result = clearSlot(pickerSlot.id);
          if (result.ok) setPickerSlotId(null);
          else setNotice(result.reason ?? null);
        }}
        onClose={() => setPickerSlotId(null)}
      />
    )}
  </section>
  );
};
