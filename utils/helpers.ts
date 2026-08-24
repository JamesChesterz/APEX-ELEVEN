/**
 * ฟังก์ชันช่วยเหลือทั่วไปที่ใช้ซ้ำได้ทั้งโปรเจกต์ (pure function เท่านั้น)
 */
import type { Position, Rarity } from '@/types/player';

/** รวม className แบบปลอดภัย ใช้แทน clsx สำหรับเคสง่าย ๆ */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

/** บีบค่าให้อยู่ในช่วง min–max */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** ปัดค่าเป็นจำนวนเต็มแบบปลอดภัย (กัน NaN) */
export const toInt = (value: number): number => (Number.isFinite(value) ? Math.round(value) : 0);

/** ใส่ตัวคั่นหลักพัน เช่น 12000 -> "12,000" */
export const formatNumber = (value: number): string => value.toLocaleString('en-US');

/** สร้าง id แบบสุ่มสำหรับข้อมูลฝั่ง client (การ์ดใหม่, ผลการแข่ง) */
export const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** สุ่มสมาชิกหนึ่งตัวจาก array */
export const pickRandom = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

/** คลาสสีตาม rarity ใช้กับกรอบ/ข้อความบน Player Card */
export const RARITY_STYLE: Record<Rarity, { text: string; border: string; label: string }> = {
  common: { text: 'text-rarity-common', border: 'border-rarity-common/40', label: 'Common' },
  rare: { text: 'text-rarity-rare', border: 'border-rarity-rare/50', label: 'Rare' },
  epic: { text: 'text-rarity-epic', border: 'border-rarity-epic/50', label: 'Epic' },
  legendary: { text: 'text-rarity-legendary', border: 'border-rarity-legendary/60', label: 'Legendary' },
  // ระดับสูงสุด — ใช้สีชมพูม่วงเรืองแสง ให้แยกออกจากสีทองของ legendary ชัดเจน
  mythical: { text: 'text-rarity-mythical', border: 'border-rarity-mythical/70', label: 'Mythical' },
};

/** กลุ่มตำแหน่ง ใช้แยกคะแนนเกมรุก/กลาง/รับ */
export const POSITION_GROUP: Record<Position, 'gk' | 'defence' | 'midfield' | 'attack'> = {
  GK: 'gk',
  CB: 'defence',
  LB: 'defence',
  RB: 'defence',
  CDM: 'midfield',
  CM: 'midfield',
  CAM: 'midfield',
  LM: 'midfield',
  RM: 'midfield',
  LW: 'attack',
  RW: 'attack',
  ST: 'attack',
};

/** ตัวย่อ 3 ตัวอักษรของชาติ ใช้บนการ์ดแทนธงจริง (ธงบางแพลตฟอร์มไม่รองรับ emoji) */
export const NATION_CODE: Record<string, string> = {
  Italy: 'ITA',
  Japan: 'JPN',
  Brazil: 'BRA',
  Norway: 'NOR',
  Nigeria: 'NGA',
  France: 'FRA',
  Thailand: 'THA',
  Poland: 'POL',
  Portugal: 'POR',
  England: 'ENG',
  Germany: 'GER',
  Morocco: 'MAR',
  Spain: 'ESP',
  Serbia: 'SRB',
  'South Korea': 'KOR',
  Czechia: 'CZE',
  Ghana: 'GHA',
  Denmark: 'DEN',
  Argentina: 'ARG',
  Netherlands: 'NED',
};

/** คืนตัวย่อชาติ ถ้าไม่รู้จักให้ใช้ 3 ตัวแรกของชื่อ */
export const nationCode = (nation: string): string =>
  NATION_CODE[nation] ?? nation.slice(0, 3).toUpperCase();

/** อักษรย่อของสโมสร ใช้ทำตราสโมสรแบบ monogram (ไม่ใช้โลโก้จริง) */
export const clubMonogram = (club: string): string =>
  club
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** สีประจำสโมสรแบบคงที่ คำนวณจากชื่อ เพื่อให้ทีมเดียวกันได้สีเดิมเสมอ */
export const clubHue = (club: string): number => {
  let hash = 0;
  for (let index = 0; index < club.length; index += 1) {
    hash = (hash * 31 + club.charCodeAt(index)) % 360;
  }
  return hash;
};

/** นามสกุลของนักเตะ ใช้แสดงบนการ์ด */
export const lastName = (name: string): string => name.split(' ').slice(-1)[0];

/** อักษรย่อของชื่อ ใช้ตอนยังไม่มีรูปนักเตะ */
export const initials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
