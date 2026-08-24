/**
 * เลือกการ์ดหลายใบจากคลังนักเตะทั้งเกม (ใช้ในแผงเสกของ)
 * กดใบในตาราง = เพิ่มเข้ารายการ · กดชิปด้านบน = เอาออก · ใบเดิมซ้ำได้ (เสกให้หลายใบ)
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById, PLAYERS } from '@/data/players';
import { playSfx } from '@/services/sound';
import { cn, RARITY_STYLE } from '@/utils/helpers';

interface CardMultiPickerProps {
  /** id นักเตะที่เลือกไว้ (ซ้ำได้) */
  selected: string[];
  onChange: (next: string[]) => void;
  /** เลือกได้มากสุดกี่ใบ */
  max: number;
}

/** จำนวนใบที่แสดงในตารางต่อครั้ง */
const VISIBLE = 48;

export const CardMultiPicker = ({ selected, onChange, max }: CardMultiPickerProps) => {
  const [keyword, setKeyword] = useState('');

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

  const add = (playerId: string) => {
    if (selected.length >= max) return;
    playSfx('click');
    onChange([...selected, playerId]);
  };

  const removeAt = (index: number) => {
    playSfx('click');
    onChange(selected.filter((_, position) => position !== index));
  };

  return (
    <div className="space-y-2">
      {/* รายการที่เลือกไว้ */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 ? (
          <p className="text-xs text-chalk/40">ยังไม่ได้เลือกการ์ด (เสกเฉพาะเงิน/แต้มก็ได้)</p>
        ) : (
          selected.map((playerId, index) => (
            <button
              key={`${playerId}-${index}`}
              type="button"
              onClick={() => removeAt(index)}
              title="กดเพื่อเอาออก"
              className="flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-1 text-[11px] text-neon hover:bg-neon/20"
            >
              {getPlayerById(playerId)?.name ?? playerId}
              <span aria-hidden>✕</span>
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-chalk/40">
          เลือกแล้ว {selected.length}/{max} ใบ
        </p>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
          className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50 sm:w-56"
        />
      </div>

      {/* คลังนักเตะทั้งเกม */}
      <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/8 bg-ink-900/40 p-2 sm:grid-cols-6 lg:grid-cols-8">
        {results.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => add(player.id)}
            disabled={selected.length >= max}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition-colors',
              'hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <PlayerCard player={player} size="xs" />
            <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
              {player.name}
            </span>
            <span className={cn('font-mono text-[8px]', RARITY_STYLE[player.rarity].text)}>
              {player.ovr}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
