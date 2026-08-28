/**
 * แผงรายชื่อข้างสนาม MATCHMAKING — ใช้ตัวเดียวกันทั้งฝั่งเราและฝั่งคู่แข่ง
 *
 * บนสุด = 11 ตัวจริงเรียงตามลำดับช่องในแผน (เบอร์ 1–11)
 * ถัดมา = ตัวสำรอง (เบอร์ 12 ขึ้นไป)
 * ล่างสุด = แถบสรุป "พร้อมแล้ว x/11" กับค่าพลังรวมของทีม
 *
 * ทุกแถวเป็นข้อมูลอ่านอย่างเดียว การจัดตัวจริงยังทำที่หน้า MY TEAM เหมือนเดิม
 */
import { positionTone, shortName } from '@/components/matchmaking/squadLabels';
import type { Position } from '@/types/player';
import { cn } from '@/utils/helpers';

export interface SquadRow {
  /** คีย์ที่ไม่ซ้ำในรายการ (ปกติใช้ slotId หรือ cardId) */
  key: string;
  /** ป้ายตำแหน่งที่จะโชว์ เช่น LCB, RDM */
  label: string;
  position: Position;
  /** null = ช่องว่าง ยังไม่ได้จัดตัว */
  name: string | null;
  ovr: number | null;
  /** ปลอกแขนกัปตัน (คนค่าพลังสูงสุดในทีม) */
  captain?: boolean;
  /** กำลังบาดเจ็บรอเปลี่ยนตัวในนัดนี้ */
  injured?: boolean;
  /** ติดโทษแบนอยู่ — ลงสนามไม่ได้จนกว่าจะครบโทษ */
  suspended?: boolean;
}

interface SquadListPanelProps {
  formationName: string;
  starters: SquadRow[];
  subs: SquadRow[];
  /** จำนวนช่องตัวจริงที่มีคนยืนอยู่จริง (ใช้ทำแถบ พร้อมแล้ว x/11) */
  filled: number;
  /** ค่าพลังรวมของทีม (null = ยังไม่รู้ เช่นยังไม่เจอคู่แข่ง) */
  totalOvr: number | null;
  /** ข้อความแทนรายชื่อเมื่อยังไม่มีข้อมูล (ใช้กับฝั่งคู่แข่งตอนยังไม่จับคู่) */
  placeholder?: string;
}

const Row = ({ index, row }: { index: number; row: SquadRow }) => (
  <li
    className={cn(
      'flex items-center gap-2 rounded-md px-2 py-[5px] transition-colors',
      row.suspended ? 'bg-[#F0705A]/10' : 'hover:bg-white/[0.04]',
    )}
  >
    <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-chalk/30">
      {index}
    </span>

    <span
      className={cn(
        'w-9 shrink-0 font-mono text-[10px] font-bold uppercase tracking-tight',
        row.name ? positionTone(row.position) : 'text-chalk/25',
      )}
    >
      {row.label}
    </span>

    <span
      className={cn(
        'min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight',
        row.name ? 'text-chalk/90' : 'text-chalk/25',
      )}
    >
      {row.name ? shortName(row.name) : '—'}
    </span>

    {row.captain && (
      <span
        className="shrink-0 rounded-[3px] bg-white/12 px-1 font-mono text-[9px] font-bold leading-[14px] text-chalk/70 ring-1 ring-white/20"
        title="กัปตันทีม"
      >
        C
      </span>
    )}
    {row.injured && (
      <span className="shrink-0 text-[10px] leading-none" title="บาดเจ็บ" aria-label="บาดเจ็บ">
        🚑
      </span>
    )}
    {row.suspended && (
      <span
        className="h-3 w-2 shrink-0 rounded-[1px] bg-[#E23A3A]"
        title="ติดโทษแบน"
        aria-label="ติดโทษแบน"
      />
    )}

    <span className="shrink-0 font-mono text-[10px] tabular-nums text-chalk/45">
      {row.ovr === null ? 'OVR —' : `OVR ${row.ovr}`}
    </span>
  </li>
);

export const SquadListPanel = ({
  formationName,
  starters,
  subs,
  filled,
  totalOvr,
  placeholder,
}: SquadListPanelProps) => {
  const ready = filled >= 11;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A0E14]/90 shadow-glass backdrop-blur-md">
      {/* หัวแผง */}
      <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
        <p className="font-display text-[15px] uppercase leading-none tracking-wide text-chalk">
          11 ตัวจริง
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neon/70">
          {formationName}
        </p>
      </div>

      {/* รายชื่อ — เลื่อนได้เองเมื่อจอเตี้ย ไม่ดันแถบสรุปตกขอบ */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {placeholder ? (
          <p className="px-2 py-10 text-center text-[11px] leading-relaxed text-chalk/35">
            {placeholder}
          </p>
        ) : (
          <>
            <ul className="space-y-px">
              {starters.map((row, index) => (
                <Row key={row.key} index={index + 1} row={row} />
              ))}
            </ul>

            {subs.length > 0 && (
              <>
                <p className="mt-3 px-2 pb-1 font-display text-[13px] uppercase leading-none tracking-wide text-chalk/70">
                  ตัวสำรอง
                </p>
                <ul className="space-y-px">
                  {subs.map((row, index) => (
                    <Row key={row.key} index={starters.length + index + 1} row={row} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* แถบสรุปล่างสุด */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ring-1',
              ready
                ? 'bg-neon/15 text-neon ring-neon/45'
                : 'bg-[#F0A070]/10 text-[#F0A070] ring-[#F0A070]/40',
            )}
            aria-hidden
          >
            {ready ? '✓' : '!'}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                'block truncate text-[11px] font-semibold leading-tight',
                ready ? 'text-neon' : 'text-[#F0A070]',
              )}
            >
              {ready ? 'พร้อมแล้ว' : 'จัดตัวไม่ครบ'}
            </span>
            <span className="block font-mono text-[10px] leading-tight text-chalk/40">
              OVR รวม
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block font-mono text-[11px] tabular-nums leading-tight text-chalk/60">
            {filled}/11
          </span>
          <span className="block font-display text-lg leading-none tabular-nums text-chalk">
            {totalOvr ?? '—'}
          </span>
        </span>
      </div>
    </aside>
  );
};
