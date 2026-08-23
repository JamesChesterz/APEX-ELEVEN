/** วิดเจ็ตซองการ์ดฟรีบนแดชบอร์ดล่าง — กดแล้วไปหน้าร้านซองการ์ด */
import { Link } from 'react-router-dom';

interface CardPackWidgetProps {
  packName: string;
  nextIn: string;
}

export const CardPackWidget = ({ packName, nextIn }: CardPackWidgetProps) => (
  <section className="glass-panel flex flex-col p-4">
    <p className="panel-title">Card Pack</p>

    <div className="mt-3 flex flex-1 items-center gap-3">
      <div className="flex h-[70px] w-[52px] shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-[#6B3FB0] via-[#3D2270] to-[#1A1030] font-display text-xl text-white/80 ring-1 ring-white/15">
        ⬢
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold uppercase">{packName}</p>
        <p className="mt-1 font-mono text-[11px] text-chalk/45">รอบถัดไป: {nextIn}</p>
      </div>
    </div>

    <Link
      to="/card-pack"
      className="mt-3 w-full rounded-lg bg-neon py-2 text-center text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
    >
      เปิดซอง
    </Link>
  </section>
);
