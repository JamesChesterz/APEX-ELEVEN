/**
 * แผงรายชื่อข้างสนาม MATCHMAKING — ใช้ตัวเดียวกันทั้งฝั่งเราและฝั่งคู่แข่ง
 *
 * บนสุด = 11 ตัวจริงเรียงตามลำดับช่องในแผน (เบอร์ 1–11)
 * ถัดมา = ม้านั่งสำรองที่ประกาศไว้ (เบอร์ 12 ขึ้นไป) — ช่องว่างก็โชว์ให้เห็นว่ายังใส่ได้อีก
 * ล่างสุด = แถบสรุป "พร้อมแล้ว x/11" กับค่าพลังรวมของทีม
 *
 * ฝั่งเราส่ง `interactive` เข้ามาได้ เพื่อเปลี่ยนตัวจากแผงนี้ตรง ๆ:
 * คลิกตัวสำรองหนึ่งครั้ง (เลือกไว้) แล้วคลิกตัวจริงที่จะเปลี่ยนออก — จบในสองคลิก
 * ฝั่งคู่แข่งไม่ส่งมา รายการก็เป็นแบบอ่านอย่างเดียวเหมือนเดิม
 */
import { positionTone, shortName } from '@/components/matchmaking/squadLabels';
import type { Position } from '@/types/player';
import { cn } from '@/utils/helpers';

export interface SquadRow {
  /** คีย์ที่ไม่ซ้ำในรายการ — ฝั่งตัวจริงใช้ slotId เพื่อให้กดเปลี่ยนตัวได้ */
  key: string;
  /** ป้ายตำแหน่งที่จะโชว์ เช่น LCB, RDM */
  label: string;
  position: Position;
  /** null = ช่องว่าง ยังไม่ได้จัดตัว */
  name: string | null;
  /** ค่าพลังที่รวมค่าตีบวกของการ์ดแล้ว */
  ovr: number | null;
  /** ค่าตีบวกของการ์ด (0/undefined = ยังไม่ได้ตีบวก ไม่ต้องโชว์ป้าย) */
  plus?: number;
  /** ปลอกแขนกัปตัน (คนค่าพลังสูงสุดในทีม) */
  captain?: boolean;
  /** กำลังบาดเจ็บรอเปลี่ยนตัวในนัดนี้ */
  injured?: boolean;
  /** ติดโทษแบนอยู่ — ลงสนามไม่ได้จนกว่าจะครบโทษ */
  suspended?: boolean;
}

/** ชุดฟังก์ชันที่ทำให้แผงนี้เปลี่ยนตัวได้ (ส่งมาเฉพาะฝั่งเรา) */
export interface SquadListInteraction {
  /** ช่องม้านั่งที่เลือกไว้รอส่งลงสนาม (null = ยังไม่ได้เลือก) */
  selectedBenchIndex: number | null;
  /** คลิกแถวตัวจริง — ถ้ามีตัวสำรองเลือกค้างอยู่จะเปลี่ยนตัวทันที */
  onStarterClick: (slotId: string) => void;
  /** คลิกแถวตัวสำรอง — มีคนอยู่ = เลือก/ยกเลิก · ช่องว่าง = เปิดรายการให้ใส่คน */
  onBenchClick: (index: number) => void;
  /** เอาคนออกจากม้านั่ง */
  onBenchClear: (index: number) => void;
}

interface SquadListPanelProps {
  formationName: string;
  starters: SquadRow[];
  /** null = ช่องม้านั่งที่ยังว่าง */
  subs: Array<SquadRow | null>;
  /** จำนวนช่องตัวจริงที่มีคนยืนอยู่จริง (ใช้ทำแถบ พร้อมแล้ว x/11) */
  filled: number;
  /** ค่าพลังรวมของทีม (null = ยังไม่รู้ เช่นยังไม่เจอคู่แข่ง) */
  totalOvr: number | null;
  /** ข้อความแทนรายชื่อเมื่อยังไม่มีข้อมูล (ใช้กับฝั่งคู่แข่งตอนยังไม่จับคู่) */
  placeholder?: string;
  interactive?: SquadListInteraction;
}

/** เนื้อในของแถวหนึ่ง — แยกออกมาเพราะแถวเป็นได้ทั้ง <li> เฉย ๆ และปุ่มกด */
const RowBody = ({ index, row }: { index: number; row: SquadRow }) => (
  <>
    <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-chalk/30">
      {index}
    </span>

    <span
      className={cn(
        'w-9 shrink-0 text-left font-mono text-[10px] font-bold uppercase tracking-tight',
        row.name ? positionTone(row.position) : 'text-chalk/25',
      )}
    >
      {row.label}
    </span>

    <span
      className={cn(
        'min-w-0 flex-1 truncate text-left text-[12px] font-semibold leading-tight',
        row.name ? 'text-chalk/90' : 'text-chalk/25',
      )}
    >
      {row.name ? shortName(row.name) : '—'}
    </span>

    {/* ค่าตีบวกของการ์ด — โชว์เฉพาะใบที่ตีบวกแล้ว จะได้ไม่รกแถวปกติ */}
    {row.plus !== undefined && row.plus > 0 && (
      <span className="shrink-0 rounded-[3px] bg-kit/20 px-1 font-mono text-[9px] font-bold leading-[14px] text-kit ring-1 ring-kit/40">
        +{row.plus}
      </span>
    )}

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
  </>
);

const ROW_BASE = 'flex w-full items-center gap-2 rounded-md px-2 py-[5px] transition-colors';

export const SquadListPanel = ({
  formationName,
  starters,
  subs,
  filled,
  totalOvr,
  placeholder,
  interactive,
}: SquadListPanelProps) => {
  const ready = filled >= 11;
  const picking = interactive?.selectedBenchIndex !== null && interactive !== undefined;

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
              {starters.map((row, index) =>
                interactive ? (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => interactive.onStarterClick(row.key)}
                      title={
                        picking ? 'เปลี่ยนตัวสำรองที่เลือกไว้ลงแทนคนนี้' : 'เลือกตัวสำรองก่อน'
                      }
                      className={cn(
                        ROW_BASE,
                        row.suspended && 'bg-[#F0705A]/10',
                        picking
                          ? 'ring-1 ring-neon/30 hover:bg-neon/10'
                          : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <RowBody index={index + 1} row={row} />
                    </button>
                  </li>
                ) : (
                  <li
                    key={row.key}
                    className={cn(ROW_BASE, row.suspended && 'bg-[#F0705A]/10')}
                  >
                    <RowBody index={index + 1} row={row} />
                  </li>
                ),
              )}
            </ul>

            {subs.length > 0 && (
              <>
                <div className="mt-3 flex items-baseline justify-between px-2 pb-1">
                  <p className="font-display text-[13px] uppercase leading-none tracking-wide text-chalk/70">
                    ตัวสำรอง
                  </p>
                  {interactive && (
                    <p className="font-mono text-[9px] uppercase tracking-wider text-chalk/35">
                      {picking ? 'เลือกตัวจริงที่จะออก' : 'แตะเพื่อเลือก'}
                    </p>
                  )}
                </div>

                <ul className="space-y-px">
                  {subs.map((row, index) => {
                    const number = starters.length + index + 1;
                    const selected = interactive?.selectedBenchIndex === index;

                    // ฝั่งคู่แข่ง (อ่านอย่างเดียว) — ช่องว่างไม่ต้องโชว์
                    if (!interactive) {
                      return row ? (
                        <li key={row.key} className={ROW_BASE}>
                          <RowBody index={number} row={row} />
                        </li>
                      ) : null;
                    }

                    return (
                      <li key={row?.key ?? `bench-${index}`} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => interactive.onBenchClick(index)}
                          title={row ? 'เลือกคนนี้เพื่อส่งลงสนาม' : 'เลือกนักเตะใส่ช่องนี้'}
                          className={cn(
                            ROW_BASE,
                            'min-w-0 flex-1',
                            selected
                              ? 'bg-neon/15 ring-1 ring-neon'
                              : 'hover:bg-white/[0.04]',
                          )}
                        >
                          <RowBody
                            index={number}
                            row={
                              row ?? {
                                key: `bench-${index}`,
                                label: '+',
                                position: 'CM',
                                name: null,
                                ovr: null,
                              }
                            }
                          />
                        </button>

                        {row && (
                          <button
                            type="button"
                            onClick={() => interactive.onBenchClear(index)}
                            aria-label={`เอา ${row.name} ออกจากม้านั่ง`}
                            className="shrink-0 rounded px-1 text-[11px] text-chalk/25 transition-colors hover:bg-white/10 hover:text-[#F07070]"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
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
            <span className="block font-mono text-[10px] leading-tight text-chalk/40">OVR รวม</span>
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
