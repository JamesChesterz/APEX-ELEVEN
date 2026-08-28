/**
 * หน้า Substitution — ที่เดียวของเกมที่ "เปลี่ยนตัว" ได้
 *
 * ทำไมต้องแยกจากหน้า MY TEAM:
 *   การพาตัวสำรองขึ้นสนามคือสิ่งเดียวที่ทำให้ติดคูลดาวน์ 1 ชั่วโมงของลีกประจำวัน
 *   เดิมมันปนอยู่กับการจัดตำแหน่งในหน้า MY TEAM ผู้เล่นจึงเผลอโดนล็อกทั้งที่ตั้งใจแค่ย้ายตำแหน่ง
 *   ตอนนี้ MY TEAM = จัดตำแหน่งอย่างเดียว (ไม่มีวันโดนล็อก) / หน้านี้ = เปลี่ยนตัว (มีคูลดาวน์ชัดเจน)
 *
 * วิธีใช้: เลือก "ตัวออก" จากรายชื่อ 11 ตัวจริง แล้วเลือก "ตัวเข้า" จากม้านั่งสำรอง แล้วกดยืนยัน
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useTeam } from '@/hooks/useTeam';
import { playSfx } from '@/services/sound';
import { getEffectiveOvr } from '@/services/teamRating';
import type { Position } from '@/types/player';
import { cn } from '@/utils/helpers';

/** ตัวกรองตำแหน่งของรายชื่อตัวสำรอง */
const GROUPS: Array<{ key: string; label: string; match: (position: Position) => boolean }> = [
  { key: 'all', label: 'ทั้งหมด', match: () => true },
  { key: 'gk', label: 'GK', match: (p) => p === 'GK' },
  { key: 'def', label: 'กองหลัง', match: (p) => ['CB', 'LB', 'RB'].includes(p) },
  { key: 'mid', label: 'กองกลาง', match: (p) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p) },
  { key: 'att', label: 'กองหน้า', match: (p) => ['LW', 'RW', 'ST'].includes(p) },
];

/** นับถอยหลังเป็น ชม:นาที:วินาที */
const formatRemaining = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

export const SubstitutionPage = () => {
  const {
    formation,
    ratedSlots,
    rating,
    team,
    bench,
    assignCard,
    canAssign,
    clearSlot,
    squadLock,
    suspensionRemaining,
  } = useTeam();

  /** cardId ของแต่ละช่อง — ใช้เช็คโทษแบนของคนที่ยืนอยู่ในช่องนั้น */
  const cardBySlot = useMemo(
    () => new Map(team.squad.map((entry) => [entry.slotId, entry.cardId])),
    [team.squad],
  );

  /**
   * ตัวจริงที่ยังติดโทษแบนอยู่
   *
   * โทษจะลดลงทีละนัดตอนเขี่ยบอลนัดใหม่เท่านั้น แต่จะลงแข่งไม่ได้เลยถ้าคนติดโทษ
   * ยังอยู่ใน 11 ตัวจริง — ต้องเปลี่ยนออกมานั่งม้านั่งก่อน โทษถึงจะเริ่มเดิน
   */
  const suspendedStarters = useMemo(
    () =>
      ratedSlots.flatMap(({ slot, player }) => {
        const cardId = cardBySlot.get(slot.id);
        const left = cardId ? suspensionRemaining(cardId) : 0;
        return left > 0 && player ? [{ slotId: slot.id, player, left }] : [];
      }),
    [cardBySlot, ratedSlots, suspensionRemaining],
  );

  /** ช่องที่เลือกไว้เป็น "ตัวออก" */
  const [slotId, setSlotId] = useState<string | null>(null);
  /** การ์ดสำรองที่เลือกไว้เป็น "ตัวเข้า" */
  const [cardId, setCardId] = useState<string | null>(null);
  const [group, setGroup] = useState('all');
  const [notice, setNotice] = useState<string | null>(null);
  /** เดินนาฬิกาเองทุกวินาที เพื่อให้ตัวเลขนับถอยหลังขยับจริง */
  const [, tick] = useState(0);

  useEffect(() => {
    if (!squadLock.locked) return undefined;
    const timer = window.setInterval(() => tick((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [squadLock.locked]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const slot = formation.slots.find((entry) => entry.id === slotId) ?? null;
  const outgoing = ratedSlots.find((entry) => entry.slot.id === slotId) ?? null;

  /** ตัวสำรองหลังกรองตำแหน่ง พร้อมค่าพลังจริงถ้าลงช่องที่เลือกไว้ */
  const options = useMemo(() => {
    const filter = GROUPS.find((entry) => entry.key === group) ?? GROUPS[0];

    return bench
      .filter(({ player }) => filter.match(player.position))
      .map(({ card, player }) => ({
        card,
        player,
        // ยังไม่เลือกช่อง = โชว์ค่าพลังดิบไปก่อน
        effectiveOvr: slot ? getEffectiveOvr({ slot, player }) : player.ovr,
        blockedReason: slot ? canAssign(slot.id, card.id).reason : undefined,
      }))
      .sort(
        (a, b) =>
          Number(Boolean(a.blockedReason)) - Number(Boolean(b.blockedReason)) ||
          b.effectiveOvr - a.effectiveOvr,
      );
  }, [bench, canAssign, group, slot]);

  const ready = Boolean(slotId && cardId) && !squadLock.locked;

  const confirm = () => {
    if (!slotId || !cardId) return;
    const result = assignCard(slotId, cardId);

    if (!result.ok) {
      setNotice(result.reason ?? 'เปลี่ยนตัวไม่ได้');
      return;
    }

    playSfx('swap');
    setNotice(null);
    setSlotId(null);
    setCardId(null);
  };

  const removeFromPitch = () => {
    if (!slotId) return;
    const result = clearSlot(slotId);
    if (!result.ok) setNotice(result.reason ?? 'เอาออกไม่ได้');
    else setSlotId(null);
  };

  return (
    <div className="space-y-4">
      {/* ── หัวหน้า ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">เปลี่ยนตัว</h2>
          <p className="text-sm text-chalk/50">
            เลือกตัวออกจากสนาม แล้วเลือกตัวเข้าจากม้านั่ง · ทีมตอนนี้ OVR {rating.matchOvr}
            {rating.emptySlots > 0 && ` · ยังว่างอีก ${rating.emptySlots} ช่อง`}
          </p>
        </div>
        <Link
          to="/my-team"
          className="rounded-lg border border-white/10 bg-ink-700/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:border-neon/40 hover:text-neon"
        >
          ← จัดตำแหน่งที่ MY TEAM
        </Link>
      </div>

      {/* ── สถานะคูลดาวน์ของลีก ── */}
      {squadLock.locked ? (
        <p className="rounded-xl border border-kit/40 bg-kit/10 px-4 py-3 text-sm text-kit">
          🔒 อยู่ในลีกประจำวัน — เปลี่ยนตัวได้อีกครั้งในอีก{' '}
          <span className="font-mono">{formatRemaining(squadLock.remainingMs)}</span>
          <span className="mt-1 block text-xs text-kit/70">
            ระหว่างนี้ยังสลับตำแหน่งของ 11 ตัวจริงได้ตามปกติที่หน้า MY TEAM
          </span>
        </p>
      ) : (
        <p className="rounded-xl border border-neon/25 bg-neon/[0.07] px-4 py-3 text-sm text-neon">
          ✓ เปลี่ยนตัวได้ตอนนี้ — ถ้าเข้าร่วมลีกอยู่ หลังเปลี่ยนแล้วจะเริ่มนับคูลดาวน์ 1 ชั่วโมง
        </p>
      )}

      {/* ── ตัวจริงที่ติดโทษแบน: ต้องเอาออกก่อนถึงจะลงแข่งได้ ── */}
      {suspendedStarters.length > 0 && (
        <div className="rounded-xl border border-[#E23A3A]/45 bg-[#E23A3A]/10 px-4 py-3 text-sm text-[#FF8A8A]">
          <p className="font-semibold">ลงแข่งไม่ได้ — มีตัวจริงติดโทษแบนอยู่</p>
          <ul className="mt-1.5 space-y-1">
            {suspendedStarters.map((entry) => (
              <li key={entry.slotId} className="flex items-center gap-2">
                <span className="h-3.5 w-2.5 shrink-0 rounded-[1px] bg-[#E23A3A]" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {entry.player.name} · ช่อง {entry.slotId} · เหลืออีก {entry.left} นัด
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setSlotId(entry.slotId);
                  }}
                  className="shrink-0 rounded-lg border border-[#E23A3A]/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-[#E23A3A]/20"
                >
                  เลือกเป็นตัวออก
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#FF8A8A]/70">
            เปลี่ยนเขาออกไปนั่งม้านั่งก่อน โทษแบนจะลดลงเองนัดละ 1 ทุกครั้งที่ลงแข่ง
          </p>
        </div>
      )}

      {notice && (
        <p className="rounded-xl border border-[#D93A3A]/40 bg-[#D93A3A]/10 px-4 py-3 text-sm text-[#FF8A8A]">
          {notice}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ── ฝั่งซ้าย: 11 ตัวจริง (เลือกตัวออก) ── */}
        <section className="glass-panel p-4">
          <p className="panel-title">1 · เลือกตัวออก</p>
          <p className="mt-1 text-xs text-chalk/45">แตะช่องที่ต้องการเปลี่ยน</p>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ratedSlots.map(({ slot: entrySlot, player, level }) => {
              const selected = slotId === entrySlot.id;
              const slotCardId = cardBySlot.get(entrySlot.id);
              const banLeft = slotCardId ? suspensionRemaining(slotCardId) : 0;

              return (
                <li key={entrySlot.id}>
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setSlotId(selected ? null : entrySlot.id);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                      selected
                        ? 'border-neon bg-neon/10'
                        : banLeft > 0
                          ? 'border-[#E23A3A]/60 bg-[#E23A3A]/10 hover:border-[#E23A3A]'
                          : 'border-white/10 bg-ink-700/50 hover:border-neon/40',
                    )}
                  >
                    {player ? (
                      <PlayerCard player={player} size="xs" level={level} />
                    ) : (
                      <span className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-chalk/35">
                        ว่าง
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-chalk/45">
                        {entrySlot.id} · {entrySlot.position}
                      </span>
                      <span className="block truncate text-sm font-semibold">
                        {player?.name ?? 'ยังไม่มีคนลงช่องนี้'}
                      </span>
                      {banLeft > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-[#E23A3A]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FF8A8A] ring-1 ring-[#E23A3A]/45">
                          <span className="h-2.5 w-[6px] rounded-[1px] bg-[#E23A3A]" aria-hidden />
                          ติดโทษแบน {banLeft} นัด
                        </span>
                      )}
                    </span>

                    {player && (
                      <span className="shrink-0 font-display text-xl leading-none">
                        {getEffectiveOvr({ slot: entrySlot, player })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── ฝั่งขวา: ม้านั่งสำรอง (เลือกตัวเข้า) ── */}
        <section className="glass-panel flex flex-col p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="panel-title">2 · เลือกตัวเข้า</p>
            <p className="font-mono text-[11px] text-chalk/45">สำรอง {bench.length} คน</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {GROUPS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setGroup(entry.key)}
                className={cn(
                  'rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  group === entry.key
                    ? 'bg-neon text-ink-900'
                    : 'bg-white/5 text-chalk/55 hover:text-chalk',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {options.length === 0 ? (
            <p className="py-10 text-center text-sm text-chalk/45">
              ไม่มีตัวสำรองในหมวดนี้ — เปิดซองการ์ดเพิ่มได้ที่หน้า Card Pack
            </p>
          ) : (
            <ul className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
              {options.map((entry) => {
                const selected = cardId === entry.card.id;

                return (
                  <li key={entry.card.id}>
                    <button
                      type="button"
                      disabled={Boolean(entry.blockedReason)}
                      title={entry.blockedReason}
                      onClick={() => {
                        playSfx('click');
                        setCardId(selected ? null : entry.card.id);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                        entry.blockedReason
                          ? 'cursor-not-allowed border-[#D93A3A]/25 bg-ink-700/30 opacity-55'
                          : selected
                            ? 'border-neon bg-neon/10'
                            : 'border-white/10 bg-ink-700/50 hover:border-neon/40',
                      )}
                    >
                      <PlayerCard
                        player={entry.player}
                        size="xs"
                        level={entry.card.level}
                        className={entry.blockedReason ? 'grayscale' : undefined}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {entry.player.name}
                        </span>
                        <span className="block font-mono text-[10px] text-chalk/45">
                          {entry.blockedReason ? 'ชื่อซ้ำในทีม' : entry.player.position}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block font-display text-xl leading-none">
                          {entry.effectiveOvr}
                        </span>
                        {entry.effectiveOvr !== entry.player.ovr && (
                          <span className="font-mono text-[9px] text-chalk/40 line-through">
                            {entry.player.ovr}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── แถบยืนยัน ── */}
      <section className="glass-panel flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">สรุปการเปลี่ยนตัว</p>
          <p className="mt-1 truncate text-sm">
            {outgoing?.player ? (
              <>
                <span className="text-[#FF8A8A]">↓ {outgoing.player.name}</span>
                {' · '}
              </>
            ) : slotId ? (
              <span className="text-chalk/50">ช่องว่าง {slotId} · </span>
            ) : (
              <span className="text-chalk/45">ยังไม่ได้เลือกช่อง · </span>
            )}
            {cardId ? (
              <span className="text-neon">
                ↑ {bench.find((entry) => entry.card.id === cardId)?.player.name}
              </span>
            ) : (
              <span className="text-chalk/45">ยังไม่ได้เลือกตัวเข้า</span>
            )}
          </p>
        </div>

        {slotId && outgoing?.player && (
          <button
            type="button"
            onClick={removeFromPitch}
            disabled={squadLock.locked}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-chalk/70 transition-colors hover:border-[#D93A3A]/60 hover:text-[#D93A3A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            เอาออกจากสนาม
          </button>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={!ready}
          className="rounded-lg bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-chalk/40"
        >
          ยืนยันเปลี่ยนตัว
        </button>
      </section>

      <p className="text-center text-xs text-chalk/35">
        ทีมชุดปัจจุบัน: {team.name} · {formation.name}
      </p>
    </div>
  );
};
