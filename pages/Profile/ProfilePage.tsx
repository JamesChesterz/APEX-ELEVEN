/**
 * หน้า Profile: ข้อมูลบัญชี + ระดับผู้เล่น + คลังการ์ด + ระบบย่อยการ์ดเป็นแต้ม
 *
 * กติกาการย่อย (ดู services/salvage.ts):
 *   - แต้มคิดตามระดับการ์ด + ค่าพลัง + เลเวล เพดานใบละ 5,000 แต้ม
 *   - การ์ดที่อยู่ใน 11 ตัวจริงย่อยไม่ได้ ต้องเอาออกจากสนามก่อน
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardDetailModal } from '@/components/player/CardDetailModal';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { RankProgressBar } from '@/components/rank/RankBadge';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { getSalvageValue, isMaxSalvage, MYTHICAL_MAX, SALVAGE_MAX } from '@/services/salvage';
import { playSfx } from '@/services/sound';
import { getLeveledOvr } from '@/services/upgrade';
import type { OwnedPlayerCard } from '@/hooks/usePlayers';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

export const ProfilePage = () => {
  const { account } = useAuth();
  const { ownedCards, coins, points, salvageCards } = usePlayers();
  const { team } = useTeam();
  const { record } = useMatchmaking();

  /** true = โหมดย่อยการ์ด (แตะการ์ด = เลือก) / false = แตะการ์ดเพื่อดูรายละเอียดและอัปเกรด */
  const [salvageMode, setSalvageMode] = useState(false);
  /** การ์ดที่กำลังเปิดดูรายละเอียด */
  const [detail, setDetail] = useState<OwnedPlayerCard | null>(null);
  /** การ์ดที่ติ๊กไว้รอย่อย */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** ผลลัพธ์ล่าสุดของการย่อย ใช้โชว์แถบสรุป */
  const [lastGain, setLastGain] = useState<number | null>(null);

  /** การ์ดที่อยู่ในสนามตอนนี้ — ย่อยไม่ได้ */
  const starterIds = useMemo(
    () => new Set(team.squad.map((slot) => slot.cardId).filter(Boolean) as string[]),
    [team.squad],
  );

  const selectedEntries = ownedCards.filter(({ card }) => selected.has(card.id));
  const totalPoints = selectedEntries.reduce(
    (sum, { card, player }) => sum + getSalvageValue(player, card.level),
    0,
  );

  /** แตะการ์ด: โหมดปกติ = เปิดรายละเอียด, โหมดย่อย = ติ๊กเลือก */
  const handleCardClick = (item: OwnedPlayerCard) => {
    if (!salvageMode) {
      playSfx('click');
      setDetail(item);
      return;
    }

    if (starterIds.has(item.card.id)) {
      playSfx('error');
      return;
    }

    playSfx('click');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.card.id)) next.delete(item.card.id);
      else next.add(item.card.id);
      return next;
    });
  };

  const confirmSalvage = () => {
    const gained = salvageCards([...selected]);
    setLastGain(gained);
    setSelected(new Set());
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* ── การ์ดสรุปบัญชี ── */}
      <section className="panel grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="eyebrow">ผู้จัดการทีม</p>
          <p className="font-display text-xl">{account?.username}</p>
          <p className="text-xs text-chalk/50">{team.name}</p>
        </div>

        <div>
          <p className="eyebrow">เหรียญ</p>
          <p className="font-display text-xl text-gold">{formatNumber(coins)}</p>
        </div>

        <div>
          <p className="eyebrow">แต้มจากการย่อยการ์ด</p>
          <p className="font-display text-xl text-token">{formatNumber(points)}</p>
        </div>

        <div>
          <p className="eyebrow">สถิติซีซัน</p>
          <p className="font-mono text-sm">
            {record.wins} ชนะ · {record.draws} เสมอ · {record.losses} แพ้
          </p>
          <p className="font-mono text-xs text-chalk/50">⭐ {formatNumber(record.points)}</p>
        </div>

        <div className="sm:col-span-2 xl:col-span-4">
          <RankProgressBar points={record.points} />
        </div>
      </section>

      {/* ── หัวข้อคลังการ์ด + แถบเครื่องมือย่อย ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">My Cards</h2>
          <p className="text-sm text-chalk/50">
            มีการ์ดทั้งหมด {ownedCards.length} ใบ ·{' '}
            {salvageMode
              ? `แตะการ์ดเพื่อเลือกย่อยเป็นแต้ม (เพดานใบละ ${formatNumber(SALVAGE_MAX)} แต้ม · Mythical ${formatNumber(MYTHICAL_MAX)})`
              : 'แตะการ์ดเพื่อดูค่าพลังและอัปเกรดนักเตะ'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setSalvageMode((current) => !current);
            setSelected(new Set());
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
            salvageMode
              ? 'bg-token text-ink-900'
              : 'border border-white/15 text-chalk/70 hover:text-chalk',
          )}
        >
          {salvageMode ? 'ออกจากโหมดย่อย' : 'โหมดย่อยการ์ด'}
        </button>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-token/40 bg-token/10 px-4 py-2">
            <span className="text-sm">
              เลือกไว้ {selected.size} ใบ ·{' '}
              <span className="font-display text-lg text-token">{formatNumber(totalPoints)}</span> แต้ม
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setConfirmOpen(true);
              }}
              className="rounded-lg bg-token px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
            >
              ย่อยการ์ด
            </button>
          </div>
        )}
      </div>

      {lastGain !== null && selected.size === 0 && (
        <p className="rounded-lg border border-token/40 bg-token/10 px-4 py-2 text-sm text-token">
          ย่อยการ์ดสำเร็จ ได้รับ {formatNumber(lastGain)} แต้ม · แต้มสะสมตอนนี้{' '}
          {formatNumber(points)} แต้ม ·{' '}
          <Link to="/exchange" className="underline underline-offset-2 hover:text-chalk">
            เอาไปแลกนักเตะที่เมนู Exchange
          </Link>
        </p>
      )}

      {/* ── คลังการ์ด ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {ownedCards.map((item) => {
          const { card, player } = item;
          const inSquad = starterIds.has(card.id);
          const isSelected = selected.has(card.id);
          const value = getSalvageValue(player, card.level);

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(item)}
              title={
                salvageMode && inSquad
                  ? 'อยู่ใน 11 ตัวจริง — เอาออกจากสนามก่อนถึงจะย่อยได้'
                  : undefined
              }
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors',
                isSelected
                  ? 'border-token bg-token/15'
                  : 'border-white/8 bg-ink-800/60 hover:border-white/20',
                salvageMode && inSquad && 'cursor-not-allowed opacity-55',
              )}
            >
              <PlayerCard
                player={player}
                size="sm"
                level={card.level}
                className={isSelected ? 'brightness-110' : undefined}
              />

              <span className="w-full truncate text-center text-[11px] font-semibold">
                {player.name}
              </span>

              <span className="font-mono text-[10px] text-chalk/45">
                {player.position} · OVR {getLeveledOvr(player, card.level)}
              </span>

              {inSquad ? (
                <span className="rounded bg-neon/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">
                  ตัวจริง
                </span>
              ) : (
                salvageMode && (
                  <span
                    className={cn(
                      'font-mono text-[10px]',
                      // เต็มเพดานของระดับตัวเอง (mythical มีเพดานสูงกว่าระดับอื่น)
                      isMaxSalvage(player, card.level) ? 'text-gold' : 'text-token',
                    )}
                  >
                    {isMaxSalvage(player, card.level) ? '★ ' : ''}
                    {formatNumber(value)} แต้ม
                  </span>
                )
              )}

              <span className={cn('font-mono text-[9px] uppercase', RARITY_STYLE[player.rarity].text)}>
                {RARITY_STYLE[player.rarity].label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ยืนยันก่อนย่อย (ย่อยแล้วการ์ดหายถาวร) ── */}
      <Modal
        open={confirmOpen}
        title="ยืนยันการย่อยการ์ด"
        subtitle={`การ์ด ${selected.size} ใบจะหายจากคลังถาวร แลกเป็น ${formatNumber(totalPoints)} แต้ม`}
        onClose={() => setConfirmOpen(false)}
      >
        <ul className="mb-4 max-h-64 space-y-1.5 overflow-y-auto">
          {selectedEntries.map(({ card, player }) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-ink-700/50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {player.name}
                <span className="ml-2 font-mono text-[10px] text-chalk/45">
                  {player.position} · OVR {player.ovr}
                </span>
              </span>
              <span className="font-mono text-xs text-token">
                +{formatNumber(getSalvageValue(player, card.level))}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="flex-1 rounded-lg border border-white/15 py-2.5 text-xs font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirmSalvage}
            className="flex-1 rounded-lg bg-token py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
          >
            ย่อยเลย · +{formatNumber(totalPoints)} แต้ม
          </button>
        </div>
      </Modal>

      {/* รายละเอียดการ์ด + อัปเกรด/รวมร่าง */}
      <CardDetailModal
        entry={detail}
        inSquad={detail ? starterIds.has(detail.card.id) : false}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};
