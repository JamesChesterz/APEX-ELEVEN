/**
 * ADMIN → ทีมจำลอง (fake player)
 *
 * ทีมจำลองไม่มีเอกสารของตัวเองในฐานข้อมูล — ค่าทุกอย่างคำนวณสดจากเวลา
 * (ดู services/bots.ts) หน้านี้จึงไม่ได้ "แก้ข้อมูลบอท" ตรง ๆ แต่แก้สองอย่าง:
 *
 *   1. ค่าตั้งรวม — จำนวนทีม ความยาวตาราง ช่วงค่าพลัง เพดานคะแนน
 *   2. ค่าล็อกรายตัว — ชื่อ ค่าพลัง ตีบวก คะแนน ของทีมใดทีมหนึ่ง
 *
 * ช่องที่เว้นว่าง = ปล่อยให้ระบบสุ่มและโตเองตามเวลา
 * ใส่ค่าลงไป = ล็อกตายตัวจนกว่าจะลบออก (ลบแล้วกลับไปเป็นทีมเดิมเป๊ะ ไม่ใช่ทีมใหม่)
 *
 * ทั้งหมดเก็บใน config/bots ใบเดียว ผู้เล่นเห็นผลทันทีผ่าน onSnapshot
 */
import { useEffect, useMemo, useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { botAdminRows, botTickAt, BOT_LIMITS, DEFAULT_BOT_CONFIG } from '@/services/bots';
import { playSfx } from '@/services/sound';
import type { BotConfig, BotOverride } from '@/types/bot';
import { cn } from '@/utils/helpers';

/** ช่องกรอกตัวเลขที่ "เว้นว่างได้" — ว่าง = ใช้ค่าที่ระบบสุ่มให้ */
const OptionalNumber = ({
  label,
  hint,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  hint: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  step?: number;
}) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">{label}</span>
    <input
      type="number"
      step={step}
      value={value ?? ''}
      placeholder={hint}
      onChange={(event) =>
        onChange(event.target.value === '' ? undefined : Number(event.target.value))
      }
      className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
    />
  </label>
);

/** ช่องกรอกค่าตั้งรวมที่ต้องมีค่าเสมอ */
const RequiredNumber = ({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
}) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">{label}</span>
    <input
      type="number"
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
    />
  </label>
);

export const BotPanel = () => {
  const { bots, saveBots } = useGameConfig();
  const [draft, setDraft] = useState<BotConfig>(bots);
  const [selectedId, setSelectedId] = useState('bot-001');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(bots), [bots]);

  /**
   * ตัวอย่างค่าที่บอทจะเป็น "ตอนนี้" ตามร่างที่กำลังแก้อยู่
   * คำนวณสดจากร่าง ไม่ใช่จากค่าที่บันทึกแล้ว จึงเห็นผลก่อนกดบันทึก
   */
  const rows = useMemo(() => botAdminRows(botTickAt(), draft), [draft]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      ({ seed }) =>
        seed.teamName.toLowerCase().includes(term) ||
        seed.managerName.toLowerCase().includes(term) ||
        seed.id.includes(term),
    );
  }, [rows, search]);

  const selected = rows.find(({ seed }) => seed.id === selectedId) ?? rows[0];
  const override: BotOverride = draft.overrides[selected?.seed.id ?? ''] ?? {};
  const hasOverride = Object.keys(override).length > 0;

  const setGlobal = (patch: Partial<BotConfig>) => setDraft((prev) => ({ ...prev, ...patch }));

  /** แก้ค่าล็อกของทีมที่เลือกอยู่ — ลบคีย์ทิ้งเมื่อช่องถูกล้างจนว่าง */
  const setOverride = (patch: Partial<BotOverride>) =>
    setDraft((prev) => {
      const id = selected?.seed.id;
      if (!id) return prev;

      const next: BotOverride = { ...prev.overrides[id], ...patch };
      (Object.keys(next) as Array<keyof BotOverride>).forEach((key) => {
        if (next[key] === undefined || next[key] === '') delete next[key];
      });

      const overrides = { ...prev.overrides };
      if (Object.keys(next).length) overrides[id] = next;
      else delete overrides[id];

      return { ...prev, overrides };
    });

  const clearSelected = () => {
    playSfx('click');
    setDraft((prev) => {
      const overrides = { ...prev.overrides };
      delete overrides[selected?.seed.id ?? ''];
      return { ...prev, overrides };
    });
    setStatus('ล้างค่าล็อกของทีมนี้แล้ว — กดบันทึกเพื่อให้มีผลจริง');
  };

  const clearAll = () => {
    playSfx('click');
    setDraft((prev) => ({ ...prev, overrides: {} }));
    setStatus('ล้างค่าล็อกทุกทีมแล้ว — กดบันทึกเพื่อให้มีผลจริง');
  };

  const resetGlobals = () => {
    playSfx('click');
    setDraft((prev) => ({ ...DEFAULT_BOT_CONFIG, overrides: prev.overrides }));
    setStatus('คืนค่าตั้งรวมเป็นค่าเริ่มต้นแล้ว — กดบันทึกเพื่อให้มีผลจริง');
  };

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveBots(draft);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นทุกคนเห็นตารางใหม่ทันที');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">ทีมจำลองในตารางอันดับ</p>
          <p className="mt-1 text-xs text-chalk/45">
            ทีมจำลองค่าพลังและคะแนนขยับเองทุก 6 ชั่วโมงโดยไม่ต้องมีเซิร์ฟเวอร์ ·
            ช่องที่เว้นว่างในหน้านี้ = ปล่อยให้ระบบดูแลเอง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setGlobal({ matchmaking: !draft.matchmaking });
            }}
            title="ปิดแล้วทีมจำลองยังอยู่ในตารางอันดับ แต่จะไม่ถูกจับมาเป็นคู่แข่ง"
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
              draft.matchmaking ? 'bg-white/10 text-chalk' : 'bg-white/5 text-chalk/40',
            )}
          >
            {draft.matchmaking ? 'ลงจับคู่ด้วย' : 'ไม่ลงจับคู่'}
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setGlobal({ enabled: !draft.enabled });
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
              draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
            )}
          >
            {draft.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
          </button>
        </div>
      </div>

      {/* ── ค่าตั้งรวม ─────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">ค่าตั้งรวม</p>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <RequiredNumber
            label={`จำนวนทีมจำลอง (${BOT_LIMITS.rosterSize.min}–${BOT_LIMITS.rosterSize.max})`}
            value={draft.rosterSize}
            onChange={(rosterSize) => setGlobal({ rosterSize })}
          />
          <RequiredNumber
            label="ความยาวตารางอันดับ"
            value={draft.tableRows}
            onChange={(tableRows) => setGlobal({ tableRows })}
          />
          <RequiredNumber
            label="ทีมจำลองขั้นต่ำที่ต้องขึ้นเสมอ"
            value={draft.minBots}
            onChange={(minBots) => setGlobal({ minBots })}
          />
          <RequiredNumber
            label="เพดานคะแนนเทียบคนจริง (%)"
            value={Math.round(draft.topShare * 100)}
            onChange={(percent) => setGlobal({ topShare: percent / 100 })}
          />
          <RequiredNumber
            label="รอบรีเซ็ตคะแนน (วัน)"
            value={draft.cycleDays}
            onChange={(cycleDays) => setGlobal({ cycleDays })}
          />
          <RequiredNumber
            label="ค่าพลังตอนตั้งทีม ต่ำสุด"
            value={draft.baseOvrMin}
            onChange={(baseOvrMin) => setGlobal({ baseOvrMin })}
          />
          <RequiredNumber
            label="ค่าพลังตอนตั้งทีม สูงสุด"
            value={draft.baseOvrMax}
            onChange={(baseOvrMax) => setGlobal({ baseOvrMax })}
          />
          <RequiredNumber
            label="เพดานค่าพลัง ต่ำสุด"
            value={draft.capOvrMin}
            onChange={(capOvrMin) => setGlobal({ capOvrMin })}
          />
          <RequiredNumber
            label="เพดานค่าพลัง สูงสุด"
            value={draft.capOvrMax}
            onChange={(capOvrMax) => setGlobal({ capOvrMax })}
          />
          <RequiredNumber
            label="ลงแข่งต่อวัน ต่ำสุด"
            step={0.1}
            value={draft.matchesMin}
            onChange={(matchesMin) => setGlobal({ matchesMin })}
          />
          <RequiredNumber
            label="ลงแข่งต่อวัน สูงสุด"
            step={0.1}
            value={draft.matchesMax}
            onChange={(matchesMax) => setGlobal({ matchesMax })}
          />
          <RequiredNumber
            label="คะแนนอ้างอิงขั้นต่ำ (เซิร์ฟใหม่)"
            value={draft.minAnchor}
            onChange={(minAnchor) => setGlobal({ minAnchor })}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-chalk/40">
          ตอนนี้มีผู้เล่นจริงกี่คนก็ตาม ทีมจำลองจะขึ้นตารางอย่างน้อย {draft.minBots} ทีมเสมอ ·
          ถ้าคนจริงยังไม่ถึง {draft.tableRows} คน ระบบจะเติมบอทให้ตารางยาวครบตามที่ตั้งไว้
        </p>

        <p className="text-[11px] leading-relaxed text-chalk/40">
          เพดานคะแนน {Math.round(draft.topShare * 100)}% หมายถึงทีมจำลองที่คะแนนสูงสุดจะได้ไม่เกิน{' '}
          {Math.round(draft.topShare * 100)}% ของผู้เล่นจริงที่นำอยู่ — อันดับ 1
          จึงเป็นของคนจริงเสมอ (สำคัญเพราะรางวัลปลายซีซันจ่ายตามอันดับ)
        </p>
      </div>

      {/* ── รายทีม ─────────────────────────────────────────────── */}
      <div className="grid gap-4 border-t border-white/10 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อทีม / ผู้จัดการ / id"
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
          />

          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {visible.map(({ seed, state }) => {
              const locked = Boolean(draft.overrides[seed.id]);
              return (
                <button
                  key={seed.id}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setSelectedId(seed.id);
                    setStatus('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                    seed.id === selected?.seed.id
                      ? 'bg-neon/15 text-chalk'
                      : 'bg-white/5 text-chalk/60 hover:text-chalk',
                    seed.hidden && 'opacity-40',
                  )}
                >
                  <span className="font-mono text-[10px] text-chalk/40">{seed.id}</span>
                  <span className="flex-1 truncate font-bold">{seed.teamName}</span>
                  <span className="font-mono text-[11px]">
                    OVR {state.ovr}
                    {seed.plus > 0 && <span className="text-neon"> +{seed.plus}</span>}
                  </span>
                  <span className="w-10 text-right font-mono text-[11px] text-chalk/50">
                    {state.points}
                  </span>
                  {locked && <span title="มีค่าที่แอดมินล็อกไว้">🔒</span>}
                </button>
              );
            })}

            {!visible.length && (
              <p className="px-3 py-6 text-center text-xs text-chalk/40">
                ไม่พบทีมที่ค้นหา (หรือตั้งจำนวนทีมจำลองไว้เป็น 0)
              </p>
            )}
          </div>
        </div>

        {selected && (
          <div className="space-y-3 rounded-lg bg-white/[0.03] p-4">
            <div>
              <p className="text-sm font-bold">{selected.seed.teamName}</p>
              <p className="mt-0.5 font-mono text-[11px] text-chalk/45">
                {selected.seed.id} · ตอนนี้ OVR {selected.state.ovr} · คะแนน{' '}
                {selected.state.points} · {selected.state.wins}/{selected.state.draws}/
                {selected.state.losses}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                  ชื่อทีม
                </span>
                <input
                  value={override.teamName ?? ''}
                  placeholder={selected.seed.teamName}
                  onChange={(event) => setOverride({ teamName: event.target.value || undefined })}
                  className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                  ชื่อผู้จัดการ
                </span>
                <input
                  value={override.managerName ?? ''}
                  placeholder={selected.seed.managerName}
                  onChange={(event) =>
                    setOverride({ managerName: event.target.value || undefined })
                  }
                  className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
                />
              </label>

              <OptionalNumber
                label="ล็อกค่าพลัง (OVR)"
                hint="ว่าง = โตเอง"
                value={override.ovr}
                onChange={(ovr) => setOverride({ ovr })}
              />

              <OptionalNumber
                label="เพดานค่าพลัง"
                hint={String(Math.round(selected.seed.capOvr))}
                value={override.capOvr}
                onChange={(capOvr) => setOverride({ capOvr })}
              />

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                  ตีบวก (+0 → +{MAX_UPGRADE})
                </span>
                <select
                  value={override.plus ?? 0}
                  onChange={(event) =>
                    setOverride({
                      plus: Number(event.target.value) || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
                >
                  {Array.from({ length: MAX_UPGRADE + 1 }, (_unused, plus) => (
                    <option key={plus} value={plus} className="bg-ink-900">
                      +{plus}
                    </option>
                  ))}
                </select>
              </label>

              <OptionalNumber
                label="ลงแข่งต่อวัน"
                step={0.1}
                hint={selected.seed.matchesPerDay.toFixed(1)}
                value={override.matchesPerDay}
                onChange={(matchesPerDay) => setOverride({ matchesPerDay })}
              />

              <OptionalNumber
                label="อัตราชนะ (0–1)"
                step={0.01}
                hint={selected.seed.winRate.toFixed(2)}
                value={override.winRate}
                onChange={(winRate) => setOverride({ winRate })}
              />

              <OptionalNumber
                label="ล็อกคะแนน"
                hint="ว่าง = ขยับเอง"
                value={override.points}
                onChange={(points) => setOverride({ points })}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  setOverride({ hidden: override.hidden ? undefined : true });
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-colors',
                  override.hidden ? 'bg-white/10 text-chalk/60' : 'bg-white/5 text-chalk/50',
                )}
              >
                {override.hidden ? 'ซ่อนอยู่ — กดเพื่อโชว์' : 'ซ่อนทีมนี้'}
              </button>

              <button
                type="button"
                onClick={clearSelected}
                disabled={!hasOverride}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-chalk/60 hover:text-chalk disabled:opacity-30"
              >
                ล้างค่าล็อกของทีมนี้
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-chalk/40">
              ตีบวกใช้ตารางเดียวกับผู้เล่นจริง (ADMIN → ตารางตีบวก) แก้ตารางเมื่อไหร่
              ค่าพลังของทีมจำลองขยับตามทันที
            </p>
          </div>
        )}
      </div>

      {/* ── บันทึก ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
        >
          บันทึกค่าตั้ง
        </button>

        <button
          type="button"
          onClick={resetGlobals}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-chalk/60 hover:text-chalk"
        >
          คืนค่าตั้งรวมเป็นค่าเริ่มต้น
        </button>

        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-chalk/60 hover:text-chalk"
        >
          ล้างค่าล็อกทุกทีม
        </button>

        <span className="font-mono text-[11px] text-chalk/40">
          ล็อกไว้ {Object.keys(draft.overrides).length} ทีม
        </span>

        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </div>
    </section>
  );
};
