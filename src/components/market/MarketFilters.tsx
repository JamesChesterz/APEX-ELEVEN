/**
 * แถบกรองและเรียงของในตลาด
 *
 * ทุกตัวกรองทำงานกับข้อมูลที่ดึงมาแล้วในเครื่อง (ของในตลาดมีไม่กี่สิบใบ)
 * จึงกดแล้วเปลี่ยนทันทีโดยไม่ต้องยิงเซิร์ฟเวอร์ใหม่
 */
import type { MarketFilter, MarketSort } from '@/types/market';
import { POSITIONS, RARITY_ORDER, type Position, type Rarity } from '@/types/player';
import { cn, RARITY_STYLE } from '@/utils/helpers';

const SORTS: Array<{ id: MarketSort; label: string }> = [
  { id: 'expiry-asc', label: 'ใกล้หมดเวลา' },
  { id: 'price-asc', label: 'ราคาต่ำ → สูง' },
  { id: 'price-desc', label: 'ราคาสูง → ต่ำ' },
  { id: 'ovr-desc', label: 'OVR สูง → ต่ำ' },
];

const FIELD =
  'w-full rounded-lg border border-white/10 bg-ink-800 px-2.5 py-2 text-sm text-chalk outline-none focus:border-neon/60';

const LABEL = 'mb-1 block text-[10px] uppercase tracking-[0.2em] text-chalk/40';

interface MarketFiltersProps {
  filter: MarketFilter;
  sort: MarketSort;
  onChange: (filter: MarketFilter) => void;
  onSort: (sort: MarketSort) => void;
  onReset: () => void;
}

export const MarketFilters = ({
  filter,
  sort,
  onChange,
  onSort,
  onReset,
}: MarketFiltersProps) => {
  /** ช่องตัวเลขว่าง = ไม่กรองเรื่องนั้น (undefined ไม่ใช่ 0) */
  const toNumber = (value: string): number | undefined => {
    const parsed = Number(value);
    return value.trim() === '' || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
  };

  return (
    <section className="glass-panel grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className={LABEL} htmlFor="market-position">
          ตำแหน่ง
        </label>
        <select
          id="market-position"
          className={FIELD}
          value={filter.position ?? 'all'}
          onChange={(event) =>
            onChange({ ...filter, position: event.target.value as Position | 'all' })
          }
        >
          <option value="all">ทุกตำแหน่ง</option>
          {POSITIONS.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL} htmlFor="market-rarity">
          ระดับการ์ด
        </label>
        <select
          id="market-rarity"
          className={FIELD}
          value={filter.rarity ?? 'all'}
          onChange={(event) => onChange({ ...filter, rarity: event.target.value as Rarity | 'all' })}
        >
          <option value="all">ทุกระดับ</option>
          {[...RARITY_ORDER].reverse().map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_STYLE[rarity].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL} htmlFor="market-min-ovr">
          OVR ขั้นต่ำ
        </label>
        <input
          id="market-min-ovr"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="เช่น 100"
          className={FIELD}
          value={filter.minOvr ?? ''}
          onChange={(event) => onChange({ ...filter, minOvr: toNumber(event.target.value) })}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="market-max-price">
          ราคาสูงสุด
        </label>
        <input
          id="market-max-price"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          placeholder="เช่น 100000"
          className={FIELD}
          value={filter.maxPrice ?? ''}
          onChange={(event) => onChange({ ...filter, maxPrice: toNumber(event.target.value) })}
        />
      </div>

      <div>
        <span className={LABEL}>เรียงตาม</span>
        <div className="flex gap-2">
          <select
            aria-label="เรียงตาม"
            className={FIELD}
            value={sort}
            onChange={(event) => onSort(event.target.value as MarketSort)}
          >
            {SORTS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'shrink-0 rounded-lg border border-white/10 px-3 text-xs uppercase tracking-wide',
              'text-chalk/60 hover:border-white/25 hover:text-chalk',
            )}
          >
            ล้าง
          </button>
        </div>
      </div>
    </section>
  );
};
