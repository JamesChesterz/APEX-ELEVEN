/**
 * เมนู UPGRADE (PHASE 13.5)
 *
 * บน   : หน้าตีบวกของการ์ดที่เลือกอยู่ (สามคอลัมน์ตามแบบ)
 * ล่าง : คลังการ์ด — ใช้ทั้งเลือกใบที่จะตี และเลือกใบที่จะเอามาช่วย
 *
 * โหมดเลือกการ์ดช่วยเปิดจากการกด + ตรงกลางหน้าตีบวก
 * คลังด้านล่างจะเปลี่ยนเป็นโหมดเลือกของช่วยจนกว่าจะเลือกเสร็จหรือกดยกเลิก
 */
import { useEffect, useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { UpgradeCardPanel } from '@/components/upgrade/UpgradeCardPanel';
import { MATERIAL_CARD_SLOTS } from '@/data/upgradeConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import { MAX_PLUS } from '@/services/upgrade';
import { cn } from '@/utils/helpers';

export const UpgradePage = () => {
  const { ownedCards, getCard } = usePlayers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** id ของการ์ดที่ใส่ไว้ในช่องช่วย */
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  /** true = คลังด้านล่างกำลังอยู่ในโหมดเลือกการ์ดช่วย */
  const [picking, setPicking] = useState(false);

  /** ใบที่ตีบวกได้อยู่ก่อน แล้วค่อยเรียงจากแรงไปอ่อน */
  const sorted = useMemo(
    () =>
      [...ownedCards].sort((left, right) => {
        const leftMaxed = getCardUpgrade(left.card) >= MAX_PLUS ? 1 : 0;
        const rightMaxed = getCardUpgrade(right.card) >= MAX_PLUS ? 1 : 0;
        if (leftMaxed !== rightMaxed) return leftMaxed - rightMaxed;

        return getEffectivePlayerOvr(right.card) - getEffectivePlayerOvr(left.card);
      }),
    [ownedCards],
  );

  /*
   * ล็อกใบที่เลือกไว้ด้วย id ตั้งแต่เข้าหน้า
   *
   * ⚠️ ถ้าปล่อยให้ fallback เป็น sorted[0] ไปเรื่อย ๆ จะมีบั๊ก:
   * พอตีบวกติด การ์ดใบนั้นแรงขึ้น ลำดับ sorted เปลี่ยน แล้วใบที่โชว์อยู่
   * จะสลับไปเป็นการ์ดคนละใบเองทั้งที่ผู้เล่นไม่ได้กดอะไร
   */
  useEffect(() => {
    if (!selectedId && sorted.length > 0) setSelectedId(sorted[0].card.id);
  }, [selectedId, sorted]);

  const selected = selectedId ? getCard(selectedId) ?? null : sorted[0]?.card ?? null;

  /** การ์ดที่อยู่ในช่องช่วยตอนนี้ — กรองใบที่หายไปแล้วทิ้งเสมอ */
  const materialCards = materialIds
    .map((id) => getCard(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  /** ใบไหนเอามาช่วยได้บ้าง: ไม่ใช่ใบที่กำลังตี ไม่ล็อก ไม่อยู่ในทีม ยังไม่ถูกเลือก */
  const canBeMaterial = (cardId: string): boolean => {
    const found = getCard(cardId);
    if (!found || found.id === selected?.id) return false;
    return !isCardLocked(found) && !found.inSquad && !materialIds.includes(cardId);
  };

  const pickCard = (cardId: string) => {
    playSfx('click');

    if (!picking) {
      setSelectedId(cardId);
      // เปลี่ยนใบที่จะตี = ล้างของช่วยทิ้ง ไม่ให้เผาการ์ดผิดใบ
      setMaterialIds([]);
      return;
    }

    if (!canBeMaterial(cardId)) {
      playSfx('error');
      return;
    }

    const next = [...materialIds, cardId].slice(0, MATERIAL_CARD_SLOTS);
    setMaterialIds(next);
    if (next.length >= MATERIAL_CARD_SLOTS) setPicking(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl">ตีบวกนักเตะ</h2>
        <p className="text-sm text-chalk/50">
          ตีบวกได้ถึง +{MAX_PLUS} · ใส่การ์ดช่วยเพิ่มโอกาสติด · ติดการ์ดป้องกันกันค่าบวกลด
        </p>
      </div>

      <UpgradeCardPanel
        card={selected}
        materialCards={materialCards}
        onPickMaterial={() => setPicking(true)}
        onRemoveMaterial={(cardId) =>
          setMaterialIds((current) => current.filter((id) => id !== cardId))
        }
        onClearMaterials={() => setMaterialIds([])}
      />

      <section className="glass-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="panel-title">
            {picking ? 'เลือกการ์ดมาช่วยตีบวก' : `คลังการ์ด (${sorted.length})`}
          </p>

          {picking && (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setPicking(false);
              }}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-xs uppercase text-chalk/60 hover:bg-white/10"
            >
              ยกเลิก
            </button>
          )}
        </div>

        {picking && (
          <p className="mt-1 text-xs text-chalk/45">
            ใบที่ล็อกไว้หรืออยู่ในทีมตัวจริงเลือกไม่ได้ · เลือกได้อีก{' '}
            {MATERIAL_CARD_SLOTS - materialIds.length} ใบ
          </p>
        )}

        {sorted.length === 0 ? (
          <p className="mt-4 text-sm text-chalk/45">ยังไม่มีการ์ดในคลัง ลองเปิดซองก่อน</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {sorted.map(({ card, player }) => {
              const upgrade = getCardUpgrade(card);
              const active = !picking && selected?.id === card.id;
              const inMaterials = materialIds.includes(card.id);
              const disabled = picking && !canBeMaterial(card.id);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => pickCard(card.id)}
                  disabled={disabled}
                  className={cn(
                    'rounded-lg border p-1 transition-colors',
                    active
                      ? 'border-neon bg-neon/10'
                      : inMaterials
                        ? 'border-gold bg-gold/10'
                        : 'border-transparent hover:bg-white/5',
                    disabled && 'cursor-not-allowed opacity-30',
                  )}
                  title={`${player.name} +${upgrade}${isCardLocked(card) ? ' (ล็อกอยู่)' : ''}`}
                >
                  <PlayerCard player={player} size="sm" level={card.level} />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
