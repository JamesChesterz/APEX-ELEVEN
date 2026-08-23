/**
 * ร้านแลกนักเตะด้วยแต้ม (แต้มได้มาจากการย่อยการ์ดที่หน้า My Cards)
 *
 * กติการาคาข้อเดียวจบ: ราคาแลก = แต้มที่ได้จากการย่อยการ์ดใบนั้น × EXCHANGE_RATE
 * ตั้งไว้แบบนี้เพราะทำให้ "ย่อยแล้วซื้อคืน" ขาดทุนเสมอ ผู้เล่นจึงหมุนแต้มวนไม่รู้จบไม่ได้
 * (ถ้าเรตต่ำกว่า 1 จะเกิดช่องโหว่ทันที — อย่าปรับลงต่ำกว่า 1 เด็ดขาด)
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { PLAYERS } from '@/data/players';
import { getSalvageValue } from '@/services/salvage';
import type { Player, Rarity } from '@/types/player';

/** ราคาแลกเป็นกี่เท่าของแต้มที่ได้จากการย่อย */
export const EXCHANGE_RATE = 10;

/** ปัดราคาให้ลงท้ายสวย ๆ ทีละ 50 แต้ม */
const ROUND_TO = 50;

/** ราคาแลกของนักเตะหนึ่งคน (หน่วยเป็นแต้ม) */
export const getExchangePrice = (player: Player): number =>
  Math.round((getSalvageValue(player) * EXCHANGE_RATE) / ROUND_TO) * ROUND_TO;

/**
 * รายชื่อนักเตะทั้งหมดที่เปิดให้แลก
 * ตอนนี้คือ pool ทั้งเกม เรียงจากแพงไปถูก
 * ถ้าอยากทำเป็นร้านหมุนเวียนรายวัน ให้กรองที่ฟังก์ชันนี้ที่เดียว
 */
export const getExchangeCatalogue = (): Player[] =>
  [...PLAYERS].sort(
    (a, b) => getExchangePrice(b) - getExchangePrice(a) || b.ovr - a.ovr,
  );

/** แท็บกรองตามระดับการ์ดในหน้าร้าน */
export const RARITY_TABS: Array<{ key: Rarity | 'all'; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'mythical', label: 'Mythical' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'epic', label: 'Epic' },
  { key: 'rare', label: 'Rare' },
  { key: 'common', label: 'Common' },
];
