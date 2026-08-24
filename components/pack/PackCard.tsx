/**
 * ซองการ์ดหนึ่งใบในร้าน
 *
 * หน้าซองโชว์ "ใบเด่น" = นักเตะที่ OVR สูงที่สุดในซองนั้น (ระบบหยิบให้เอง)
 * ผู้เล่นจึงเห็นตั้งแต่ยังไม่จ่ายว่าซองนี้ลุ้นอะไรได้ และกดดูรายชื่อทั้งซองต่อได้
 */
import { useState } from 'react';
import { PackContentsModal } from '@/components/pack/PackContentsModal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { formatOdds, getMythicalChance, getPackHighlight, getPackPlayers } from '@/services/cardPack';
import { playSfx } from '@/services/sound';
import type { CardPack, PackTier } from '@/types/card';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

interface PackCardProps {
  pack: CardPack;
  coins: number;
  opening?: boolean;
  disabled?: boolean;
  onOpen: (packId: string) => void;
}

/**
 * สีประจำซองแต่ละระดับ ใช้เป็นแสงหลังใบเด่น
 * mythic ใช้ไล่สีชมพู–ฟ้าให้ตรงกับสีของการ์ดระดับ mythical ในฉากเปิดซอง
 */
const TIER_ART: Record<PackTier, { glow: string; ring: string }> = {
  bronze: { glow: 'from-[#7A5230]/50 to-transparent', ring: 'ring-white/10' },
  silver: { glow: 'from-[#8A96A0]/50 to-transparent', ring: 'ring-white/15' },
  gold: { glow: 'from-[#C79A2E]/45 to-transparent', ring: 'ring-gold/30' },
  special: { glow: 'from-[#6B3FB0]/50 to-transparent', ring: 'ring-white/15' },
  mythic: { glow: 'from-[#FF3FA4]/45 to-transparent', ring: 'ring-rarity-mythical/45' },
};

export const PackCard = ({ pack, coins, opening = false, disabled = false, onOpen }: PackCardProps) => {
  const [showContents, setShowContents] = useState(false);

  const affordable = coins >= pack.price;
  const art = TIER_ART[pack.tier];
  const mythicalChance = getMythicalChance(pack);
  const highlight = getPackHighlight(pack);
  const totalPlayers = getPackPlayers(pack).length;

  return (
    <>
      <article
        className={cn(
          'glass-panel flex flex-col p-5',
          // ซอง mythic ได้ขอบเรืองแสงพิเศษ ให้เด่นกว่าซองอื่นในแถวเดียวกัน
          pack.tier === 'mythic' && 'border-rarity-mythical/40 shadow-[0_0_28px_-8px_#FF3FA4]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">{pack.tier}</p>
          {mythicalChance > 0 && (
            <span className="rounded bg-rarity-mythical/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rarity-mythical">
              mythical {mythicalChance}%
            </span>
          )}
        </div>

        <h3 className="mt-1 text-xl">{pack.name}</h3>
        <p className="mt-2 min-h-[40px] text-sm text-chalk/55">{pack.description}</p>

        {/* ── ใบเด่นหน้าซอง: คนที่ OVR สูงสุดในซองนี้ ── */}
        <div className="relative my-4 flex justify-center">
          {/* แสงหลังการ์ด สีตามระดับของซอง */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-2 mx-auto h-[110px] w-[150px] rounded-full bg-gradient-to-b blur-2xl',
              art.glow,
            )}
            aria-hidden
          />

          {highlight ? (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowContents(true);
              }}
              title={`${highlight.name} · OVR ${highlight.ovr} — กดดูนักเตะทั้งหมดในซอง`}
              className={cn(
                'relative rounded-xl p-1 ring-1 transition-transform hover:-translate-y-1',
                art.ring,
                opening && 'animate-pulse ring-2 ring-neon',
              )}
            >
              <PlayerCard player={highlight} size="md" />
              <span className="mt-1 block truncate text-center text-[11px] font-semibold">
                {highlight.name}
              </span>
              <span
                className={cn(
                  'block text-center font-mono text-[9px] uppercase tracking-wider',
                  RARITY_STYLE[highlight.rarity].text,
                )}
              >
                {RARITY_STYLE[highlight.rarity].label} · OVR {highlight.ovr}
              </span>
            </button>
          ) : (
            <div className="relative flex h-[120px] w-[88px] items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-chalk/40">
              ยังไม่มีนักเตะ
            </div>
          )}
        </div>

        <dl className="space-y-1 text-xs text-chalk/45">
          <div className="flex justify-between">
            <dt>จำนวนการ์ด</dt>
            <dd className="font-mono text-chalk/70">{pack.cardCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>โอกาส</dt>
            <dd className="truncate font-mono text-chalk/70" title={formatOdds(pack)}>
              {formatOdds(pack)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setShowContents(true);
          }}
          className="mt-3 rounded-lg border border-white/15 py-2 text-xs font-bold uppercase tracking-wider text-chalk/65 transition-colors hover:border-neon/50 hover:text-neon"
        >
          ดูนักเตะในซอง ({totalPlayers} คน)
        </button>

        <button
          type="button"
          disabled={disabled || opening || !affordable}
          onClick={() => onOpen(pack.id)}
          className={cn(
            'mt-2 rounded-lg py-2.5 font-bold uppercase tracking-wide transition-colors',
            affordable ? 'bg-neon text-ink-900 hover:bg-neon-dim' : 'bg-white/10 text-chalk/40',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {opening ? 'กำลังเปิด...' : `${formatNumber(pack.price)} เหรียญ`}
        </button>

        {!affordable && <p className="mt-2 text-center text-[11px] text-chalk/40">เหรียญไม่พอ</p>}
      </article>

      {showContents && <PackContentsModal pack={pack} onClose={() => setShowContents(false)} />}
    </>
  );
};
