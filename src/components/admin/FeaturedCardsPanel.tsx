/**
 * จัดการ "แถวการ์ด" บนหน้า HOME (แท็บ "การ์ดใหม่ (หน้าแรก)" ของหน้า ADMIN)
 * เพิ่มได้หลายแถว แต่ละแถวตั้งหัวข้อ+ป้ายมุมการ์ดเองได้อิสระ — มีปุ่มพรีเซ็ตให้กด
 * เพิ่มแถว "การ์ดใหม่ล่าสุด" / "การ์ด OVR สูงสุด" / "LIMITED EDITION" ไวๆ โดยไม่ต้องพิมพ์เอง
 */
import { useState } from 'react';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  createEmptyCardRow,
  FEATURED_ROW_LIMITS,
  FEATURED_ROW_PRESETS,
  type FeaturedCardRow,
} from '@/services/homeFeed';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50';

const PRESET_BUTTONS: Array<{ key: keyof typeof FEATURED_ROW_PRESETS; icon: string }> = [
  { key: 'new', icon: '🃏' },
  { key: 'topOvr', icon: '👑' },
  { key: 'limited', icon: '💎' },
];

export const FeaturedCardsPanel = () => {
  const { featuredCardRows, saveFeaturedCardRows } = useGameConfig();

  const [draft, setDraft] = useState<FeaturedCardRow[]>(featuredCardRows);
  const [editing, setEditing] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(featuredCardRows);
  if (syncedWith !== featuredCardRows) {
    setSyncedWith(featuredCardRows);
    setDraft(featuredCardRows);
    setEditing(0);
  }

  const row = draft[editing];

  const patch = (changes: Partial<FeaturedCardRow>) => {
    setDraft((current) =>
      current.map((entry, index) => (index === editing ? { ...entry, ...changes } : entry)),
    );
  };

  const addRow = (preset?: keyof typeof FEATURED_ROW_PRESETS) => {
    if (draft.length >= FEATURED_ROW_LIMITS.maxRows) return;
    playSfx('click');
    setDraft((current) => [createEmptyCardRow(preset), ...current]);
    setEditing(0);
  };

  const removeRow = () => {
    if (draft.length === 0) return;
    playSfx('click');
    setDraft((current) => current.filter((_, index) => index !== editing));
    setEditing((current) => Math.max(0, current - 1));
  };

  const move = (direction: -1 | 1) => {
    const target = editing + direction;
    if (target < 0 || target >= draft.length) return;
    playSfx('click');
    setDraft((current) => {
      const next = [...current];
      [next[editing], next[target]] = [next[target], next[editing]];
      return next;
    });
    setEditing(target);
  };

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await saveFeaturedCardRows(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — หน้า HOME ของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">การ์ดใหม่ล่าสุด (หน้า HOME)</p>
          <p className="mt-1 text-xs text-chalk/45">
            {draft.length}/{FEATURED_ROW_LIMITS.maxRows} แถว · แถวละไม่เกิน{' '}
            {FEATURED_ROW_LIMITS.maxCardsPerRow} ใบ · เรียงบนลงล่างตามลำดับนี้
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESET_BUTTONS.map(({ key, icon }) => (
            <button
              key={key}
              type="button"
              disabled={draft.length >= FEATURED_ROW_LIMITS.maxRows}
              onClick={() => addRow(key)}
              title={`เพิ่มแถว “${FEATURED_ROW_PRESETS[key].title}”`}
              className="rounded-lg border border-neon/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
            >
              {icon} + {FEATURED_ROW_PRESETS[key].title}
            </button>
          ))}
          <button
            type="button"
            disabled={draft.length >= FEATURED_ROW_LIMITS.maxRows}
            onClick={() => addRow()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk disabled:opacity-40"
          >
            + แถวเปล่า
          </button>
          <button
            type="button"
            disabled={draft.length === 0}
            onClick={removeRow}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            ลบแถวนี้
          </button>
        </div>
      </div>

      {draft.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ยังไม่มีแถวการ์ด — กดปุ่มด้านบนเพื่อเริ่มสร้างแถวแรก
        </p>
      )}

      {draft.length > 0 && row && (
        <>
          {/* ── เลือกแถวที่จะแก้ ── */}
          <div className="flex flex-wrap gap-1.5">
            {draft.map((entry, index) => (
              <button
                key={`${entry.id}-${index}`}
                type="button"
                onClick={() => {
                  playSfx('click');
                  setEditing(index);
                }}
                className={cn(
                  'max-w-[14rem] truncate rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  index === editing
                    ? 'bg-neon text-ink-900'
                    : 'bg-white/5 text-chalk/55 hover:text-chalk',
                )}
              >
                {entry.title.trim() || `แถว #${index + 1}`}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">หัวข้อแถว</span>
              <input
                value={row.title}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={FEATURED_ROW_LIMITS.maxTitleChars}
                placeholder="เช่น การ์ด OVR สูงสุด"
                className={cn(inputClass, 'mt-1')}
              />
            </label>

            <label className="block">
              <span className="eyebrow">ป้ายมุมการ์ด (เว้นว่าง = ไม่ติดป้าย)</span>
              <input
                value={row.badge}
                onChange={(event) => patch({ badge: event.target.value })}
                maxLength={FEATURED_ROW_LIMITS.maxBadgeChars}
                placeholder="เช่น NEW, TOP OVR, LIMITED"
                className={cn(inputClass, 'mt-1')}
              />
            </label>
          </div>

          <CardMultiPicker
            selected={row.cardIds}
            onChange={(cardIds) => patch({ cardIds })}
            max={FEATURED_ROW_LIMITS.maxCardsPerRow}
          />

          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-4">
            <button
              type="button"
              disabled={editing === 0}
              onClick={() => move(-1)}
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk disabled:opacity-30"
            >
              ↑ ขึ้น
            </button>
            <button
              type="button"
              disabled={editing === draft.length - 1}
              onClick={() => move(1)}
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk disabled:opacity-30"
            >
              ↓ ลง
            </button>
            <div className="flex-1" />
            {status && <p className="text-xs text-chalk/70">{status}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="rounded-lg bg-neon px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกแถวการ์ดทั้งหมด'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
