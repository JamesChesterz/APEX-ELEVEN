/**
 * การ์ดนักเตะ = รูปการ์ดจากโฟลเดอร์ public/players/ ล้วน ๆ
 * ไม่มีกรอบหรือข้อมูลซ้อนทับ เพราะตัวรูปการ์ดมีข้อมูลครบอยู่แล้ว
 *
 * ไฟล์รูปตั้งชื่อตาม id ของนักเตะ และใช้ได้ทั้ง .png .gif .webp .jpg
 * (เช่น public/players/p001.gif) ระบบจะไล่ลองนามสกุลให้เองจนกว่าจะเจอไฟล์จริง
 * ถ้าไม่เจอเลยจะ fallback เป็นกล่องข้อมูลย่อ เพื่อให้เห็นว่ายังขาดรูปใบไหน
 */
import { useEffect, useState, type CSSProperties, type DragEvent } from 'react';
import { getPortraitCandidates, rememberPortraitUrl } from '@/data/players';
import { getPlus, MAX_PLUS } from '@/services/upgrade';
import type { Player } from '@/types/player';
import { cn, lastName } from '@/utils/helpers';

export type PlayerCardSize = 'xs' | 'sm' | 'md' | 'lg';

interface PlayerCardProps {
  player: Player;
  size?: PlayerCardSize;
  onSelect?: (player: Player) => void;
  /** เลเวลการ์ด (1 = +0) — ใส่มาเมื่อไหร่จะขึ้นป้ายค่าตีบวกมุมบนซ้าย (ไม่ใส่ = ไม่โชว์) */
  level?: number;
  /** เปิดให้ลากการ์ดใบนี้ได้ */
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  className?: string;
  style?: CSSProperties;
}

/** ความกว้างของการ์ดแต่ละขนาด (px) — ความสูงปล่อยให้เป็นไปตามสัดส่วนของไฟล์รูป */
export const CARD_WIDTH: Record<PlayerCardSize, number> = { xs: 62, sm: 84, md: 124, lg: 176 };

export const PlayerCard = ({
  player,
  size = 'md',
  onSelect,
  level,
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
  style,
}: PlayerCardProps) => {
  const candidates = getPortraitCandidates(player);
  /** ตำแหน่งนามสกุลที่กำลังลองอยู่ — เกินความยาวรายการ = ไม่มีไฟล์รูปเลย */
  const [attempt, setAttempt] = useState(0);
  const width = CARD_WIDTH[size];

  // เปลี่ยนนักเตะในการ์ดใบเดิม (เช่นสลับตัว) ต้องเริ่มไล่นามสกุลใหม่
  useEffect(() => setAttempt(0), [player.id]);

  const source = candidates[attempt];

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(player)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.(player);
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={`${player.name} · ${player.position} · OVR ${player.ovr}`}
      style={{ width, ...style }}
      className={cn(
        'relative select-none transition-transform duration-150',
        onSelect && 'cursor-pointer hover:-translate-y-1',
        draggable && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      {/* ป้ายค่าตีบวก แสดงเฉพาะการ์ดที่ตีบวกแล้ว เพื่อไม่ให้รกการ์ดปกติ */}
      {level !== undefined && getPlus(level) > 0 && (
        <span
          className={cn(
            'absolute left-0 top-0 z-10 overflow-hidden rounded-br-md rounded-tl-md font-display leading-none text-ink-900 shadow-card',
            size === 'xs' ? 'text-[10px]' : 'text-xs',
            // ตีบวกจนสุดใช้สีทองให้เห็นชัดว่าเป็นใบท็อป
            getPlus(level) >= MAX_PLUS
              ? 'animate-max-glow bg-gold p-[2px] shadow-[0_0_10px_rgba(245,185,62,0.85)]'
              : 'bg-kit px-1.5 py-0.5',
          )}
        >
          {/*
            ป้าย +8 มีแสงทองวิ่งวนรอบกรอบของตัวป้ายเอง
            เลเยอร์ conic-gradient หมุนอยู่ข้างหลัง แล้วพื้นทึบทับตรงกลางไว้
            เหลือให้เห็นเฉพาะขอบ 2px = แสงวิ่งรอบเลข
          */}
          {getPlus(level) >= MAX_PLUS ? (
            <>
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-[260%] w-[260%] animate-max-halo bg-[conic-gradient(from_0deg,transparent_0deg,transparent_200deg,rgba(255,243,196,0.35)_250deg,#FFF3C4_310deg,#FFFFFF_335deg,#FFF3C4_350deg,transparent_360deg)]"
              />
              <span className="relative block rounded-[3px] bg-gold px-1.5 py-0.5">
                +{getPlus(level)}
              </span>
            </>
          ) : (
            <>+{getPlus(level)}</>
          )}
        </span>
      )}

      {!source ? (
        // ไม่มีไฟล์รูปในทุกนามสกุล: แสดงข้อมูลย่อแทนเพื่อไม่ให้เลย์เอาต์พัง
        <div className="flex aspect-square flex-col items-center justify-center rounded-lg border border-white/15 bg-ink-700 text-center">
          <span className="font-display text-[1.4em] leading-none">{player.ovr}</span>
          <span className="font-mono text-[9px] text-chalk/50">{player.position}</span>
          <span className="mt-1 max-w-full truncate px-1 text-[10px] font-semibold">
            {lastName(player.name)}
          </span>
        </div>
      ) : (
        <img
          // key ผูกกับ src เพื่อบังคับให้ browser เริ่มโหลดใหม่ทุกครั้งที่เปลี่ยนนามสกุล
          key={source}
          src={source}
          alt={`${player.name} ${player.position} OVR ${player.ovr}`}
          draggable={false}
          loading="lazy"
          onLoad={() => rememberPortraitUrl(player.id, source)}
          onError={() => setAttempt((current) => current + 1)}
          className="block h-auto w-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
        />
      )}
    </div>
  );
};
