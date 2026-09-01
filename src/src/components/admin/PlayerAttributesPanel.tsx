/**
 * ADMIN → ค่าพลังนักเตะ (PHASE 13.5)
 *
 * แก้ "ค่าพื้นฐานของตัวนักเตะ" ซึ่งคนละเรื่องกับการ์ดที่ผู้เล่นถืออยู่:
 *   แก้ที่นี่  = นักเตะคนนี้เก่งขึ้น/อ่อนลงสำหรับทุกคนในเซิร์ฟเวอร์
 *   แก้การ์ด  = เฉพาะใบนั้นใบเดียวของคนนั้นคนเดียว (ดูแท็บ "การ์ดของผู้เล่น")
 *
 * ค่าที่แก้ถูกเก็บเป็น "ค่าทับ" ที่ config/playerOverrides ไม่ได้ไปแก้ players.ts
 * ลบค่าทับออกเมื่อไรก็กลับไปใช้ค่าที่เขียนไว้ในโค้ดทันที
 */
import { useMemo, useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { PLAYERS } from '@/data/players';
import { getBasePlayer, type PlayerOverride } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { PlayerStats } from '@/types/player';
import { cn } from '@/utils/helpers';

const STAT_FIELDS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'dribbling', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
];

export const PlayerAttributesPanel = () => {
  const { playerOverrides, savePlayerOverrides } = useGameConfig();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(PLAYERS[0]?.id ?? '');
  const [draft, setDraft] = useState<PlayerOverride>({});
  const [status, setStatus] = useState('');

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? PLAYERS.filter(
          (player) =>
            player.name.toLowerCase().includes(term) || player.id.toLowerCase().includes(term),
        )
      : PLAYERS;
    return list.slice(0, 60);
  }, [search]);

  /** ค่าที่กำลังใช้อยู่จริง (ค่าในโค้ด + ค่าทับที่บันทึกไว้แล้ว) */
  const current = getBasePlayer(selectedId);

  const select = (playerId: string) => {
    playSfx('click');
    setSelectedId(playerId);
    setDraft(playerOverrides[playerId] ?? {});
    setStatus('');
  };

  const save = async () => {
    const next = { ...playerOverrides };
    const hasChange = draft.ovr !== undefined || Object.keys(draft.stats ?? {}).length > 0;

    if (hasChange) next[selectedId] = draft;
    else delete next[selectedId];

    setStatus('กำลังบันทึก…');
    const error = await savePlayerOverrides(next);
    setStatus(error ?? 'บันทึกแล้ว — ค่าใหม่มีผลกับทุกการ์ดของนักเตะคนนี้ทันที');
  };

  const reset = async () => {
    const next = { ...playerOverrides };
    delete next[selectedId];
    setDraft({});
    setStatus('กำลังล้างค่าทับ…');
    const error = await savePlayerOverrides(next);
    setStatus(error ?? 'ล้างแล้ว — กลับไปใช้ค่าที่เขียนไว้ในโค้ด');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">ค่าพลังนักเตะ (ค่าพื้นฐาน)</p>
        <p className="mt-1 text-xs text-chalk/45">
          แก้ที่นี่มีผลกับนักเตะคนนี้ทั้งเซิร์ฟเวอร์ · ไม่ใช่การแก้การ์ดของผู้เล่นคนใดคนหนึ่ง
        </p>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ค้นหาชื่อหรือ id นักเตะ"
        className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
      />

      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {results.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => select(player.id)}
            className={cn(
              'rounded px-2 py-1 text-[11px] transition-colors',
              player.id === selectedId ? 'bg-neon text-ink-900' : 'bg-white/5 hover:bg-white/10',
              playerOverrides[player.id] && player.id !== selectedId && 'text-gold',
            )}
          >
            {player.id} · {player.name}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-display text-lg">{current.name}</p>
            <p className="font-mono text-xs text-chalk/50">
              {current.position} · {current.rarity} · Base OVR {current.ovr}
            </p>
            {playerOverrides[selectedId] && (
              <span className="rounded bg-gold/20 px-2 py-0.5 text-[10px] text-gold">
                มีค่าทับอยู่
              </span>
            )}
          </div>

          <label className="flex items-center gap-3 text-xs">
            <span className="w-16 text-chalk/50">Base OVR</span>
            <input
              type="number"
              value={draft.ovr ?? current.ovr}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, ovr: Number(event.target.value) || 0 }))
              }
              className="w-24 rounded bg-white/5 px-2 py-1 font-mono outline-none focus:bg-white/10"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAT_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <span className="w-9 text-chalk/50">{label}</span>
                <input
                  type="number"
                  value={draft.stats?.[key] ?? current.stats[key]}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      stats: { ...prev.stats, [key]: Number(event.target.value) || 0 },
                    }))
                  }
                  className="w-20 rounded bg-white/5 px-2 py-1 font-mono outline-none focus:bg-white/10"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
            >
              ล้างค่าทับ
            </button>
          </div>

          {status && <p className="text-xs text-chalk/55">{status}</p>}
        </div>
      )}
    </section>
  );
};
