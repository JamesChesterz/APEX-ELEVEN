/**
 * หน้าต่างเลือกนักเตะของช่องหนึ่งช่องบนสนาม
 *
 * กดที่ช่องตัวจริง → เห็นนักเตะทุกคนที่เรามีสำหรับตำแหน่งนั้น → กดเพื่อสลับได้ทันที
 * รายชื่อรวมทั้งตัวสำรองและตัวจริงในช่องอื่น (เลือกตัวจริงคนอื่น = สลับตำแหน่งกัน)
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getEffectiveOvr } from '@/services/teamRating';
import type { Player, Position } from '@/types/player';
import { cn } from '@/utils/helpers';

/** นักเตะหนึ่งคนที่ลงช่องนี้ได้ พร้อมที่มาของการ์ด */
export interface SlotCandidate {
  cardId: string;
  player: Player;
  /** เลเวลของการ์ดใบนี้ (1 = +0) ใช้ขึ้นป้ายค่าตีบวก */
  level?: number;
  /** ช่องที่การ์ดใบนี้อยู่ตอนนี้ (ไม่มี = เป็นตัวสำรอง) */
  fromSlotId?: string;
  /** เหตุผลที่เลือกใบนี้ไม่ได้ (เช่น มีนักเตะชื่อเดียวกันลงสนามอยู่แล้ว) */
  blockedReason?: string;
}

interface SlotPickerModalProps {
  open: boolean;
  /** ตำแหน่งของช่องที่กำลังเลือก เช่น 'ST' */
  position: Position;
  /** ชื่อช่อง เช่น 'ST1' ใช้แสดงให้รู้ว่ากำลังแก้ช่องไหน */
  slotId: string;
  /** นักเตะที่อยู่ในช่องนี้ตอนนี้ */
  current: Player | null;
  candidates: SlotCandidate[];
  onPick: (cardId: string) => void;
  /** เอานักเตะออกจากช่องนี้ (กลับไปเป็นตัวสำรอง) */
  onClear?: () => void;
  onClose: () => void;
}

/** ความเหมาะสมของนักเตะกับตำแหน่งนี้ ใช้ทั้งจัดกลุ่มและเรียงลำดับ */
type Fit = 'exact' | 'alt' | 'other';

const FIT_ORDER: Record<Fit, number> = { exact: 0, alt: 1, other: 2 };

const FIT_BADGE: Record<Fit, { label: string; className: string }> = {
  exact: { label: 'ตรงตำแหน่ง', className: 'bg-neon/20 text-neon ring-neon/40' },
  alt: { label: 'ตำแหน่งรอง', className: 'bg-kit/15 text-kit ring-kit/40' },
  other: { label: 'ผิดตำแหน่ง', className: 'bg-white/5 text-chalk/45 ring-white/10' },
};

const getFit = (player: Player, position: Position): Fit => {
  if (player.position === position) return 'exact';
  if (player.altPositions.includes(position)) return 'alt';
  return 'other';
};

export const SlotPickerModal = ({
  open,
  position,
  slotId,
  current,
  candidates,
  onPick,
  onClear,
  onClose,
}: SlotPickerModalProps) => {
  /** true = แสดงเฉพาะคนที่เล่นตำแหน่งนี้ได้จริง */
  const [onlyFit, setOnlyFit] = useState(true);

  /** จัดอันดับ: ตรงตำแหน่งก่อน แล้วค่อยเรียงตามค่าพลังจริงในช่องนี้ */
  const ranked = useMemo(() => {
    const slot = { id: slotId, position, x: 0, y: 0 };

    return candidates
      .map((candidate) => ({
        ...candidate,
        fit: getFit(candidate.player, position),
        effectiveOvr: getEffectiveOvr({ slot, player: candidate.player }),
      }))
      .sort(
        (a, b) =>
          // คนที่เลือกไม่ได้ (ชื่อซ้ำ) ถูกดันไปท้ายรายการเสมอ
          Number(Boolean(a.blockedReason)) - Number(Boolean(b.blockedReason)) ||
          FIT_ORDER[a.fit] - FIT_ORDER[b.fit] ||
          b.effectiveOvr - a.effectiveOvr,
      );
  }, [candidates, position, slotId]);

  const visible = onlyFit ? ranked.filter((entry) => entry.fit !== 'other') : ranked;
  const fitCount = ranked.filter((entry) => entry.fit !== 'other').length;

  return (
    <Modal
      open={open}
      title={`เลือกนักเตะ · ${position}`}
      subtitle={`ช่อง ${slotId} · เล่นตำแหน่งนี้ได้ ${fitCount} คน จากทั้งหมด ${ranked.length} คน · ห้ามนักเตะชื่อซ้ำใน 11 ตัวจริง`}
      onClose={onClose}
    >
      {/* นักเตะที่อยู่ในช่องนี้ตอนนี้ */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-white/10 bg-ink-700/60 p-3">
        {current ? (
          <>
            <PlayerCard player={current} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">ตัวจริงตอนนี้</p>
              <p className="truncate font-display text-lg">{current.name}</p>
              <p className="font-mono text-xs text-chalk/50">
                {current.position} · OVR {current.ovr}
              </p>
            </div>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-chalk/70 hover:border-[#D93A3A]/60 hover:text-[#D93A3A]"
              >
                เอาออก
              </button>
            )}
          </>
        ) : (
          <div className="flex-1">
            <p className="eyebrow">ตัวจริงตอนนี้</p>
            <p className="text-sm text-chalk/50">ช่องนี้ยังว่าง — เลือกนักเตะด้านล่างเพื่อจัดลง</p>
          </div>
        )}
      </div>

      {/* ตัวกรอง */}
      <div className="mb-3 flex gap-2">
        {[
          { key: true, label: `เล่นตำแหน่งนี้ได้ (${fitCount})` },
          { key: false, label: `ทั้งหมด (${ranked.length})` },
        ].map((tab) => (
          <button
            key={String(tab.key)}
            type="button"
            onClick={() => setOnlyFit(tab.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              onlyFit === tab.key
                ? 'bg-neon text-ink-900'
                : 'bg-white/5 text-chalk/60 hover:text-chalk',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* รายชื่อนักเตะที่เลือกได้ */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-chalk/45">
          ไม่มีนักเตะในหมวดนี้ — ลองกดดู “ทั้งหมด” หรือเปิดซองการ์ดเพิ่ม
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((entry) => {
            const badge = FIT_BADGE[entry.fit];

            return (
              <li key={entry.cardId}>
                <button
                  type="button"
                  disabled={Boolean(entry.blockedReason)}
                  title={entry.blockedReason}
                  onClick={() => onPick(entry.cardId)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                    entry.blockedReason
                      ? 'cursor-not-allowed border-[#D93A3A]/25 bg-ink-700/30 opacity-55'
                      : 'border-white/10 bg-ink-700/50 hover:border-neon/50 hover:bg-ink-600/60',
                  )}
                >
                  <PlayerCard
                    player={entry.player}
                    size="xs"
                    level={entry.level}
                    className={entry.blockedReason ? 'grayscale' : undefined}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{entry.player.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ring-1',
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                      {entry.blockedReason ? (
                        // นักเตะชื่อเดียวกันลงได้คนเดียวใน 11 ตัวจริง
                        <span className="rounded bg-[#D93A3A]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FF8A8A] ring-1 ring-[#D93A3A]/40">
                          ชื่อซ้ำในทีม
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-chalk/45">
                          {entry.fromSlotId ? `ตัวจริง · ${entry.fromSlotId}` : 'ตัวสำรอง'}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-display text-2xl leading-none">
                      {entry.effectiveOvr}
                    </span>
                    {/* ค่าพลังจริงในช่องนี้ต่างจากค่าพลังนักเตะเมื่อเล่นผิดตำแหน่ง */}
                    {entry.effectiveOvr !== entry.player.ovr && (
                      <span className="font-mono text-[9px] text-chalk/40 line-through">
                        {entry.player.ovr}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};
