/**
 * pool นักเตะทั้งหมดของเกม = ข้อมูลที่เขียนมือ + รายชื่อจาก roster
 *
 * เพิ่มนักเตะใหม่ที่ src/data/roster.ts (แค่ชื่อไฟล์รูป + ระดับการ์ด)
 * ไฟล์นี้แก้เฉพาะตอนอยากปรับค่าของนักเตะ p001–p020 ที่เขียนมือไว้แล้ว
 * ชื่อทั้งหมดเป็นชื่อสมมติ ไว้สลับเป็นข้อมูลจริง/API ทีหลัง
 */
import { buildPlayerFromRoster } from '@/data/autoPlayer';
import { ROSTER } from '@/data/roster';
import type { Player } from '@/types/player';

const CUSTOM_PLAYERS: Player[] = [
  {
    id: 'p001',
    name: 'Marco Belline',
    club: 'Aurora FC',
    nation: 'Italy',
    position: 'ST',
    altPositions: ['CAM'],
    ovr: 91,
    rarity: 'common',
    stats: { pace: 89, shooting: 93, passing: 80, dribbling: 90, defending: 42, physical: 82 },
  },
  {
    id: 'p002',
    name: 'Kenji Aramaki',
    club: 'Sakura United',
    nation: 'Japan',
    position: 'CAM',
    altPositions: ['CM', 'RW'],
    ovr: 88,
    rarity: 'common',
    stats: { pace: 84, shooting: 82, passing: 90, dribbling: 91, defending: 48, physical: 68 },
  },
  {
    id: 'p003',
    name: 'Diego Marreno',
    club: 'Rio Central',
    nation: 'Brazil',
    position: 'LW',
    altPositions: ['ST'],
    ovr: 87,
    rarity: 'common',
    stats: { pace: 94, shooting: 84, passing: 78, dribbling: 92, defending: 34, physical: 66 },
  },
  {
    id: 'p004',
    name: 'Anders Vinter',
    club: 'Nord Bergen',
    nation: 'Norway',
    position: 'CB',
    altPositions: ['CDM'],
    ovr: 86,
    rarity: 'common',
    stats: { pace: 70, shooting: 45, passing: 68, dribbling: 60, defending: 89, physical: 90 },
  },
  {
    id: 'p005',
    name: 'Samir Oduya',
    club: 'Lagos Kings',
    nation: 'Nigeria',
    position: 'CDM',
    altPositions: ['CM', 'CB'],
    ovr: 85,
    rarity: 'common',
    stats: { pace: 74, shooting: 62, passing: 81, dribbling: 74, defending: 86, physical: 87 },
  },
  {
    id: 'p006',
    name: 'Lucas Ferrand',
    club: 'Lyon Étoile',
    nation: 'France',
    position: 'GK',
    altPositions: [],
    ovr: 88,
    rarity: 'common',
    stats: { pace: 55, shooting: 22, passing: 64, dribbling: 48, defending: 88, physical: 84 },
  },
  {
    id: 'p007',
    name: 'Thanakorn Srisai',
    club: 'Bangkok Riverside',
    nation: 'Thailand',
    position: 'RW',
    altPositions: ['RM'],
    ovr: 83,
    rarity: 'common',
    stats: { pace: 90, shooting: 78, passing: 76, dribbling: 86, defending: 38, physical: 62 },
  },
  {
    id: 'p008',
    name: 'Piotr Wozniak',
    club: 'Kraków Legion',
    nation: 'Poland',
    position: 'CB',
    altPositions: [],
    ovr: 82,
    rarity: 'common',
    stats: { pace: 66, shooting: 40, passing: 62, dribbling: 55, defending: 85, physical: 88 },
  },
  {
    id: 'p009',
    name: 'Rafael Duarte',
    club: 'Porto Azul',
    nation: 'Portugal',
    position: 'LB',
    altPositions: ['LM'],
    ovr: 81,
    rarity: 'common',
    stats: { pace: 86, shooting: 58, passing: 78, dribbling: 77, defending: 79, physical: 72 },
  },
  {
    id: 'p010',
    name: 'Owen Hartley',
    club: 'Dover Athletic',
    nation: 'England',
    position: 'RB',
    altPositions: ['RM'],
    ovr: 80,
    rarity: 'common',
    stats: { pace: 85, shooting: 55, passing: 74, dribbling: 72, defending: 80, physical: 75 },
  },
  {
    id: 'p011',
    name: 'Hugo Meier',
    club: 'Rhein Stadt',
    nation: 'Germany',
    position: 'CM',
    altPositions: ['CDM'],
    ovr: 84,
    rarity: 'common',
    stats: { pace: 72, shooting: 74, passing: 87, dribbling: 82, defending: 70, physical: 76 },
  },
  {
    id: 'p012',
    name: 'Younes Tazi',
    club: 'Casablanca City',
    nation: 'Morocco',
    position: 'ST',
    altPositions: ['LW'],
    ovr: 82,
    rarity: 'common',
    stats: { pace: 88, shooting: 84, passing: 70, dribbling: 83, defending: 32, physical: 74 },
  },
  {
    id: 'p013',
    name: 'Nico Baltar',
    club: 'Valencia Sur',
    nation: 'Spain',
    position: 'CM',
    altPositions: ['CAM'],
    ovr: 79,
    rarity: 'common',
    stats: { pace: 70, shooting: 68, passing: 82, dribbling: 80, defending: 62, physical: 68 },
  },
  {
    id: 'p014',
    name: 'Ivan Petrovic',
    club: 'Danube Zvezda',
    nation: 'Serbia',
    position: 'CB',
    altPositions: [],
    ovr: 78,
    rarity: 'common',
    stats: { pace: 62, shooting: 38, passing: 58, dribbling: 52, defending: 81, physical: 85 },
  },
  {
    id: 'p015',
    name: 'Jae-won Park',
    club: 'Seoul Tigers',
    nation: 'South Korea',
    position: 'RM',
    altPositions: ['RW', 'CM'],
    ovr: 78,
    rarity: 'common',
    stats: { pace: 84, shooting: 70, passing: 76, dribbling: 80, defending: 52, physical: 64 },
  },
  {
    id: 'p016',
    name: 'Tomas Halvar',
    club: 'Brno Vlci',
    nation: 'Czechia',
    position: 'GK',
    altPositions: [],
    ovr: 77,
    rarity: 'common',
    stats: { pace: 50, shooting: 20, passing: 58, dribbling: 42, defending: 78, physical: 80 },
  },
  {
    id: 'p017',
    name: 'Emeka Nwosu',
    club: 'Accra Stars',
    nation: 'Ghana',
    position: 'LM',
    altPositions: ['LW', 'LB'],
    ovr: 76,
    rarity: 'common',
    stats: { pace: 87, shooting: 64, passing: 70, dribbling: 78, defending: 55, physical: 70 },
  },
  {
    id: 'p018',
    name: 'Alan Vestergaard',
    club: 'Odense Havn',
    nation: 'Denmark',
    position: 'CDM',
    altPositions: ['CB'],
    ovr: 76,
    rarity: 'common',
    stats: { pace: 64, shooting: 58, passing: 74, dribbling: 66, defending: 79, physical: 82 },
  },
  {
    id: 'p019',
    name: 'Mateo Rivas',
    club: 'Rosario Norte',
    nation: 'Argentina',
    position: 'CAM',
    altPositions: ['ST'],
    ovr: 80,
    rarity: 'common',
    stats: { pace: 78, shooting: 79, passing: 84, dribbling: 86, defending: 40, physical: 62 },
  },
  {
    id: 'p020',
    name: 'Sebastian Krol',
    club: 'Amsterdam Kade',
    nation: 'Netherlands',
    position: 'LB',
    altPositions: ['CB'],
    ovr: 75,
    rarity: 'common',
    stats: { pace: 80, shooting: 48, passing: 70, dribbling: 68, defending: 76, physical: 72 },
  },
];

/** นักเตะที่สร้างจาก roster (ค่าต่าง ๆ คำนวณอัตโนมัติจาก id) */
const ROSTER_PLAYERS: Player[] = ROSTER.map(buildPlayerFromRoster);

/**
 * pool รวมของทั้งเกม
 * id ซ้ำกัน = ข้อมูลที่เขียนมือชนะ (roster จะถูกข้าม) เผื่อวันไหนอยากปรับ p021 เอง
 * ก็แค่ย้ายมาเขียนใน CUSTOM_PLAYERS ได้เลยโดยไม่ต้องลบบรรทัดใน roster
 */
export const PLAYERS: Player[] = [
  ...CUSTOM_PLAYERS,
  ...ROSTER_PLAYERS.filter(
    (player) => !CUSTOM_PLAYERS.some((custom) => custom.id === player.id),
  ),
];

/**
 * โฟลเดอร์รูปนักเตะ: วางไฟล์ชื่อ <playerId>.<นามสกุล> ไว้ใน public/players/
 * รองรับทั้งภาพนิ่งและภาพเคลื่อนไหว (.gif / .webp แบบ animated)
 * ถ้าไม่มีไฟล์ตรงกับ id การ์ดจะ fallback ไปใช้กล่องข้อมูลย่ออัตโนมัติ
 */
export const PORTRAIT_BASE = '/players/';

/**
 * นามสกุลไฟล์ที่ระบบจะไล่หา เรียงตามลำดับความสำคัญ
 * ใช้เฉพาะกับนักเตะที่ไม่ได้ระบุนามสกุลไฟล์ไว้ (imageUrl ว่าง)
 * การ์ดจะลองโหลดทีละนามสกุลจนกว่าจะเจอไฟล์จริง แล้วจำผลไว้ในแคช
 * (ถ้าไฟล์ส่วนใหญ่เป็น .gif ให้สลับ 'gif' ขึ้นมาไว้ตัวแรกเพื่อลดการลองโหลดที่พลาด)
 */
export const PORTRAIT_EXTENSIONS = ['png', 'gif', 'webp', 'jpg'] as const;

/**
 * แคชนามสกุลที่โหลดสำเร็จของนักเตะแต่ละคน
 * ทำให้การ์ดใบอื่น ๆ ของนักเตะคนเดียวกันข้ามการลองนามสกุลที่ผิดไปได้เลย
 */
const resolvedExtension = new Map<string, string>();

/** บันทึกว่านักเตะคนนี้ใช้ไฟล์นามสกุลไหน (เรียกจาก PlayerCard เมื่อรูปโหลดสำเร็จ) */
export const rememberPortraitUrl = (playerId: string, url: string): void => {
  const extension = url.split('.').pop();
  if (extension) resolvedExtension.set(playerId, extension);
};

/**
 * รายการ URL ที่ควรลองโหลดสำหรับนักเตะหนึ่งคน เรียงตามลำดับ
 * - imageUrl ในข้อมูลนักเตะชนะเสมอ (ใช้ค่าเดียว ไม่ต้องเดานามสกุล)
 * - ถ้าเคยโหลดสำเร็จแล้ว จะเอานามสกุลที่เจอขึ้นมาเป็นตัวแรก
 */
export const getPortraitCandidates = (player: Player): string[] => {
  if (player.imageUrl) return [player.imageUrl];

  const known = resolvedExtension.get(player.id);
  const extensions = known
    ? [known, ...PORTRAIT_EXTENSIONS.filter((extension) => extension !== known)]
    : [...PORTRAIT_EXTENSIONS];

  return extensions.map((extension) => `${PORTRAIT_BASE}${player.id}.${extension}`);
};

/** URL รูปที่ควรลองก่อนเป็นอันดับแรก (ใช้ตอนต้องการค่าเดียว เช่น preload) */
export const getPortraitUrl = (player: Player): string => getPortraitCandidates(player)[0];

/**
 * เตือนตอนพัฒนาเมื่อมีนักเตะ id ซ้ำกัน (มักเกิดจากพิมพ์ชื่อไฟล์ซ้ำใน roster.ts)
 * id ซ้ำทำให้ getPlayerById คืนคนแรกเสมอ อีกคนจะหายไปจากเกมเงียบ ๆ
 */
const duplicatedIds = (() => {
  const seen = new Set<string>();
  return PLAYERS.filter((player) => {
    if (seen.has(player.id)) return true;
    seen.add(player.id);
    return false;
  });
})();

if (duplicatedIds.length > 0) {
  console.warn(
    '[players] พบ id ซ้ำใน roster:',
    duplicatedIds.map((player) => `${player.id} (${player.name})`).join(', '),
  );
}

/** ค้นหานักเตะจาก id — ใช้บ่อยตอน map จาก PlayerCard กลับมาเป็น Player */
export const getPlayerById = (id: string): Player | undefined =>
  PLAYERS.find((player) => player.id === id);
