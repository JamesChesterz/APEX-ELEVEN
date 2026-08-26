/**
 * เลือกการ์ด "ใหม่ล่าสุด" ที่จะโชว์เป็นแถวบนหน้า HOME (แท็บ "การ์ดใหม่" ของหน้า ADMIN)
 * เรียงจากซ้ายไปขวาตามลำดับที่เลือกไว้ในนี้ (ใบแรก = ใบซ้ายสุด)
 */
import { useState } from 'react';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { FEATURED_CARDS_LIMITS } from '@/services/homeFeed';
import { playSfx } from '@/services/sound';

export const FeaturedCardsPanel = () => {
  const { featuredCards, saveFeaturedCards } = useGameConfig();

  const [draft, setDraft] = useState<string[]>(featuredCards);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(featuredCards);
  if (syncedWith !== featuredCards) {
    setSyncedWith(featuredCards);
    setDraft(featuredCards);
  }

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await saveFeaturedCards(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — แถว “การ์ดใหม่ล่าสุด” บนหน้า HOME เปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">การ์ดใหม่ล่าสุด (หน้า HOME)</p>
        <p className="mt-1 text-xs text-chalk/45">
          เลือกได้สูงสุด {FEATURED_CARDS_LIMITS.maxCards} ใบ เรียงซ้าย → ขวาตามลำดับที่เลือก
        </p>
      </div>

      {draft.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-white/10 bg-ink-900/40 p-3">
          {draft.map((playerId, index) => {
            const player = getPlayerById(playerId);
            if (!player) return null;
            return <PlayerCard key={`${playerId}-${index}`} player={player} size="xs" />;
          })}
        </div>
      )}

      <CardMultiPicker
        selected={draft}
        onChange={setDraft}
        max={FEATURED_CARDS_LIMITS.maxCards}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        {status && <p className="text-xs text-chalk/70">{status}</p>}
        <div className="flex-1" />
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="rounded-lg bg-neon px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกการ์ดใหม่ล่าสุด'}
        </button>
      </div>
    </section>
  );
};
