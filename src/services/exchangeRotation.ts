/**
 * ร้านแลกนักเตะแบบหมุนเวียน
 *
 * ของในร้านเปลี่ยนทุก 3 ชั่วโมง สุ่มมาระดับละไม่เกิน 5 ใบ
 * ทุกคนเห็นชุดเดียวกันโดยไม่ต้องถามเซิร์ฟเวอร์ เพราะ seed คิดจาก "ช่วงเวลา"
 * ไม่ใช่จาก Math.random — เปิดกี่เครื่องก็ได้ชุดเดิม และรู้ล่วงหน้าได้ว่ารอบหน้าจะมีใคร
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { PLAYERS } from '@/data/players';
import { getExchangePrice } from '@/services/exchange';
import type { Player, Rarity } from '@/types/player';
import { seededShuffle } from '@/utils/seededRandom';

/** ร้านเปลี่ยนของทุกกี่ชั่วโมง */
export const ROTATION_HOURS = 3;

const ROTATION_MS = ROTATION_HOURS * 60 * 60 * 1000;

/** แต่ละระดับมีให้แลกได้มากสุดกี่ใบต่อรอบ */
export const PER_RARITY_LIMIT = 5;

/** ระดับที่เข้าร้าน — เรียงจากหายากไปหาง่าย ใช้เป็นลำดับแสดงผลด้วย */
export const ROTATION_RARITIES: Rarity[] = ['mythical', 'legendary', 'epic', 'rare', 'common'];

/**
 * เลขรอบของเวลาหนึ่ง — นับจาก epoch หารด้วยความยาวรอบ
 * ทุกเครื่องทั่วโลกจึงได้เลขเดียวกัน ไม่ขึ้นกับ timezone
 */
export const getRotationIndex = (now: Date = new Date()): number =>
  Math.floor(now.getTime() / ROTATION_MS);

/** เวลาที่รอบนี้จะหมด (= เวลาที่ของชุดใหม่จะมา) */
export const getRotationEnd = (now: Date = new Date()): Date =>
  new Date((getRotationIndex(now) + 1) * ROTATION_MS);

/** เหลืออีกกี่วินาทีของถึงจะเปลี่ยน */
export const secondsToRotation = (now: Date = new Date()): number =>
  Math.max(0, Math.floor((getRotationEnd(now).getTime() - now.getTime()) / 1000));

/** แปลงวินาทีเป็น ช:นน:วว */
export const formatCountdown = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

/**
 * ของในร้านของรอบหนึ่ง — สุ่มระดับละไม่เกิน PER_RARITY_LIMIT ใบ
 *
 * สุ่มแยกทีละระดับ เพื่อให้ทุกระดับมีของเสมอ ไม่ใช่สุ่มรวมแล้วได้ common ล้วน
 * ผลเรียงจากราคาแพงไปถูก เหมือนร้านเดิม
 *
 * @param excluded การ์ดที่ห้ามเข้าร้าน (การ์ดรางวัลอันดับ 1–3 ของซีซัน)
 *   คัดออกก่อนสุ่ม ไม่ใช่หลังสุ่ม — ไม่งั้นรอบที่บังเอิญสุ่มติดใบต้องห้าม
 *   จะมีของน้อยกว่ารอบอื่นโดยไม่มีเหตุผล
 */
export const getRotationPlayers = (
  rotationIndex: number,
  excluded: ReadonlySet<string> = new Set(),
): Player[] =>
  ROTATION_RARITIES.flatMap((rarity) =>
    seededShuffle(
      PLAYERS.filter((player) => player.rarity === rarity && !excluded.has(player.id)),
      `exchange:${rotationIndex}:${rarity}`,
    ).slice(0, PER_RARITY_LIMIT),
  ).sort((a, b) => getExchangePrice(b) - getExchangePrice(a) || b.ovr - a.ovr);
