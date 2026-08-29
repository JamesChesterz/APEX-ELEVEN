/**
 * ตั้งค่ากล่องสุ่มรางวัลแบบตาราง (แท็บ "กล่องสุ่ม" ของหน้า ADMIN)
 *
 * ทำได้ทั้งหมดจากหน้านี้:
 *   • เปิด/ปิดเมนู Lucky Box (ปิดแล้วเมนูหายจากแถบนำทางของผู้เล่นทุกคน)
 *   • ตั้งขนาดตารางเอง (คอลัมน์ × แถว อย่างละ 3–12) — เปลี่ยนขนาดแล้วระบบขึ้นรอบใหม่ให้เอง
 *   • ตั้งชื่อกล่อง ราคาสุ่มครั้งแรก ขั้นบันไดที่แพงขึ้นต่อครั้ง และเพดานราคา
 *   • เลือกการ์ดใหญ่กลางตาราง (ตั้งใจให้เป็นการ์ด MYTHICAL)
 *   • กดช่องไหนก็ได้ในตารางเพื่อแก้รางวัลของช่องนั้น (เหรียญ/แต้ม/การ์ด)
 *   • ใส่รูปของแต่ละช่องได้ (.png .webp .gif) — อัปโหลดไฟล์ หรือใส่พาธไฟล์ใน public/
 *   • ตั้งเวลาปิดกล่อง และกด "เริ่มรอบใหม่" เพื่อล้างความคืบหน้าของผู้เล่นทุกคน
 *
 * ผู้เล่นที่เก็บครบทุกช่องแล้วจะเล่นต่อไม่ได้ ต้องรอแอดมินกด "เริ่มรอบใหม่" เท่านั้น
 * ไม่มีการรีเซ็ตอัตโนมัติ เพื่อกันการวนเก็บรางวัลชุดเดิมซ้ำ ๆ
 *
 * บันทึกแล้วเมนู Lucky Box ของทุกคนเปลี่ยนทันที ไม่ต้อง deploy ใหม่
 */
import { useMemo, useState } from 'react';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById, PLAYERS } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  cellCountOf,
  configByteSize,
  embeddedImageCount,
  LUCKY_SIZE_BLOCK,
  LUCKY_SIZE_WARN,
  cellPosition,
  createDefaultCells,
  createStarterGrid,
  describeReward,
  drawCost,
  grandSpan,
  grandStart,
  LUCKY_LIMITS,
  resizeCells,
  REWARD_TYPES,
  rewardIcon,
} from '@/services/luckyGrid';
import {
  formatRemaining,
  fromLocalInputValue,
  hoursFromNow,
  toLocalInputValue,
} from '@/services/pointsExchange';
import { isSafeLuckyImage } from '@/services/luckyImage';
import { playSfx } from '@/services/sound';
import type { LuckyGridConfig, LuckyReward, LuckyRewardType } from '@/types/lucky';
import { cn, formatNumber } from '@/utils/helpers';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

/** ปุ่มลัดตั้งเวลาปิดกล่อง */
const QUICK_END = [
  { label: '+1 วัน', hours: 24 },
  { label: '+3 วัน', hours: 72 },
  { label: '+7 วัน', hours: 168 },
  { label: '+14 วัน', hours: 336 },
] as const;

/** จำนวนการ์ดที่แสดงในตารางเลือกต่อครั้ง */
const PICKER_VISIBLE = 40;

export const LuckyGridPanel = () => {
  const { luckyGrid, saveLuckyGrid } = useGameConfig();

  const [draft, setDraft] = useState<LuckyGridConfig>(luckyGrid);
  /** ช่องที่กำลังแก้อยู่ (null = ยังไม่เลือก, 'grand' = การ์ดใหญ่) */
  const [editing, setEditing] = useState<number | 'grand' | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(luckyGrid);
  if (syncedWith !== luckyGrid) {
    setSyncedWith(luckyGrid);
    setDraft(luckyGrid);
    setEditing(null);
  }

  const grandPlayer = getPlayerById(draft.grandPlayerId);
  const ready = draft.cells.length > 0 && Boolean(draft.grandPlayerId);

  const results = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const list = term
      ? PLAYERS.filter(
          (player) =>
            player.name.toLowerCase().includes(term) ||
            player.position.toLowerCase().includes(term) ||
            player.rarity.toLowerCase().includes(term),
        )
      : PLAYERS;

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, PICKER_VISIBLE);
  }, [keyword]);

  const patch = (changes: Partial<LuckyGridConfig>) =>
    setDraft((current) => ({ ...current, ...changes }));

  /**
   * เปลี่ยนขนาดตาราง — ปรับความยาวรายการช่องตามไปด้วยทันที
   * ช่องเดิมที่ยังอยู่ในระยะถูกเก็บไว้ครบ ช่องที่งอกใหม่เติมด้วยรางวัลตั้งต้น
   * (ยังไม่เคยสร้างชุดช่อง = สร้างให้เลยจะได้ไม่เจอตารางเปล่า)
   */
  const setSize = (columns: number, rows: number) => {
    const nextColumns = Math.min(Math.max(columns, LUCKY_LIMITS.minSide), LUCKY_LIMITS.maxSide);
    const nextRows = Math.min(Math.max(rows, LUCKY_LIMITS.minSide), LUCKY_LIMITS.maxSide);

    setEditing(null);
    setDraft((current) => ({
      ...current,
      columns: nextColumns,
      rows: nextRows,
      cells:
        current.cells.length === 0
          ? createDefaultCells(nextColumns, nextRows)
          : resizeCells(current.cells, nextColumns, nextRows),
    }));
  };

  const patchCell = (index: number, reward: LuckyReward) =>
    setDraft((current) => ({
      ...current,
      cells: current.cells.map((entry, position) => (position === index ? reward : entry)),
    }));

  /** ตั้ง/ล้างรูปของช่องหนึ่ง — ค่าว่างต้องลบคีย์ทิ้ง ไม่ใช่ตั้ง undefined (Firestore ไม่รับ) */
  const setCellImage = (index: number, image: string) =>
    setDraft((current) => ({
      ...current,
      cells: current.cells.map((entry, position) => {
        if (position !== index) return entry;
        if (!image) {
          const { image: _drop, ...rest } = entry;
          return rest;
        }
        return { ...entry, image };
      }),
    }));

  /** ตั้ง/ล้างรูปหน้าปกของกล่อง */
  const setCoverImage = (image: string) =>
    setDraft((current) => {
      if (!image) {
        const { coverImage: _drop, ...rest } = current;
        return rest;
      }
      return { ...current, coverImage: image };
    });

  /** ลบ endsAt ทิ้งทั้งคีย์ ไม่ใช่ตั้งเป็น undefined (Firestore ไม่รับ undefined) */
  const clearEndsAt = () =>
    setDraft((current) => {
      const { endsAt: _drop, ...rest } = current;
      return rest;
    });

  /** เติมรางวัลแบบเดียวกันให้ทุกช่องรวดเดียว — ใช้ตอนอยากเริ่มจากผืนเปล่าที่เท่ากันหมด */
  const fillAll = (reward: LuckyReward) => {
    playSfx('click');
    setDraft((current) => ({ ...current, cells: current.cells.map(() => ({ ...reward })) }));
  };

  /** เปลี่ยนขนาดตารางแล้ว index ของช่องเลื่อนกันหมด ความคืบหน้าเก่าจึงใช้ต่อไม่ได้ */
  const sizeChanged = draft.columns !== luckyGrid.columns || draft.rows !== luckyGrid.rows;

  /** ขนาดเอกสารที่จะเซฟจริง — รูปที่อัปโหลดฝังไว้คือสิ่งเดียวที่ทำให้บวมได้ */
  const byteSize = configByteSize(draft);
  const embedded = embeddedImageCount(draft);

  const submit = async () => {
    // เอกสารใหญ่เกินเพดาน Firestore = เซฟไปก็ถูกปฏิเสธทั้งก้อน กันไว้ตั้งแต่ตรงนี้
    if (byteSize > LUCKY_SIZE_BLOCK) {
      setStatus('รูปที่ฝังไว้รวมกันใหญ่เกินไป — ลบรูปบางใบออก หรือเปลี่ยนไปใช้พาธไฟล์ใน public/ แทน');
      playSfx('error');
      return;
    }

    setSaving(true);
    setStatus(null);

    // ขนาดเปลี่ยน = ดันเลขรอบขึ้นให้เอง ผู้เล่นทุกคนจะเริ่มตารางใหม่พร้อมกัน
    const payload = sizeChanged
      ? { ...draft, round: Math.max(draft.round, luckyGrid.round + 1) }
      : draft;

    const error = await saveLuckyGrid(payload);
    setSaving(false);
    if (!error) {
      setDraft(payload);
      playSfx('rankUp');
    }
    setStatus(
      error ??
        (sizeChanged
          ? `บันทึกแล้ว — ตารางใหม่ ${payload.columns}×${payload.rows} และขึ้นรอบที่ ${payload.round} ให้อัตโนมัติ`
          : 'บันทึกแล้ว — เมนู Lucky Box ของทุกคนเปลี่ยนทันที'),
    );
  };

  const editingReward: LuckyReward | null =
    typeof editing === 'number' ? (draft.cells[editing] ?? null) : null;

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">
            กล่องสุ่มรางวัล (ตาราง {draft.columns}×{draft.rows})
          </p>
          <p className="mt-1 text-xs text-chalk/45">
            {cellCountOf(draft.columns, draft.rows)} ช่องรางวัล + การ์ดใหญ่กลางตาราง · รอบที่ {draft.round}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            patch({ enabled: !draft.enabled });
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
            draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/10 text-chalk/50 hover:text-chalk',
          )}
        >
          {draft.enabled ? 'เปิดอยู่ — ผู้เล่นเห็นเมนูนี้' : 'ปิดอยู่ — ซ่อนเมนูนี้'}
        </button>
      </div>

      {!ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 p-3 text-xs text-[#F0A070]">
          <span>ยังไม่เคยตั้งค่ากล่องนี้ — กดสร้างชุดตั้งต้นแล้วค่อยแก้ทีละช่องได้เลย</span>
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setDraft(createStarterGrid());
            }}
            className="ml-auto rounded-lg border border-neon/40 px-3 py-1.5 font-bold uppercase tracking-wider text-neon hover:bg-neon/10"
          >
            สร้างกล่องตั้งต้น
          </button>
        </div>
      )}

      {/* ── ขนาดตาราง ── */}
      <div className="space-y-2 rounded-lg border border-white/10 bg-ink-700/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <SideStepper
            label="คอลัมน์ (แนวนอน)"
            value={draft.columns}
            onChange={(value) => setSize(value, draft.rows)}
          />
          <SideStepper
            label="แถว (แนวตั้ง)"
            value={draft.rows}
            onChange={(value) => setSize(draft.columns, value)}
          />
        </div>

        <p className="text-[11px] text-chalk/45">
          ตาราง {draft.columns}×{draft.rows} = {draft.columns * draft.rows} ช่อง · การ์ดใหญ่กลางตารางกิน{' '}
          {grandSpan(draft.columns)}×{grandSpan(draft.rows)} ช่อง · เหลือช่องรางวัล{' '}
          {cellCountOf(draft.columns, draft.rows)} ช่อง
          <br />
          ด้านที่เป็นเลขคู่การ์ดใหญ่จะกิน 2 ช่อง (เลขคู่ไม่มีช่องกลางเดี่ยว) ด้านที่เป็นเลขคี่กินช่องเดียว
        </p>

        {sizeChanged && (
          <p className="rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 p-2 text-[11px] text-[#F0A070]">
            ⚠️ เปลี่ยนขนาดตารางแล้ว — พอกดบันทึก ระบบจะขึ้นรอบใหม่ให้อัตโนมัติ (รอบที่{' '}
            {Math.max(draft.round, luckyGrid.round + 1)}) ความคืบหน้าและราคาสุ่มของผู้เล่นทุกคนจะถูกล้าง
            เพราะเลขช่องเลื่อนกันหมด
          </p>
        )}
      </div>

      {/* ── รูปหน้าปกกล่อง ── */}
      <ImagePicker
        label="รูปหน้าปกกล่อง (ไม่ใส่ = โชว์การ์ดรางวัลใหญ่)"
        value={draft.coverImage ?? ''}
        onChange={setCoverImage}
        onError={setStatus}
      />

      {/* ── ค่าพื้นฐาน ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="ชื่อกล่อง">
          <input
            value={draft.title}
            maxLength={LUCKY_LIMITS.maxTitleChars}
            onChange={(event) => patch({ title: event.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="ราคาสุ่มครั้งแรก (เหรียญ)">
          <input
            type="number"
            min={0}
            value={draft.baseCost}
            onChange={(event) => patch({ baseCost: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>

        <Field label="แพงขึ้นครั้งละ (เหรียญ)">
          <input
            type="number"
            min={0}
            value={draft.costStep}
            onChange={(event) => patch({ costStep: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>

        <Field label="เพดานราคาต่อครั้ง (0 = ไม่จำกัด)">
          <input
            type="number"
            min={0}
            value={draft.maxCost}
            onChange={(event) => patch({ maxCost: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>
      </div>

      <p className="rounded-lg border border-white/10 bg-ink-700/40 p-3 font-mono text-[11px] text-chalk/55">
        ตัวอย่างราคา — ครั้งที่ 1: {formatNumber(drawCost(draft, 0))} · ครั้งที่ 10:{' '}
        {formatNumber(drawCost(draft, 9))} · ครั้งที่ 30: {formatNumber(drawCost(draft, 29))} · ครั้งสุดท้าย
        (ครั้งที่ {cellCountOf(draft.columns, draft.rows) + 1}):{' '}
        {formatNumber(drawCost(draft, cellCountOf(draft.columns, draft.rows)))}
      </p>

      {/* ── เวลาปิด + รอบ ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ปิดกล่องเมื่อ (ว่าง = ไม่มีกำหนด)">
          <div className="flex flex-wrap gap-1.5">
            <input
              type="datetime-local"
              value={toLocalInputValue(draft.endsAt)}
              onChange={(event) => {
                const next = fromLocalInputValue(event.target.value);
                if (next) patch({ endsAt: next });
                else clearEndsAt();
              }}
              className={cn(inputClass, 'font-mono text-xs')}
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_END.map((entry) => (
                <button
                  key={entry.hours}
                  type="button"
                  onClick={() => patch({ endsAt: hoursFromNow(entry.hours) })}
                  className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-chalk/55 hover:text-chalk"
                >
                  {entry.label}
                </button>
              ))}
              {draft.endsAt && (
                <button
                  type="button"
                  onClick={clearEndsAt}
                  className="rounded-lg border border-white/15 px-2 py-1 font-mono text-[10px] uppercase text-chalk/55 hover:text-chalk"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
          {draft.endsAt && (
            <p className="mt-1 font-mono text-[10px] text-chalk/45">
              เหลือ{' '}
              {formatRemaining(
                Math.max(0, Math.floor((new Date(draft.endsAt).getTime() - Date.now()) / 1000)),
              )}
            </p>
          )}
        </Field>

        <Field label="รอบของกล่อง">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                patch({ round: draft.round + 1 });
              }}
              className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10"
            >
              เริ่มรอบใหม่ (รอบที่ {draft.round + 1})
            </button>

          </div>
          <p className="mt-1 text-[11px] text-chalk/45">
            กด “เริ่มรอบใหม่” แล้วบันทึก = ความคืบหน้าและราคาสุ่มของผู้เล่นทุกคนถูกล้างทันที
            <br />
            ผู้เล่นที่เก็บครบทุกช่องแล้วจะเล่นต่อไม่ได้จนกว่าจะกดปุ่มนี้ — ระบบไม่รีเซ็ตเองอัตโนมัติ
            เพื่อไม่ให้วนเก็บรางวัลชุดเดิมซ้ำ
          </p>
        </Field>
      </div>

      {/* ── ตาราง: กดช่องเพื่อแก้รางวัลของช่องนั้น ── */}
      {draft.cells.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">กดช่องในตารางเพื่อแก้รางวัลของช่องนั้น</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="eyebrow mr-1">เติมทุกช่องเป็น</span>
              <button
                type="button"
                onClick={() => fillAll({ type: 'coins', amount: 10_000 })}
                className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-chalk/55 hover:text-chalk"
              >
                🪙 10,000
              </button>
              <button
                type="button"
                onClick={() => fillAll({ type: 'points', amount: 500 })}
                className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-chalk/55 hover:text-chalk"
              >
                💠 500
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid gap-1"
              style={{
                minWidth: draft.columns * 62,
                gridTemplateColumns: `repeat(${draft.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${draft.rows}, minmax(0, 1fr))`,
              }}
            >
              {/* การ์ดใหญ่กลางตาราง */}
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  setEditing('grand');
                }}
                style={{
                  gridColumn: `${grandStart(draft.columns)} / span ${grandSpan(draft.columns)}`,
                  gridRow: `${grandStart(draft.rows)} / span ${grandSpan(draft.rows)}`,
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg border p-1 transition-colors',
                  editing === 'grand'
                    ? 'border-neon bg-neon/10'
                    : 'border-gold/50 bg-gold/10 hover:border-gold',
                )}
              >
                {grandPlayer ? (
                  <PlayerCard player={grandPlayer} size="xs" style={{ width: '80%' }} />
                ) : (
                  <span className="text-[10px] text-chalk/40">เลือกการ์ด</span>
                )}
                <span className="font-mono text-[8px] uppercase text-gold">รางวัลใหญ่</span>
              </button>

              {draft.cells.map((reward, index) => {
                const { row, column } = cellPosition(index, draft);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setEditing(index);
                    }}
                    style={{ gridColumn: column, gridRow: row }}
                    title={`ช่อง ${index + 1} · ${describeReward(reward)}`}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-0.5 text-center transition-colors',
                      editing === index
                        ? 'border-neon bg-neon/10'
                        : 'border-white/10 bg-ink-900/50 hover:border-white/30',
                    )}
                  >
                    {isSafeLuckyImage(reward.image) ? (
                      <img
                        src={reward.image}
                        alt=""
                        loading="lazy"
                        className="max-h-[60%] w-4/5 object-contain"
                      />
                    ) : (
                      <span className="text-base leading-none">{rewardIcon(reward)}</span>
                    )}
                    <span className="w-full truncate font-mono text-[8px] text-chalk/55">
                      {reward.type === 'card'
                        ? (getPlayerById(reward.playerId ?? '')?.name ?? '—')
                        : formatNumber(reward.amount ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── แก้ช่องที่เลือก ── */}
      {editing !== null && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-ink-700/50 p-3">
          <p className="eyebrow">
            {editing === 'grand'
              ? 'รางวัลใหญ่กลางตาราง (ควรเป็นการ์ดระดับ MYTHICAL)'
              : `ช่องที่ ${(editing as number) + 1} — ${describeReward(draft.cells[editing as number])}`}
          </p>

          {editing !== 'grand' && editingReward && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {REWARD_TYPES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      const type = entry.key as LuckyRewardType;
                      patchCell(
                        editing as number,
                        type === 'card'
                          ? { type: 'card', playerId: editingReward.playerId ?? draft.grandPlayerId }
                          : { type, amount: editingReward.amount ?? 1000 },
                      );
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                      editingReward.type === entry.key
                        ? 'bg-neon text-ink-900'
                        : 'bg-white/5 text-chalk/55 hover:text-chalk',
                    )}
                  >
                    {entry.icon} {entry.label}
                  </button>
                ))}
              </div>

              {editingReward.type !== 'card' && (
                <Field label="จำนวนที่ได้รับ">
                  <input
                    type="number"
                    min={0}
                    value={editingReward.amount ?? 0}
                    onChange={(event) =>
                      patchCell(editing as number, {
                        type: editingReward.type,
                        amount: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    className={cn(inputClass, 'max-w-[14rem] font-mono')}
                  />
                </Field>
              )}
            </>
          )}

          {/* เลือกการ์ด — ใช้ทั้งกับรางวัลใหญ่และช่องปกติที่ตั้งเป็นการ์ด */}
          {(editing === 'grand' || editingReward?.type === 'card') && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] text-chalk/45">
                  เลือกอยู่:{' '}
                  {editing === 'grand'
                    ? (grandPlayer?.name ?? 'ยังไม่เลือก')
                    : (getPlayerById(editingReward?.playerId ?? '')?.name ?? 'ยังไม่เลือก')}
                </p>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ (พิมพ์ mythical ได้)"
                  className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50 sm:w-64"
                />
              </div>

              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/10 bg-ink-900/40 p-2 sm:grid-cols-6 lg:grid-cols-8">
                {results.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      if (editing === 'grand') patch({ grandPlayerId: player.id });
                      else patchCell(editing as number, { type: 'card', playerId: player.id });
                    }}
                    className="flex flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition-colors hover:border-white/20 hover:bg-white/5"
                  >
                    <PlayerCard player={player} size="xs" />
                    <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                      {player.name}
                    </span>
                  </button>
                ))}
              </div>

              {editing === 'grand' && grandPlayer && grandPlayer.rarity !== 'mythical' && (
                <p className="text-[11px] text-[#F0A070]">
                  ⚠️ การ์ดใบนี้ไม่ใช่ระดับ MYTHICAL — ใส่ได้ แต่ช่องกลางออกแบบมาให้เป็นรางวัลใหญ่สุดของกล่อง
                </p>
              )}
            </div>
          )}

          {typeof editing === 'number' && editingReward && (
            <ImagePicker
              label="รูปของช่องนี้ (ไม่ใส่ = ใช้ไอคอนตามประเภทรางวัล)"
              value={editingReward.image ?? ''}
              onChange={(image) => setCellImage(editing, image)}
              onError={setStatus}
            />
          )}

          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
          >
            ปิดช่องนี้
          </button>
        </div>
      )}

      {/* ── มาตรวัดขนาดเอกสาร ── */}
      {embedded > 0 && (
        <p
          className={cn(
            'rounded-lg border p-3 text-[11px]',
            byteSize > LUCKY_SIZE_BLOCK
              ? 'border-gem/40 bg-gem/10 text-gem'
              : byteSize > LUCKY_SIZE_WARN
                ? 'border-[#F0A070]/30 bg-[#F0A070]/10 text-[#F0A070]'
                : 'border-white/10 bg-ink-700/40 text-chalk/55',
          )}
        >
          ฝังรูปไว้ {embedded} ใบ · ขนาดค่าตั้งราว {Math.round(byteSize / 1024)} KB จากเพดาน 1024 KB
          {byteSize > LUCKY_SIZE_WARN && (
            <>
              <br />
              เอกสารนี้ผู้เล่นทุกคนต้องโหลดตอนเข้าเกม — ถ้าจะใส่รูปหลายใบ แนะนำวางไฟล์ไว้ใน public/
              แล้วใส่พาธแทนการอัปโหลด จะไม่กินพื้นที่เลย
            </>
          )}
        </p>
      )}

      {/* ── บันทึก ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {status && <p className="min-w-0 text-xs text-chalk/70">{status}</p>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(luckyGrid)}
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
            {saving ? 'กำลังบันทึก…' : 'บันทึกกล่องสุ่ม'}
          </button>
        </div>
      </div>
    </section>
  );
};

/** ช่องปรับจำนวนช่องของด้านหนึ่ง — มีปุ่ม −/+ เพราะกดบนมือถือง่ายกว่าพิมพ์ */
const SideStepper = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        disabled={value <= LUCKY_LIMITS.minSide}
        onClick={() => {
          playSfx('click');
          onChange(value - 1);
        }}
        className="h-9 w-9 shrink-0 rounded-lg border border-white/15 font-mono text-lg leading-none text-chalk/70 hover:text-chalk disabled:opacity-30"
      >
        −
      </button>

      <input
        type="number"
        min={LUCKY_LIMITS.minSide}
        max={LUCKY_LIMITS.maxSide}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || LUCKY_LIMITS.minSide)}
        className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-center font-mono text-sm outline-none focus:border-neon/50"
      />

      <button
        type="button"
        disabled={value >= LUCKY_LIMITS.maxSide}
        onClick={() => {
          playSfx('click');
          onChange(value + 1);
        }}
        className="h-9 w-9 shrink-0 rounded-lg border border-white/15 font-mono text-lg leading-none text-chalk/70 hover:text-chalk disabled:opacity-30"
      >
        +
      </button>
    </div>
    <p className="mt-1 font-mono text-[10px] text-chalk/40">
      {LUCKY_LIMITS.minSide}–{LUCKY_LIMITS.maxSide} ช่อง
    </p>
  </label>
);
