/**
 * สร้าง/แก้ซองการ์ดในร้าน (แท็บ "ซองการ์ด" ของหน้า ADMIN)
 *
 * บันทึกแล้วร้านเปลี่ยนทันทีสำหรับทุกคน ไม่ต้อง deploy ใหม่
 * ยังไม่เคยบันทึก = ร้านใช้ชุดค่าเริ่มต้นในโค้ด (src/data/cards.ts)
 *
 * มีตัวเตือนสองอย่างที่กันบั๊กที่เจอบ่อยตอนสร้างซอง:
 *   • odds รวมไม่ครบ 100
 *   • ตั้งโอกาสได้ระดับหนึ่งไว้ แต่ไม่มีการ์ดระดับนั้นในซอง (สุ่มไม่มีทางออก)
 */
import { useState } from 'react';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { useGameConfig } from '@/hooks/useGameConfig';
import { getPackPlayers } from '@/services/cardPack';
import {
  createEmptyPack,
  findEmptyRarities,
  PACK_LIMITS,
  PACK_TIERS,
  sumOdds,
} from '@/services/packConfig';
import { playSfx } from '@/services/sound';
import type { CardPack } from '@/types/card';
import { RARITY_ORDER, type Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** ช่องกรอกข้อความสั้น ๆ */
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

export const PackBuilderPanel = () => {
  const { packs, packsFromServer, savePacks } = useGameConfig();

  /** ชุดที่กำลังแก้อยู่ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<CardPack[]>(packs);
  const [editing, setEditing] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(packs);
  if (syncedWith !== packs) {
    setSyncedWith(packs);
    setDraft(packs);
  }

  const pack = draft[editing];

  const patch = (changes: Partial<CardPack>) => {
    setDraft((current) =>
      current.map((entry, index) => (index === editing ? { ...entry, ...changes } : entry)),
    );
  };

  const patchOdds = (rarity: Rarity, value: number) => {
    if (!pack) return;
    patch({ odds: { ...pack.odds, [rarity]: Math.min(Math.max(value, 0), 100) } });
  };

  const addPack = () => {
    if (draft.length >= PACK_LIMITS.maxPacks) return;
    playSfx('click');
    setDraft((current) => [...current, createEmptyPack()]);
    setEditing(draft.length);
  };

  const removePack = () => {
    if (draft.length <= 1) return;
    playSfx('click');
    setDraft((current) => current.filter((_, index) => index !== editing));
    setEditing((current) => Math.max(0, current - 1));
  };

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await savePacks(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — ร้านของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  if (!pack) return null;

  const total = sumOdds(pack.odds);
  const emptyRarities = findEmptyRarities(pack);
  const playersInPack = getPackPlayers(pack).length;

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ซองการ์ดในร้าน</p>
          <p className="mt-1 text-xs text-chalk/45">
            ตอนนี้ร้านใช้ชุดจาก{packsFromServer ? 'เซิร์ฟเวอร์' : 'ไฟล์ค่าเริ่มต้น'} ·{' '}
            {draft.length}/{PACK_LIMITS.maxPacks} ซอง
          </p>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={draft.length >= PACK_LIMITS.maxPacks}
            onClick={addPack}
            className="rounded-lg border border-neon/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
          >
            + เพิ่มซอง
          </button>
          <button
            type="button"
            disabled={draft.length <= 1}
            onClick={removePack}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            ลบซองนี้
          </button>
        </div>
      </div>

      {/* ── เลือกซองที่จะแก้ ── */}
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
              'max-w-[12rem] truncate rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
              index === editing
                ? 'bg-neon text-ink-900'
                : 'bg-white/5 text-chalk/55 hover:text-chalk',
            )}
          >
            {entry.name}
          </button>
        ))}
      </div>

      {/* ── รายละเอียดซอง ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อซอง">
          <input
            value={pack.name}
            maxLength={PACK_LIMITS.maxNameChars}
            onChange={(event) => patch({ name: event.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="ระดับซอง (มีผลกับหน้าตาเท่านั้น)">
          <div className="flex flex-wrap gap-1">
            {PACK_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => patch({ tier })}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 font-mono text-[10px] uppercase transition-colors',
                  pack.tier === tier
                    ? 'bg-kit text-ink-900'
                    : 'bg-white/5 text-chalk/55 hover:text-chalk',
                )}
              >
                {tier}
              </button>
            ))}
          </div>
        </Field>

        <Field label="ราคา (เหรียญ)">
          <input
            type="number"
            min={0}
            max={PACK_LIMITS.maxPrice}
            value={pack.price}
            onChange={(event) => patch({ price: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>

        <Field label={`จำนวนการ์ดต่อซอง (1–${PACK_LIMITS.maxCardsPerPack})`}>
          <input
            type="number"
            min={1}
            max={PACK_LIMITS.maxCardsPerPack}
            value={pack.cardCount}
            onChange={(event) =>
              patch({
                cardCount: Math.min(
                  Math.max(Number(event.target.value) || 1, 1),
                  PACK_LIMITS.maxCardsPerPack,
                ),
              })
            }
            className={cn(inputClass, 'font-mono')}
          />
        </Field>
      </div>

      <Field label="คำโปรย">
        <input
          value={pack.description}
          maxLength={PACK_LIMITS.maxDescriptionChars}
          placeholder="เช่น ซองไอคอนรุ่นพิเศษ"
          onChange={(event) => patch({ description: event.target.value })}
          className={cn(inputClass, 'placeholder:text-chalk/30')}
        />
      </Field>

      {/* ── โอกาสได้แต่ละระดับ ── */}
      <div className="space-y-2 rounded-lg border border-white/10 bg-ink-700/50 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">โอกาสได้แต่ละระดับ (ต่อการ์ด 1 ใบ)</p>
          <p
            className={cn(
              'font-mono text-[11px]',
              total === 100 ? 'text-neon' : 'text-[#F0A070]',
            )}
          >
            รวม {total}/100
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {RARITY_ORDER.map((rarity) => (
            <label key={rarity} className="block">
              <span className={cn('eyebrow', RARITY_STYLE[rarity].text)}>{rarity}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={pack.odds[rarity] ?? 0}
                onChange={(event) => patchOdds(rarity, Number(event.target.value) || 0)}
                className={cn(inputClass, 'mt-1 font-mono')}
              />
            </label>
          ))}
        </div>

        {total !== 100 && (
          <p className="text-[11px] text-[#F0A070]">
            ⚠️ รวมไม่ครบ 100 — ระบบยังสุ่มได้ แต่สัดส่วนจริงจะเพี้ยนจากที่ตั้งไว้
          </p>
        )}

        {emptyRarities.length > 0 && (
          <p className="text-[11px] text-[#F0A070]">
            ⚠️ ตั้งโอกาสได้ระดับ {emptyRarities.join(', ')} ไว้ แต่ไม่มีการ์ดระดับนั้นในซอง —
            สุ่มไม่มีทางออก ต้องใส่การ์ดเพิ่มหรือปรับโอกาสเป็น 0
          </p>
        )}
      </div>

      {/* ── นักเตะในซอง ── */}
      <div>
        <p className="eyebrow">
          นักเตะในซอง — ไม่เลือกเลย = สุ่มจากนักเตะทั้งเกม (ตอนนี้ออกได้ {formatNumber(playersInPack)} คน)
        </p>
        <div className="mt-2">
          <CardMultiPicker
            selected={pack.pool ?? []}
            onChange={(pool) => patch({ pool: [...new Set(pool)] })}
            max={PACK_LIMITS.maxPoolSize}
          />
        </div>
      </div>

      {/* ── บันทึก ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {status && <p className="min-w-0 text-xs text-chalk/70">{status}</p>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(packs)}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
          >
            คืนค่าเดิม
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-lg bg-neon px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกร้านค้า'}
          </button>
        </div>
      </div>
    </section>
  );
};
