/**
 * หน้าต่างตั้งค่ารางวัลอันดับ 1–10 (เห็นเฉพาะเจ้าของโปรเจค)
 *
 * แบ่งเป็นสองชั้นเพื่อไม่ให้เนื้อหายาวจนปุ่มบันทึกถูกดันตกจอ:
 *   ชั้นแรก  = รายการอันดับ 1–10 พร้อมปุ่มบันทึกที่เห็นตลอด
 *   ชั้นที่สอง = ป๊อปอัปเลือกการ์ด เปิดทับเมื่อกดอันดับที่ต้องการแก้
 *
 * บันทึกแล้วค่าจะขึ้น Firestore ผู้เล่นทุกคนเห็นรางวัลชุดใหม่ทันทีโดยไม่ต้อง deploy
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { PLAYERS } from '@/data/players';
import { useRankRewards } from '@/hooks/useRankRewards';
import { getRewardPlayer } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import { cn, RARITY_STYLE } from '@/utils/helpers';

interface RankRewardPickerProps {
  open: boolean;
  onClose: () => void;
}

/** แสดงการ์ดกี่ใบต่อครั้งในป๊อปอัปเลือกการ์ด */
const VISIBLE = 60;

export const RankRewardPicker = ({ open, onClose }: RankRewardPickerProps) => {
  const { cards, save, uid, fromServer } = useRankRewards();

  /** ค่าที่กำลังแก้อยู่ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<string[]>(cards);
  /** อันดับที่กำลังเปิดป๊อปอัปเลือกการ์ดให้ (null = ยังไม่ได้เปิด) */
  const [picking, setPicking] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
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

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, VISIBLE);
  }, [keyword]);

  /** เลือกการ์ดให้อันดับที่เปิดป๊อปอัปอยู่ แล้วปิดป๊อปอัปทันที */
  const pick = (playerId: string) => {
    if (picking === null) return;

    playSfx('click');
    setDraft((current) => current.map((entry, index) => (index === picking - 1 ? playerId : entry)));
    setPicking(null);
    setKeyword('');
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
    <>
      <Modal
        open={open}
        title="ตั้งค่ารางวัลอันดับ"
        subtitle={`กดที่อันดับเพื่อเลือกการ์ด · ค่าที่ใช้อยู่มาจาก${fromServer ? 'เซิร์ฟเวอร์' : 'ไฟล์ค่าเริ่มต้น'}`}
        onClose={onClose}
      >
        {/* ── อันดับ 1–10 ── */}
        <div className="grid max-h-[52vh] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {draft.map((playerId, index) => {
            const slotRank = index + 1;
            const player = getRewardPlayer(slotRank, draft);

            return (
              <button
                key={slotRank}
                type="button"
                onClick={() => {
                  playSfx('click');
                  setPicking(slotRank);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  slotRank === 1
                    ? 'border-gold/40 bg-gold/5 hover:border-gold/70'
                    : 'border-white/8 bg-ink-700/40 hover:border-white/25',
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
                  <span className="block truncate text-xs font-semibold">
                    {player?.name ?? playerId}
                  </span>
                  <span
                    className={cn(
                      'block font-mono text-[10px]',
                      player ? RARITY_STYLE[player.rarity].text : 'text-chalk/40',
                    )}
                  >
                    {player ? `${player.position} · OVR ${player.ovr}` : 'ไม่พบการ์ดใบนี้'}
                  </span>
                </span>

                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-chalk/40">
                  เปลี่ยน
                </span>
              </button>
            );
          })}
        </div>

        {/* ── บันทึก (อยู่นอกกล่องที่เลื่อน จึงเห็นตลอด) ── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
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

      {/* ── ป๊อปอัปเลือกการ์ด (ชั้นบนสุด) ── */}
      <Modal
        open={picking !== null}
        title={`เลือกการ์ดให้อันดับ ${picking ?? ''}`}
        subtitle={`แสดง ${results.length} ใบที่ OVR สูงสุด · พิมพ์ค้นหาเพื่อดูใบอื่น`}
        onClose={() => {
          setPicking(null);
          setKeyword('');
        }}
      >
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
          className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
        />

        <div className="mt-3 grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-7">
          {results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => pick(player.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors',
                picking !== null && draft[picking - 1] === player.id
                  ? 'border-neon/60 bg-neon/10'
                  : 'border-transparent hover:border-white/25 hover:bg-white/5',
              )}
            >
              <PlayerCard player={player} size="xs" />
              <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                {player.name}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
};
