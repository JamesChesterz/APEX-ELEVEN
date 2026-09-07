/**
 * ADMIN → ทีมพิเศษ — ตั้งชุด 11 ตัวจริงที่จัดครบแล้วได้โบนัส Team OVR
 *
 * ตั้งได้หลายชุด แต่ละชุดมีรายชื่อนักเตะของตัวเองและโบนัสของตัวเอง (ค่าเริ่มต้น +5)
 * บันทึกแล้วทุกเครื่องเห็นทันที ไม่ต้อง deploy ใหม่
 *
 * เลือกนักเตะจากคลังทั้งเกม — คนละคนเท่านั้น (ห้ามซ้ำ) เพราะสนามห้ามนักเตะ
 * ชื่อเดียวกันลงพร้อมกันอยู่แล้ว ชุดที่มีชื่อซ้ำจึงเป็นชุดที่ไม่มีวันครบ
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById, PLAYERS } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { playSfx } from '@/services/sound';
import {
  createEmptySquadBonusTeam,
  squadBonusTeamIssues,
  SQUAD_BONUS_LIMITS,
} from '@/services/squadBonus';
import type { SquadBonusTeam } from '@/types/team';
import { cn, RARITY_STYLE } from '@/utils/helpers';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

/** จำนวนใบที่แสดงในตารางค้นหาต่อครั้ง */
const VISIBLE = 48;

export const SquadBonusPanel = () => {
  const { squadBonus, saveSquadBonus } = useGameConfig();

  const [draft, setDraft] = useState<SquadBonusTeam[]>(squadBonus.teams);
  const [enabled, setEnabled] = useState(squadBonus.enabled);
  const [editing, setEditing] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(squadBonus);
  if (syncedWith !== squadBonus) {
    setSyncedWith(squadBonus);
    setDraft(squadBonus.teams);
    setEnabled(squadBonus.enabled);
    setEditing(0);
  }

  const team = draft[editing];

  const patch = (changes: Partial<SquadBonusTeam>) => {
    setDraft((current) =>
      current.map((entry, index) => (index === editing ? { ...entry, ...changes } : entry)),
    );
  };

  const addTeam = () => {
    if (draft.length >= SQUAD_BONUS_LIMITS.maxTeams) return;
    playSfx('click');
    setDraft((current) => [...current, createEmptySquadBonusTeam()]);
    setEditing(draft.length);
  };

  const removeTeam = () => {
    if (draft.length === 0) return;
    playSfx('click');
    setDraft((current) => current.filter((_, index) => index !== editing));
    setEditing((current) => Math.max(0, current - 1));
  };

  /** กดนักเตะในตาราง = สลับเข้า/ออกจากชุดที่กำลังแก้ */
  const togglePlayer = (playerId: string) => {
    if (!team) return;
    const has = team.playerIds.includes(playerId);
    if (!has && team.playerIds.length >= SQUAD_BONUS_LIMITS.maxPlayers) return;

    playSfx('click');
    patch({
      playerIds: has
        ? team.playerIds.filter((id) => id !== playerId)
        : [...team.playerIds, playerId],
    });
  };

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

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, VISIBLE);
  }, [keyword]);

  /** ทุกชุดต้องผ่านก่อนบันทึก — ชุดเดียวพังก็บันทึกไม่ได้ทั้งก้อน */
  const issues = useMemo(
    () =>
      draft.flatMap((entry, index) =>
        squadBonusTeamIssues(
          entry,
          draft.filter((_, other) => other !== index),
        ).map((issue) => `${entry.name}: ${issue}`),
      ),
    [draft],
  );

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await saveSquadBonus({ enabled, teams: draft });
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — ทีมของทุกคนคิดโบนัสใหม่ทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ทีมพิเศษ (โบนัส Team OVR)</p>
          <p className="mt-1 text-xs text-chalk/45">
            {draft.length}/{SQUAD_BONUS_LIMITS.maxTeams} ชุด · ผู้เล่นที่จัดนักเตะของชุดไหน
            ลง 11 ตัวจริง “ครบทุกคน” จะได้โบนัส Team OVR ของชุดนั้น
          </p>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={draft.length >= SQUAD_BONUS_LIMITS.maxTeams}
            onClick={addTeam}
            className="rounded-lg border border-neon/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
          >
            + เพิ่มทีม
          </button>
          <button
            type="button"
            disabled={draft.length === 0}
            onClick={removeTeam}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            ลบทีมนี้
          </button>
        </div>
      </div>

      {/* ── สวิตช์ใหญ่ ── */}
      <Field label="เปิดระบบทีมพิเศษทั้งหมด">
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setEnabled((current) => !current);
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
            enabled ? 'bg-neon text-ink-900' : 'bg-white/10 text-chalk/50 hover:text-chalk',
          )}
        >
          {enabled ? 'เปิดอยู่' : 'ปิดอยู่ (ไม่มีใครได้โบนัส)'}
        </button>
      </Field>

      {draft.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ยังไม่มีทีมพิเศษ — กด “+ เพิ่มทีม” เพื่อสร้างชุดแรก
        </p>
      )}

      {team && (
        <>
          {/* ── เลือกชุดที่จะแก้ ── */}
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
                    : entry.enabled
                      ? 'bg-white/5 text-chalk/55 hover:text-chalk'
                      : 'bg-white/5 text-chalk/25 hover:text-chalk/50',
                )}
              >
                {entry.name} ({entry.playerIds.length}/{SQUAD_BONUS_LIMITS.maxPlayers}) +
                {entry.bonus}
                {!entry.enabled && ' (ปิด)'}
              </button>
            ))}
          </div>

          {/* ── รายละเอียดของชุดที่เลือก ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ชื่อทีม">
              <input
                value={team.name}
                maxLength={SQUAD_BONUS_LIMITS.maxNameChars}
                onChange={(event) => patch({ name: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label={`โบนัส Team OVR (${SQUAD_BONUS_LIMITS.minBonus}–${SQUAD_BONUS_LIMITS.maxBonus})`}>
              <input
                type="number"
                min={SQUAD_BONUS_LIMITS.minBonus}
                max={SQUAD_BONUS_LIMITS.maxBonus}
                value={team.bonus}
                onChange={(event) => patch({ bonus: Number(event.target.value) })}
                className={inputClass}
              />
            </Field>

            <Field label="เปิดใช้งานชุดนี้">
              <button
                type="button"
                onClick={() => patch({ enabled: !team.enabled })}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  team.enabled ? 'bg-neon text-ink-900' : 'bg-white/10 text-chalk/50 hover:text-chalk',
                )}
              >
                {team.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
              </button>
            </Field>
          </div>

          <Field label="คำอธิบาย (แสดงในเกม)">
            <input
              value={team.description}
              maxLength={SQUAD_BONUS_LIMITS.maxDescriptionChars}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="เช่น จัดครบทั้งชุดรับโบนัสพลังทีม"
              className={inputClass}
            />
          </Field>

          {/* ── 11 ตัวจริงของชุดนี้ ── */}
          <div className="rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">
                นักเตะในชุด {team.playerIds.length}/{SQUAD_BONUS_LIMITS.maxPlayers}
                {team.playerIds.length === SQUAD_BONUS_LIMITS.maxPlayers && ' · ครบ 11 ตัวจริง'}
              </p>
              {team.playerIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    patch({ playerIds: [] });
                  }}
                  className="rounded-lg border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/50 hover:text-chalk"
                >
                  ล้างทั้งชุด
                </button>
              )}
            </div>

            {team.playerIds.length === 0 ? (
              <p className="mt-2 text-xs text-chalk/40">
                ยังไม่ได้เลือกใครเลย — กดการ์ดในคลังด้านล่างเพื่อใส่เข้าชุด
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {team.playerIds.map((playerId) => {
                  const player = getPlayerById(playerId);
                  return (
                    <button
                      key={playerId}
                      type="button"
                      onClick={() => togglePlayer(playerId)}
                      title="กดเพื่อเอาออก"
                      className="flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-1 text-[11px] text-neon hover:bg-neon/20"
                    >
                      {player?.name ?? playerId}
                      <span className="font-mono text-[9px] text-neon/60">
                        {player?.position ?? '—'}
                      </span>
                      <span aria-hidden>✕</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── คลังนักเตะทั้งเกม ── */}
          <div className="space-y-2">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
              className={inputClass}
            />

            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/8 bg-ink-900/40 p-2 sm:grid-cols-6 lg:grid-cols-8">
              {results.map((player) => {
                const picked = team.playerIds.includes(player.id);
                const full = team.playerIds.length >= SQUAD_BONUS_LIMITS.maxPlayers;

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    disabled={!picked && full}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-1 transition-colors',
                      picked
                        ? 'border-neon/60 bg-neon/10'
                        : 'border-transparent hover:border-white/20 hover:bg-white/5',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                  >
                    <PlayerCard player={player} size="xs" />
                    <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                      {player.name}
                    </span>
                    <span className={cn('font-mono text-[8px]', RARITY_STYLE[player.rarity].text)}>
                      {player.position} · {player.ovr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── ปัญหาที่ต้องแก้ก่อนบันทึก ── */}
      {issues.length > 0 && (
        <ul className="space-y-0.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-[11px] text-rose-300">
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <button
          type="button"
          disabled={saving || issues.length > 0}
          onClick={submit}
          className="rounded-lg bg-neon px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-900 disabled:opacity-40"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกทีมพิเศษ'}
        </button>
        {status && <p className="text-xs text-chalk/60">{status}</p>}
      </div>
    </section>
  );
};
