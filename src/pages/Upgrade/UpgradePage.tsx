/**
 * PHASE 13.5 — เมนู UPGRADE
 *
 * ซ้าย: คลังการ์ดของผู้เล่น (เรียงตามค่าบวกและ OVR)
 * ขวา: หน้าตีบวกของการ์ดที่เลือกอยู่
 *
 * ทั้งหน้าไม่มีตัวเลขที่เขียนตายตัวเลย — ทุกอย่างมาจาก Attribute Engine
 * และตารางตีบวกกลาง (src/data/upgradeConfig.ts)
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { UpgradeCardPanel } from '@/components/upgrade/UpgradeCardPanel';
import { usePlayers } from '@/hooks/usePlayers';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import { MAX_PLUS } from '@/services/upgrade';
import { cn } from '@/utils/helpers';

export const UpgradePage = () => {
  const { ownedCards, getCard } = usePlayers();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = selectedId ? getCard(selectedId) ?? null : sorted[0]?.card ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl">ตีบวกนักเตะ</h2>
        <p className="text-sm text-chalk/50">
          ตีบวกได้ถึง +{MAX_PLUS} · ค่าพลังที่เพิ่มมีผลกับ Team OVR และผลการแข่งจริง
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── คลังการ์ด ── */}
        <section className="glass-panel p-4">
          <p className="panel-title">คลังการ์ด ({sorted.length})</p>

          {sorted.length === 0 ? (
            <p className="mt-4 text-sm text-chalk/45">ยังไม่มีการ์ดในคลัง ลองเปิดซองก่อน</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {sorted.map(({ card, player }) => {
                const upgrade = getCardUpgrade(card);
                const active = selected?.id === card.id;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setSelectedId(card.id);
                    }}
                    className={cn(
                      'rounded-lg border p-1 transition-colors',
                      active ? 'border-neon bg-neon/10' : 'border-transparent hover:bg-white/5',
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

        {/* ── หน้าตีบวก ── */}
        <UpgradeCardPanel card={selected} />
      </div>
    </div>
  );
};
