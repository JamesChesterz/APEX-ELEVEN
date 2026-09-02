/**
 * เมนู "อัปเกรดนักเตะ"
 *
 * โครงหน้าตามแบบที่ให้มา:
 *   หัวข้อ + ยอดสกุลเงิน → แผงอัปเกรดสามคอลัมน์ → แถบแท็บด้านล่าง
 *
 * หน้านี้ถือ state สองก้อนเท่านั้น: ใบที่กำลังอัปเกรด กับใบที่ใส่ในช่อง
 * กติกาการอัปเกรดทั้งหมดอยู่ใน UpgradeCardPanel + usePlayers ไม่ได้กระจายมาที่นี่
 *
 * ⚠️ ค่าอัปเกรดคือ "การ์ดนักเตะ" แล้ว ไม่ใช่แต้มตีบวก
 * แต้มตีบวกย้ายไปเป็นสกุลเงินของร้านไอเทม (ดู UpgradeItemShop)
 */
import { useEffect, useMemo, useState } from 'react';
import { CardPickerModal } from '@/components/upgrade/CardPickerModal';
import { UpgradeCardPanel } from '@/components/upgrade/UpgradeCardPanel';
import { UpgradeItemShop } from '@/components/upgrade/UpgradeItemShop';
import { MATERIAL_CARD_SLOTS } from '@/data/upgradeConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { getCardUpgrade, isCardLocked, isStrongEnoughMaterial } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import { MAX_PLUS } from '@/services/upgrade';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import { cn, formatNumber } from '@/utils/helpers';

/** แท็บล่างตามแบบ — ตอนนี้เปิดใช้จริงแค่แท็บแรก */
const TABS = [
  { id: 'upgrade', label: 'อัปเกรดนักเตะ', ready: true },
  { id: 'boost', label: 'เสริมพลังนักเตะ', ready: false },
  { id: 'tier', label: 'เปลี่ยนระดับ', ready: false },
  { id: 'unlock', label: 'ปลดล็อก', ready: false },
  { id: 'train', label: 'ฝึกฝน', ready: false },
];

export const UpgradePage = () => {
  const { rawCards, coins, points, upgradePoints, getCard } = usePlayers();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** id ของการ์ดที่ใส่ไว้ในช่องอัปเกรด */
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<'target' | 'material' | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [tab, setTab] = useState('upgrade');

  /** ใบที่ยังอัปเกรดได้อยู่ก่อน แล้วค่อยเรียงจากแรงไปอ่อน */
  const sorted = useMemo(
    () =>
      [...rawCards].sort((left, right) => {
        const leftMaxed = getCardUpgrade(left) >= MAX_PLUS ? 1 : 0;
        const rightMaxed = getCardUpgrade(right) >= MAX_PLUS ? 1 : 0;
        if (leftMaxed !== rightMaxed) return leftMaxed - rightMaxed;

        return getEffectivePlayerOvr(right) - getEffectivePlayerOvr(left);
      }),
    [rawCards],
  );

  /*
   * ล็อกใบที่เลือกไว้ด้วย id ตั้งแต่เข้าหน้า
   *
   * ⚠️ ถ้าปล่อยให้ fallback เป็น sorted[0] ไปเรื่อย ๆ จะมีบั๊ก:
   * พออัปเกรดติด การ์ดใบนั้นแรงขึ้น ลำดับ sorted เปลี่ยน แล้วใบที่โชว์อยู่
   * จะสลับไปเป็นการ์ดคนละใบเองทั้งที่ผู้เล่นไม่ได้กดอะไร
   */
  useEffect(() => {
    if (!selectedId && sorted.length > 0) setSelectedId(sorted[0].id);
  }, [selectedId, sorted]);

  const selected = selectedId ? (getCard(selectedId) ?? null) : null;

  /** การ์ดที่อยู่ในช่องตอนนี้ — กรองใบที่หายไปแล้วทิ้งเสมอ */
  const materialCards = materialIds
    .map((id) => getCard(id))
    .filter((entry): entry is PlayerCardData => Boolean(entry));

  /**
   * ใบไหนเอามาใส่ช่องได้บ้าง
   * ไม่ใช่ใบที่กำลังอัปเกรด · ไม่ล็อก · ไม่อยู่ในทีม · OVR ไม่ต่ำกว่าใบเป้าหมาย
   */
  const canBeMaterial = (entry: PlayerCardData): boolean => {
    if (!selected || entry.id === selected.id) return false;
    if (isCardLocked(entry) || entry.inSquad) return false;

    return isStrongEnoughMaterial(selected, entry);
  };

  const handlePick = (ids: string[]) => {
    if (picker === 'target') {
      playSfx('click');
      setSelectedId(ids[0]);
      // เปลี่ยนใบที่จะอัปเกรด = ล้างช่องทิ้ง ไม่ให้เผาการ์ดผิดใบ
      setMaterialIds([]);
      setPicker(null);
      return;
    }

    setMaterialIds((current) => [...current, ...ids].slice(0, MATERIAL_CARD_SLOTS));
    setPicker(null);
  };

  return (
    <div className="space-y-3">
      {/* ── หัวข้อ + ยอดสกุลเงิน ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl tracking-wide">อัปเกรดนักเตะ</h2>
          <span
            title={`อัปเกรดได้ถึง +${MAX_PLUS} · ใช้การ์ดนักเตะเป็นวัตถุดิบ · ไอเทมป้องกันกันขั้นลด`}
            className="grid h-5 w-5 cursor-help place-items-center rounded-full bg-white/10 text-[11px] text-chalk/60"
          >
            ?
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="flex items-center gap-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-bold text-ink-900">
              B
            </span>
            {formatNumber(coins)}
          </span>
          <span className="flex items-center gap-1.5 text-token">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-token text-[9px] font-bold text-ink-900">
              P
            </span>
            {formatNumber(points)}
          </span>
          <button
            type="button"
            onClick={() => setShopOpen(true)}
            title="แต้มตีบวก — ใช้ซื้อไอเทมช่วยอัปเกรด"
            className="flex items-center gap-1.5 text-kit transition-colors hover:brightness-125"
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-kit text-[9px] font-bold text-ink-900">
              U
            </span>
            {formatNumber(upgradePoints)}
          </button>
        </div>
      </div>

      {tab === 'upgrade' ? (
        <UpgradeCardPanel
          card={selected}
          materialCards={materialCards}
          onPickTarget={() => setPicker('target')}
          onPickMaterial={() => setPicker('material')}
          onRemoveMaterial={(cardId) =>
            setMaterialIds((current) => current.filter((id) => id !== cardId))
          }
          onClearMaterials={() => setMaterialIds([])}
          onOpenShop={() => setShopOpen(true)}
        />
      ) : (
        <section className="glass-panel grid min-h-[320px] place-items-center p-8 text-center">
          <div>
            <p className="font-display text-lg text-chalk/70">
              {TABS.find((entry) => entry.id === tab)?.label}
            </p>
            <p className="mt-1 text-sm text-chalk/40">เมนูนี้กำลังพัฒนา</p>
          </div>
        </section>
      )}

      {/* ── แท็บล่างตามแบบ ── */}
      <nav className="glass-panel flex overflow-x-auto">
        {TABS.map((entry) => {
          const active = entry.id === tab;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                playSfx('click');
                setTab(entry.id);
              }}
              className={cn(
                'relative flex-1 whitespace-nowrap px-4 py-3.5 text-sm transition-colors',
                active ? 'text-chalk' : 'text-chalk/40 hover:text-chalk/70',
              )}
            >
              {entry.label}
              {active && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-neon" />
              )}
            </button>
          );
        })}
      </nav>

      <CardPickerModal
        open={picker !== null}
        mode={picker === 'material' ? 'material' : 'target'}
        cards={sorted}
        targetId={selectedId}
        usedIds={materialIds}
        remaining={MATERIAL_CARD_SLOTS - materialIds.length}
        canUse={canBeMaterial}
        onPick={handlePick}
        onClose={() => setPicker(null)}
      />

      <UpgradeItemShop open={shopOpen} onClose={() => setShopOpen(false)} />
    </div>
  );
};
