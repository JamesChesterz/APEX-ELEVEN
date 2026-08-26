/**
 * สนามฟุตบอลหลักของหน้า MY TEAM
 *
 * จัดทีมได้ครบทุกอย่างในหน้าเดียว และไม่มีคูลดาวน์ใด ๆ
 * ทีมชุดนี้คือทีมที่ใช้ลงแข่งทั้งลีกประจำวันและแมตช์กระชับมิตร แก้แล้วมีผลทันที
 *
 * วิธีเปลี่ยนตัว / สลับตำแหน่ง (ให้ผลเหมือนกันทุกทาง):
 *   1. คลิกการ์ดในสนาม 1 ครั้ง = เด้งรายชื่อการ์ดในคลังที่เล่นตำแหน่งนั้นได้ กดเลือกเพื่อสลับลงเลย
 *   2. ลากการ์ดไปวางทับอีกใบ (สลับที่) หรือลากจากลิ้นชักตัวสำรองมาวางในสนาม
 *   3. คลิกการ์ดในลิ้นชักตัวสำรองก่อน แล้วค่อยจิ้มช่องในสนามที่จะให้ลง
 * พื้นสนามเป็นรูปภาพจริง (public/pitch/stadium-bg.webp) ส่วนตำแหน่งการ์ดผู้เล่นยังส่งผ่าน
 * projectToPitch (ใน FormationPositions) เพื่อให้มี perspective ลึกเข้าหาเส้นขอบฟ้าเหมือนเดิม
 * ประกอบด้วย: พื้นหลังสเตเดียม + ขอบมืดจมภาพ + ช่องผู้เล่น 11 ช่อง
 */
import { useEffect, useMemo, useState } from 'react';
import { FormationPositions } from '@/components/pitch/FormationPositions';
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
  } = useTeam();

  /** ข้อความเตือนกลางสนาม เช่น พยายามใส่นักเตะชื่อซ้ำ */
  const [notice, setNotice] = useState<string | null>(null);
  /** การ์ดตัวสำรองที่เลือกไว้รอส่งลงสนาม */
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  /** ช่องที่กำลังเปิดหน้าต่างเลือกนักเตะอยู่ */
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [subsOpen, setSubsOpen] = useState(false);

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
   * คลิกช่องในสนาม 1 ครั้ง
   * - ถ้าเลือกตัวสำรองค้างไว้อยู่: ส่งลงช่องนั้นทันที (ทางลัด)
   * - ปกติ: เด้งรายชื่อการ์ดในคลังของตำแหน่งนั้นขึ้นมาให้เลือกสลับได้เลย
   */
  const handleSlotClick = (slotId: string) => {
    if (pendingCardId) {
      // ใส่ไม่ได้ก็คงการ์ดที่เลือกไว้ ผู้เล่นจะได้ลองช่องอื่นต่อได้เลย
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
      {/* พื้นหลังสนามจริง (รูปสเตเดียม) แทนสนามที่เคยวาดด้วย SVG */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/pitch/pml.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

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

    {/* คลิกช่อง 1 ครั้ง → เลือกนักเตะที่เรามีในตำแหน่งนั้นแล้วสลับได้ทันที */}
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
