/**
 * FC ALLSTAR PASS — หน้าพาสประจำซีซัน (เมนู Pass อยู่ใต้ Exchange)
 *
 * เลย์เอาต์ตามแบบที่ออกไว้ แบ่งเป็นสองคอลัมน์ใหญ่
 *
 *   คอลัมน์ซ้าย (เนื้อหาหลัก)
 *     • ชื่อซีซัน + ป้ายเวลาที่เหลือ · การ์ดแต้มพาส (XP) · การ์ดเลเวลพาส
 *     • แถบแท็บ: PASS / ภารกิจ / รางวัล / ร้านค้าพาส
 *     • หมุดเลเวล + หลอด XP + ปุ่ม "ซื้อเลเวล" และ "ปลดล็อกพาสพรีเมียม"
 *     • ราง: คอลัมน์ซ้ายคงที่เป็นการ์ดของแต่ละสาย ขวาเป็นช่องรางวัลไล่ตามเลเวล
 *       มีเลขเลเวลเป็นหัวคอลัมน์ และแบ่งหน้าเป็นชุดละ 10 เลเวล
 *     • แผงภารกิจประจำวัน / ภารกิจพาส
 *
 *   คอลัมน์ขวา: ตารางอันดับแต้มพาส (XP) ของทั้งเซิร์ฟเวอร์
 *
 * หลักที่ยึดไว้ทั้งหน้า: สาย FREE ต้องเด่นและใช้งานได้เต็มที่เสมอ
 * ช่องของสายที่ยังไม่ปลดล็อกจะจางและติดแม่กุญแจ แต่ยังมองเห็นของข้างในได้
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PassLeaderboard } from '@/components/pass/PassLeaderboard';
import { PassMissions } from '@/components/pass/PassMissions';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { usePass } from '@/hooks/usePass';
import { getDayStart } from '@/services/league';
import { isSafeLuckyImage } from '@/services/luckyImage';
import {
  describePassReward,
  passCell,
  passRewardIcon,
  passRewardImage,
  TIER_LABEL,
  unlockCost,
} from '@/services/pass';
import { formatRemaining } from '@/services/pointsExchange';
import { playSfx } from '@/services/sound';
import type { PassReward, PassTier } from '@/types/pass';
import { cn, formatNumber } from '@/utils/helpers';

/** กี่เลเวลต่อหนึ่งหน้าของราง */
const PAGE_SIZE = 10;

/** ความกว้างของหนึ่งคอลัมน์เลเวล (px) */
const COLUMN = 96;

/** แถวรางวัลเรียงจากบนลงล่าง — สายสูงสุดอยู่บน สาย FREE อยู่ล่างสุด */
const ROWS: PassTier[] = ['plus', 'premium', 'free'];

/** แท็บของหน้า — ตอนนี้ทำจริงสองแท็บแรก อีกสองแท็บพาไปยังของที่มีอยู่แล้วในเกม */
const TABS = [
  { key: 'pass', label: 'PASS' },
  { key: 'missions', label: 'ภารกิจ' },
] as const;

type Tab = (typeof TABS)[number]['key'];

/** ย่อจำนวนก้อนใหญ่ให้พอดีช่องเล็ก */
const shortAmount = (value: number): string => {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return formatNumber(value);
};

/** วินาทีที่เหลือก่อนภารกิจประจำวันรีเซ็ต (วันแข่งเริ่ม 06:00 เหมือนลีก) */
const secondsUntilDailyReset = (now = new Date()): number => {
  const next = getDayStart(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((next - now.getTime()) / 1000));
};

export const PassPage = () => {
  const {
    config,
    open,
    closed,
    secondsLeft,
    standing,
    progress,
    tier,
    passXp,
    passTickets,
    coins,
    pending,
    result,
    error,
    dailyMissions,
    seasonMissions,
    missionXpReady,
    claimMission,
    claimAllMissions,
    claimCell,
    claimAll,
    buyLevel,
    unlock,
    dismissResult,
    clearError,
  } = usePass();

  const { account } = useAuth();
  const { profileByUid } = useOnline();
  /** โปรไฟล์ทุกใบที่โหลดไว้แล้ว — ใช้ทำตารางอันดับ XP โดยไม่ยิงคำขอเพิ่ม */
  const profiles = useMemo(() => Object.values(profileByUid), [profileByUid]);

  const [tab, setTab] = useState<Tab>('pass');
  /** สายที่กำลังจะยืนยันการปลดล็อก */
  const [buying, setBuying] = useState<PassTier | null>(null);
  const [page, setPage] = useState(0);

  /** นาฬิกาเดินทุกวินาที ใช้นับถอยหลังการรีเซ็ตภารกิจประจำวัน */
  const [dailyReset, setDailyReset] = useState(() => secondsUntilDailyReset());

  useEffect(() => {
    const id = window.setInterval(() => setDailyReset(secondsUntilDailyReset()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pageCount = Math.max(1, Math.ceil(config.levels.length / PAGE_SIZE));

  /** เปิดหน้าปุ๊บให้เด้งไปหน้าที่มีเลเวลปัจจุบันอยู่ จะได้ไม่ต้องกดหาเอง */
  useEffect(() => {
    if (config.levels.length === 0) return;
    setPage(Math.min(pageCount - 1, Math.floor((standing.level - 1) / PAGE_SIZE)));
    // ตั้งใจให้ทำครั้งเดียวตอนรู้จำนวนเลเวลแล้ว ไม่ใช่ดึงหน้ากลับทุกครั้งที่ XP ขยับ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.levels.length]);

  const visibleLevels = useMemo(
    () => config.levels.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [config.levels, page],
  );

  const banner = isSafeLuckyImage(config.bannerImage) ? config.bannerImage : null;

  /** สายถัดไปที่ยังซื้อได้ ใช้กับปุ่ม "ปลดล็อกพาสพรีเมียม" บนแถบบน */
  const nextTier: PassTier | null =
    tier === 'free' ? 'premium' : tier === 'premium' ? 'plus' : null;

  if (!open) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl uppercase">ยังไม่เปิด</p>
        <p className="mt-2 text-sm text-chalk/50">พาสประจำซีซันยังไม่เปิดให้เล่นตอนนี้</p>
      </div>
    );
  }

  if (config.levels.length === 0) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl uppercase">{config.title}</p>
        <p className="mt-2 text-sm text-chalk/50">ทีมงานกำลังจัดรางวัลของซีซันนี้อยู่</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 xl:flex-row">
      {/* ══ คอลัมน์ซ้าย: เนื้อหาหลัก ══ */}
      <div className="min-w-0 flex-1 space-y-3">
        {/* ── ชื่อซีซัน + การ์ด XP + การ์ดเลเวล ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl uppercase tracking-wide text-gold sm:text-3xl">
              {config.seasonName}
            </h2>
            {secondsLeft !== null && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-neon/15 px-2.5 py-0.5 font-mono text-[11px] text-neon">
                ⏱ เหลือเวลา {formatRemaining(secondsLeft)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <StatCard icon="⭐" label="แต้มพาส (XP)" value={formatNumber(passXp)} tone="gold" />
            <StatCard icon="🏅" label="เลเวลพาส" value={String(standing.level)} tone="kit" />
            <StatCard icon="🎟️" label="ตั๋วพาส" value={String(passTickets)} tone="neon" />
          </div>
        </div>

        {/* ── แท็บ ── */}
        <div className="flex overflow-hidden rounded-lg border border-white/10 bg-ink-900/50">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                playSfx('click');
                setTab(entry.key);
              }}
              className={cn(
                'relative flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                tab === entry.key
                  ? 'bg-white/[0.07] text-chalk'
                  : 'text-chalk/45 hover:text-chalk/80',
              )}
            >
              {entry.label}
              {entry.key === 'missions' && missionXpReady > 0 && (
                <span className="ml-1.5 rounded-full bg-neon px-1.5 py-0.5 font-mono text-[9px] text-ink-900">
                  +{missionXpReady}
                </span>
              )}
              {tab === entry.key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-neon" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="flex items-center justify-between gap-3 rounded-lg border border-gem/40 bg-gem/10 px-3 py-1.5 text-xs text-gem">
            {error}
            <button type="button" onClick={clearError} className="text-[10px] uppercase tracking-wider">
              ปิด
            </button>
          </p>
        )}

        {closed && (
          <p className="rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 px-3 py-1.5 text-xs text-[#F0A070]">
            ซีซันนี้ปิดแล้ว — รางวัลที่ยังไม่ได้กดรับจะหายไปเมื่อทีมงานเปิดซีซันใหม่
          </p>
        )}

        {tab === 'pass' ? (
          <>
            {/* ── หมุดเลเวล + หลอด XP + ปุ่มหลัก ── */}
            <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display text-lg text-gold ring-2 ring-gold/50">
                {standing.level}
              </span>

              <div className="min-w-[12rem] flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">ระดับพาส</span>
                  <span className="font-mono text-[11px] text-chalk/55">
                    {standing.maxed
                      ? `${formatNumber(standing.xp)} XP · เลเวลสูงสุดแล้ว`
                      : `${formatNumber(standing.into)} / ${formatNumber(standing.into + standing.need)} XP`}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon to-kit transition-[width] duration-500"
                    style={{ width: `${Math.round(standing.ratio * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-chalk/40">
                  ลงแข่ง Matchmaking จบหนึ่งนัดได้ {formatNumber(config.xpPerMatch)} XP — แพ้ก็ได้
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {config.levelUpCoins > 0 && !standing.maxed && (
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      buyLevel();
                    }}
                    className="rounded-lg bg-neon px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
                  >
                    ซื้อเลเวล
                    <span className="ml-1.5 font-mono normal-case">
                      🪙 {formatNumber(config.levelUpCoins)}
                    </span>
                  </button>
                )}

                {nextTier && (
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setBuying(nextTier);
                    }}
                    className="rounded-lg bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
                  >
                    ปลดล็อก{TIER_LABEL[nextTier]}
                  </button>
                )}

                <button
                  type="button"
                  disabled={pending.length === 0}
                  onClick={() => {
                    playSfx('click');
                    claimAll();
                  }}
                  className={cn(
                    'rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                    pending.length > 0
                      ? 'bg-kit text-ink-900 hover:brightness-110'
                      : 'cursor-not-allowed bg-white/10 text-chalk/40',
                  )}
                >
                  รับทั้งหมด{pending.length > 0 ? ` (${pending.length})` : ''}
                </button>
              </div>
            </div>

            {/* ── รางรางวัล ── */}
            <div className="glass-panel overflow-hidden p-2 sm:p-3">
              <div className="flex gap-2">
                {/* คอลัมน์ซ้ายคงที่: การ์ดของแต่ละสาย */}
                <div className="flex w-[132px] shrink-0 flex-col gap-1 sm:w-[150px]">
                  {/* ช่องว่างให้ตรงกับแถวเลขเลเวล */}
                  <div className="h-7 shrink-0" />
                  {ROWS.map((row) => (
                    <TrackCard
                      key={row}
                      tier={row}
                      owned={tierOwned(tier, row)}
                      cost={unlockCost(config, row)}
                      banner={row === 'plus' ? banner : null}
                      onBuy={() => {
                        playSfx('click');
                        setBuying(row);
                      }}
                    />
                  ))}
                </div>

                {/* ช่องรางวัลของหน้านี้ */}
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div
                    style={{ width: visibleLevels.length * COLUMN }}
                    className="flex flex-col gap-1"
                  >
                    {/* หัวคอลัมน์: เลขเลเวล */}
                    <div className="flex h-7 shrink-0 items-center rounded-md bg-ink-900/60">
                      {visibleLevels.map((entry) => {
                        const reached = entry.level <= standing.level;
                        return (
                          <span
                            key={entry.level}
                            style={{ width: COLUMN }}
                            title={`เลเวล ${entry.level} · ต้องใช้ ${formatNumber(entry.xp)} XP`}
                            className={cn(
                              'shrink-0 text-center font-display text-base',
                              entry.level === standing.level
                                ? 'text-neon'
                                : reached
                                  ? 'text-chalk/80'
                                  : 'text-chalk/35',
                            )}
                          >
                            {entry.level}
                          </span>
                        );
                      })}
                    </div>

                    {ROWS.map((row) => (
                      <div key={row} className="flex items-stretch">
                        {visibleLevels.map((entry) => {
                          const cell = passCell(config, progress, standing, row, entry.level);
                          return (
                            <RewardCell
                              key={`${row}-${entry.level}`}
                              rewards={cell.rewards}
                              tier={row}
                              reached={cell.reached}
                              owned={cell.owned}
                              claimed={cell.claimed}
                              claimable={cell.claimable}
                              onClaim={() => claimCell(row, entry.level)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── เปลี่ยนหน้า ── */}
              {pageCount > 1 && (
                <div className="mt-2 flex items-center justify-center gap-4">
                  <PagerButton
                    label="‹"
                    disabled={page === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  />
                  <span className="font-mono text-xs text-chalk/60">
                    {page + 1} / {pageCount}
                  </span>
                  <PagerButton
                    label="›"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  />
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-chalk/45">
              สาย FREE เก็บได้ครบทุกเลเวลโดยไม่ต้องปลดล็อกอะไร · ปลดล็อกทีหลังก็ยังกดรับของเลเวลเก่าได้ครบ
            </p>
          </>
        ) : (
          <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-3">
            <p className="text-xs text-chalk/60">
              ทำภารกิจเก็บ XP เพื่อดันเลเวลพาส — ภารกิจประจำวันรีเซ็ตทุกวันตอน 06:00
            </p>
            <button
              type="button"
              disabled={missionXpReady === 0}
              onClick={() => {
                playSfx('click');
                claimAllMissions();
              }}
              className={cn(
                'rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                missionXpReady > 0
                  ? 'bg-neon text-ink-900 hover:bg-neon-dim'
                  : 'cursor-not-allowed bg-white/10 text-chalk/40',
              )}
            >
              รับ XP ทั้งหมด{missionXpReady > 0 ? ` (+${formatNumber(missionXpReady)})` : ''}
            </button>
          </div>
        )}

        {/* ── ภารกิจ (โชว์ตลอด เหมือนแบบที่ออกไว้) ── */}
        <PassMissions
          daily={dailyMissions}
          season={seasonMissions}
          dailyResetIn={dailyReset}
          onClaim={claimMission}
        />
      </div>

      {/* ══ คอลัมน์ขวา: ตารางอันดับแต้มพาส ══ */}
      <PassLeaderboard
        profiles={profiles}
        myUid={account?.id}
        myXp={passXp}
        myName={account?.managerName ?? 'ผู้จัดการ'}
      />

      {/* ── ยืนยันการปลดล็อก ── */}
      <Modal
        open={buying !== null}
        title={`ปลดล็อกสาย ${buying ? TIER_LABEL[buying] : ''}`}
        subtitle="ปลดล็อกแล้วจะได้รางวัลของเลเวลที่ถึงแล้วย้อนหลังทั้งหมดทันที"
        onClose={() => setBuying(null)}
      >
        {buying && (
          <UnlockConfirm
            tier={buying}
            cost={unlockCost(config, buying)}
            coins={coins}
            tickets={passTickets}
            level={standing.level}
            onCancel={() => setBuying(null)}
            onConfirm={(method) => {
              if (unlock(buying, method)) setBuying(null);
            }}
          />
        )}
      </Modal>

      {/* ── สรุปของที่เพิ่งรับ ── */}
      <Modal
        open={result !== null}
        title="รับรางวัลแล้ว!"
        subtitle={result ? `จากทั้งหมด ${result.cells} ช่อง` : ''}
        onClose={dismissResult}
      >
        {result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap justify-center gap-2">
              {result.coins > 0 && <Tally icon="🪙" label="เหรียญ" amount={result.coins} />}
              {result.points > 0 && <Tally icon="💠" label="แต้มแลกนักเตะ" amount={result.points} />}
              {result.upgradePoints > 0 && (
                <Tally icon="⚡" label="แต้มตีบวก" amount={result.upgradePoints} />
              )}
              {result.tickets > 0 && <Tally icon="🎟️" label="ตั๋วพาส" amount={result.tickets} />}
            </div>

            {result.cards.length > 0 && (
              <div className="space-y-2">
                <p className="eyebrow text-center">การ์ดที่ได้</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {result.cards.map((entry) => {
                    const player = getPlayerById(entry.playerId);
                    return player ? (
                      <PlayerCard key={entry.card.id} player={player} size="sm" />
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={dismissResult}
                className="rounded-lg bg-neon px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
              >
                เยี่ยม
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/** สายที่ปลดล็อกไว้ครอบสายนี้ไหม */
const tierOwned = (owned: PassTier, target: PassTier): boolean => {
  const order: PassTier[] = ['free', 'premium', 'plus'];
  return order.indexOf(owned) >= order.indexOf(target);
};

/** การ์ดตัวเลขบนแถบบน */
const StatCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: 'gold' | 'kit' | 'neon';
}) => (
  <div
    className={cn(
      'flex items-center gap-2.5 rounded-xl border px-3 py-2',
      tone === 'gold' && 'border-gold/40 bg-gold/10',
      tone === 'kit' && 'border-kit/40 bg-kit/10',
      tone === 'neon' && 'border-neon/40 bg-neon/10',
    )}
  >
    <span className="text-xl leading-none">{icon}</span>
    <span>
      <span className="block font-mono text-[10px] uppercase tracking-wider text-chalk/50">
        {label}
      </span>
      <span
        className={cn(
          'font-display text-xl leading-none',
          tone === 'gold' && 'text-gold',
          tone === 'kit' && 'text-kit',
          tone === 'neon' && 'text-neon',
        )}
      >
        {value}
      </span>
    </span>
  </div>
);

/** ปุ่มเปลี่ยนหน้าของราง */
const PagerButton = ({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => {
      playSfx('click');
      onClick();
    }}
    className="h-8 w-8 rounded-full border border-white/15 font-mono text-lg leading-none text-chalk/70 hover:text-chalk disabled:opacity-25"
  >
    {label}
  </button>
);

/** การ์ดหัวแถวของแต่ละสายในคอลัมน์ซ้าย */
const TrackCard = ({
  tier,
  owned,
  cost,
  banner,
  onBuy,
}: {
  tier: PassTier;
  owned: boolean;
  cost: ReturnType<typeof unlockCost>;
  /** รูปแบนเนอร์ของซีซัน โชว์บนการ์ดใบบนสุดใบเดียว */
  banner: string | null;
  onBuy: () => void;
}) => {
  const sellable = cost !== null && (cost.tickets > 0 || cost.coins > 0);

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center',
        tier === 'free'
          ? 'border-kit/40 bg-kit/10'
          : owned
            ? 'border-neon/50 bg-neon/10'
            : 'border-gold/40 bg-gradient-to-b from-gold/20 to-gold/5',
      )}
    >
      {banner ? (
        <img src={banner} alt="" className="max-h-12 w-full rounded object-contain" />
      ) : (
        <span className="text-2xl leading-none">{tier === 'free' ? '🛡️' : '⭐'}</span>
      )}

      <p
        className={cn(
          'font-display text-xs uppercase leading-tight',
          tier === 'free' ? 'text-kit' : owned ? 'text-neon' : 'text-gold',
        )}
      >
        {TIER_LABEL[tier]} PASS
      </p>

      {tier === 'free' ? (
        <span className="rounded bg-kit/20 px-2 py-0.5 font-mono text-[10px] text-kit">
          ✓ รับได้ฟรี
        </span>
      ) : owned ? (
        <span className="rounded bg-neon/20 px-2 py-0.5 font-mono text-[10px] text-neon">
          ✓ ปลดล็อกแล้ว
        </span>
      ) : sellable ? (
        <button
          type="button"
          onClick={onBuy}
          className="w-full rounded bg-gold py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
        >
          ปลดล็อก
        </button>
      ) : (
        <span className="font-mono text-[10px] text-chalk/40">ยังไม่เปิดขาย</span>
      )}
    </div>
  );
};

/** ยอดหนึ่งก้อนในหน้าต่างสรุป */
const Tally = ({ icon, label, amount }: { icon: string; label: string; amount: number }) => (
  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-700/50 px-3 py-2">
    <span className="text-2xl">{icon}</span>
    <span>
      <span className="block font-mono text-[10px] uppercase tracking-wider text-chalk/45">
        {label}
      </span>
      <span className="font-display text-lg text-neon">+{formatNumber(amount)}</span>
    </span>
  </div>
);

/** เนื้อในหน้าต่างยืนยันการปลดล็อก */
const UnlockConfirm = ({
  tier,
  cost,
  coins,
  tickets,
  level,
  onCancel,
  onConfirm,
}: {
  tier: PassTier;
  cost: ReturnType<typeof unlockCost>;
  coins: number;
  tickets: number;
  level: number;
  onCancel: () => void;
  onConfirm: (method: 'tickets' | 'coins') => void;
}) => (
  <div className="space-y-4 py-2">
    <p className="text-center text-sm text-chalk/70">
      ตอนนี้คุณอยู่เลเวล <span className="font-bold text-neon">{level}</span> — ปลดล็อกสาย{' '}
      {TIER_LABEL[tier]} แล้วจะได้รางวัลของเลเวล 1–{level} ย้อนหลังครบทันที
    </p>

    <div className="flex flex-col gap-2 sm:flex-row">
      {cost && cost.tickets > 0 && (
        <button
          type="button"
          disabled={tickets < cost.tickets}
          onClick={() => onConfirm('tickets')}
          className={cn(
            'flex-1 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition-colors',
            tickets >= cost.tickets
              ? 'bg-kit text-ink-900 hover:brightness-110'
              : 'cursor-not-allowed bg-white/5 text-chalk/35',
          )}
        >
          🎟️ ใช้ตั๋ว {cost.tickets} ใบ
          <span className="mt-0.5 block font-mono text-[10px] normal-case tracking-normal">
            มีอยู่ {tickets} ใบ
          </span>
        </button>
      )}

      {cost && cost.coins > 0 && (
        <button
          type="button"
          disabled={coins < cost.coins}
          onClick={() => onConfirm('coins')}
          className={cn(
            'flex-1 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition-colors',
            coins >= cost.coins
              ? 'bg-gold text-ink-900 hover:brightness-110'
              : 'cursor-not-allowed bg-white/5 text-chalk/35',
          )}
        >
          🪙 ใช้เหรียญ {formatNumber(cost.coins)}
          <span className="mt-0.5 block font-mono text-[10px] normal-case tracking-normal">
            มีอยู่ {formatNumber(coins)}
          </span>
        </button>
      )}
    </div>

    <div className="text-center">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-white/15 px-6 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
      >
        ยกเลิก
      </button>
    </div>
  </div>
);

/** ช่องรางวัลหนึ่งช่องในราง */
const RewardCell = ({
  rewards,
  tier,
  reached,
  owned,
  claimed,
  claimable,
  onClaim,
}: {
  rewards: PassReward[];
  tier: PassTier;
  reached: boolean;
  owned: boolean;
  claimed: boolean;
  claimable: boolean;
  onClaim: () => void;
}) => {
  const label = useMemo(() => rewards.map(describePassReward).join(' · '), [rewards]);

  if (rewards.length === 0) {
    return (
      <div style={{ width: COLUMN }} className="shrink-0 p-1">
        <span className="flex h-full min-h-[104px] w-full rounded-md border border-dashed border-white/10 opacity-30" />
      </div>
    );
  }

  return (
    <div style={{ width: COLUMN }} className="shrink-0 p-1">
      <button
        type="button"
        disabled={!claimable}
        onClick={() => {
          playSfx('click');
          onClaim();
        }}
        title={`${TIER_LABEL[tier]} · ${label}`}
        className={cn(
          'relative flex min-h-[104px] w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border p-1 transition-colors',
          claimed && 'border-white/10 bg-ink-900/70 opacity-45',
          !claimed && claimable && 'border-neon bg-neon/15 ring-2 ring-neon/40 hover:bg-neon/25',
          // ยังไม่ถึงเลเวล หรือยังไม่ปลดล็อกสาย — จางลงแต่ยังเห็นว่ามีอะไรรออยู่
          !claimed && !claimable && 'border-white/10 bg-ink-800/60',
          !claimed && !claimable && !owned && 'opacity-60',
          !claimed && !claimable && owned && !reached && 'opacity-75',
        )}
      >
        {rewards.slice(0, 2).map((reward) => (
          <RewardFace key={reward.id} reward={reward} />
        ))}

        {rewards.length > 2 && (
          <span className="font-mono text-[9px] text-chalk/45">+{rewards.length - 2}</span>
        )}

        {claimed && <span className="absolute right-1 top-1 text-sm text-neon">✓</span>}

        {/* สายที่ยังไม่ได้ปลดล็อก ติดแม่กุญแจไว้มุมบน */}
        {!owned && !claimed && (
          <span className="absolute right-1 top-1 text-[11px] opacity-80">🔒</span>
        )}
      </button>
    </div>
  );
};

/** หน้าตาของรางวัลหนึ่งชิ้นในช่อง */
const RewardFace = ({ reward }: { reward: PassReward }) => {
  // รูปที่แอดมินใส่เอง > รูปตั้งต้นตามประเภท > อีโมจิ
  const image = passRewardImage(reward);

  if (isSafeLuckyImage(image)) {
    return (
      <>
        <img
          src={image}
          alt={describePassReward(reward)}
          loading="lazy"
          className="max-h-[54px] w-[72%] object-contain"
        />
        {reward.type !== 'card' && (
          <span className="font-mono text-[9px] font-bold text-chalk/75">
            x{shortAmount(reward.amount ?? 0)}
          </span>
        )}
      </>
    );
  }

  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    if (!player) return <span className="text-[10px] text-chalk/35">—</span>;
    return (
      <>
        <PlayerCard player={player} size="xs" style={{ width: '74%' }} />
        <span className="w-full truncate font-mono text-[8px] text-chalk/50">{player.name}</span>
      </>
    );
  }

  return (
    <>
      <span className="text-2xl leading-none">{passRewardIcon(reward)}</span>
      <span className="font-mono text-[9px] font-bold text-chalk/75">
        x{shortAmount(reward.amount ?? 0)}
      </span>
    </>
  );
};
