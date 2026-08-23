/** มูลค่ารวมของทีม */
import { formatNumber } from '@/utils/helpers';

export const TeamValuePanel = ({ value }: { value: number }) => (
  <section className="glass-panel p-4">
    <p className="panel-title">Total Value</p>
    <p className="mt-2 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[10px] text-gold" aria-hidden>
        ⬤
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums">{formatNumber(value)}</span>
    </p>
  </section>
);
