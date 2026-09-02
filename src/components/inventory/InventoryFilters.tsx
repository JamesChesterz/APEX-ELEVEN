/**
 * แถบเครื่องมือของหน้า INVENTORY — แท็บหมวด + ตัวกรอง + ค้นหา + สลับมุมมอง
 *
 * แยกออกมาจากหน้าหลักเพราะตัวหน้ายาวพอแล้ว และแถบนี้เป็น UI ล้วน
 * ไม่มีตรรกะการกรองอยู่ข้างใน — ตัดสินใจกรองจริงที่ InventoryPage ที่เดียว
 */
import type { ReactNode } from 'react';
import { POSITIONS, type Position, type Rarity } from '@/types/player';
import { cn, RARITY_STYLE } from '@/utils/helpers';

/** หมวดของในคลัง (ตามแท็บในแบบ) */
export type InventoryTab = 'all' | 'players' | 'training' | 'items' | 'others';

export const INVENTORY_TABS: Array<{ id: InventoryTab; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'players', label: 'นักเตะ' },
  { id: 'training', label: 'การ์ดฝึก' },
  { id: 'items', label: 'ไอเทม' },
  { id: 'others', label: 'อื่นๆ' },
];

/** ช่วง OVR ที่เลือกได้ — ขอบบนเปิดไว้เพราะการ์ดทะลุ 150 ได้แล้ว */
export const OVR_BANDS: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: 'all', label: 'OVR', min: 0, max: Infinity },
  { id: '150', label: 'OVR 150+', min: 150, max: Infinity },
  { id: '130', label: 'OVR 130–149', min: 130, max: 149 },
  { id: '110', label: 'OVR 110–129', min: 110, max: 129 },
  { id: '90', label: 'OVR 90–109', min: 90, max: 109 },
  { id: 'low', label: 'OVR ต่ำกว่า 90', min: 0, max: 89 },
];

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

/** ดรอปดาวน์หน้าตาเดียวกันทั้งสี่ช่อง */
const Select = ({ value, onChange, children }: SelectProps) => (
  <div className="relative min-w-0 flex-1">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full appearance-none rounded-lg border border-white/10 bg-ink-800/80 px-3 py-2.5 pr-8 text-sm outline-none transition-colors hover:border-white/20 focus:border-neon/50"
    >
      {children}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-chalk/40">
      ▼
    </span>
  </div>
);

export interface InventoryFilterState {
  ovrBand: string;
  position: Position | 'all';
  rarity: Rarity | 'all';
  club: string;
  search: string;
}

interface InventoryFiltersProps {
  tab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
  filter: InventoryFilterState;
  onFilterChange: (filter: InventoryFilterState) => void;
  /** รายชื่อสโมสรที่มีอยู่จริงในคลัง (ไม่โชว์สโมสรที่ผู้เล่นไม่มีการ์ด) */
  clubs: string[];
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
  /** true = มีตัวกรองที่ยังเปิดอยู่ ปุ่มล้างจะเรืองขึ้นมา */
  dirty: boolean;
  onReset: () => void;
}

export const InventoryFilters = ({
  tab,
  onTabChange,
  filter,
  onFilterChange,
  clubs,
  view,
  onViewChange,
  dirty,
  onReset,
}: InventoryFiltersProps) => {
  const patch = (next: Partial<InventoryFilterState>) => onFilterChange({ ...filter, ...next });

  return (
    <div className="space-y-3">
      {/* แท็บหมวด */}
      <div className="flex flex-wrap gap-1.5">
        {INVENTORY_TABS.map((entry) => {
          const active = entry.id === tab;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onTabChange(entry.id)}
              className={cn(
                'rounded-lg px-6 py-2 text-sm transition-colors',
                active
                  ? 'bg-neon/15 font-semibold text-neon ring-1 ring-inset ring-neon/50'
                  : 'text-chalk/45 hover:bg-white/5 hover:text-chalk/75',
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* ตัวกรอง + ค้นหา + สลับมุมมอง */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[280px] flex-1 flex-wrap gap-2">
          <Select value={filter.ovrBand} onChange={(value) => patch({ ovrBand: value })}>
            {OVR_BANDS.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </Select>

          <Select
            value={filter.position}
            onChange={(value) => patch({ position: value as Position | 'all' })}
          >
            <option value="all">ตำแหน่ง</option>
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </Select>

          {/*
            แบบต้นฉบับเป็น "ลีก" กับ "ทีม" แต่ APEX ELEVEN ไม่มีข้อมูลลีก
            จึงใช้สองอย่างที่การ์ดมีจริง: ระดับการ์ด กับ สโมสร
            ใส่ช่องว่างเปล่าไว้แทนจะกรองอะไรไม่ได้เลย
          */}
          <Select
            value={filter.rarity}
            onChange={(value) => patch({ rarity: value as Rarity | 'all' })}
          >
            <option value="all">ระดับการ์ด</option>
            {(Object.keys(RARITY_STYLE) as Rarity[]).map((rarity) => (
              <option key={rarity} value={rarity}>
                {RARITY_STYLE[rarity].label}
              </option>
            ))}
          </Select>

          <Select value={filter.club} onChange={(value) => patch({ club: value })}>
            <option value="all">สโมสร</option>
            {clubs.map((club) => (
              <option key={club} value={club}>
                {club}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-chalk/35">
            ⌕
          </span>
          <input
            value={filter.search}
            onChange={(event) => patch({ search: event.target.value })}
            placeholder="ค้นหานักเตะ"
            className="w-full rounded-lg border border-white/10 bg-ink-800/80 py-2.5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-chalk/35 hover:border-white/20 focus:border-neon/50"
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          title="ล้างตัวกรองทั้งหมด"
          aria-label="ล้างตัวกรองทั้งหมด"
          className={cn(
            'grid h-[42px] w-[42px] place-items-center rounded-lg border transition-colors',
            dirty
              ? 'border-neon/50 bg-neon/10 text-neon'
              : 'border-white/10 bg-ink-800/80 text-chalk/40 hover:text-chalk/70',
          )}
        >
          ⛛
        </button>

        {/* สลับมุมมองตาราง / รายการ */}
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          {(['grid', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewChange(mode)}
              aria-label={mode === 'grid' ? 'มุมมองตาราง' : 'มุมมองรายการ'}
              className={cn(
                'grid h-[42px] w-[42px] place-items-center text-base transition-colors',
                view === mode ? 'bg-neon text-ink-900' : 'bg-ink-800/80 text-chalk/40',
              )}
            >
              {mode === 'grid' ? '▦' : '☰'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
