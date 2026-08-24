/**
 * แจ้งเตือน "ได้รับของจากผู้ดูแล" — เด้งมุมขวาบนตอนของเข้าบัญชีเรียบร้อยแล้ว
 * ของถูกเพิ่มเข้าคลังไปก่อนหน้านี้แล้ว (ดู hooks/useGifts.tsx) ตัวนี้แค่บอกให้รู้
 */
import { useEffect } from 'react';
import { getPlayerById } from '@/data/players';
import { useGifts } from '@/hooks/useGifts';
import { formatNumber } from '@/utils/helpers';

/** ปิดเองหลังกี่มิลลิวินาที */
const AUTO_HIDE_MS = 12_000;

export const GiftNotice = () => {
  const { received, clearNotices } = useGifts();

  useEffect(() => {
    if (received.length === 0) return undefined;
    const timer = window.setTimeout(clearNotices, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [clearNotices, received]);

  if (received.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-[65] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2">
      {received.map((gift) => {
        const cards = (gift.cardPlayerIds ?? [])
          .map((playerId) => getPlayerById(playerId))
          .filter((player): player is NonNullable<typeof player> => Boolean(player));

        return (
          <button
            key={gift.id}
            type="button"
            onClick={clearNotices}
            className="pointer-events-auto rounded-xl border border-gold/40 bg-ink-800/95 p-3 text-left shadow-lg backdrop-blur"
          >
            <p className="eyebrow text-gold">🎁 ได้รับของจากผู้ดูแล</p>

            <ul className="mt-1.5 space-y-0.5 font-mono text-[11px]">
              {gift.coins > 0 && <li className="text-gold">+{formatNumber(gift.coins)} เหรียญ</li>}
              {gift.points > 0 && <li className="text-token">+{formatNumber(gift.points)} แต้มแลกนักเตะ</li>}
              {gift.upgradePoints > 0 && (
                <li className="text-kit">+{formatNumber(gift.upgradePoints)} แต้มตีบวก</li>
              )}
              {cards.length > 0 && (
                <li className="text-neon">
                  +{cards.length} การ์ด · {cards.map((player) => player.name).join(', ')}
                </li>
              )}
            </ul>

            {gift.note?.trim() && (
              <p className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-chalk/60">
                “{gift.note}”
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
};
