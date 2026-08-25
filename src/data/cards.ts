/**
 * Mock data: ซองการ์ดที่ขายในร้าน
 *
 * หมายเหตุ: การ์ดเริ่มต้นของผู้เล่นย้ายไปอยู่ที่ src/data/starter.ts แล้ว
 * เพราะตอนนี้ผูกกับบัญชีที่สมัคร (แต่ละไอดีมีคลังการ์ดของตัวเอง)
 *
 * เรื่อง odds: ตัวเลขคือ "น้ำหนัก" ของการสุ่ม รวมกันได้ 100 ต่อการ์ด 1 ใบ
 * ระดับ mythical ตั้งไว้ต่ำมากโดยตั้งใจ — ซองทั่วไปแทบไม่มีทางออก
 * ถ้าจะเจอจริงจังต้องซื้อ Mythic Pack
 *
 * เรื่อง pool: ใส่ id ของนักเตะที่อยากให้อยู่ในซองนั้นโดยเฉพาะ (ดู id ได้ที่ src/data/roster.ts)
 *   ไม่ใส่ pool = ซองนั้นสุ่มจากนักเตะทั้งเกมตาม odds
 *   ใส่ pool   = ออกได้เฉพาะคนในรายชื่อ (ยังสุ่มระดับตาม odds เหมือนเดิม)
 * การ์ดที่ OVR สูงที่สุดในซองจะถูกหยิบไปโชว์เป็นใบเด่นหน้าซองให้อัตโนมัติ
 */
import type { CardPack } from '@/types/card';

export const CARD_PACKS: CardPack[] = [
  {
    id: 'pack-bronze',
    name: 'Starter Pack',
    tier: 'bronze',
    price: 3000,
    cardCount: 2,
    odds: { common: 0, rare: 98, epic: 2, legendary: 0, mythical: 0 },
    description: 'ซองราคาเบา เปิดเก็บแต้มย่อยได้เรื่อย ๆ',
  },
  {
    id: 'pack-legend',
    name: 'Signature Pack',
    tier: 'special',
    price: 7000,
    cardCount: 2,
    odds: { common: 70, rare: 25, epic: 0, legendary: 5, mythical: 0 },
    pool: [
      'p021', 'p037', 'p039', 'p041', 'p045', 'p047', 'p048', 'p049', 'p050',
      'p051', 'p052', 'p053', 'p054', 'p055', 'p056', 'p057',
      'p085', 'p086', 'p087', 'p088',
      'p090', 'p091', 'p092', 'p093','p094', 'p095', 'p096', 'p097',
    ],
    description: 'ซองพิเศษ Signature Pack คัดสรรพิเศษ',
  },
  {
    id: 'pack-mythic',
    name: 'Mythic Pack',
    tier: 'mythic',
    price: 10000,
    cardCount: 1,
    odds: { common: 62, rare: 22, epic: 11, legendary: 4, mythical: 1 },
    pool: [
      'p061', 'p065', 'p066', 'p067',
      'p060', 'p058', 'p059', 'p080',
      'p030', 'p031', 'p032',
      'p024', 'p025',
      'p001', 'p002', 'p003',
    ],
    description: 'การ์ด MYTHICAL 4 ผู้เล่นระดับตำนานลูกหนัง ',
  },
   {
    id: 'pack-mythic-xi',
    name: 'ULTIMATE XI Pack',
    tier: 'mythic',
    price: 12000,
    cardCount: 1,
    odds: { common: 62, rare: 22, epic: 11, legendary: 4, mythical: 1 },
    pool: [
      'p068', 'p069', 'p070', 'p071', 'p072', 'p073', 'p074', 'p075', 'p076', 'p077', 'p078', 'p079',
      'p060', 'p058', 'p059',
      'p030', 'p031', 'p032',
      'p024', 'p025',
      'p085', 'p086', 'p087', 'p088',
    ],
    description: 'การ์ดระดับ MYTHICAL ผู้เล่น ULTIMATE XI ',
  },
    {
    id: 'pack-premier-league-AllStar',              // ห้ามซ้ำกับซองอื่นเด็ดขาด
    name: 'Premier League All Star',
    tier: 'special',                 // bronze | silver | gold | special | mythic
    price: 12000,
    cardCount: 3,
    odds: { common: 70, rare: 20, epic: 7, legendary: 3, mythical: 0 },
    pool: ['p111', 'p112', 'p113', 'p114', 'p115', 'p116', 'p117', 'p118', 'p119', 'p120', 'p121', //legendary
           'p023', 'p028', 'p029', 'p030', 'p031', 'p032', 'p033', 'p034', 'p035', //epic
           'p089', 'p090', 'p091', 'p092', 'p093', 'p094', 'p095', 'p096', 'p097', //rare
           'p088', 'p087', 'p086', 'p085', //common
          ],   // ตัดออกได้ = สุ่มจากนักเตะทั้งเกม
    description: 'นักเตะอันเป็นที่รักของแฟนคลับ premier league ',
  },
];
