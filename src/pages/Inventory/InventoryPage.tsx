/**
 * หน้า INVENTORY — คลังการ์ดนักเตะ
 *
 * โครงตามแบบที่ให้มา:
 *   แถบสรุป → แท็บหมวด → ตัวกรอง/ค้นหา/สลับมุมมอง → ตารางการ์ด → แถบล่าง (ขาย/หน้า/ล็อก)
 *
 * การขายการ์ดใช้ระบบ "ย่อยการ์ด" เดิม (services/salvage.ts) ไม่ได้สร้างระบบใหม่ซ้อน
 * แค่เปลี่ยนคำเรียกบนหน้าจอให้ตรงกับแบบ — ย่อยแล้วได้แต้มแลกนักเตะเหมือนเดิม
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { CardDetailModal } from '@/components/player/CardDetailModal';
import { InventoryCardTile } from '@/components/inventory/InventoryCardTile';
import {
  InventoryFilters,
  OVR_BANDS,
  type InventoryFilterState,
  type InventoryTab,
} from '@/components/inventory/InventoryFilters';
import { InventoryStatsBar } from '@/components/inventory/InventoryStatsBar';
import { UPGRADE_ITEMS } from '@/data/upgradeConfig';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { usePlayers, type OwnedPlayerCard } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { getCardUpgrade, INVENTORY_CAPACITY, isCardLocked, LOCK_LIMIT } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import { getSalvageValue } from '@/services/salvage';
import { playSfx } from '@/services/sound';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** การ์ดต่อหนึ่งหน้า — 6 คอลัมน์ × 3 แถวตามแบบ */
const PAGE_SIZE = 18;

const EMPTY_FILTER: InventoryFilterState = {
  ovrBand: 'all',
  position: 'all',
  rarity: 'all',
  club: 'all',
  search: '',
};

export const InventoryPage = () => {
  const { ownedCards, upgradeItems, salvageCards, toggleCardLock } = usePlayers();
  const { team, rating } = useTeam();
  const { record } = useMatchmaking();

  const [tab, setTab] = useState<InventoryTab>('all');
  const [filter, setFilter] = useState<InventoryFilterState>(EMPTY_FILTER);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  /** โหมดเลือกหลายใบเพื่อขาย */
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'selected' | 'all' | null>(null);
  const [detail, setDetail] = useState<OwnedPlayerCard | null>(null);
  const [notice, setNotice] = useState('');

  /** การ์ดที่ลงสนามอยู่ — ขายไม่ได้ ต้องเอาออกจากทีมก่อน */
  const starterIds = useMemo(
    () => new Set(team.squad.map((slot) => slot.cardId).filter(Boolean) as string[]),
    [team.squad],
  );

  const lockedCount = ownedCards.filter(({ card }) => isCardLocked(card)).length;

  /** สโมสรที่มีการ์ดอยู่จริง — ไม่เอาตัวเลือกที่กรองแล้วว่างเปล่ามาให้เลือก */
  const clubs = useMemo(
    () => [...new Set(ownedCards.map(({ player }) => player.club))].sort(),
    [ownedCards],
  );

  const visible = useMemo(() => {
    const band = OVR_BANDS.find((entry) => entry.id === filter.ovrBand) ?? OVR_BANDS[0];
    const keyword = filter.search.trim().toLowerCase();

    return ownedCards
      .filter(({ card, player }) => {
        const ovr = getEffectivePlayerOvr(card);
        if (ovr < band.min || ovr > band.max) return false;
        if (filter.position !== 'all' && player.position !== filter.position) return false;
        if (filter.rarity !== 'all' && player.rarity !== filter.rarity) return false;
        if (filter.club !== 'all' && player.club !== filter.club) return false;
        if (keyword && !player.name.toLowerCase().includes(keyword)) return false;
        return true;
      })
      .sort((left, right) => getEffectivePlayerOvr(right.card) - getEffectivePlayerOvr(left.card));
  }, [filter, ownedCards]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  // กรองแล้วหน้าอาจหายไป เช่นค้างอยู่หน้า 5 แล้วพิมพ์ค้นหาจนเหลือหน้าเดียว
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  const pageCards = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** ใบนี้ขายได้ไหม — ล็อกอยู่หรือลงสนามอยู่ = ขายไม่ได้ */
  const sellable = ({ card }: OwnedPlayerCard): boolean =>
    !isCardLocked(card) && !starterIds.has(card.id);

  const selectedEntries = ownedCards.filter(({ card }) => selected.has(card.id));
  const selectedValue = selectedEntries.reduce(
    (sum, { card, player }) => sum + getSalvageValue(player, card.level),
    0,
  );

  /** ชุดการ์ดที่จะโดนขายจริงเมื่อกดยืนยัน */
  const pendingEntries = confirm === 'all' ? visible.filter(sellable) : selectedEntries;
  const pendingValue =
    confirm === 'all'
      ? pendingEntries.reduce((sum, { card, player }) => sum + getSalvageValue(player, card.level), 0)
      : selectedValue;

  const handleOpen = (entry: OwnedPlayerCard) => {
    if (!picking) {
      playSfx('click');
      setDetail(entry);
      return;
    }

    if (!sellable(entry)) {
      playSfx('error');
      setNotice(
        isCardLocked(entry.card)
          ? 'การ์ดใบนี้ถูกล็อกไว้ — ปลดล็อกก่อนถึงจะขายได้'
          : 'การ์ดใบนี้อยู่ใน 11 ตัวจริง — เอาออกจากสนามก่อน',
      );
      return;
    }

    playSfx('click');
    setNotice('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(entry.card.id)) next.delete(entry.card.id);
      else next.add(entry.card.id);
      return next;
    });
  };

  const confirmSell = () => {
    const gained = salvageCards(pendingEntries.map(({ card }) => card.id));
    setNotice(`ขายการ์ด ${pendingEntries.length} ใบ ได้ ${formatNumber(gained)} แต้ม`);
    setSelected(new Set());
    setConfirm(null);
    setPicking(false);
  };

  const dirty = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);

  /** แท็บที่ยังไม่มีของจริง — บอกตรง ๆ ว่ายังไม่มี ดีกว่าโชว์ตารางว่าง */
  const emptyTabMessage =
    tab === 'training'
      ? 'ยังไม่มีการ์ดฝึกในระบบ'
      : tab === 'others'
        ? 'ยังไม่มีของหมวดอื่นในคลัง'
        : '';

  return (
    <div className="space-y-4">
      <InventoryStatsBar
        total={ownedCards.length}
        capacity={INVENTORY_CAPACITY}
        topOvr={ownedCards.reduce((best, { card }) => Math.max(best, getEffectivePlayerOvr(card)), 0)}
        totalValue={ownedCards.reduce(
          (sum, { card, player }) => sum + getSalvageValue(player, card.level),
          0,
        )}
        teamOvr={rating.ovr}
        rankPoints={record.points}
        locked={lockedCount}
      />

      <InventoryFilters
        tab={tab}
        onTabChange={(next) => {
          playSfx('click');
          setTab(next);
          setPage(1);
        }}
        filter={filter}
        onFilterChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
        clubs={clubs}
        view={view}
        onViewChange={setView}
        dirty={dirty}
        onReset={() => {
          playSfx('click');
          setFilter(EMPTY_FILTER);
          setPage(1);
        }}
      />

      {notice && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-chalk/70">
          {notice}
        </p>
      )}

      {/* ── เนื้อหาตามแท็บ ── */}
      {emptyTabMessage ? (
        <section className="glass-panel grid min-h-[420px] place-items-center p-8 text-center">
          <p className="text-sm text-chalk/45">{emptyTabMessage}</p>
        </section>
      ) : tab === 'items' ? (
        <section className="glass-panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {UPGRADE_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/25 p-3"
            >
              <img src={item.icon} alt="" className="h-[74px] w-auto shrink-0 object-contain" />
              <div className="min-w-0">
                <p className={cn('font-display text-sm', item.text)}>{item.name}</p>
                <p className="text-[11px] leading-snug text-chalk/45">{item.hint}</p>
                <p className="mt-1 font-mono text-sm text-chalk/70">
                  ×{formatNumber(upgradeItems[item.id])}
                </p>
              </div>
            </div>
          ))}
        </section>
      ) : visible.length === 0 ? (
        <section className="glass-panel grid min-h-[420px] place-items-center p-8 text-center">
          <div>
            <p className="text-sm text-chalk/60">ไม่มีการ์ดที่ตรงกับตัวกรอง</p>
            {dirty && (
              <button
                type="button"
                onClick={() => setFilter(EMPTY_FILTER)}
                className="mt-2 text-xs text-neon underline underline-offset-2"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </section>
      ) : view === 'grid' ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {pageCards.map((entry) => (
            <InventoryCardTile
              key={entry.card.id}
              entry={entry}
              locked={isCardLocked(entry.card)}
              inSquad={starterIds.has(entry.card.id)}
              picking={picking}
              selected={selected.has(entry.card.id)}
              onOpen={() => handleOpen(entry)}
              onToggleLock={() => {
                if (!toggleCardLock(entry.card.id)) {
                  setNotice(`ล็อกได้สูงสุด ${LOCK_LIMIT} ใบ — ปลดล็อกใบอื่นก่อน`);
                }
              }}
            />
          ))}
        </section>
      ) : (
        <section className="glass-panel divide-y divide-white/[0.06] overflow-hidden">
          {pageCards.map((entry) => {
            const { card, player } = entry;
            const locked = isCardLocked(card);

            return (
              <div
                key={card.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 transition-colors',
                  selected.has(card.id) ? 'bg-neon/10' : 'hover:bg-white/[0.03]',
                )}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(entry)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="w-12 shrink-0 text-center font-display text-xl">
                    {getEffectivePlayerOvr(card)}
                  </span>
                  <span className="w-12 shrink-0 font-mono text-xs text-chalk/50">
                    {player.position}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  <span className="hidden w-40 shrink-0 truncate text-xs text-chalk/45 sm:block">
                    {player.club}
                  </span>
                  <span
                    className={cn(
                      'hidden w-24 shrink-0 font-mono text-[10px] uppercase sm:block',
                      RARITY_STYLE[player.rarity].text,
                    )}
                  >
                    {RARITY_STYLE[player.rarity].label}
                  </span>
                  <span className="w-20 shrink-0 font-mono text-xs text-chalk/50">
                    Lv. {card.level} · +{getCardUpgrade(card)}
                  </span>
                  <span className="w-28 shrink-0 text-right font-mono text-xs text-gold">
                    {formatNumber(getSalvageValue(player, card.level))}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!toggleCardLock(card.id)) {
                      setNotice(`ล็อกได้สูงสุด ${LOCK_LIMIT} ใบ — ปลดล็อกใบอื่นก่อน`);
                    }
                  }}
                  aria-label={locked ? 'ปลดล็อกการ์ด' : 'ล็อกการ์ด'}
                  className={cn('shrink-0 text-sm', locked ? 'text-gold' : 'text-chalk/25')}
                >
                  {locked ? '🔒' : '🔓'}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* ── แถบล่าง: ขาย · เปลี่ยนหน้า · โควตาล็อก ── */}
      <section className="glass-panel flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setPicking((current) => !current);
            setSelected(new Set());
            setNotice('');
          }}
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm transition-colors',
            picking
              ? 'bg-token text-ink-900'
              : 'border border-white/10 bg-ink-800/80 text-chalk/70 hover:text-chalk',
          )}
        >
          {picking ? `เลือกไว้ ${selected.size} ใบ · ออกจากโหมด` : '⇲ ขายหลายใบ'}
        </button>

        {picking && selected.size > 0 && (
          <button
            type="button"
            onClick={() => setConfirm('selected')}
            className="rounded-lg bg-token px-4 py-2.5 text-sm font-bold text-ink-900 hover:brightness-110"
          >
            ขายที่เลือก · {formatNumber(selectedValue)} แต้ม
          </button>
        )}

        {/* เปลี่ยนหน้า */}
        <div className="mx-auto flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            aria-label="หน้าก่อนหน้า"
            className="grid h-9 w-9 place-items-center rounded-lg text-chalk/50 transition-colors hover:bg-white/5 disabled:opacity-25"
          >
            ‹
          </button>
          <span className="min-w-[72px] text-center font-mono text-sm">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            aria-label="หน้าถัดไป"
            className="grid h-9 w-9 place-items-center rounded-lg text-chalk/50 transition-colors hover:bg-white/5 disabled:opacity-25"
          >
            ›
          </button>
        </div>

        <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-800/80 px-4 py-2.5 text-sm text-chalk/60">
          🔒 การ์ดที่ถูกล็อก
          <span className="font-mono text-chalk/90">
            {lockedCount} / {LOCK_LIMIT}
          </span>
        </span>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setConfirm('all');
          }}
          disabled={visible.filter(sellable).length === 0}
          className="rounded-lg bg-neon px-6 py-2.5 text-sm font-bold text-ink-900 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-chalk/30"
        >
          ขายทั้งหมด
        </button>
      </section>

      {/* ยืนยันก่อนขาย — ขายแล้วการ์ดหายถาวร */}
      <Modal
        open={confirm !== null}
        title="ยืนยันการขายการ์ด"
        subtitle={
          confirm === 'all'
            ? `ขายการ์ดที่ตรงตัวกรองทั้งหมด ${pendingEntries.length} ใบ (ข้ามใบที่ล็อกไว้และตัวจริง)`
            : `การ์ด ${pendingEntries.length} ใบจะหายจากคลังถาวร`
        }
        onClose={() => setConfirm(null)}
      >
        <div className="space-y-4 p-4">
          <p className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[11px] text-gold/90">
            ขายแล้วการ์ดหายถาวร กู้คืนไม่ได้ · จะได้รับ {formatNumber(pendingValue)} แต้ม
          </p>

          <ul className="max-h-56 space-y-1.5 overflow-y-auto">
            {pendingEntries.slice(0, 60).map(({ card, player }) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-ink-700/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {player.name}
                  <span className="ml-2 font-mono text-[10px] text-chalk/45">
                    {player.position} · OVR {getEffectivePlayerOvr(card)}
                  </span>
                </span>
                <span className="font-mono text-xs text-token">
                  +{formatNumber(getSalvageValue(player, card.level))}
                </span>
              </li>
            ))}
            {pendingEntries.length > 60 && (
              <li className="px-3 py-1 text-center text-[11px] text-chalk/40">
                และอีก {pendingEntries.length - 60} ใบ
              </li>
            )}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm text-chalk/70 hover:text-chalk"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmSell}
              disabled={pendingEntries.length === 0}
              className="flex-1 rounded-lg bg-token py-2.5 text-sm font-bold text-ink-900 hover:brightness-110 disabled:opacity-40"
            >
              ขายเลย · +{formatNumber(pendingValue)} แต้ม
            </button>
          </div>
        </div>
      </Modal>

      <CardDetailModal
        entry={detail}
        inSquad={detail ? starterIds.has(detail.card.id) : false}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};
