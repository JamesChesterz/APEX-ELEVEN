/**
 * จัดการ "ประกาศอัปเดตล่าสุด" ที่ขึ้นบนหน้า HOME (แท็บ "ข่าวหน้าแรก" ของหน้า ADMIN)
 *
 * ต่างจากแท็บ "ประกาศ" เดิม (config/announcement) ตรงที่อันนั้นเป็นป็อปอัปเด้งครั้งเดียว
 * ส่วนอันนี้คือรายการข่าวที่อยู่บนหน้า HOME ตลอด — ใบไหนใส่รูปไว้จะโผล่ในสไลด์แบนเนอร์ด้วย
 */
import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { createEmptyNews, NEWS_LIMITS, type NewsItem } from '@/services/homeFeed';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50';

export const NewsPanel = () => {
  const { news, saveNews } = useGameConfig();

  const [draft, setDraft] = useState<NewsItem[]>(news);
  const [editing, setEditing] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(news);
  if (syncedWith !== news) {
    setSyncedWith(news);
    setDraft(news);
    setEditing(0);
  }

  const item = draft[editing];

  const patch = (changes: Partial<NewsItem>) => {
    setDraft((current) =>
      current.map((entry, index) => (index === editing ? { ...entry, ...changes } : entry)),
    );
  };

  const addItem = () => {
    if (draft.length >= NEWS_LIMITS.maxItems) return;
    playSfx('click');
    setDraft((current) => [createEmptyNews(), ...current]);
    setEditing(0);
  };

  const removeItem = () => {
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
    const error = await saveNews(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — หน้า HOME ของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ประกาศอัปเดตล่าสุด (หน้า HOME)</p>
          <p className="mt-1 text-xs text-chalk/45">
            {draft.length}/{NEWS_LIMITS.maxItems} รายการ · ใบที่ใส่รูปจะขึ้นในสไลด์แบนเนอร์ด้วย ·
            เรียงบนลงล่างตามลำดับนี้
          </p>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={draft.length >= NEWS_LIMITS.maxItems}
            onClick={addItem}
            className="rounded-lg border border-neon/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
          >
            + เพิ่มข่าว
          </button>
          <button
            type="button"
            disabled={draft.length === 0}
            onClick={removeItem}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            ลบข่าวนี้
          </button>
        </div>
      </div>

      {draft.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ยังไม่มีข่าว — กด “+ เพิ่มข่าว” เพื่อเริ่มสร้างรายการแรก
        </p>
      )}

      {draft.length > 0 && item && (
        <>
          {/* ── เลือกข่าวที่จะแก้ ── */}
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
                {entry.title.trim() || `ข่าว #${index + 1}`}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="หัวข้อ">
              <input
                value={item.title}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={NEWS_LIMITS.maxTitleChars}
                placeholder="เช่น อัปเดต Season 8"
                className={inputClass}
              />
            </Field>

            <Field label="วันที่ (พิมพ์เองอิสระ)">
              <input
                value={item.date}
                onChange={(event) => patch({ date: event.target.value })}
                maxLength={NEWS_LIMITS.maxDateChars}
                placeholder="27/05/2024"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="เนื้อหาย่อ">
            <textarea
              value={item.message}
              onChange={(event) => patch({ message: event.target.value })}
              maxLength={NEWS_LIMITS.maxMessageChars}
              rows={3}
              placeholder="ข้อความสั้น ๆ ที่แสดงในรายการข่าว"
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
            <span className="mt-1 block text-right font-mono text-[10px] text-chalk/35">
              {item.message.length}/{NEWS_LIMITS.maxMessageChars}
            </span>
          </Field>

          <Field label="รูปแบนเนอร์ (URL — เว้นว่างได้ ถ้าไม่ต้องการให้ขึ้นสไลด์บนสุด)">
            <input
              value={item.imageUrl ?? ''}
              onChange={(event) => patch({ imageUrl: event.target.value })}
              maxLength={NEWS_LIMITS.maxImageUrlChars}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>

          {item.imageUrl && (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <img
                src={item.imageUrl}
                alt=""
                className="h-32 w-full object-cover"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-chalk/70">
            <input
              type="checkbox"
              checked={Boolean(item.badge)}
              onChange={(event) => patch({ badge: event.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-ink-900 accent-neon"
            />
            ติดป้าย NEW
          </label>

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
              {saving ? 'กำลังบันทึก…' : 'บันทึกข่าวทั้งหมด'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
