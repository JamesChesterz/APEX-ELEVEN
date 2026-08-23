/**
 * แถบความเข้ากันของทีม (Chemistry)
 * เคมีไม่ได้เป็นแค่ตัวเลขโชว์ — มันถูกแปลงเป็นโบนัส/ค่าปรับค่าพลังตอนลงแข่งจริง
 */
import { cn, clamp, toInt } from '@/utils/helpers';

interface ChemistryPanelProps {
  chemistry: number;
  maxChemistry: number;
  /** โบนัสค่าพลังที่ได้จากเคมีชุดนี้ */
  bonus: number;
}

export const ChemistryPanel = ({ chemistry, maxChemistry, bonus }: ChemistryPanelProps) => {
  const percent = clamp(toInt((chemistry / maxChemistry) * 100), 0, 100);

  return (
    <section className="glass-panel p-4">
      <div className="flex items-baseline justify-between">
        <p className="panel-title">Chemistry</p>
        <p className="font-mono text-sm tabular-nums">
          {chemistry}/{maxChemistry}
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-dim to-neon transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span
          className={cn(
            'font-mono text-[11px]',
            bonus > 0 ? 'text-neon' : bonus < 0 ? 'text-[#F0A070]' : 'text-chalk/45',
          )}
        >
          {bonus > 0 ? `พลังทีม +${bonus}` : bonus < 0 ? `พลังทีม ${bonus}` : 'ไม่มีผลบวกลบ'}
        </span>
        <span className="font-mono text-[11px] text-neon">{percent}%</span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-chalk/40">
        จัดนักเตะให้ตรงตำแหน่งมากขึ้นเพื่อดันเคมี — ทีมที่ตรงตำแหน่งครบได้พลังเพิ่มสูงสุด +3
      </p>
    </section>
  );
};
