/**
 * สร้างข้อมูลนักเตะเต็มใบจากข้อมูลสั้น ๆ ที่ผู้ดูแลเกมกรอก (ชื่อไฟล์รูป + ระดับการ์ด)
 *
 * แนวคิด: ค่าที่เหลือ (ชื่อ, ตำแหน่ง, OVR, ค่าพลัง 6 ด้าน) คำนวณจาก "เลขประจำตัว"
 * ที่ดึงมาจาก id ของนักเตะ จึงได้ผลเดิมทุกครั้งที่รีเฟรช และไม่ต้องเก็บลงไฟล์
 * ถ้าอยากกำหนดค่าไหนเองก็ใส่ทับได้ทุกฟิลด์ผ่าน RosterEntry
 */
import { getStatCeiling, STAT_PROFILE } from '@/data/positionProfile';
import type { Player, PlayerStats, Position, Rarity } from '@/types/player';
import { clamp, toInt } from '@/utils/helpers';

/**
 * หนึ่งบรรทัดในรายชื่อนักเตะ (src/data/roster.ts)
 * บังคับแค่ file กับ rarity — ที่เหลือใส่เมื่ออยากกำหนดเองเท่านั้น
 */
export interface RosterEntry {
  /**
   * ชื่อไฟล์รูปใน public/players/
   * - ใส่ทั้งนามสกุล ('p021.gif') = ชี้ตรงไปที่ไฟล์นั้น เร็วที่สุด
   * - ใส่แค่ชื่อ ('p021') = ระบบไล่หานามสกุลให้เอง (png → gif → webp → jpg)
   */
  file: string;
  /** ระดับการ์ด — มีผลกับ OVR ที่ระบบสุ่มให้ และโอกาสออกจากซอง */
  rarity: Rarity;

  /* ── ค่าที่ใส่ทับได้ (ไม่ใส่ = ระบบคำนวณให้) ─────────────── */
  id?: string;
  name?: string;
  position?: Position;
  altPositions?: Position[];
  ovr?: number;
  club?: string;
  nation?: string;
  stats?: Partial<PlayerStats>;
  /** false = มีในระบบแต่ยังไม่ได้เป็นเจ้าของ (ต้องเปิดซองเอา) — ค่าปกติคือ true */
  owned?: boolean;
}

/* ── ตารางอ้างอิงสำหรับการเติมค่าอัตโนมัติ ──────────────────── */

/** ช่วง OVR ของแต่ละระดับการ์ด */
const OVR_RANGE: Record<Rarity, [number, number]> = {
  common: [68, 78],
  rare: [76, 84],
  epic: [83, 90],
  legendary: [89, 96],
  mythical: [96, 99],
};

/**
 * วงล้อตำแหน่ง — ระบบหยิบตามเลขประจำตัวของนักเตะ
 * ใส่ตำแหน่งที่ทีมต้องใช้เยอะ (CB, CM, ST) ซ้ำหลายช่อง เพื่อให้จัดทีมได้ครบทุกแผน
 */
const POSITION_WHEEL: Position[] = [
  'GK', 'CB', 'LB', 'CM', 'ST', 'CB', 'RB', 'CAM',
  'LW', 'CDM', 'RM', 'CB', 'RW', 'CM', 'LM', 'ST',
];

/** ตำแหน่งรองที่สมเหตุสมผลของแต่ละตำแหน่งหลัก */
const ALT_POSITIONS: Record<Position, Position[]> = {
  GK: [],
  CB: ['CDM'],
  LB: ['LM'],
  RB: ['RM'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'ST'],
  LM: ['LW', 'LB'],
  RM: ['RW', 'RB'],
  LW: ['LM', 'ST'],
  RW: ['RM', 'ST'],
  ST: ['CAM'],
};

const FIRST_NAMES = ['Adrian', 'Kaito', 'Bruno', 'Emil', 'Tarek', 'Niko', 'Sandro', 'Idris', 'Milan', 'Kwame', 'Anton', 'Rafa', 'Yusuf', 'Leon', 'Dimitri', 'Somchai'];
const LAST_NAMES = ['Kovac', 'Silva', 'Okoye', 'Brandt', 'Marchetti', 'Nakamura', 'Bergström', 'Aliyev', 'Costa', 'Renard', 'Vlasic', 'Sorn', 'Haruna', 'Dvorak', 'Lindqvist', 'Moretti'];
const CLUBS = ['Aurora FC', 'Sakura United', 'Rio Central', 'Nord Bergen', 'Lagos Kings', 'Lyon Étoile', 'Bangkok Riverside', 'Kraków Legion', 'Porto Azul', 'Dover Athletic', 'Rhein Stadt', 'Casablanca City', 'Valencia Sur', 'Seoul Tigers', 'Accra Stars', 'Amsterdam Kade'];
const NATIONS = ['Italy', 'Japan', 'Brazil', 'Norway', 'Nigeria', 'France', 'Thailand', 'Poland', 'Portugal', 'England', 'Germany', 'Morocco', 'Spain', 'South Korea', 'Ghana', 'Netherlands'];

/* ── ตัวสร้างเลขสุ่มแบบคงที่ ────────────────────────────────── */

/**
 * เลขประจำตัวของนักเตะ ใช้เป็นเมล็ดพันธุ์ของทุกค่าที่คำนวณเอง
 * ถ้า id ลงท้ายด้วยตัวเลข (p021) จะใช้เลขนั้นตรง ๆ ทำให้ไฟล์ที่เรียงกันได้ตำแหน่งกระจายสวย
 */
const seedOf = (id: string): number => {
  const digits = id.match(/(\d+)\s*$/);
  if (digits) return Number(digits[1]);

  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  return hash;
};

/** หยิบสมาชิกจาก array แบบคงที่ (seed เดิม = ผลเดิมเสมอ) */
const pickBy = <T,>(items: readonly T[], seed: number, salt: number): T =>
  items[(seed * 7 + salt * 13) % items.length];

/** ตัวเลขคงที่ในช่วง -range ถึง +range ใช้ทำให้ค่าพลังไม่เท่ากันเป๊ะทุกคน */
const jitter = (seed: number, salt: number, range: number): number =>
  (((seed * 37 + salt * 101) % (range * 2 + 1)) - range);

/* ── ตัวสร้างนักเตะ ─────────────────────────────────────────── */

/** แยกชื่อไฟล์เป็น id (ตัดนามสกุลออก) */
const idFromFile = (file: string): string => file.replace(/\.[^.]+$/, '');

/** ค่าพลัง 6 ด้านที่คำนวณจากตำแหน่งและ OVR */
const buildStats = (position: Position, ovr: number, seed: number): PlayerStats => {
  const profile = STAT_PROFILE[position];

  /*
   * เพดานบนเป็นของ "ด้านนั้น + ตำแหน่งนั้น" ไม่ใช่ 99 เท่ากันหมดอีกแล้ว
   * ของเดิมบีบทุกด้านที่ 99 การ์ด OVR 120+ จึงออกมาเต็ม 99 ทั้งหกช่องเหมือนกันหมด
   * จนแยกกองหน้ากับกองหลังจากค่าพลังไม่ได้เลย
   */
  return Object.fromEntries(
    (Object.keys(profile) as Array<keyof PlayerStats>).map((key, index) => [
      key,
      clamp(
        toInt(ovr * profile[key] + jitter(seed, index, 3)),
        25,
        getStatCeiling(position, key),
      ),
    ]),
  ) as unknown as PlayerStats;
};

/**
 * แปลงหนึ่งบรรทัดใน roster เป็นข้อมูลนักเตะเต็มใบ
 * ค่าที่ผู้ดูแลใส่มาเองชนะค่าที่ระบบคำนวณเสมอ
 */
export const buildPlayerFromRoster = (entry: RosterEntry): Player => {
  const id = entry.id ?? idFromFile(entry.file);
  const seed = seedOf(id);

  const [minOvr, maxOvr] = OVR_RANGE[entry.rarity];
  const ovr = entry.ovr ?? minOvr + ((seed * 5) % (maxOvr - minOvr + 1));

  const position = entry.position ?? POSITION_WHEEL[seed % POSITION_WHEEL.length];

  return {
    id,
    name: entry.name ?? `${pickBy(FIRST_NAMES, seed, 1)} ${pickBy(LAST_NAMES, seed, 2)}`,
    club: entry.club ?? pickBy(CLUBS, seed, 3),
    nation: entry.nation ?? pickBy(NATIONS, seed, 4),
    position,
    altPositions: entry.altPositions ?? ALT_POSITIONS[position],
    ovr,
    rarity: entry.rarity,
    stats: { ...buildStats(position, ovr, seed), ...entry.stats },
    // ใส่นามสกุลมาด้วย = ชี้ตรงไปที่ไฟล์เลย ไม่ต้องให้การ์ดไล่เดานามสกุล
    imageUrl: entry.file.includes('.') ? `/players/${entry.file}` : undefined,
  };
};
