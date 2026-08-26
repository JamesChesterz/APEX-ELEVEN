/**
 * "การ์ดใหม่ล่าสุด" บนหน้า HOME — แถวการ์ดที่แอดมินเลือกไว้ (config/featuredCards)
 * กดใบไหนก็ดูตัวใหญ่ได้ในหน้าต่างซ้อน
 */
import { useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import type { Player } from '@/types/player';
import { RARITY_STYLE } from '@/utils/helpers';

interface NewCardsRowProps {
  cardIds: string[];
}

export const NewCardsRow = ({ cardIds }: NewCardsRowProps) => {
  const [preview, setPreview] = useState<Player | null>(null);
  const players = cardIds.map((id) => getPlayerById(id)).filter((player): player is Player => Boolean(player));

  if (players.length === 0) return null;

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-gold">★</span>
        <p className="panel-title">การ์ดใหม่ล่าสุด</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1">
        {players.map((player) => (
          <div key={player.id} className="relative shrink-0">
            <span className="absolute -top-1 right-1 z-10 rounded-full bg-neon px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-900 shadow-card">
              NEW
            </span>
            <PlayerCard player={player} size="sm" onSelect={setPreview} />
          </div>
        ))}
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-panel flex flex-col items-center gap-3 p-6"
          >
            <PlayerCard player={preview} size="lg" />
            <p className="font-display text-lg uppercase">{preview.name}</p>
            <p className={`font-mono text-xs uppercase ${RARITY_STYLE[preview.rarity].text}`}>
              {RARITY_STYLE[preview.rarity].label} · {preview.position} · OVR {preview.ovr}
            </p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="mt-2 w-full rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
