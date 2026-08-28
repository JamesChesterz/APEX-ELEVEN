/**
 * แผงซ้ายล่างของหน้า MATCHMAKING — ผู้เล่นบาดเจ็บ
 *
 * ระหว่างถ่ายทอดสด ถ้าตัวจริงของเราบาดเจ็บ นาฬิกาแมตช์จะหยุดรอจนกว่าจะเปลี่ยนตัวเสร็จ
 * แผงนี้จึงเสนอ "ตัวสำรองที่แนะนำ" (คนที่ค่าพลังสูงสุดที่ลงช่องนั้นได้)
 * ให้กดปุ่มลูกศรเขียวเปลี่ยนตัวจบในคลิกเดียว หรือกดดูรายชื่อทั้งหมดถ้าอยากเลือกเอง
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { positionTone, shortName } from '@/components/matchmaking/squadLabels';
import type { Player } from '@/types/player';

/** นักเตะหนึ่งคนพร้อมเบอร์และป้ายตำแหน่งที่จะโชว์ในแผงนี้ */
export interface InjuryEntry {
  cardId: string;
  /** เบอร์ในรายชื่อ (1–11 ตัวจริง, 12+ ตัวสำรอง) */
  number: number;
  label: string;
  player: Player;
}

interface InjuryPanelProps {
  injured: InjuryEntry | null;
  /** ตัวสำรองที่ระบบแนะนำ (null = ไม่มีใครลงแทนได้) */
  suggestion: InjuryEntry | null;
  onSubstitute: (cardId: string) => void;
  onOpenPicker: () => void;
}

const PlayerLine = ({ entry }: { entry: InjuryEntry }) => (
  <>
    <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-chalk/30">
      {entry.number}
    </span>
    <span className={`w-9 shrink-0 font-mono text-[10px] font-bold ${positionTone(entry.player.position)}`}>
      {entry.label}
    </span>
    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-chalk/90">
      {shortName(entry.player.name)}
    </span>
  </>
);

export const InjuryPanel = ({
  injured,
  suggestion,
  onSubstitute,
  onOpenPicker,
}: InjuryPanelProps) => (
  <section className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A0E14]/90 p-3 shadow-glass backdrop-blur-md">
    <p className="font-display text-[13px] uppercase leading-none tracking-wide text-chalk/85">
      ผู้เล่นบาดเจ็บ
    </p>

    {!injured ? (
      <p className="flex flex-1 items-center justify-center py-6 text-center text-[11px] text-chalk/35">
        ตอนนี้ไม่มีใครบาดเจ็บ — ลงแข่งได้เต็มทีม
      </p>
    ) : (
      <>
        {/* คนที่บาดเจ็บ */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
            <PlayerCard player={injured.player} size="xs" className="!w-full" />
          </span>

          <PlayerLine entry={injured} />

          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#E23A3A] text-[12px] font-bold leading-none text-white"
            aria-hidden
          >
            ✚
          </span>

          <span className="shrink-0 text-right">
            <span className="block text-[11px] font-semibold leading-tight text-[#F07070]">
              บาดเจ็บ
            </span>
            <span className="block text-[10px] leading-tight text-chalk/45">รอเปลี่ยนตัว</span>
          </span>
        </div>

        {/* ตัวสำรองที่แนะนำ */}
        <p className="mt-3 border-t border-white/10 pt-2.5 font-display text-[13px] uppercase leading-none tracking-wide text-chalk/85">
          เปลี่ยนตัวแนะนำ
        </p>

        {suggestion ? (
          <div className="mt-2 flex items-center gap-2.5">
            <PlayerLine entry={suggestion} />
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-chalk/45">
              OVR {suggestion.player.ovr}
            </span>
            <button
              type="button"
              onClick={() => onSubstitute(suggestion.cardId)}
              title={`เปลี่ยน ${suggestion.player.name} ลงแทน`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neon/15 text-neon ring-1 ring-neon/45 transition-colors hover:bg-neon hover:text-ink-900"
            >
              →
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-chalk/40">
            ไม่มีตัวสำรองที่ลงช่องนี้ได้ — ทีมจะแข่งต่อด้วย 10 คน
          </p>
        )}

        <button
          type="button"
          onClick={onOpenPicker}
          className="mt-2 self-start text-[11px] text-chalk/45 underline-offset-2 transition-colors hover:text-chalk/80 hover:underline"
        >
          เลือกตัวสำรองเอง
        </button>
      </>
    )}
  </section>
);
