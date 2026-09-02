/**
 * แถบสรุปหัวหน้า INVENTORY
 *
 * ห้าช่องเรียงตามแบบ: จำนวนการ์ด · OVR สูงสุด · มูลค่ารวม · ค่าพลังทีม (พร้อมดาว) · การ์ดที่ล็อก
 * ช่อง TEAM OVR ใช้พื้นหลังคนละสีกับช่องอื่นเพราะเป็นค่าที่คนดูบ่อยที่สุด
 *
 * ตัวเลขทุกตัวรับมาเป็น prop ล้วน คอมโพเนนต์นี้ไม่คำนวณอะไรเอง
 */
import { cn, formatNumber } from '@/utils/helpers';

/** ดาวห้าดวงที่รองรับครึ่งดวง — แปลงจากคะแนน 0–5 */
const Stars = ({ score }: { score: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${score.toFixed(1)} จาก 5 ดาว`}>
    {Array.from({ length: 5 }).map((_, index) => {
      const fill = Math.min(1, Math.max(0, score - index));

      return (
        <span key={index} className="relative text-base leading-none text-white/15">
          ★
          {/* ครึ่งดวงทำด้วยการครอบดาวสีทองแล้วตัดความกว้าง ไม่ต้องมีไอคอนครึ่งดวงแยก */}
          <span
            className="absolute inset-0 overflow-hidden text-gold"
            style={{ width: `${fill * 100}%` }}
          >
            ★
          </span>
        </span>
      );
    })}
  </span>
);

interface InventoryStatsBarProps {
  total: number;
  capacity: number;
  topOvr: number;
  totalValue: number;
  teamOvr: number;
  /** คะแนนอันดับสะสม (เลขข้างดาว) */
  rankPoints: number;
  locked: number;
}

export const InventoryStatsBar = ({
  total,
  capacity,
  topOvr,
  totalValue,
  teamOvr,
  rankPoints,
  locked,
}: InventoryStatsBarProps) => (
  <section className="glass-panel relative flex flex-wrap items-center gap-x-8 gap-y-4 overflow-hidden px-5 py-4">
    {/* เส้นเรืองบาง ๆ ด้านบนตามแบบ */}
    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />

    <div>
      <p className="eyebrow">Total Players</p>
      <p className="font-display text-3xl leading-none">
        <span className="text-neon">{formatNumber(total)}</span>
        <span className="ml-1 text-lg text-chalk/35">/ {formatNumber(capacity)}</span>
      </p>
    </div>

    <div className="flex items-center gap-2.5">
      <span className="rounded-md border border-gold/50 bg-gold/10 px-2.5 py-1 text-center">
        <span className="block text-[8px] uppercase tracking-wide text-gold/70">OVR สูงสุด</span>
        <span className="block font-display text-xl leading-none text-gold">{topOvr}</span>
      </span>
    </div>

    <div>
      <p className="eyebrow">Total Value</p>
      <p className="flex items-center gap-1.5 font-display text-2xl leading-none text-gold">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink-900">
          B
        </span>
        {formatNumber(totalValue)}
      </p>
    </div>

    {/* ช่องค่าพลังทีม — เน้นด้วยพื้นม่วงให้ต่างจากช่องอื่นตามแบบ */}
    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-fuchsia-500/15 to-transparent px-4 py-2">
      <div>
        <p className="eyebrow text-fuchsia-300/80">Team OVR</p>
        <p className="font-display text-3xl leading-none text-fuchsia-200">{teamOvr}</p>
      </div>
      <div className="flex items-center gap-2">
        <Stars score={Math.min(5, (teamOvr / 150) * 5)} />
        <span className="font-mono text-xs text-chalk/50">★ {formatNumber(rankPoints)}</span>
      </div>
    </div>

    <div className="ml-auto">
      <p className="eyebrow">การ์ดที่ถูกล็อก</p>
      <p className={cn('flex items-center gap-1.5 font-display text-2xl leading-none')}>
        <span className="text-base">🔒</span>
        {formatNumber(locked)}
      </p>
    </div>
  </section>
);
