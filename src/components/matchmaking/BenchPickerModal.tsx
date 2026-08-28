/**
 * เลือกนักเตะใส่ม้านั่งสำรองหนึ่งช่อง
 *
 * รายชื่อคือ "คนที่ยังไม่ได้อยู่ทั้งในตัวจริงและม้านั่ง" (reserves ของ useTeam)
 * ส่วนคนที่ชื่อซ้ำกับใครในทีม 16 คนจะขึ้นเทาและกดไม่ได้ พร้อมบอกเหตุผลไว้บนปุ่ม
 * เพราะกติกาห้ามชื่อซ้ำครอบทั้งทีม ไม่ใช่แค่ 11 ตัวจริง
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { positionTone } from '@/components/matchmaking/squadLabels';
import type { BenchCard } from '@/hooks/useTeam';
import { getPlus } from '@/services/upgrade';
import { cn } from '@/utils/helpers';

interface BenchPickerModalProps {
  open: boolean;
  /** เบอร์ของช่องม้านั่งที่กำลังจัด (12, 13, ...) */
  number: number;
  reserves: BenchCard[];
  /** เหตุผลที่ใส่ใบนี้ไม่ได้ (undefined = ใส่ได้) */
  blockedReason: (cardId: string) => string | undefined;
  onPick: (cardId: string) => void;
  onClose: () => void;
}

export const BenchPickerModal = ({
  open,
  number,
  reserves,
  blockedReason,
  onPick,
  onClose,
}: BenchPickerModalProps) => {
  const [search, setSearch] = useState('');

  /** เรียงคนที่ใส่ได้ขึ้นก่อน แล้วค่อยไล่ตามค่าพลัง */
  const ranked = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return reserves
      .filter((entry) => !keyword || entry.player.name.toLowerCase().includes(keyword))
      .map((entry) => ({ ...entry, blocked: blockedReason(entry.card.id) }))
      .sort(
        (a, b) =>
          Number(Boolean(a.blocked)) - Number(Boolean(b.blocked)) || b.player.ovr - a.player.ovr,
      );
  }, [blockedReason, reserves, search]);

  return (
    <Modal
      open={open}
      title={`ตัวสำรอง เบอร์ ${number}`}
      subtitle={`เลือกจากคลัง ${reserves.length} ใบ · ห้ามใช้นักเตะชื่อเดียวกันซ้ำในทีม`}
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ค้นหาชื่อนักเตะ"
        aria-label="ค้นหาชื่อนักเตะ"
        className="mb-3 w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm placeholder:text-chalk/30 focus:border-neon/50 focus:outline-none"
      />

      {ranked.length === 0 ? (
        <p className="py-10 text-center text-sm text-chalk/45">
          ไม่มีนักเตะที่เข้าเงื่อนไข — ลองล้างคำค้นหา หรือเปิดซองการ์ดเพิ่ม
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ranked.map((entry) => (
            <li key={entry.card.id}>
              <button
                type="button"
                disabled={Boolean(entry.blocked)}
                title={entry.blocked}
                onClick={() => onPick(entry.card.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                  entry.blocked
                    ? 'cursor-not-allowed border-[#D93A3A]/25 bg-ink-700/30 opacity-55'
                    : 'border-white/10 bg-ink-700/50 hover:border-neon/50 hover:bg-ink-600/60',
                )}
              >
                <PlayerCard
                  player={entry.player}
                  size="xs"
                  level={entry.card.level}
                  className={entry.blocked ? 'grayscale' : undefined}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{entry.player.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'font-mono text-[10px] font-bold',
                        positionTone(entry.player.position),
                      )}
                    >
                      {entry.player.position}
                    </span>
                    {getPlus(entry.card.level) > 0 && (
                      <span className="font-mono text-[10px] font-bold text-kit">
                        +{getPlus(entry.card.level)}
                      </span>
                    )}
                    {entry.blocked && (
                      <span className="truncate text-[10px] text-[#FF8A8A]">ชื่อซ้ำในทีม</span>
                    )}
                  </span>
                </span>

                <span className="shrink-0 font-display text-2xl leading-none">
                  {entry.player.ovr}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
