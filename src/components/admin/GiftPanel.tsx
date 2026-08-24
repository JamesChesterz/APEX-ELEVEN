/**
 * แผงเสกของ — ส่งเหรียญ/แต้ม/การ์ดให้ผู้เล่น
 *
 * ส่งได้ 3 แบบ:
 *   ตัวเอง  → เพิ่มเข้าบัญชีทันที ไม่ต้องผ่านกล่องของขวัญ
 *   เลือกคน → หย่อนใบสั่งลงกล่องของเขา เขาเปิดเกมเมื่อไหร่ของก็เข้าทันที
 *   ทุกคน   → หย่อนให้ทุกบัญชีในตารางอันดับรวดเดียว (ใช้ตอนแจกของชดเชย/อีเวนต์)
 */
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { usePlayers } from '@/hooks/usePlayers';
import { getPlayerById } from '@/data/players';
import { GIFT_MAX_AMOUNT, GIFT_MAX_CARDS, sendGift, type GiftDoc } from '@/services/firebase/gifts';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import { cn, createId, formatNumber } from '@/utils/helpers';

type Target = 'self' | 'one' | 'all';

const TARGETS: Array<{ key: Target; label: string }> = [
  { key: 'self', label: 'ตัวเอง' },
  { key: 'one', label: 'เลือกคน' },
  { key: 'all', label: 'ทุกคน' },
];

/** ช่องกรอกจำนวน — บีบให้เป็นจำนวนเต็มบวกเสมอ */
const AmountField = ({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  tone: string;
  onChange: (next: number) => void;
}) => (
  <label className="block">
    <span className={cn('eyebrow', tone)}>{label}</span>
    <input
      type="number"
      min={0}
      max={GIFT_MAX_AMOUNT}
      value={value || ''}
      placeholder="0"
      onChange={(event) =>
        onChange(Math.min(Math.max(Math.floor(Number(event.target.value) || 0), 0), GIFT_MAX_AMOUNT))
      }
      className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 font-mono text-sm outline-none focus:border-neon/50"
    />
  </label>
);

export const GiftPanel = () => {
  const { account } = useAuth();
  const { profileByUid } = useOnline();
  const { addCoins, addPoints, addUpgradePoints, addCards } = usePlayers();

  const [target, setTarget] = useState<Target>('self');
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [coins, setCoins] = useState(0);
  const [points, setPoints] = useState(0);
  const [upgradePoints, setUpgradePoints] = useState(0);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /** ผู้เล่นทุกคนบนเซิร์ฟเวอร์ (ตัวเราเองรวมอยู่ด้วย) */
  const everyone = useMemo(() => Object.values(profileByUid), [profileByUid]);

  const matches = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const list = term
      ? everyone.filter(
          (profile) =>
            profile.teamName.toLowerCase().includes(term) ||
            profile.managerName.toLowerCase().includes(term),
        )
      : everyone;

    return [...list].sort((a, b) => b.points - a.points).slice(0, 30);
  }, [everyone, keyword]);

  const empty = coins === 0 && points === 0 && upgradePoints === 0 && cardIds.length === 0;

  /** สร้างการ์ดจริงจากรายการ id (ใช้ตอนเสกให้ตัวเอง) */
  const buildCards = (): PlayerCardData[] =>
    cardIds
      .filter((playerId) => Boolean(getPlayerById(playerId)))
      .map((playerId) => ({
        id: createId('c'),
        playerId,
        acquiredAt: new Date().toISOString(),
        level: 1,
        inSquad: false,
      }));

  const reset = () => {
    setCoins(0);
    setPoints(0);
    setUpgradePoints(0);
    setCardIds([]);
    setNote('');
  };

  const send = async () => {
    if (empty) {
      setStatus('ยังไม่ได้ใส่ของอะไรเลย');
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      // ── เสกให้ตัวเอง: เข้าบัญชีทันที ──
      if (target === 'self') {
        if (coins > 0) addCoins(coins);
        if (points > 0) addPoints(points);
        if (upgradePoints > 0) addUpgradePoints(upgradePoints);
        const cards = buildCards();
        if (cards.length > 0) addCards(cards);

        playSfx('rankUp');
        setStatus('เพิ่มเข้าบัญชีของคุณแล้ว');
        reset();
        return;
      }

      // ── ส่งให้คนอื่น: หย่อนใบลงกล่องของขวัญ ──
      const targets =
        target === 'all'
          ? everyone.map((profile) => profile.uid)
          : targetUid
            ? [targetUid]
            : [];

      if (targets.length === 0) {
        setStatus('ยังไม่ได้เลือกผู้รับ');
        return;
      }

      const base: Omit<GiftDoc, 'id'> = {
        fromUid: account?.id ?? '',
        fromName: account?.managerName ?? 'ผู้ดูแล',
        coins,
        points,
        upgradePoints,
        cardPlayerIds: cardIds,
        note: note.trim().slice(0, 200),
        sentAt: new Date().toISOString(),
      };

      let sent = 0;
      let failed = 0;

      // ส่งทีละ 20 คน กันยิงพร้อมกันทีเดียวหลายร้อยเส้น
      for (let start = 0; start < targets.length; start += 20) {
        const chunk = targets.slice(start, start + 20);
        const results = await Promise.allSettled(
          chunk.map((uid) => sendGift(uid, { ...base, id: createId('g') })),
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') sent += 1;
          else failed += 1;
        });
      }

      playSfx('rankUp');
      setStatus(
        failed === 0
          ? `ส่งสำเร็จ ${sent} คน — ของจะเข้าบัญชีเขาตอนเปิดเกมครั้งถัดไป`
          : `ส่งสำเร็จ ${sent} คน · ไม่สำเร็จ ${failed} คน (ตรวจสิทธิ์ใน firestore.rules)`,
      );
      if (failed === 0) reset();
    } catch (error) {
      console.error('[admin] เสกของไม่สำเร็จ', error);
      setStatus('ส่งไม่สำเร็จ — ต้องเพิ่ม uid ของคุณใน firestore.rules ก่อน');
    } finally {
      setSending(false);
    }
  };

  const receiver =
    target === 'self'
      ? 'ตัวเอง'
      : target === 'all'
        ? `ทุกคน (${everyone.length} บัญชี)`
        : targetUid
          ? profileByUid[targetUid]?.teamName ?? '—'
          : 'ยังไม่ได้เลือก';

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">เสกของ</p>
        <p className="mt-1 text-xs text-chalk/45">
          เหรียญ / แต้มแลกนักเตะ / แต้มตีบวก / การ์ด — ส่งให้ตัวเอง เลือกคน หรือทุกคนพร้อมกัน
        </p>
      </div>

      {/* ── ผู้รับ ── */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {TARGETS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                playSfx('click');
                setTarget(entry.key);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                target === entry.key ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/55 hover:text-chalk',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {target === 'one' && (
          <div className="space-y-2">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="ค้นหาชื่อทีม / ชื่อผู้จัดการ"
              className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
            />

            <div className="max-h-48 space-y-1 overflow-y-auto">
              {matches.map((profile) => (
                <button
                  key={profile.uid}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setTargetUid(profile.uid);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                    targetUid === profile.uid
                      ? 'border-neon/60 bg-neon/10'
                      : 'border-white/8 bg-ink-700/40 hover:border-white/20',
                  )}
                >
                  <Avatar src={profile.avatar} name={profile.managerName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{profile.teamName}</span>
                    <span className="block truncate font-mono text-[10px] text-chalk/40">
                      {profile.managerName} · OVR {profile.teamOvr} · ⭐ {formatNumber(profile.points)}
                    </span>
                  </span>
                </button>
              ))}

              {matches.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-chalk/40">ไม่พบผู้เล่นที่ค้นหา</p>
              )}
            </div>
          </div>
        )}

        {target === 'all' && (
          <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
            ⚠️ จะหย่อนของให้ทุกบัญชีในตารางอันดับ ({everyone.length} คน) ย้อนกลับไม่ได้ ตรวจตัวเลขให้ดีก่อนกดส่ง
          </p>
        )}
      </div>

      {/* ── ของที่จะให้ ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <AmountField label="เหรียญ" tone="text-gold" value={coins} onChange={setCoins} />
        <AmountField label="แต้มแลกนักเตะ" tone="text-token" value={points} onChange={setPoints} />
        <AmountField label="แต้มตีบวก" tone="text-kit" value={upgradePoints} onChange={setUpgradePoints} />
      </div>

      <div>
        <p className="eyebrow">การ์ด</p>
        <div className="mt-2">
          <CardMultiPicker selected={cardIds} onChange={setCardIds} max={GIFT_MAX_CARDS} />
        </div>
      </div>

      {target !== 'self' && (
        <label className="block">
          <span className="eyebrow">ข้อความถึงผู้รับ (ไม่ใส่ก็ได้)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="เช่น ของชดเชยเซิร์ฟเวอร์ล่ม"
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
          />
        </label>
      )}

      {/* ── ส่ง ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="min-w-0">
          <p className="text-xs text-chalk/60">ผู้รับ: {receiver}</p>
          {status && <p className="mt-0.5 text-xs text-neon">{status}</p>}
        </div>

        <button
          type="button"
          disabled={sending || empty}
          onClick={send}
          className="rounded-lg bg-neon px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
        >
          {sending ? 'กำลังส่ง…' : 'ส่งของ'}
        </button>
      </div>
    </section>
  );
};
