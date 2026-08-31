/**
 * หน้าต่างรายละเอียดการ์ดหนึ่งใบ + ระบบตีบวกนักเตะ
 *
 * มีสองทางให้ตีบวก:
 *   - รวมร่างการ์ดซ้ำ (ฟรี, ติดแน่นอน) — แนะนำเป็นทางหลัก เพราะการ์ดซ้ำลงตัวจริงพร้อมกันไม่ได้อยู่แล้ว
 *   - จ่ายแต้มตีบวก — มีโอกาสล้มเหลว (+1 100% → +5 30%) ล้มเหลวแล้วเสียแต้มแต่ค่าบวกไม่ลด
 */
import { useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { usePlayers, type CardActionResult, type OwnedPlayerCard } from '@/hooks/usePlayers';
import { getSalvageValue } from '@/services/salvage';
import { playSfx } from '@/services/sound';
import {
  canLevelUp,
  getLevelBonus,
  getLeveledOvr,
  getPlus,
  getRemainingUpgradeCost,
  getUpgradeChance,
  getUpgradeCost,
  MAX_LEVEL,
  MAX_PLUS,
  OVR_PER_LEVEL,
} from '@/services/upgrade';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

interface CardDetailModalProps {
  entry: OwnedPlayerCard | null;
  /** true = การ์ดใบนี้อยู่ใน 11 ตัวจริง */
  inSquad: boolean;
  onClose: () => void;
}

/** แถวข้อมูลหนึ่งบรรทัดในกล่องสรุป */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <p className="flex items-baseline justify-between gap-3 text-sm">
    <span className="text-chalk/55">{label}</span>
    <span className="font-mono">{children}</span>
  </p>
);

export const CardDetailModal = ({ entry, inSquad, onClose }: CardDetailModalProps) => {
  const { ownedCards, upgradePoints, upgradeCard, mergeCard } = usePlayers();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!entry) return null;

  /*
   * เอาใบล่าสุดจากคลังมาใช้เสมอ ไม่ใช้ของที่ส่งมาตอนกดเปิด
   *
   * entry เป็น "ภาพนิ่ง" ณ วินาทีที่กดเปิดหน้าต่าง พอตีบวกหรือรวมร่างสำเร็จ
   * คลังการ์ดอัปเดตแล้วแต่ตัวแปรนี้ยังชี้ไปที่ข้อมูลชุดเดิม ทุกอย่างบนจอเลยค้าง
   * ทั้งเลข +N, ค่าพลัง, ราคาขั้นถัดไป และโอกาสสำเร็จ
   *
   * หาใหม่จาก ownedCards ด้วย id ทุกครั้งที่วาด จึงสดเสมอ
   * (ถ้าหาไม่เจอ เช่นใบถูกใช้รวมร่างไปแล้ว ก็ถอยไปใช้ของเดิมกันจอพัง)
   */
  const live = ownedCards.find((other) => other.card.id === entry.card.id) ?? entry;

  const { card, player } = live;
  const level = card.level;
  const plus = getPlus(level);
  const bonus = getLevelBonus(level);
  const cost = getUpgradeCost(level);
  const chance = getUpgradeChance(level);
  const maxed = !canLevelUp(level);

  /** การ์ดซ้ำของนักเตะคนเดียวกันที่เอามารวมร่างได้ (ไม่นับใบนี้ และไม่เอาใบที่ลงสนามอยู่) */
  const duplicates = ownedCards.filter(
    (other) => other.player.id === player.id && other.card.id !== card.id,
  );

  /** แปลงผลของ upgradeCard/mergeCard เป็นข้อความบนหน้าจอ */
  const handle = (result: CardActionResult) => {
    if (!result.ok) {
      setMessage(null);
      setError(result.reason ?? 'ทำรายการไม่สำเร็จ');
      return;
    }

    if (result.success) {
      setError(null);
      playSfx('levelUp');
      setMessage(`ตีบวกติด! ตอนนี้ +${result.plus} · ค่าพลัง +${OVR_PER_LEVEL}`);
    } else {
      playSfx('error');
      // ล้มเหลว: เสียแต้มแต่การ์ดยังอยู่ที่ค่าบวกเดิม
      setMessage(null);
      setError(
        `ตีบวกไม่ติด — เสีย ${formatNumber(result.cost ?? 0)} แต้มตีบวก ค่าบวกยังเป็น +${result.plus} เท่าเดิม`,
      );
    }
  };

  return (
    <Modal
      open
      title={player.name}
      subtitle={`${player.position} · ${player.club} · ${RARITY_STYLE[player.rarity].label}`}
      onClose={onClose}
    >
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto">
          <PlayerCard player={player} size="lg" level={level} />
        </div>

        <div className="space-y-3">
          {/* สรุปค่าพลังปัจจุบัน */}
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-ink-700/50 p-4">
            <Row label="ค่าตีบวก">
              <span className={cn('text-base', plus >= MAX_PLUS ? 'text-gold' : 'text-kit')}>
                +{plus} / +{MAX_PLUS}
              </span>
            </Row>
            <Row label="ค่าพลังรวม">
              <span className="text-base">
                {getLeveledOvr(player, level)}
                {bonus > 0 && <span className="ml-1.5 text-[11px] text-neon">(+{bonus})</span>}
              </span>
            </Row>
            <Row label={`ถ้าตีบวกถึง +${MAX_PLUS}`}>
              {maxed ? (
                <span className="text-gold">เต็มแล้ว</span>
              ) : (
                <span className="text-chalk/60">
                  OVR {getLeveledOvr(player, MAX_LEVEL)} · ใช้อีกอย่างน้อย{' '}
                  {formatNumber(getRemainingUpgradeCost(level))} แต้มตีบวก
                </span>
              )}
            </Row>
            <Row label="ย่อยได้">
              <span className="text-token">
                {formatNumber(getSalvageValue(player, level))} แต้มแลกนักเตะ
              </span>
            </Row>
          </div>

          {/* ค่าพลัง 6 ด้าน */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['PAC', player.stats.pace],
                ['SHO', player.stats.shooting],
                ['PAS', player.stats.passing],
                ['DRI', player.stats.dribbling],
                ['DEF', player.stats.defending],
                ['PHY', player.stats.physical],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-ink-700/40 px-2 py-1.5 text-center">
                <p className="eyebrow">{label}</p>
                <p className="font-display text-lg leading-none">{Math.min(99, value + bonus)}</p>
              </div>
            ))}
          </div>

          {message && (
            <p className="rounded-lg border border-neon/40 bg-neon/10 px-3 py-2 text-sm text-neon">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-gem/40 bg-gem/10 px-3 py-2 text-sm text-gem">
              {error}
            </p>
          )}

          {inSquad && (
            <p className="text-xs text-chalk/45">
              การ์ดใบนี้อยู่ใน 11 ตัวจริง — ตีบวกได้ตามปกติ ค่าพลังทีมจะขยับขึ้นทันทีที่ตีบวกติด
            </p>
          )}

          {/* ── ทางที่ 1: รวมร่างการ์ดซ้ำ ── */}
          {!maxed && (
            <section className="space-y-2">
              <p className="eyebrow">รวมร่างการ์ดซ้ำ (ฟรี · ติดแน่นอน 100%)</p>

              {duplicates.length === 0 ? (
                <p className="text-xs text-chalk/45">
                  ยังไม่มีการ์ดของนักเตะคนนี้ใบที่สอง — ถ้าเปิดซองได้ซ้ำเมื่อไหร่ เอามาอัปที่นี่ได้เลย
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {duplicates.map((duplicate) => (
                    <li
                      key={duplicate.card.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-ink-700/50 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        การ์ดใบซ้ำ
                        <span className="ml-2 font-mono text-[10px] text-chalk/45">
                          +{getPlus(duplicate.card.level)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handle(mergeCard(card.id, duplicate.card.id))}
                        className="shrink-0 rounded-lg bg-kit px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
                      >
                        ใช้รวมร่าง +1
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── ทางที่ 2: จ่ายแต้มตีบวก (มีโอกาสล้มเหลว) ── */}
          {!maxed && cost !== null && chance !== null && (
            <section className="space-y-2">
              <p className="eyebrow">ตีบวกด้วยแต้มตีบวก</p>

              <div className="flex items-baseline justify-between rounded-lg bg-ink-700/50 px-3 py-2 text-sm">
                <span className="text-chalk/55">โอกาสสำเร็จ</span>
                <span
                  className={cn(
                    'font-display text-xl',
                    chance >= 0.8 ? 'text-neon' : chance >= 0.6 ? 'text-kit' : 'text-gem',
                  )}
                >
                  {Math.round(chance * 100)}%
                </span>
              </div>

              <button
                type="button"
                disabled={upgradePoints < cost}
                onClick={() => handle(upgradeCard({ cardId: card.id }))}
                className={cn(
                  'w-full rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                  upgradePoints >= cost
                    ? 'bg-kit text-ink-900 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/5 text-chalk/35',
                )}
              >
                ตีบวกเป็น +{plus + 1} · {formatNumber(cost)} แต้มตีบวก
              </button>

              <p className="text-center text-[10px] text-chalk/40">
                ล้มเหลว = เสียแต้ม แต่ค่าบวกเดิมไม่ลดและการ์ดไม่หาย
              </p>
              <p className="text-center font-mono text-[10px] text-chalk/40">
                แต้มตีบวกคงเหลือ {formatNumber(upgradePoints)}
              </p>
            </section>
          )}

          {maxed && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-center text-sm text-gold">
              ★ การ์ดใบนี้ตีบวกถึง +{MAX_PLUS} แล้ว
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
