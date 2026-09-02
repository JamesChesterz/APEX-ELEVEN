/**
 * ร้านไอเทมช่วยอัปเกรด (ฝั่งผู้เล่น)
 *
 * ราคา ช่องทางจ่าย และการเปิด/ปิด มาจาก ADMIN → ร้านไอเทม (config/upgradeItemShop)
 * ไฟล์นี้ไม่มีตัวเลขของตัวเองเลย — ตั้งค่าที่แอดมินที่เดียวแล้วหน้านี้เห็นทันที
 *
 * แต้มตีบวกเคยเป็นค่าอัปเกรดโดยตรง พอเปลี่ยนมาใช้การ์ดนักเตะแล้ว
 * แต้มที่ผู้เล่นสะสมไว้จะไม่มีที่ใช้ จึงย้ายมาเป็นสกุลเงินหลักของร้านนี้แทน
 */
import { Modal } from '@/components/layout/Modal';
import { getUpgradeItem } from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { cn, formatNumber } from '@/utils/helpers';

interface UpgradeItemShopProps {
  open: boolean;
  onClose: () => void;
}

export const UpgradeItemShop = ({ open, onClose }: UpgradeItemShopProps) => {
  const { coins, upgradePoints, upgradeItems, buyUpgradeItem } = usePlayers();
  const { itemShop } = useGameConfig();

  const onSale = itemShop.offers.filter((offer) => offer.enabled);

  return (
    <Modal
      open={open}
      title="ร้านไอเทมช่วยอัปเกรด"
      subtitle={`แต้มตีบวก ${formatNumber(upgradePoints)} · BP ${formatNumber(coins)}`}
      onClose={onClose}
    >
      <div className="space-y-3 p-4">
        {!itemShop.enabled || onSale.length === 0 ? (
          <p className="py-8 text-center text-sm text-chalk/45">
            ตอนนี้ร้านปิดอยู่ — ไอเทมที่มีในคลังยังใช้ได้ตามปกติ
          </p>
        ) : (
          onSale.map((offer) => {
            const item = getUpgradeItem(offer.id);
            const bundle = Math.max(1, offer.bundle);
            const pointTotal = offer.price * bundle;
            const coinTotal = offer.coinPrice * bundle;

            return (
              <div
                key={offer.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3"
              >
                <img
                  src={item.icon}
                  alt=""
                  className={cn('h-[78px] w-auto shrink-0 object-contain', item.glow)}
                />

                <div className="min-w-[160px] flex-1">
                  <p className={cn('font-display text-sm', item.text)}>
                    {item.name}
                    {bundle > 1 && <span className="ml-1.5 text-chalk/50">×{bundle}</span>}
                  </p>
                  <p className="text-[11px] leading-snug text-chalk/50">{item.hint}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-chalk/40">
                    มีอยู่ {formatNumber(upgradeItems[offer.id])} ชิ้น
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {/* ราคา 0 = แอดมินปิดช่องทางจ่ายนั้น จึงไม่ต้องแสดงปุ่ม */}
                  {pointTotal > 0 && (
                    <button
                      type="button"
                      disabled={upgradePoints < pointTotal}
                      onClick={() =>
                        buyUpgradeItem({
                          id: offer.id,
                          quantity: bundle,
                          currency: 'points',
                          unitPrice: offer.price,
                        })
                      }
                      className={cn(
                        'rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors',
                        upgradePoints >= pointTotal
                          ? 'bg-kit/90 text-ink-900 hover:brightness-110'
                          : 'cursor-not-allowed bg-white/5 text-chalk/30',
                      )}
                    >
                      ซื้อ
                      <span className="block font-mono text-[10px]">
                        {formatNumber(pointTotal)} แต้ม
                      </span>
                    </button>
                  )}

                  {coinTotal > 0 && (
                    <button
                      type="button"
                      disabled={coins < coinTotal}
                      onClick={() =>
                        buyUpgradeItem({
                          id: offer.id,
                          quantity: bundle,
                          currency: 'coins',
                          unitPrice: offer.coinPrice,
                        })
                      }
                      className={cn(
                        'rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors',
                        coins >= coinTotal
                          ? 'bg-gold/90 text-ink-900 hover:brightness-110'
                          : 'cursor-not-allowed bg-white/5 text-chalk/30',
                      )}
                    >
                      ซื้อ
                      <span className="block font-mono text-[10px]">
                        {formatNumber(coinTotal)} BP
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        <p className="text-center text-[11px] text-chalk/40">
          แต้มตีบวกยังได้จากลีกประจำวัน ภารกิจ และการชนะ Matchmaking เหมือนเดิม
        </p>
      </div>
    </Modal>
  );
};
