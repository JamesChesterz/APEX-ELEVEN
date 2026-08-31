/**
 * ADMIN → การ์ดของผู้เล่น (Card Instance) — PHASE 13.5
 *
 * ส่องการ์ดของบัญชีหนึ่งทีละใบ: ใครเป็นเจ้าของ ตีบวกเท่าไร ฝึกมากี่ระดับ
 * ล็อกไว้ไหม และ OVR พื้นฐานเทียบกับ OVR จริงต่างกันแค่ไหน
 *
 * ⚠️ หน้านี้ "อ่านอย่างเดียว" โดยตั้งใจ
 * การแก้ค่าบวกของการ์ดต้องผ่านฟังก์ชัน upgradeCard ฝั่งเซิร์ฟเวอร์เท่านั้น
 * ถ้าเปิดให้แอดมินเขียนค่าบวกลง state.cards ตรง ๆ ที่นี่ ก็เท่ากับมีทางเขียน
 * ค่าบวกจากฝั่งเครื่องเพิ่มมาอีกทางหนึ่ง ซึ่งขัดกับหลัก server authority ของ PHASE 13
 * (ถ้าต้องเสกการ์ดให้ผู้เล่น ใช้แท็บ "เสกของ" ที่มีอยู่แล้ว)
 */
import { useState } from 'react';
import { getPlayerById } from '@/data/players';
import { readAccountForAdmin, type AdminAccountView } from '@/services/firebase/adminActions';
import { getCardTraining, getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getBasePlayer, getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

export const CardInstancePanel = () => {
  const [uid, setUid] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [account, setAccount] = useState<AdminAccountView | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const target = uid.trim();
    if (!target) return;

    playSfx('click');
    setBusy(true);
    setStatus('กำลังอ่านบัญชี…');

    try {
      const found = await readAccountForAdmin(target);
      setAccount(found);
      setStatus(found ? '' : 'ไม่พบบัญชีนี้');
    } catch {
      setAccount(null);
      setStatus('อ่านบัญชีไม่สำเร็จ — ตรวจว่า uid ของคุณอยู่ใน isProjectOwner() ของ firestore.rules');
    } finally {
      setBusy(false);
    }
  };

  const cards = (account?.state?.cards ?? []).filter((card) => {
    const term = cardSearch.trim().toLowerCase();
    if (!term) return true;
    const player = getPlayerById(card.playerId);
    return (
      card.id.toLowerCase().includes(term) ||
      card.playerId.toLowerCase().includes(term) ||
      (player?.name.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">การ์ดของผู้เล่น (Card Instance)</p>
        <p className="mt-1 text-xs text-chalk/45">
          อ่านอย่างเดียว · การแก้ค่าบวกต้องผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์เท่านั้น
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={uid}
          onChange={(event) => setUid(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load()}
          placeholder="uid ของผู้เล่น"
          className="min-w-[16rem] flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
        />
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900 disabled:opacity-50"
        >
          เปิดดู
        </button>
      </div>

      {status && <p className="text-xs text-chalk/55">{status}</p>}

      {account && (
        <>
          <div className="flex flex-wrap gap-3 border-y border-white/10 py-3 font-mono text-[11px] text-chalk/55">
            <span>{account.teamName ?? '—'}</span>
            <span>{account.managerName ?? '—'}</span>
            <span>การ์ด {account.state?.cards?.length ?? 0} ใบ</span>
            <span>เหรียญ {formatNumber(account.state?.coins ?? 0)}</span>
            <span>แต้มตีบวก {formatNumber(account.state?.upgradePoints ?? 0)}</span>
          </div>

          <input
            value={cardSearch}
            onChange={(event) => setCardSearch(event.target.value)}
            placeholder="ค้นหา card id / player id / ชื่อนักเตะ"
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
          />

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="sticky top-0 bg-ink-900/90 text-chalk/45">
                <tr>
                  <th className="py-1.5">Card ID</th>
                  <th>นักเตะ</th>
                  <th>เจ้าของ</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Effective</th>
                  <th className="text-right">+</th>
                  <th className="text-right">ฝึก</th>
                  <th>ล็อก</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const base = getBasePlayer(card.playerId);
                  const upgrade = getCardUpgrade(card);

                  return (
                    <tr key={card.id} className="border-t border-white/5">
                      <td className="max-w-[9rem] truncate py-1.5">{card.id}</td>
                      <td className="max-w-[9rem] truncate">{base?.name ?? card.playerId}</td>
                      <td className="max-w-[8rem] truncate text-chalk/40">
                        {card.ownerId ?? account.uid}
                      </td>
                      <td className="text-right text-chalk/50">{base?.ovr ?? '—'}</td>
                      <td className="text-right text-neon">{getEffectivePlayerOvr(card)}</td>
                      <td className={cn('text-right', upgrade > 0 && 'text-kit')}>+{upgrade}</td>
                      <td className="text-right">{getCardTraining(card)}</td>
                      <td>{isCardLocked(card) ? '🔒' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {cards.length === 0 && (
              <p className="py-4 text-center text-xs text-chalk/40">ไม่มีการ์ดที่ตรงกับคำค้น</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};
