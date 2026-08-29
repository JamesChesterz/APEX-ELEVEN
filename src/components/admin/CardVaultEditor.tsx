/**
 * แก้คลังการ์ดของผู้เล่นคนหนึ่ง — เพิ่ม / ลบ / ตีบวก (อยู่ในแท็บ "เสกของ")
 *
 * ต่างจากการส่งของขวัญตรงที่อันนี้ "เขียนบัญชีเขาตรง ๆ" ไม่ได้หย่อนใบสั่งลงกล่อง
 * เพราะกล่องของขวัญทำได้แค่ "เพิ่มของ" — จะลบการ์ดหรือแก้ค่าตีบวกของใบที่มีอยู่แล้วไม่ได้
 *
 * ⚠️ ข้อจำกัดที่ต้องรู้: เครื่องผู้เล่นอ่านบัญชีตัวเองครั้งเดียวตอนล็อกอิน
 * แล้วถือ state ทั้งก้อนไว้ในหน่วยความจำ ไม่ได้ subscribe เอกสารแบบเรียลไทม์
 * ถ้าเจ้าตัวกำลังเปิดเกมอยู่ตอนที่แอดมินแก้ พอเขาทำอะไรที่ทำให้เกมเซฟ
 * (เปิดซอง จบแมตช์ จัดตัว) เครื่องเขาจะเขียน state ชุดเก่าทับของที่เพิ่งแก้ไป
 *
 * จึงควรแก้ตอนเจ้าตัวออกจากเกมแล้ว และให้เขาล็อกอินใหม่ถึงจะเห็นผล
 * ส่วนการ "แจกการ์ดเพิ่ม" เฉย ๆ ให้ใช้ช่องส่งของขวัญด้านบนแทน ไม่มีความเสี่ยงนี้เลย
 */
import { useEffect, useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById, PLAYERS } from '@/data/players';
import { readAccountForAdmin, setPlayerCards } from '@/services/firebase/adminActions';
import { playSfx } from '@/services/sound';
import { getPlus, MAX_LEVEL } from '@/services/upgrade';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import { cn, createId, RARITY_STYLE } from '@/utils/helpers';

interface CardVaultEditorProps {
  /** บัญชีที่จะแก้ (null = ยังไม่ได้เลือกใคร) */
  uid: string | null;
  /** ชื่อทีมของเขา ใช้แสดงบนหัวข้อ */
  label: string;
}

/** จำนวนนักเตะที่โชว์ในตารางเลือกต่อครั้ง */
const PICKER_VISIBLE = 32;

export const CardVaultEditor = ({ uid, label }: CardVaultEditorProps) => {
  /** คลังจริงที่โหลดมาล่าสุด ใช้เทียบว่าแก้ไปแล้วกี่ใบ และใช้ตอนกด "คืนค่าเดิม" */
  const [loaded, setLoaded] = useState<PlayerCardData[] | null>(null);
  /** คลังที่กำลังแก้ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<PlayerCardData[] | null>(null);

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  /** เปลี่ยนคนที่เลือก = ล้างของเก่าทิ้งแล้วโหลดใหม่ */
  useEffect(() => {
    setLoaded(null);
    setDraft(null);
    setStatus(null);
    setKeyword('');
  }, [uid]);

  const load = async () => {
    if (!uid) return;
    setLoading(true);
    setStatus(null);

    try {
      const account = await readAccountForAdmin(uid);
      if (!account) {
        setStatus('อ่านบัญชีไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
        return;
      }

      const cards = account.state?.cards ?? [];
      setLoaded(cards);
      setDraft(cards);
      setStatus(`โหลดคลังแล้ว ${cards.length} ใบ`);
    } catch (error) {
      console.error('[admin] อ่านคลังการ์ดไม่สำเร็จ', error);
      setStatus('อ่านบัญชีไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
    } finally {
      setLoading(false);
    }
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

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, PICKER_VISIBLE);
  }, [keyword]);

  const addCard = (playerId: string) => {
    playSfx('click');
    setDraft((current) => [
      ...(current ?? []),
      {
        id: createId('adm'),
        playerId,
        acquiredAt: new Date().toISOString(),
        level: 1,
        // ไม่ลงตัวจริงให้อัตโนมัติ กันชนกฎห้ามนักเตะชื่อซ้ำใน 11 ตัวจริง
        inSquad: false,
      },
    ]);
  };

  const removeCard = (cardId: string) => {
    playSfx('click');
    setDraft((current) => (current ?? []).filter((card) => card.id !== cardId));
  };

  /** ปรับค่าตีบวกของการ์ดใบหนึ่ง (step +1 หรือ −1) */
  const stepLevel = (cardId: string, step: number) => {
    playSfx('click');
    setDraft((current) =>
      (current ?? []).map((card) =>
        card.id === cardId
          ? { ...card, level: Math.min(MAX_LEVEL, Math.max(1, card.level + step)) }
          : card,
      ),
    );
  };

  const save = async () => {
    if (!uid || !draft) return;
    setBusy(true);
    setStatus(null);

    try {
      const written = await setPlayerCards(uid, draft);
      // อัปเดตชุดอ้างอิงด้วย ไม่งั้นป้าย "ยังไม่บันทึก" จะค้างอยู่ทั้งที่บันทึกไปแล้ว
      setLoaded(draft);
      setStatus(`บันทึกแล้ว ${written} ใบ — เจ้าตัวต้องล็อกอินใหม่ถึงจะเห็นผล`);
      playSfx('rankUp');
    } catch (error) {
      console.error('[admin] บันทึกคลังการ์ดไม่สำเร็จ', error);
      setStatus('บันทึกไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-ink-700/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">แก้คลังการ์ด</p>
          <p className="mt-0.5 text-[11px] text-chalk/45">
            เพิ่ม / ลบ / ตีบวกการ์ดของ {label} — เขียนบัญชีเขาตรง ๆ ไม่ผ่านกล่องของขวัญ
          </p>
        </div>

        <button
          type="button"
          disabled={!uid || loading}
          onClick={load}
          className="shrink-0 rounded-lg border border-kit/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-kit hover:bg-kit/10 disabled:opacity-40"
        >
          {loading ? 'กำลังโหลด…' : draft ? 'โหลดใหม่' : 'โหลดคลังการ์ด'}
        </button>
      </div>

      {!uid && (
        <p className="text-[11px] text-chalk/40">เลือกผู้รับเป็น “เลือกคน” ก่อน แล้วเลือกบัญชีที่จะแก้</p>
      )}

      {draft !== null && loaded !== null && (
        <>
          <p className="rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 p-2.5 text-[11px] leading-relaxed text-[#F0A070]">
            ⚠️ เครื่องผู้เล่นอ่านบัญชีครั้งเดียวตอนล็อกอิน ถ้าเจ้าตัวกำลังเปิดเกมอยู่
            พอเขาเปิดซอง จบแมตช์ หรือจัดตัว เครื่องเขาจะเขียนทับของที่เพิ่งแก้ไป — ควรแก้ตอนเขาออกจากเกมแล้ว
            <br />
            ถ้าแค่อยากแจกการ์ดเพิ่ม ใช้ช่องส่งของขวัญด้านบนจะปลอดภัยกว่า ไม่มีความเสี่ยงนี้เลย
          </p>

          {/* เพิ่มการ์ด */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">เพิ่มการ์ด (กดที่การ์ดเพื่อเพิ่ม)</p>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
                className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50 sm:w-56"
              />
            </div>

            <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/10 bg-ink-900/40 p-2 sm:grid-cols-6 lg:grid-cols-8">
              {results.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => addCard(player.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition-colors hover:border-white/20 hover:bg-white/5"
                >
                  <PlayerCard player={player} size="xs" />
                  <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                    {player.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* คลังปัจจุบัน */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">
              คลังการ์ด {draft.length} ใบ
              {draft.length !== loaded.length && (
                <span className="ml-1 text-[#F0A070]">(เดิม {loaded.length} ใบ · ยังไม่บันทึก)</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setDraft(loaded);
              }}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
            >
              คืนค่าเดิม
            </button>
          </div>

          {draft.length === 0 ? (
            <p className="py-6 text-center text-xs text-chalk/40">ยังไม่มีการ์ดในคลัง</p>
          ) : (
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
              {draft.map((card) => {
                const player = getPlayerById(card.playerId);
                if (!player) return null;

                const plus = getPlus(card.level);

                return (
                  <div
                    key={card.id}
                    className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-ink-900/40 p-1.5"
                  >
                    <PlayerCard player={player} size="xs" level={card.level} />
                    <span className="w-full truncate text-center font-mono text-[9px] text-chalk/60">
                      {player.name}
                    </span>
                    <span className={cn('font-mono text-[8px]', RARITY_STYLE[player.rarity].text)}>
                      OVR {player.ovr}
                      {card.inSquad && <span className="ml-1 text-neon">·ตัวจริง</span>}
                    </span>

                    {/* ตีบวก */}
                    <div className="flex w-full items-center gap-1">
                      <button
                        type="button"
                        disabled={plus === 0}
                        onClick={() => stepLevel(card.id, -1)}
                        className="h-6 flex-1 rounded border border-white/15 font-mono text-xs leading-none text-chalk/70 hover:text-chalk disabled:opacity-25"
                      >
                        −
                      </button>
                      <span className="w-8 shrink-0 text-center font-mono text-[10px] font-bold text-kit">
                        +{plus}
                      </span>
                      <button
                        type="button"
                        disabled={card.level >= MAX_LEVEL}
                        onClick={() => stepLevel(card.id, 1)}
                        className="h-6 flex-1 rounded border border-white/15 font-mono text-xs leading-none text-chalk/70 hover:text-chalk disabled:opacity-25"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      className="w-full rounded border border-[#F0A070]/40 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10"
                    >
                      ลบ
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="w-full rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึกคลังการ์ด'}
          </button>
        </>
      )}

      {status && <p className="text-[11px] text-chalk/70">{status}</p>}
    </div>
  );
};
