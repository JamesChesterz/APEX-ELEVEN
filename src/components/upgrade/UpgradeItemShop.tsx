/**
 * ร้านไอเทมช่วยอัปเกรด — ซื้อด้วย "แต้มตีบวก"
 *
 * แต้มตีบวกเคยเป็นค่าอัปเกรดโดยตรง พอเปลี่ยนมาใช้การ์ดนักเตะแล้ว
 * แต้มที่ผู้เล่นสะสมไว้จะไม่มีที่ใช้ จึงย้ายมาเป็นสกุลเงินของร้านนี้แทน
 * ของเก่าไม่ถูกทิ้ง แค่เปลี่ยนหน้าที่
 */
import { Modal } from '@/components/layout/Modal';
import { Hex } from '@/components/upgrade/UpgradeShapes';
import { UPGRADE_ITEMS } from '@/data/upgradeConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { cn, formatNumber } from '@/utils/helpers';

interface UpgradeItemShopProps {
  open: boolean;
  onClose: () => void;
}

export const UpgradeItemShop = ({ open, onClose }: UpgradeItemShopProps) => {
  const { upgradePoints, upgradeItems, buyUpgradeItem } = usePlayers();

  return (
    <Modal
      open={open}
      title="ร้านไอเทมช่วยอัปเกรด"
      subtitle={`แต้มตีบวกคงเหลือ ${formatNumber(upgradePoints)}`}
      onClose={onClose}
    >
      <div className="space-y-3 p-4">
        {UPGRADE_ITEMS.map((item) => {
          const affordable = upgradePoints >= item.price;

          return (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <Hex
                width={58}
                edgeClass={item.edge}
                fillClass="bg-ink-800"
                className={item.glow}
              >
                <span className={cn('font-display text-base leading-none', item.text)}>UP</span>
              </Hex>

              <div className="min-w-0 flex-1">
                <p className={cn('font-display text-sm', item.text)}>{item.name}</p>
                <p className="text-[11px] leading-snug text-chalk/50">{item.hint}</p>
                <p className="mt-0.5 font-mono text-[11px] text-chalk/40">
                  มีอยู่ {formatNumber(upgradeItems[item.id])} ชิ้น
                </p>
              </div>

              <button
                type="button"
                disabled={!affordable}
                onClick={() => buyUpgradeItem(item.id, 1)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors',
                  affordable
                    ? 'bg-kit/90 text-ink-900 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/5 text-chalk/30',
                )}
              >
                ซื้อ
                <span className="block font-mono text-[10px]">{formatNumber(item.price)} แต้ม</span>
              </button>
            </div>
          );
        })}

        <p className="text-center text-[11px] text-chalk/40">
          แต้มตีบวกยังได้จากลีกประจำวัน ภารกิจ และการชนะ Matchmaking เหมือนเดิม
        </p>
      </div>
    </Modal>
  );
};
