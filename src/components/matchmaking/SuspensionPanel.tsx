/**
 * แผงขวาล่างของหน้า MATCHMAKING — ผู้เล่นติดโทษแบน
 *
 * ใบแดงที่ได้ระหว่างแมตช์ทำให้นักเตะคนนั้นลงสนามไม่ได้ 3 นัดถัดไป
 * (นับถอยหลังทีละนัดทุกครั้งที่เขี่ยบอลนัดใหม่ — ดู useMatchmaking.kickoff)
 * แถว "นัดที่เหลือ" คือจำนวนนัดที่ยังต้องรอ ไล่จากนัดถัดไปเป็นต้นไป
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { positionTone, shortName } from '@/components/matchmaking/squadLabels';
import type { Player } from '@/types/player';

export interface SuspensionEntry {
  cardId: string;
  /** เบอร์ในรายชื่อ (ตัวจริงจะมีเบอร์ 1–11, ที่เหลือเป็นตัวสำรอง) */
  number: number;
  label: string;
  player: Player;
  /** จำนวนนัดที่ยังต้องแบน */
  matchesLeft: number;
}

interface SuspensionPanelProps {
  entries: SuspensionEntry[];
  /** true = คนที่ติดโทษยังอยู่ใน 11 ตัวจริง — ลงแข่งไม่ได้จนกว่าจะเปลี่ยนออก */
  blocking?: boolean;
  /** พาไปหน้าเปลี่ยนตัว (ใส่มาเมื่อ blocking) */
  onFix?: () => void;
}

export const SuspensionPanel = ({ entries, blocking, onFix }: SuspensionPanelProps) => {
  const featured = entries[0];

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A0E14]/90 p-3 shadow-glass backdrop-blur-md">
      <p className="font-display text-[13px] uppercase leading-none tracking-wide text-chalk/85">
        ผู้เล่นติดโทษแบน
      </p>

      {!featured ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-[11px] text-chalk/35">
          ไม่มีใครติดโทษแบน — เลือกลงสนามได้ทุกคน
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
              <PlayerCard player={featured.player} size="xs" className="!w-full" />
            </span>

            <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-chalk/30">
              {featured.number}
            </span>
            <span
              className={`w-9 shrink-0 font-mono text-[10px] font-bold ${positionTone(featured.player.position)}`}
            >
              {featured.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-chalk/90">
              {shortName(featured.player.name)}
            </span>

            <span
              className="h-5 w-3.5 shrink-0 rounded-[2px] bg-[#E23A3A]"
              title="โดนใบแดง"
              aria-hidden
            />

            <span className="shrink-0 text-right">
              <span className="block text-[11px] font-semibold leading-tight text-[#F07070]">
                โดนใบแดง
              </span>
              <span className="block text-[10px] leading-tight text-chalk/45">
                แบน {featured.matchesLeft} นัด
              </span>
            </span>
          </div>

          {/* นัดที่ยังต้องรอ */}
          <p className="mt-3 border-t border-white/10 pt-2.5 font-display text-[13px] uppercase leading-none tracking-wide text-chalk/85">
            นัดที่เหลือ
          </p>

          <ul className="mt-2 flex flex-wrap items-center gap-2">
            {Array.from({ length: featured.matchesLeft }, (_, index) => (
              <li
                key={index}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1"
              >
                <span
                  className="h-4 w-3 rounded-[2px] bg-[#E23A3A]/80"
                  aria-hidden
                />
                <span className="font-mono text-[11px] tabular-nums text-chalk/70">
                  {index + 1}
                </span>
              </li>
            ))}
          </ul>

          {entries.length > 1 && (
            <p className="mt-2 text-[11px] text-chalk/40">
              และอีก {entries.length - 1} คนที่ยังติดโทษอยู่
            </p>
          )}

          {/* โทษแบนลดลงตอนเขี่ยบอลนัดใหม่เท่านั้น จึงต้องเอาคนติดโทษออกจากตัวจริงก่อน */}
          {blocking && onFix && (
            <div className="mt-2 rounded-lg border border-[#E23A3A]/40 bg-[#E23A3A]/10 p-2">
              <p className="text-[11px] leading-snug text-[#FF8A8A]">
                เขายังอยู่ใน 11 ตัวจริง — เปลี่ยนออกก่อนถึงจะลงแข่งได้ แล้วโทษจะลดเองนัดละ 1
              </p>
              <button
                type="button"
                onClick={onFix}
                className="mt-1.5 rounded-md border border-[#E23A3A]/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF8A8A] transition-colors hover:bg-[#E23A3A]/20"
              >
                ไปหน้าเปลี่ยนตัว
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
