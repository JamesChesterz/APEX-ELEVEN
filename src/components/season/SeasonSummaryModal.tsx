/**
 * หน้าจอสรุปปลายซีซัน — ขึ้นเองเมื่อหมดเวลา และต้องกดรับก่อนถึงจะเล่นต่อได้
 * แสดงระดับที่จบ อันดับสุดท้าย รางวัล (เหรียญ/แต้ม/การ์ด) และคะแนนที่จะยกไปซีซันใหม่
 *
 * การ์ดรางวัล: จบอันดับ 1–10 ได้ใบที่เจ้าของโปรเจคกำหนดไว้ของอันดับนั้น
 * อันดับ 11 ลงไปได้แพ็คสุ่ม 10 ใบเท่ากันทุกคน
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { ChampionTitle, RankBadge } from '@/components/rank/RankBadge';
import { REWARD_RANKS } from '@/data/rankRewards';
import { CARRY_OVER, type SeasonSummary } from '@/services/season';
import { formatNumber } from '@/utils/helpers';

interface SeasonSummaryModalProps {
  summary: SeasonSummary;
  onClaim: () => void;
}

export const SeasonSummaryModal = ({ summary, onClaim }: SeasonSummaryModalProps) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
    <div className="glass-panel w-full max-w-md p-6 text-center">
      <p className="eyebrow">จบซีซันแล้ว</p>
      <h2 className="mt-1 font-display text-4xl uppercase leading-none">ซีซัน {summary.number}</h2>

      <div className="mt-5 flex flex-col items-center gap-2">
        <RankBadge tier={summary.tier} size="md" />
        {summary.wasChampion && <ChampionTitle size="md" />}
        <p className="font-mono text-sm text-chalk/60">
          จบอันดับ {summary.rank} · {formatNumber(summary.record.points)} คะแนน
        </p>
        <p className="font-mono text-xs text-chalk/45">
          {summary.record.wins} ชนะ · {summary.record.draws} เสมอ · {summary.record.losses} แพ้
        </p>
      </div>

      {/* รางวัล */}
      <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-ink-700/50 p-4 text-left">
        <p className="eyebrow">รางวัลปลายซีซัน</p>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-chalk/55">เหรียญ</span>
          <span className="font-display text-xl text-gold">
            +{formatNumber(summary.reward.coins)}
          </span>
        </p>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-chalk/55">แต้ม</span>
          <span className="font-display text-xl text-token">
            +{formatNumber(summary.reward.points)}
          </span>
        </p>
        {summary.wasChampion && (
          <p className="pt-1 text-xs text-gold">★ รวมโบนัสพิเศษของผู้จบซีซันในอันดับ 1 แล้ว</p>
        )}
      </div>

      {/* ── การ์ดรางวัลตามอันดับ ── */}
      <div className="mt-3 rounded-xl border border-white/10 bg-ink-700/50 p-4">
        <p className="eyebrow text-left">
          {summary.cardReward.featured
            ? `การ์ดรางวัลของอันดับ ${summary.rank}`
            : `แพ็คสุ่ม ${summary.cardReward.cards.length} ใบ (ไม่ติดอันดับ 1–${REWARD_RANKS})`}
        </p>

        <div
          className={
            summary.cardReward.featured
              ? 'mt-3 flex justify-center'
              : 'mt-3 grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto'
          }
        >
          {summary.cardReward.players.map((player, index) => (
            <div key={`${player.id}-${index}`} className="flex justify-center">
              <PlayerCard
                player={player}
                size={summary.cardReward.featured ? 'md' : 'xs'}
                className={
                  summary.cardReward.featured
                    ? 'drop-shadow-[0_0_20px_rgba(240,190,90,0.5)]'
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        {summary.cardReward.featured && summary.cardReward.players[0] && (
          <p className="mt-2 font-display text-lg leading-none text-gold">
            {summary.cardReward.players[0].name}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-chalk/45">
        ซีซัน {summary.number + 1} เริ่มทันทีที่กดรับ · คะแนนยกไป {Math.round(CARRY_OVER * 100)}% (
        {formatNumber(summary.nextRecord.points)} คะแนน) ส่วนสถิติแพ้-ชนะเริ่มนับใหม่
      </p>

      <button
        type="button"
        onClick={onClaim}
        className="mt-5 w-full rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim"
      >
        รับรางวัลและเริ่มซีซันใหม่
      </button>
    </div>
  </div>
);
