/**
 * หน้าต่างตั้งค่ารางวัลอันดับ 1–10 (เห็นเฉพาะเจ้าของโปรเจค)
 *
 * ซ้าย = อันดับ 1–10 พร้อมการ์ดที่เลือกไว้ตอนนี้
 * ขวา = คลังนักเตะทั้งเกม ค้นหาด้วยชื่อ/ตำแหน่ง/ระดับ แล้วกดเพื่อใส่ให้อันดับที่เลือกอยู่
 *
 * บันทึกแล้วค่าจะขึ้น Firestore ผู้เล่นทุกคนเห็นรางวัลชุดใหม่ทันทีโดยไม่ต้อง deploy
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { PLAYERS } from '@/data/players';
import { REWARD_RANKS } from '@/data/rankRewards';
import { useRankRewards } from '@/hooks/useRankRewards';
import { getRewardPlayer } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import { cn, RARITY_STYLE } from '@/utils/helpers';

interface RankRewardPickerProps {
  open: boolean;
  onClose: () => void;
}

export const RankRewardPicker = ({ open, onClose }: RankRewardPickerProps) => {
  const { cards, save, uid, fromServer } = useRankRewards();

  /** ค่าที่กำลังแก้อยู่ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<string[]>(cards);
  /** อันดับที่กำลังเลือกการ์ดให้ */
  const [rank, setRank] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** เปิดหน้าต่างใหม่ทุกครั้ง = เริ่มจากค่าล่าสุดที่ใช้อยู่จริง */
  const [syncedWith, setSyncedWith] = useState(cards);
  if (open && syncedWith !== cards) {
    setSyncedWith(cards);
    setDraft(cards);
  }

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

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, 60);
  }, [keyword]);

  const pick = (playerId: string) => {
    playSfx('click');
    setDraft((current) => current.map((entry, index) => (index === rank - 1 ? playerId : entry)));
    // เลือกครบแล้วเลื่อนไปอันดับถัดไปให้เอง ทำงานต่อเนื่องกว่าการกดสลับเอง
    setRank((current) => (current < REWARD_RANKS ? current + 1 : current));
  };

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await save(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นทุกคนเห็นรางวัลชุดใหม่ทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <Modal
      open={open}
      title="ตั้งค่ารางวัลอันดับ"
      subtitle={`เลือกการ์ดให้อันดับ 1–${REWARD_RANKS} · ค่าที่ใช้อยู่ตอนนี้มาจาก${fromServer ? 'เซิร์ฟเวอร์' : 'ไฟล์ค่าเริ่มต้น'}`}
      onClose={onClose}
    >
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* ── อันดับ 1–10 ── */}
        <div className="space-y-1.5">
          <p className="eyebrow">อันดับ</p>
          {draft.map((playerId, index) => {
            const slotRank = index + 1;
            const player = getRewardPlayer(slotRank, draft);
            const active = slotRank === rank;

            return (
              <button
                key={slotRank}
                type="button"
                onClick={() => {
                  playSfx('click');
                  setRank(slotRank);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  active
                    ? 'border-neon/60 bg-neon/10'
                    : 'border-white/8 bg-ink-700/40 hover:border-white/20',
                )}
              >
                <span
                  className={cn(
                    'w-6 shrink-0 text-center font-display text-lg',
                    slotRank === 1 ? 'text-gold' : 'text-chalk/60',
                  )}
                >
                  {slotRank}
                </span>
                {player ? (
                  <PlayerCard player={player} size="xs" />
                ) : (
                  <span className="text-xs text-chalk/40">ยังไม่เลือก</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{player?.name ?? playerId}</span>
                  <span
                    className={cn(
                      'block font-mono text-[10px]',
                      player ? RARITY_STYLE[player.rarity].text : 'text-chalk/40',
                    )}
                  >
                    {player ? `${player.position} · OVR ${player.ovr}` : 'ไม่พบการ์ดใบนี้'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── คลังนักเตะทั้งเกม ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">เลือกการ์ดให้อันดับ {rank}</p>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
              className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50 sm:w-56"
            />
          </div>

          <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-6">
            {results.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => pick(player.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors',
                  draft[rank - 1] === player.id
                    ? 'border-neon/60 bg-neon/10'
                    : 'border-transparent hover:border-white/20 hover:bg-white/5',
                )}
              >
                <PlayerCard player={player} size="xs" />
                <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                  {player.name}
                </span>
              </button>
            ))}
          </div>

          <p className="font-mono text-[10px] text-chalk/35">
            แสดง {results.length} ใบแรกที่ OVR สูงสุด · พิมพ์ค้นหาเพื่อดูใบอื่น
          </p>
        </div>
      </div>

      {/* ── บันทึก ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="min-w-0">
          {status && <p className="text-xs text-chalk/70">{status}</p>}
          <p className="truncate font-mono text-[10px] text-chalk/35">
            uid ของคุณ: {uid ?? '—'} (ใช้เปิดสิทธิ์เขียนใน firestore.rules)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(cards)}
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
            {saving ? 'กำลังบันทึก…' : 'บันทึกรางวัล'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
