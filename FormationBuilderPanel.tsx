/**
 * แผงแอดมิน — วาดแผนการเล่นเองบนสนามจริง
 *
 * สนามที่ใช้เป็นภาพเดียวกับหน้า MATCHMAKING และแปลงพิกัดด้วยสูตรเดียวกัน
 * (projectMatchday / unprojectMatchday) แอดมินจึงเห็น "ตำแหน่งที่นักเตะจะยืนจริง"
 * ตอนวาด ไม่ใช่สนามจำลองคนละแบบที่วางเสร็จแล้วไปเพี้ยนตอนลงแข่ง
 *
 * วิธีใช้: เลือกตำแหน่งจากรายการ (หรือคลิกตัวหมากบนสนาม) แล้วคลิกจุดที่ต้องการบนสนาม
 * หรือจะลากตัวหมากตรง ๆ ก็ได้ ทั้งสองทางเขียนพิกัดเดียวกัน
 *
 * แผนพื้นฐาน 4 แบบในโค้ดแก้ไม่ได้จากที่นี่ — แผนที่สร้างจากหน้านี้เป็นของ "เพิ่มเข้ามา"
 * ผู้เล่นที่ใช้แผนพื้นฐานอยู่จึงไม่ได้รับผลกระทบอะไรเลยไม่ว่าแอดมินจะทำอะไรตรงนี้
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { projectMatchday, unprojectMatchday } from '@/components/matchmaking/matchdayProjection';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  createEmptyFormation,
  formationIssues,
  nextSlotId,
  SLOTS_PER_FORMATION,
  FORMATION_LIMITS,
} from '@/services/formationConfig';
import { playSfx } from '@/services/sound';
import { POSITIONS, type Position } from '@/types/player';
import type { Formation, FormationSlot } from '@/types/team';
import { cn, POSITION_GROUP } from '@/utils/helpers';

/** สีตัวหมากตามกลุ่มตำแหน่ง — กวาดตาแล้วเห็นรูปทรงของแผนทันที */
const GROUP_COLOR: Record<'gk' | 'defence' | 'midfield' | 'attack', string> = {
  gk: '#F5C445',
  defence: '#5AA9F0',
  midfield: '#31E06D',
  attack: '#F0705A',
};

export const FormationBuilderPanel = () => {
  const { customFormations, saveFormations } = useGameConfig();

  /** แผนที่กำลังแก้อยู่ (null = ยังไม่ได้เลือกอะไร) */
  const [draft, setDraft] = useState<Formation | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null);
  /** ช่องที่กำลังลากอยู่ (null = ไม่ได้ลาก) */
  const draggingRef = useRef<string | null>(null);

  /** แผนอื่น ๆ ที่ไม่ใช่ตัวที่กำลังแก้ — ใช้เช็ครหัสซ้ำ */
  const others = useMemo(
    () => customFormations.filter((entry) => entry.id !== draft?.id),
    [customFormations, draft?.id],
  );

  const issues = draft ? formationIssues(draft, others) : [];

  /** แปลงตำแหน่งเมาส์/นิ้วบนสนาม เป็นพิกัดของแผน */
  const pointToCoords = useCallback((clientX: number, clientY: number) => {
    const box = pitchRef.current?.getBoundingClientRect();
    if (!box) return null;

    return unprojectMatchday(
      ((clientX - box.left) / box.width) * 100,
      ((clientY - box.top) / box.height) * 100,
    );
  }, []);

  const moveSlot = useCallback((slotId: string, x: number, y: number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            slots: current.slots.map((slot) => (slot.id === slotId ? { ...slot, x, y } : slot)),
          }
        : current,
    );
  }, []);

  /** คลิกพื้นสนาม: มีช่องที่เลือกอยู่ = ย้ายไปจุดนั้น · ไม่มี = เพิ่มช่องใหม่ตรงนั้น */
  const handlePitchClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!draft) return;

    const point = pointToCoords(event.clientX, event.clientY);
    if (!point) return;

    if (selectedSlotId) {
      moveSlot(selectedSlotId, point.x, point.y);
      playSfx('click');
      return;
    }

    if (draft.slots.length >= SLOTS_PER_FORMATION) {
      setStatus(`ครบ ${SLOTS_PER_FORMATION} ตำแหน่งแล้ว — เลือกตัวที่มีอยู่เพื่อย้าย`);
      return;
    }

    const taken = new Set(draft.slots.map((slot) => slot.id));
    const slot: FormationSlot = {
      id: nextSlotId('CM', taken),
      position: 'CM',
      x: point.x,
      y: point.y,
    };
    setDraft({ ...draft, slots: [...draft.slots, slot] });
    setSelectedSlotId(slot.id);
    playSfx('click');
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const slotId = draggingRef.current;
    if (!slotId) return;

    const point = pointToCoords(event.clientX, event.clientY);
    if (point) moveSlot(slotId, point.x, point.y);
  };

  const updateSlot = (slotId: string, patch: Partial<FormationSlot>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            slots: current.slots.map((slot) =>
              slot.id === slotId ? { ...slot, ...patch } : slot,
            ),
          }
        : current,
    );
  };

  const removeSlot = (slotId: string) => {
    setDraft((current) =>
      current ? { ...current, slots: current.slots.filter((slot) => slot.id !== slotId) } : current,
    );
    setSelectedSlotId((current) => (current === slotId ? null : current));
  };

  /** บันทึกทั้งชุด (แผนที่แก้อยู่ + แผนอื่นที่มีอยู่แล้ว) */
  const handleSave = async () => {
    if (!draft || issues.length > 0) return;

    setSaving(true);
    const next = customFormations.some((entry) => entry.id === draft.id)
      ? customFormations.map((entry) => (entry.id === draft.id ? draft : entry))
      : [...customFormations, draft];

    const error = await saveFormations(next);
    setSaving(false);
    setStatus(error ?? `บันทึก "${draft.name}" แล้ว — ผู้เล่นเลือกแผนนี้ได้ทันที`);
    if (!error) playSfx('swap');
  };

  const handleDelete = async (formation: Formation) => {
    setSaving(true);
    const error = await saveFormations(
      customFormations.filter((entry) => entry.id !== formation.id),
    );
    setSaving(false);
    setStatus(error ?? `ลบ "${formation.name}" แล้ว — ทีมที่ใช้แผนนี้จะกลับไปใช้แผนพื้นฐาน`);
    if (!error && draft?.id === formation.id) setDraft(null);
  };

  return (
    <section className="space-y-4">
      {/* ── รายการแผนที่สร้างไว้ ── */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg uppercase">แผนการเล่นที่สร้างเอง</h3>
            <p className="text-xs text-chalk/45">
              เพิ่มจากแผนพื้นฐาน 4 แบบในเกม (แผนพื้นฐานแก้จากที่นี่ไม่ได้) · สร้างได้สูงสุด{' '}
              {FORMATION_LIMITS.maxFormations} แผน
            </p>
          </div>

          <button
            type="button"
            disabled={customFormations.length >= FORMATION_LIMITS.maxFormations}
            onClick={() => {
              playSfx('click');
              setDraft(createEmptyFormation());
              setSelectedSlotId(null);
              setStatus('เริ่มจากรูปทรง 4-4-2 — ลากหรือคลิกย้ายให้เป็นแผนที่ต้องการ');
            }}
            className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:opacity-40"
          >
            + สร้างแผนใหม่
          </button>
        </div>

        {customFormations.length === 0 ? (
          <p className="mt-4 text-sm text-chalk/40">
            ยังไม่มีแผนที่สร้างเอง — กดปุ่มด้านบนเพื่อเริ่มวาดแผนแรก
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {customFormations.map((formation) => (
              <li
                key={formation.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  draft?.id === formation.id
                    ? 'border-neon/60 bg-neon/5'
                    : 'border-white/10 bg-ink-700/40',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{formation.name}</span>
                  <span className="block truncate text-[11px] text-chalk/40">
                    {formation.description || formation.id}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    // คัดลอกลึกก่อนแก้ ไม่ให้ไปแตะข้อมูลที่มาจากเซิร์ฟเวอร์โดยตรง
                    setDraft({ ...formation, slots: formation.slots.map((slot) => ({ ...slot })) });
                    setSelectedSlotId(null);
                    setStatus(null);
                  }}
                  className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete(formation)}
                  className="shrink-0 rounded-lg border border-[#D93A3A]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF8A8A] hover:bg-[#D93A3A]/15 disabled:opacity-40"
                >
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── ตัวแก้ไข ── */}
      {draft && (
        <div className="panel space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-chalk/50">ชื่อแผน (ที่ผู้เล่นเห็น)</span>
              <input
                value={draft.name}
                maxLength={FORMATION_LIMITS.maxNameChars}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="เช่น 4-2-4 Ultra Attack"
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm focus:border-neon/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs text-chalk/50">คำอธิบายสั้น ๆ</span>
              <input
                value={draft.description}
                maxLength={FORMATION_LIMITS.maxDescriptionChars}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="เช่น บุกหนัก ใช้กองหน้าสี่คน"
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm focus:border-neon/50 focus:outline-none"
              />
            </label>
          </div>

          {/* ── สนาม ── */}
          <div>
            <p className="mb-2 text-xs text-chalk/50">
              {selectedSlotId
                ? `เลือก ${selectedSlotId} อยู่ — คลิกบนสนามเพื่อย้ายไปจุดนั้น (หรือลากตัวหมากก็ได้)`
                : draft.slots.length < SLOTS_PER_FORMATION
                  ? 'คลิกบนสนามเพื่อเพิ่มตำแหน่งใหม่ · คลิกตัวหมากเพื่อเลือกก่อนย้าย'
                  : 'คลิกตัวหมากเพื่อเลือก แล้วคลิกจุดใหม่บนสนามเพื่อย้าย'}
            </p>

            <div
              ref={pitchRef}
              onClick={handlePitchClick}
              onPointerMove={handleDragMove}
              onPointerUp={() => {
                draggingRef.current = null;
              }}
              onPointerLeave={() => {
                draggingRef.current = null;
              }}
              className="relative aspect-[16/9] w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-white/10 bg-[#05080A]"
              style={{
                backgroundImage: 'url(/pitch/matchday.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/*
                ครึ่งขวาคือฝั่งคู่แข่ง แผนที่วาดตรงนี้ใช้กับ "ทีมเรา" เท่านั้น
                (ฝั่งตรงข้ามระบบพลิกพิกัดให้เองตอนแข่ง) จึงหรี่ครึ่งขวาไว้กันวางผิดฝั่ง
              */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-black/45" />
              <p className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-chalk/35">
                ครึ่งสนามคู่แข่ง
                <br />
                (ระบบพลิกให้เอง)
              </p>

              {draft.slots.map((slot) => {
                const point = projectMatchday(slot.x, slot.y, 'home');
                const selected = selectedSlotId === slot.id;
                const color = GROUP_COLOR[POSITION_GROUP[slot.position]];

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={(event) => {
                      // กันไม่ให้คลิกทะลุไปโดน handler ของพื้นสนามจนย้ายตัวเองทันที
                      event.stopPropagation();
                      playSfx('click');
                      setSelectedSlotId(selected ? null : slot.id);
                    }}
                    onPointerDown={() => {
                      draggingRef.current = slot.id;
                      setSelectedSlotId(slot.id);
                    }}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      backgroundColor: selected ? color : `${color}33`,
                      borderColor: color,
                      color: selected ? '#06080C' : color,
                    }}
                    className={cn(
                      'absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 px-2 py-1 font-mono text-[10px] font-bold leading-none shadow-card active:cursor-grabbing',
                      selected && 'ring-2 ring-white/70',
                    )}
                  >
                    {slot.position}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── รายการตำแหน่ง ── */}
          <div>
            <p className="mb-2 text-xs text-chalk/50">
              ตำแหน่งทั้งหมด {draft.slots.length}/{SLOTS_PER_FORMATION}
            </p>

            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {draft.slots.map((slot) => (
                <li
                  key={slot.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2',
                    selectedSlotId === slot.id
                      ? 'border-neon/60 bg-neon/5'
                      : 'border-white/10 bg-ink-700/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSlotId(selectedSlotId === slot.id ? null : slot.id)}
                    className="w-14 shrink-0 truncate text-left font-mono text-[10px] text-chalk/50"
                    title="เลือกช่องนี้เพื่อย้ายบนสนาม"
                  >
                    {slot.id}
                  </button>

                  <select
                    value={slot.position}
                    onChange={(event) =>
                      updateSlot(slot.id, { position: event.target.value as Position })
                    }
                    aria-label={`ตำแหน่งของช่อง ${slot.id}`}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-ink-700/60 px-1.5 py-1 text-xs focus:border-neon/50 focus:outline-none"
                  >
                    {POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>

                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-chalk/35">
                    {slot.x}/{slot.y}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    aria-label={`ลบช่อง ${slot.id}`}
                    className="shrink-0 rounded px-1 text-xs text-chalk/30 hover:text-[#FF8A8A]"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── ปัญหาที่ต้องแก้ก่อนบันทึก ── */}
          {issues.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-[#F0A070]/40 bg-[#F0A070]/10 p-3 text-xs text-[#F0A070]">
              {issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={issues.length > 0 || saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-neon px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกแผนนี้'}
            </button>

            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setSelectedSlotId(null);
              }}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
            >
              ปิดตัวแก้ไข
            </button>

            {status && <p className="text-xs text-chalk/55">{status}</p>}
          </div>
        </div>
      )}
    </section>
  );
};
