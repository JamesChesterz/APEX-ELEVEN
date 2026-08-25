/**
 * ═══════════════════════════════════════════════════════════════
 *  รายชื่อนักเตะ — ไฟล์เดียวที่ต้องแก้เวลาเพิ่มการ์ดใหม่
 * ═══════════════════════════════════════════════════════════════
 *
 * วิธีเพิ่มนักเตะ 1 คน:
 *   1. วางไฟล์รูปไว้ใน public/players/  (เช่น p036.gif)
 *   2. เพิ่มหนึ่งบรรทัดข้างล่างนี้:  { file: 'p036', rarity: 'epic' },
 *   จบ — ชื่อ ตำแหน่ง OVR และค่าพลัง 6 ด้าน ระบบคำนวณให้เองจากเลขท้าย id
 *        และค่าที่ได้จะเหมือนเดิมทุกครั้ง ไม่สุ่มใหม่ตอนรีเฟรช
 *
 * `file` ใส่ได้ 2 แบบ:
 *   'p036'      → ระบบไล่หานามสกุลให้ (png → gif → webp → jpg)
 *   'p036.gif'  → ชี้ตรงไปที่ไฟล์นั้นเลย เร็วกว่า แนะนำถ้ารู้นามสกุลแน่นอน
 *
 * อยากกำหนดค่าไหนเอง ใส่ทับได้เลย ระบบจะไม่คำนวณให้ทับ:
 *   { file: 'p036.gif', rarity: 'legendary', name: 'ชื่อที่อยากได้', position: 'ST', ovr: 94 }
 *
 * อยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น (ไม่ได้ตั้งแต่แรก):
 *   { file: 'p036', rarity: 'legendary', owned: false }
 *
 * ระดับการ์ดที่ใช้ได้: common → rare → epic → legendary → mythical (สูงสุด)
 *
 * เคล็ดลับ: รัน `python3 tools/scan-players.py` จะพิมพ์บรรทัดของไฟล์รูป
 * ที่ยังไม่มีในรายชื่อออกมาให้ก๊อปวางได้เลย
 *
 * หมายเหตุ: p001–p020 เป็นข้อมูลที่เขียนมือไว้แล้วใน players.ts
 * จึงไม่ต้องใส่ซ้ำที่นี่ (ถ้าใส่ซ้ำ ข้อมูลเขียนมือจะชนะ)
 */
import type { RosterEntry } from '@/data/autoPlayer';

export const ROSTER: RosterEntry[] = [
  { file: 'p021.gif', rarity: 'legendary', name: 'DIRK KUYT', position: 'CM', ovr: 122 },
  { file: 'p022.gif', rarity: 'legendary', name: 'VAN DIJK', position: 'CB', ovr: 122 },
  { file: 'p023.gif', rarity: 'epic', name: 'STEVEN GERRARD', position: 'CM', ovr: 121 },
  { file: 'p024.gif', rarity: 'rare', name: 'CARRAGHER', position: 'CB', ovr: 119 },
  { file: 'p025.gif', rarity: 'rare', name: 'CROUCH', position: 'ST', ovr: 119 },
  { file: 'p026.gif', rarity: 'epic', name: 'RUSH', position: 'ST', ovr: 120 },
  { file: 'p027.gif', rarity: 'legendary', name: 'OSIMHEN', position: 'ST', ovr: 122 },
  { file: 'p028.gif', rarity: 'epic', name: 'KVARATSKHELIA', position: 'LW', ovr: 121 },
  { file: 'p029.gif', rarity: 'epic', name: 'MARQUINHOS', position: 'CB', ovr: 121 },
  { file: 'p030.gif', rarity: 'epic', name: 'HAALAND', position: 'ST', ovr: 121 },
  { file: 'p031.gif', rarity: 'epic', name: 'DONNARUMMA', position: 'GK', ovr: 121 },
  { file: 'p032.gif', rarity: 'epic', name: 'KIMMICH', position: 'CDM', ovr: 121 },
  { file: 'p033.gif', rarity: 'epic', name: 'JOAO NEVES', position: 'CM', ovr: 120 },
  { file: 'p034.gif', rarity: 'epic', name: 'VALVERDE', position: 'CM', ovr: 120 },
  { file: 'p035.gif', rarity: 'epic', name: 'COURTOIS', position: 'GK', ovr: 120 },
  { file: 'p036.gif', rarity: 'legendary', name: 'BALE', position: 'RW', ovr: 122 },
  { file: 'p037.gif', rarity: 'legendary', name: 'KAKA', position: 'CAM', ovr: 122  },
  { file: 'p038.gif', rarity: 'legendary', name: 'LUCIO', position: 'CB', ovr: 122  },
  { file: 'p039.gif', rarity: 'legendary', name: 'RIBERY', position: 'LW', ovr: 122   },
  { file: 'p040.gif', rarity: 'legendary', name: 'MAKELELE', position: 'CDM', ovr: 122   },
  { file: 'p041.gif', rarity: 'legendary', name: 'TOURE', position: 'CDM', ovr: 122   },
  { file: 'p042.gif', rarity: 'legendary', name: 'LAHM', position: 'RB', ovr: 122   },
  { file: 'p043.gif', rarity: 'legendary', name: 'KOMPANY', position: 'CB', ovr: 122 },
  { file: 'p044.gif', rarity: 'legendary', name: 'CHIELLINI', position: 'CB', ovr: 122   },
  { file: 'p045.gif', rarity: 'legendary', name: 'RICARDO CARVALHO', position: 'CB', ovr: 122   },
  { file: 'p046.gif', rarity: 'legendary', name: 'DROGBA', position: 'ST', ovr: 122   },
  { file: 'p047.gif', rarity: 'legendary', name: 'KEMPES', position: 'ST', ovr: 122   },
  { file: 'p048.gif', rarity: 'legendary', name: 'FORLAN', position: 'ST', ovr: 122   },
  { file: 'p049.gif', rarity: 'legendary', name: 'SANCHEZ', position: 'ST', ovr: 122   },
  { file: 'p050.gif', rarity: 'legendary', name: 'LUIS FIGO', position: 'CB', ovr: 122   },
  { file: 'p051.gif', rarity: 'legendary', name: 'COLE', position: 'LB', ovr: 122   },
  { file: 'p052.gif', rarity: 'legendary', name: 'LAMPARD', position: 'CM', ovr: 122  },
  { file: 'p053.gif', rarity: 'legendary', name: 'STAM', position: 'CB', ovr: 122   },
  { file: 'p054.gif', rarity: 'legendary', name: 'KOMPANY', position: 'CB', ovr: 122   },
  { file: 'p055.gif', rarity: 'legendary', name: 'NAKATA', position: 'CAM', ovr: 122   },
  { file: 'p056.gif', rarity: 'legendary', name: 'DONOVAN', position: 'CAM', ovr: 122   },
  { file: 'p057.gif', rarity: 'legendary', name: 'INESTA', position: 'CAM', ovr: 122   },
  { file: 'p058.gif', rarity: 'legendary', name: 'MBAPPE', position: 'LW', ovr: 122   },
  { file: 'p059.gif', rarity: 'legendary', name: 'MARC CUCURELLA', position: 'LB', ovr: 122   },
  { file: 'p060.gif', rarity: 'legendary', name: 'RODRI', position: 'CDM', ovr: 122   },
  { file: 'p126.gif', rarity: 'legendary', name: 'CASILLAS', position: 'GK', ovr: 122   },

  /* ── ระดับ MYTHICAL ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p061.png', rarity: 'mythical', name: 'C. RONALDO', position: 'ST', ovr: 123 },
  { file: 'p062.png', rarity: 'mythical', name: 'STEVEN GERRARD', position: 'CM', ovr: 123 },
  { file: 'p063.gif', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 123 },
  { file: 'p064.gif', rarity: 'mythical', name: 'HAALAND', position: 'ST', ovr: 123 },
  { file: 'p065.png', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 123 },
  { file: 'p066.png', rarity: 'mythical', name: 'HENRY', position: 'ST', ovr: 123 },
  { file: 'p067.png', rarity: 'mythical', name: 'HAZARD', position: 'LW', ovr: 123 },
  { file: 'p068.png', rarity: 'mythical', name: 'PIRLO', position: 'CM', ovr: 123 },
  { file: 'p069.png', rarity: 'mythical', name: 'BLANC', position: 'CB', ovr: 123 },
  { file: 'p070.png', rarity: 'mythical', name: 'CAFU', position: 'RB', ovr: 123 },
  { file: 'p071.png', rarity: 'mythical', name: 'FERDINAN', position: 'CB', ovr: 123 },
  { file: 'p072.png', rarity: 'mythical', name: 'TORRES', position: 'ST', ovr: 123 },
  { file: 'p073.png', rarity: 'mythical', name: 'MESSI', position: 'RW', ovr: 123 },
  { file: 'p074.png', rarity: 'mythical', name: 'MODRIC', position: 'CM', ovr: 123 },
  { file: 'p075.png', rarity: 'mythical', name: 'C. RONALDO', position: 'LW', ovr: 123 },
  { file: 'p076.png', rarity: 'mythical', name: 'ROBERTO CARLOS', position: 'LB', ovr: 123 },
  { file: 'p077.png', rarity: 'mythical', name: 'RONALDINHO', position: 'LW', ovr: 123 },
  { file: 'p078.png', rarity: 'mythical', name: 'ZIDANE', position: 'CAM', ovr: 123 },
  { file: 'p079.png', rarity: 'mythical', name: 'VAA DER SAR', position: 'GK', ovr: 123 },
  { file: 'p080.gif', rarity: 'legendary', name: 'MATHEUS CUNHA', position: 'ST', ovr: 122   },
  { file: 'p081.gif', rarity: 'mythical', name: 'GINOLA', position: 'LW', ovr: 123   },
  { file: 'p083.gif', rarity: 'mythical', name: 'C. RONALDO', position: 'ST', ovr: 123   },
  { file: 'p084.gif', rarity: 'mythical', name: 'MESSI', position: 'RW', ovr: 123   },
  { file: 'p085.gif', rarity: 'common', name: 'VARANE', position: 'CB', ovr: 114   },
  { file: 'p086.gif', rarity: 'common', name: 'PEPE', position: 'CB', ovr: 114   },
  { file: 'p087.gif', rarity: 'common', name: 'RUMMENIGGE', position: 'ST', ovr: 114   },
  { file: 'p088.gif', rarity: 'common', name: 'AGUERO', position: 'ST', ovr: 114   },
  
  /* ── GAME CHANGER ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p089.gif', rarity: 'rare', name: 'AMAD', position: 'CAM', ovr: 119   },
  { file: 'p090.gif', rarity: 'rare', name: 'STANISIC', position: 'CB', ovr: 119   },
  { file: 'p091.gif', rarity: 'rare', name: 'DE GEA', position: 'GK', ovr: 119   },
  { file: 'p092.gif', rarity: 'rare', name: 'MAGUIRE', position: 'CB', ovr: 119   },
  { file: 'p093.gif', rarity: 'rare', name: 'ANDRICH', position: 'CDM', ovr: 118   },
  { file: 'p094.gif', rarity: 'rare', name: 'SORLOTH', position: 'ST', ovr: 118   },
  { file: 'p095.gif', rarity: 'rare', name: 'SVILAR', position: 'GK', ovr: 118   },
  { file: 'p096.gif', rarity: 'rare', name: 'ISCO', position: 'CAM', ovr: 119   },
  { file: 'p097.gif', rarity: 'rare', name: 'MIKEL MERINO', position: 'CM', ovr: 118   },
  { file: 'p098.gif', rarity: 'rare', name: 'GIROUD', position: 'ST', ovr: 118   },
  { file: 'p099.gif', rarity: 'rare', name: 'GATTI', position: 'CB', ovr: 118   },
  { file: 'p100.gif', rarity: 'rare', name: 'BUENDIA', position: 'CAM', ovr: 118   },
  { file: 'p101.gif', rarity: 'rare', name: 'HOJBJERG', position: 'CDM', ovr: 117   },
  { file: 'p102.gif', rarity: 'rare', name: 'BARNES', position: 'LW', ovr: 117   },
  { file: 'p103.gif', rarity: 'rare', name: 'FRATTESI', position: 'CM', ovr: 117   },
  { file: 'p104.gif', rarity: 'rare', name: 'ORSOLINI', position: 'RM', ovr: 116   },
  { file: 'p105.gif', rarity: 'rare', name: 'SAMBA', position: 'GK', ovr: 117   },
  { file: 'p106.gif', rarity: 'rare', name: 'ZAMBO ANGUISSA', position: 'CM', ovr: 117   },
  { file: 'p107.gif', rarity: 'rare', name: 'ANTON', position: 'CB', ovr: 116   },
  { file: 'p108.gif', rarity: 'rare', name: 'BAUMANN', position: 'GK', ovr: 116   },
  { file: 'p109.gif', rarity: 'rare', name: 'GERARD MORENO', position: 'ST', ovr: 116   },
  { file: 'p110.gif', rarity: 'rare', name: 'HENDERSON', position: 'GK', ovr: 115   },
  
  /* ── PML all STAR ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p111.gif', rarity: 'legendary', name: 'BRUNO FERNANDES', position: 'CAM', ovr: 122   },
  { file: 'p112.gif', rarity: 'legendary', name: 'EZE', position: 'CAM', ovr: 122   },
  { file: 'p113.gif', rarity: 'legendary', name: 'ISAK', position: 'ST', ovr: 122   },
  { file: 'p114.gif', rarity: 'legendary', name: 'JARROD BOWEN', position: 'LW', ovr: 121   },
  { file: 'p115.gif', rarity: 'legendary', name: 'MITOMA', position: 'LW', ovr: 121   },
  { file: 'p116.gif', rarity: 'legendary', name: 'OLLIE WATKINS', position: 'ST', ovr: 122   },
  { file: 'p117.gif', rarity: 'legendary', name: 'PALMER', position: 'CAM', ovr: 122   },
  { file: 'p118.gif', rarity: 'legendary', name: 'RODRI', position: 'CDM', ovr: 122   },
  { file: 'p119.gif', rarity: 'legendary', name: 'SAKA', position: 'RW', ovr: 122   },
  { file: 'p120.gif', rarity: 'legendary', name: 'SALAH', position: 'RW', ovr: 122   },
  { file: 'p121.gif', rarity: 'legendary', name: 'SON HEUNG-MIN', position: 'ST', ovr: 122   },

    /* ── RANK ALL STAR ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p122.gif', rarity: 'mythical', name: 'MALDINI', position: 'CB', ovr: 123   },
  { file: 'p123.gif', rarity: 'mythical', name: 'ROONEY', position: 'ST', ovr: 123   },
  { file: 'p124.gif', rarity: 'mythical', name: 'SOCRETES', position: 'CM', ovr: 123   },
  { file: 'p125.gif', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 124 },
  { file: 'p127.png', rarity: 'mythical', name: 'MESSI', position: 'RW', ovr: 123 },
  { file: 'p128.png', rarity: 'mythical', name: 'NEYMAR JR', position: 'LW', ovr: 123 },
  { file: 'p129.png', rarity: 'mythical', name: 'BELLINGHAM', position: 'CM', ovr: 123 },
];
