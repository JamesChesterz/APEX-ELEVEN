/**
 * สนามฟุตบอลหลักของหน้า MY TEAM
 *
 * ใช้ public/pitch-background.png เป็นพื้นหลังสนามโดยตรง
 * ภาพพื้นหลังมีสนาม, เส้นสนาม, perspective, แสง และบรรยากาศสนามครบแล้ว
 *
 * Layer ด้านบน:
 * - FormationPositions: ตำแหน่งการ์ดผู้เล่น
 * - SubsDrawer: ตัวสำรอง
 * - SlotPickerModal: หน้าต่างเลือก/สลับผู้เล่น
 */
import { useEffect, useMemo, useState } from 'react';
import { FormationPositions } from '@/components/pitch/FormationPositions';
import {
  SlotPickerModal,
  type SlotCandidate,
} from '@/components/pitch/SlotPickerModal';
import { SubsDrawer } from '@/components/pitch/SubsDrawer';
import type { CardDragPayload } from '@/components/pitch/dragData';
import { FORMATIONS } from '@/data/formations';
import { useTeam } from '@/hooks/useTeam';
import type { FormationId } from '@/types/team';

interface FootballPitchProps {
  squadName: string;
  onSlotClick?: (slotId: string) => void;
}

export const FootballPitch = ({
  squadName,
  onSlotClick,
}: FootballPitchProps) => {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);

  /**
   * ล้างข้อความแจ้งเตือนอัตโนมัติหลัง 3 วินาที
   */
  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  /**
   * จัดการ์ดลงช่อง
   */
  const tryAssign = (slotId: string, cardId: string) => {
    const result = assignCard(slotId, cardId);

    setNotice(
      result.ok
        ? null
        : result.reason ?? 'จัดนักเตะคนนี้ลงช่องนี้ไม่ได้',
    );

    return result.ok;
  };

  /**
   * Drop การ์ดลงช่องสนาม
   *
   * - จากช่องสนาม → สลับตำแหน่ง
   * - จากตัวสำรอง → ส่งลงสนาม
   */
  const handleDropOnSlot = (
    slotId: string,
    payload: CardDragPayload,
  ) => {
    if (payload.fromSlotId) {
      const result = swapSlots(payload.fromSlotId, slotId);

      if (!result.ok) {
        setNotice(result.reason ?? null);
      }
    } else {
      tryAssign(slotId, payload.cardId);
    }

    setPendingCardId(null);
  };

  /**
   * คลิกช่องผู้เล่น
   *
   * ถ้ามีตัวสำรองที่เลือกค้างไว้:
   *   → ส่งตัวสำรองลงช่องทันที
   *
   * ถ้าไม่มี:
   *   → เปิด SlotPickerModal
   */
  const handleSlotClick = (slotId: string) => {
    if (pendingCardId) {
      if (tryAssign(slotId, pendingCardId)) {
        setPendingCardId(null);
      }

      return;
    }

    setPickerSlotId(slotId);
  };

  /**
   * เลือก/ยกเลิกตัวสำรอง
   */
  const handleBenchClick = (cardId: string) => {
    setPendingCardId((current) =>
      current === cardId ? null : cardId,
    );
  };

  /**
   * ช่องที่กำลังเปิด Modal
   */
  const pickerSlot =
    formation.slots.find(
      (slot) => slot.id === pickerSlotId,
    ) ?? null;

  /**
   * นักเตะที่อยู่ในช่องปัจจุบัน
   */
  const currentInSlot =
    ratedSlots.find(
      (entry) => entry.slot.id === pickerSlotId,
    )?.player ?? null;

  /**
   * รายชื่อผู้เล่นที่สามารถเลือกมาลงช่องนี้ได้
   *
   * รวม:
   * - ตัวสำรอง
   * - ตัวจริงจากช่องอื่น
   */
  const pickerCandidates = useMemo<SlotCandidate[]>(() => {
    if (!pickerSlotId) return [];

    const fromBench: SlotCandidate[] = bench.map(
      ({ card, player }) => ({
        cardId: card.id,
        player,
        level: card.level,
        blockedReason: canAssign(
          pickerSlotId,
          card.id,
        ).reason,
      }),
    );

    const fromPitch: SlotCandidate[] = ratedSlots.flatMap(
      ({ slot, player, level }) => {
        if (slot.id === pickerSlotId || !player) {
          return [];
        }

        const cardId = team.squad.find(
          (entry) => entry.slotId === slot.id,
        )?.cardId;

        return cardId
          ? [
              {
                cardId,
                player,
                level,
                fromSlotId: slot.id,
              },
            ]
          : [];
      },
    );

    return [...fromBench, ...fromPitch];
  }, [
    bench,
    canAssign,
    pickerSlotId,
    ratedSlots,
    team.squad,
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      {/* ─────────────────────────────────────────────
          แถบควบคุมเหนือสนาม
      ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-700/80 px-3 py-2">
          <span className="text-sm font-semibold uppercase tracking-wide">
            {squadName}
          </span>

          <button
            type="button"
            aria-label="ล้างชุดทีม"
            className="text-chalk/40 hover:text-chalk"
          >
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
          <span className="sr-only">
            แผนการเล่น
          </span>

          <select
            value={team.formationId}
            onChange={(event) => {
              const result = changeFormation(
                event.target.value as FormationId,
              );

              if (!result.ok) {
                setNotice(result.reason ?? null);
              }
            }}
            className="appearance-none rounded-lg border border-white/10 bg-ink-700/80 py-2 pl-3 pr-9 text-sm font-semibold focus:border-neon/50"
          >
            {FORMATIONS.map((formationOption) => (
              <option
                key={formationOption.id}
                value={formationOption.id}
                className="bg-ink-800"
              >
                {formationOption.name}
              </option>
            ))}
          </select>

          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-chalk/50">
            ▾
          </span>
        </label>
      </div>

      {/* ─────────────────────────────────────────────
          สนาม
          
          สนามทั้งหมดอยู่ใน:
          /public/pitch-background.png

          React/Vite จะเรียก public asset ด้วย:
          /pitch-background.png
      ───────────────────────────────────────────── */}
      <div
        className="relative min-h-[470px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#05080A] shadow-glass"
        style={{
          backgroundImage: "url('/pitch-background.png')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',

          /*
           * ภาพถูกสร้างมาให้เป็นสนามเต็มเฟรม
           * จึง stretch ตามกรอบสนามเพื่อให้พิกัด
           * FormationPositions ตรงกับภาพ 1:1
           */
          backgroundSize: '100% 100%',
        }}
      >
        {/* ─────────────────────────────────────────
            Player cards layer
        ───────────────────────────────────────── */}
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

        {/* ─────────────────────────────────────────
            Notice
        ───────────────────────────────────────── */}
        {notice ? (
          <p className="pointer-events-none absolute inset-x-0 top-3 z-30 mx-auto w-fit max-w-[90%] rounded-full border border-[#D93A3A]/50 bg-black/85 px-4 py-1.5 text-center text-xs text-[#FF8A8A] backdrop-blur">
            {notice}
          </p>
        ) : (
          pendingCardId && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-30 mx-auto w-fit rounded-full bg-black/75 px-4 py-1.5 text-xs text-neon backdrop-blur">
              เลือกตัวสำรองไว้แล้ว — จิ้มช่องในสนามเพื่อส่งลง
            </p>
          )
        )}

        {/* ─────────────────────────────────────────
            ตัวสำรอง
        ───────────────────────────────────────── */}
        <SubsDrawer
          bench={bench}
          open={subsOpen}
          selectedCardId={pendingCardId}
          onToggle={() =>
            setSubsOpen((current) => !current)
          }
          onSelectCard={handleBenchClick}
          onDropCard={(payload) => {
            if (payload.fromSlotId) {
              const result = clearSlot(
                payload.fromSlotId,
              );

              if (!result.ok) {
                setNotice(result.reason ?? null);
              }
            }

            setPendingCardId(null);
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────
          เลือก/สลับนักเตะ
      ───────────────────────────────────────────── */}
      {pickerSlot && (
        <SlotPickerModal
          open
          slotId={pickerSlot.id}
          position={pickerSlot.position}
          current={currentInSlot}
          candidates={pickerCandidates}
          onPick={(cardId) => {
            if (
              tryAssign(
                pickerSlot.id,
                cardId,
              )
            ) {
              setPickerSlotId(null);
            }
          }}
          onClear={() => {
            const result = clearSlot(
              pickerSlot.id,
            );

            if (result.ok) {
              setPickerSlotId(null);
            } else {
              setNotice(
                result.reason ?? null,
              );
            }
          }}
          onClose={() =>
            setPickerSlotId(null)
          }
        />
      )}
    </section>
  );
};
