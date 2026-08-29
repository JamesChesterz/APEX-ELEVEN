/**
 * ═══════════════════════════════════════════════════════════════
 *  รายชื่อนักเตะ — ไฟล์เดียวที่ต้องแก้เวลาเพิ่มการ์ดใหม่
 * ═══════════════════════════════════════════════════════════════
 *
 * วิธีเพิ่มนักเตะ 1 คน:
 *   1. วางไฟล์รูปไว้ใน public/players/  (เช่น p036.webp)
 *   2. เพิ่มหนึ่งบรรทัดข้างล่างนี้:  { file: 'p036', rarity: 'epic' },
 *   จบ — ชื่อ ตำแหน่ง OVR และค่าพลัง 6 ด้าน ระบบคำนวณให้เองจากเลขท้าย id
 *        และค่าที่ได้จะเหมือนเดิมทุกครั้ง ไม่สุ่มใหม่ตอนรีเฟรช
 *
 * `file` ใส่ได้ 2 แบบ:
 *   'p036'      → ระบบไล่หานามสกุลให้ (png → gif → webp → jpg)
 *   'p036.webp'  → ชี้ตรงไปที่ไฟล์นั้นเลย เร็วกว่า แนะนำถ้ารู้นามสกุลแน่นอน
 *
 * อยากกำหนดค่าไหนเอง ใส่ทับได้เลย ระบบจะไม่คำนวณให้ทับ:
 *   { file: 'p036.webp', rarity: 'legendary', name: 'ชื่อที่อยากได้', position: 'ST', ovr: 94 }
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
  { file: 'p021.webp', rarity: 'legendary', name: 'DIRK KUYT', position: 'CM', ovr: 122 },
  { file: 'p022.webp', rarity: 'legendary', name: 'VAN DIJK', position: 'CB', ovr: 122 },
  { file: 'p023.webp', rarity: 'epic', name: 'STEVEN GERRARD', position: 'CM', ovr: 121 },
  { file: 'p024.webp', rarity: 'rare', name: 'CARRAGHER', position: 'CB', ovr: 119 },
  { file: 'p025.webp', rarity: 'rare', name: 'CROUCH', position: 'ST', ovr: 119 },
  { file: 'p026.webp', rarity: 'epic', name: 'RUSH', position: 'ST', ovr: 120 },
  { file: 'p027.webp', rarity: 'legendary', name: 'OSIMHEN', position: 'ST', ovr: 122 },
  { file: 'p028.webp', rarity: 'epic', name: 'KVARATSKHELIA', position: 'LW', ovr: 121 },
  { file: 'p029.webp', rarity: 'epic', name: 'MARQUINHOS', position: 'CB', ovr: 121 },
  { file: 'p030.webp', rarity: 'mythical', name: 'HAALAND', position: 'ST', ovr: 121 },
  { file: 'p031.webp', rarity: 'epic', name: 'DONNARUMMA', position: 'GK', ovr: 121 },
  { file: 'p032.webp', rarity: 'epic', name: 'KIMMICH', position: 'CDM', ovr: 121 },
  { file: 'p033.webp', rarity: 'epic', name: 'JOAO NEVES', position: 'CM', ovr: 120 },
  { file: 'p034.webp', rarity: 'epic', name: 'VALVERDE', position: 'CM', ovr: 120 },
  { file: 'p035.webp', rarity: 'epic', name: 'COURTOIS', position: 'GK', ovr: 120 },
  { file: 'p036.webp', rarity: 'legendary', name: 'BALE', position: 'RW', ovr: 122 },
  { file: 'p037.webp', rarity: 'legendary', name: 'KAKA', position: 'CAM', ovr: 122  },
  { file: 'p038.webp', rarity: 'legendary', name: 'LUCIO', position: 'CB', ovr: 122  },
  { file: 'p039.webp', rarity: 'legendary', name: 'RIBERY', position: 'LW', ovr: 122   },
  { file: 'p040.webp', rarity: 'legendary', name: 'MAKELELE', position: 'CDM', ovr: 122   },
  { file: 'p041.webp', rarity: 'legendary', name: 'TOURE', position: 'CDM', ovr: 122   },
  { file: 'p042.webp', rarity: 'legendary', name: 'LAHM', position: 'RB', ovr: 122   },
  { file: 'p043.webp', rarity: 'legendary', name: 'KOMPANY', position: 'CB', ovr: 122 },
  { file: 'p044.webp', rarity: 'legendary', name: 'CHIELLINI', position: 'CB', ovr: 122   },
  { file: 'p045.webp', rarity: 'legendary', name: 'RICARDO CARVALHO', position: 'CB', ovr: 122   },
  { file: 'p046.webp', rarity: 'legendary', name: 'DROGBA', position: 'ST', ovr: 122   },
  { file: 'p047.webp', rarity: 'mythical', name: 'KEMPES', position: 'ST', ovr: 122   },
  { file: 'p048.webp', rarity: 'mythical', name: 'FORLAN', position: 'ST', ovr: 122   },
  { file: 'p049.webp', rarity: 'mythical', name: 'SANCHEZ', position: 'ST', ovr: 122   },
  { file: 'p050.webp', rarity: 'legendary', name: 'LUIS FIGO', position: 'RW', ovr: 122   },
  { file: 'p051.webp', rarity: 'legendary', name: 'COLE', position: 'LB', ovr: 122   },
  { file: 'p052.webp', rarity: 'legendary', name: 'LAMPARD', position: 'CM', ovr: 122  },
  { file: 'p053.webp', rarity: 'legendary', name: 'STAM', position: 'CB', ovr: 122   },
  { file: 'p054.webp', rarity: 'legendary', name: 'KOMPANY', position: 'CB', ovr: 122   },
  { file: 'p055.webp', rarity: 'legendary', name: 'NAKATA', position: 'CAM', ovr: 122   },
  { file: 'p056.webp', rarity: 'legendary', name: 'DONOVAN', position: 'CAM', ovr: 122   },
  { file: 'p057.webp', rarity: 'legendary', name: 'INESTA', position: 'CAM', ovr: 122   },
  { file: 'p058.webp', rarity: 'legendary', name: 'MBAPPE', position: 'LW', ovr: 122   },
  { file: 'p059.webp', rarity: 'legendary', name: 'MARC CUCURELLA', position: 'LB', ovr: 122   },
  { file: 'p060.webp', rarity: 'legendary', name: 'RODRI', position: 'CDM', ovr: 122   },

  /* ── ระดับ MYTHICAL ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p061.png', rarity: 'mythical', name: 'C. RONALDO', position: 'ST', ovr: 123 },
  { file: 'p062.png', rarity: 'mythical', name: 'STEVEN GERRARD', position: 'CM', ovr: 123 },
  { file: 'p063.webp', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 123 },
  { file: 'p064.webp', rarity: 'mythical', name: 'HAALAND', position: 'ST', ovr: 123 },
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
  { file: 'p080.webp', rarity: 'legendary', name: 'MATHEUS CUNHA', position: 'ST', ovr: 122   },
  { file: 'p081.webp', rarity: 'mythical', name: 'GINOLA', position: 'LW', ovr: 123   },
  { file: 'p083.webp', rarity: 'mythical', name: 'C. RONALDO', position: 'ST', ovr: 123   },
  { file: 'p084.webp', rarity: 'mythical', name: 'MESSI', position: 'RW', ovr: 123   },
  { file: 'p085.webp', rarity: 'common', name: 'VARANE', position: 'CB', ovr: 114   },
  { file: 'p086.webp', rarity: 'common', name: 'PEPE', position: 'CB', ovr: 114   },
  { file: 'p087.webp', rarity: 'common', name: 'RUMMENIGGE', position: 'ST', ovr: 114   },
  { file: 'p088.webp', rarity: 'common', name: 'AGUERO', position: 'ST', ovr: 114   },
  
  /* ── GAME CHANGER ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p089.webp', rarity: 'legendary', name: 'AMAD', position: 'CAM', ovr: 119   },
  { file: 'p090.webp', rarity: 'legendary', name: 'STANISIC', position: 'CB', ovr: 119   },
  { file: 'p091.webp', rarity: 'legendary', name: 'DE GEA', position: 'GK', ovr: 119   },
  { file: 'p092.webp', rarity: 'legendary', name: 'MAGUIRE', position: 'CB', ovr: 119   },
  { file: 'p093.webp', rarity: 'epic', name: 'ANDRICH', position: 'CDM', ovr: 118   },
  { file: 'p094.webp', rarity: 'epic', name: 'SORLOTH', position: 'ST', ovr: 118   },
  { file: 'p095.webp', rarity: 'epic', name: 'SVILAR', position: 'GK', ovr: 118   },
  { file: 'p096.webp', rarity: 'legendary', name: 'ISCO', position: 'CAM', ovr: 119   },
  { file: 'p097.webp', rarity: 'epic', name: 'MIKEL MERINO', position: 'CM', ovr: 118   },
  { file: 'p098.webp', rarity: 'epic', name: 'GIROUD', position: 'ST', ovr: 118   },
  { file: 'p099.webp', rarity: 'epic', name: 'GATTI', position: 'CB', ovr: 118   },
  { file: 'p100.webp', rarity: 'epic', name: 'BUENDIA', position: 'CAM', ovr: 118   },
  { file: 'p101.webp', rarity: 'epic', name: 'HOJBJERG', position: 'CDM', ovr: 117   },
  { file: 'p102.webp', rarity: 'epic', name: 'BARNES', position: 'LW', ovr: 117   },
  { file: 'p103.webp', rarity: 'epic', name: 'FRATTESI', position: 'CM', ovr: 117   },
  { file: 'p104.webp', rarity: 'rare', name: 'ORSOLINI', position: 'RM', ovr: 116   },
  { file: 'p105.webp', rarity: 'epic', name: 'SAMBA', position: 'GK', ovr: 117   },
  { file: 'p106.webp', rarity: 'epic', name: 'ZAMBO ANGUISSA', position: 'CM', ovr: 117   },
  { file: 'p107.webp', rarity: 'rare', name: 'ANTON', position: 'CB', ovr: 116   },
  { file: 'p108.webp', rarity: 'rare', name: 'BAUMANN', position: 'GK', ovr: 116   },
  { file: 'p109.webp', rarity: 'rare', name: 'GERARD MORENO', position: 'ST', ovr: 116   },
  { file: 'p110.webp', rarity: 'rare', name: 'HENDERSON', position: 'GK', ovr: 115   },
  
  /* ── PML all STAR ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p111.webp', rarity: 'legendary', name: 'BRUNO FERNANDES', position: 'CAM', ovr: 122   },
  { file: 'p112.webp', rarity: 'legendary', name: 'EZE', position: 'CAM', ovr: 122   },
  { file: 'p113.webp', rarity: 'legendary', name: 'ISAK', position: 'ST', ovr: 122   },
  { file: 'p114.webp', rarity: 'legendary', name: 'JARROD BOWEN', position: 'LW', ovr: 121   },
  { file: 'p115.webp', rarity: 'legendary', name: 'MITOMA', position: 'LW', ovr: 121   },
  { file: 'p116.webp', rarity: 'legendary', name: 'OLLIE WATKINS', position: 'ST', ovr: 122   },
  { file: 'p117.webp', rarity: 'legendary', name: 'PALMER', position: 'CAM', ovr: 122   },
  { file: 'p118.webp', rarity: 'legendary', name: 'RODRI', position: 'CDM', ovr: 122   },
  { file: 'p119.webp', rarity: 'legendary', name: 'SAKA', position: 'RW', ovr: 122   },
  { file: 'p120.webp', rarity: 'legendary', name: 'SALAH', position: 'RW', ovr: 122   },
  { file: 'p121.webp', rarity: 'legendary', name: 'SON HEUNG-MIN', position: 'ST', ovr: 122   },

    /* ── RANK ALL STAR ─────────────────────────────────────────
   * 4 ใบท็อปสุดถูกยกขึ้นเป็นระดับสูงสุดของเกม
   * อยากเพิ่ม/ลดใบไหน แก้ค่า rarity ในบรรทัดข้างล่างได้เลย
   * (ถ้าอยากให้เป็นการ์ดที่ต้องเปิดซองเอาเท่านั้น เติม owned: false ต่อท้าย)
   */
  { file: 'p122.webp', rarity: 'mythical', name: 'MALDINI', position: 'CB', ovr: 123   },
  { file: 'p123.webp', rarity: 'mythical', name: 'ROONEY', position: 'ST', ovr: 123   },
  { file: 'p124.webp', rarity: 'mythical', name: 'SOCRETES', position: 'CM', ovr: 123   },
  { file: 'p125.webp', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 124 },
  { file: 'p126.webp', rarity: 'legendary', name: 'CASILLAS', position: 'GK', ovr: 120 },
  { file: 'p127.gif', rarity: 'mythical', name: 'BELLINGHAM', position: 'CM', ovr: 123 },
  { file: 'p128.gif', rarity: 'mythical', name: 'LAMINE YAMAL', position: 'RW', ovr: 123 },
  { file: 'p129.gif', rarity: 'mythical', name: 'MBAPPE', position: 'ST', ovr: 123 },
  { file: 'p130.gif', rarity: 'mythical', name: 'RAPHINHA', position: 'LW', ovr: 123 },
  { file: 'p131.gif', rarity: 'mythical', name: 'ALEXANDER ARNOLD', position: 'RB', ovr: 123 },
  { file: 'p132.gif', rarity: 'mythical', name: 'OBLAK', position: 'GK', ovr: 122 },
  { file: 'p133.gif', rarity: 'mythical', name: 'RUDIGER', position: 'CB', ovr: 123 },

   /* ── CARD NUMERU 7 ─────────────────────────────────────────*/
  { file: 'p134.gif', rarity: 'legendary', name: 'GARINCHA', position: 'RW', ovr: 118 },
  { file: 'p135.gif', rarity: 'mythical', name: 'CANTONA', position: 'ST', ovr: 122 },
  { file: 'p136.gif', rarity: 'mythical', name: 'VINICIUS JR.', position: 'LW', ovr: 122 },
  { file: 'p137.gif', rarity: 'mythical', name: 'SAKA', position: 'RW', ovr: 121 },
  { file: 'p138.gif', rarity: 'legendary', name: 'GRIEZMANN', position: 'ST', ovr: 120 },
  { file: 'p139.gif', rarity: 'legendary', name: 'JOBE BELLINGHAM', position: 'CM', ovr: 120 },
  { file: 'p140.gif', rarity: 'legendary', name: 'SIMON', position: 'CAM', ovr: 120 },
  { file: 'p141.gif', rarity: 'legendary', name: 'ZIELINSKI', position: 'CM', ovr: 119 },
  { file: 'p142.gif', rarity: 'legendary', name: 'PELLEGRINI', position: 'CAM', ovr: 119 },
  { file: 'p143.gif', rarity: 'legendary', name: 'FERAN TORRES', position: 'LW', ovr: 119 },
  { file: 'p144.gif', rarity: 'legendary', name: 'JOELINTON', position: 'CM', ovr: 118 },
  { file: 'p145.gif', rarity: 'epic', name: 'ALEX BERENGUER', position: 'LM', ovr: 118 },
  { file: 'p146.gif', rarity: 'epic', name: 'ORSOLINI', position: 'RM', ovr: 118 },
  { file: 'p147.gif', rarity: 'epic', name: 'DEVID NERES', position: 'LW', ovr: 117 },
  { file: 'p148.gif', rarity: 'epic', name: 'FERNANDEZ-PARDO', position: 'LM', ovr: 117 },
  { file: 'p149.gif', rarity: 'epic', name: 'VAN BOMMEL', position: 'LW', ovr: 117 },
  { file: 'p150.gif', rarity: 'rare', name: 'KNAUFF', position: 'RM', ovr: 116 },
  { file: 'p151.gif', rarity: 'rare', name: 'NUSA', position: 'LM', ovr: 115 },
  { file: 'p152.gif', rarity: 'rare', name: 'BORJA IGLESIAS', position: 'ST', ovr: 115 },
  { file: 'p153.gif', rarity: 'rare', name: 'DIEGO MOREIRA', position: 'LM', ovr: 116 },
  { file: 'p154.gif', rarity: 'rare', name: 'PUADO', position: 'ST', ovr: 115 },
  { file: 'p155.gif', rarity: 'rare', name: 'SCHADE', position: 'LM', ovr: 115 },
  { file: 'p156.gif', rarity: 'rare', name: 'DOMPE', position: 'LW', ovr: 116 },
  { file: 'p157.gif', rarity: 'rare', name: 'HOFMANN', position: 'CAM', ovr: 114 },
  { file: 'p158.gif', rarity: 'common', name: 'ISAAC', position: 'ST', ovr: 112 },
  { file: 'p159.gif', rarity: 'common', name: 'DELE-BASHIRU', position: 'CAM', ovr: 114 },
  { file: 'p160.gif', rarity: 'common', name: 'SBAI', position: 'LM', ovr: 113 },
  { file: 'p161.gif', rarity: 'common', name: 'WALDSCHMIDT', position: 'CAM', ovr: 113 },
  { file: 'p162.gif', rarity: 'common', name: 'GORY', position: 'ST', ovr: 113 },
  { file: 'p163.gif', rarity: 'common', name: 'DANJUMA', position: 'ST', ovr: 114 },
  { file: 'p165.gif', rarity: 'mythical', name: 'BEST', position: 'RW', ovr: 122 },
  { file: 'p166.gif', rarity: 'epic', name: 'DALGLISH', position: 'ST', ovr: 117 },
  { file: 'p167.gif', rarity: 'legendary', name: 'RAUL', position: 'ST', ovr: 118 },
  { file: 'p168.gif', rarity: 'mythical', name: 'SHEVECHENKO', position: 'ST', ovr: 121 },
  { file: 'p169.gif', rarity: 'legendary', name: 'DALGLISH', position: 'ST', ovr: 119 },
  { file: 'p170.gif', rarity: 'mythical', name: 'SUAREZ', position: 'ST', ovr: 122 },
  { file: 'p171.gif', rarity: 'mythical', name: 'C. RONALDO', position: 'ST', ovr: 122 },
  { file: 'p172.gif', rarity: 'legendary', name: 'KANU', position: 'ST', ovr: 120 },
  { file: 'p173.gif', rarity: 'mythical', name: 'RAMIRES', position: 'CDM', ovr: 121 },
  { file: 'p174.gif', rarity: 'mythical', name: 'LUFFY', position: 'ST', ovr: 122 },
  { file: 'p175.gif', rarity: 'mythical', name: 'ZORO', position: 'LW', ovr: 122 },
  { file: 'p176.gif', rarity: 'mythical', name: 'SANJI', position: 'RW', ovr: 122 },
  { file: 'p177.gif', rarity: 'mythical', name: 'BACKHAM', position: 'RW', ovr: 123 },
  { file: 'p178.gif', rarity: 'mythical', name: 'NEYMAR', position: 'LW', ovr: 123 },
  { file: 'p179.gif', rarity: 'mythical', name: 'RONALDO', position: 'ST', ovr: 124 },
  { file: 'p180.gif', rarity: 'mythical', name: 'SALIBA', position: 'CB', ovr: 122 },
  
  /* ── CARD even pass onepice ─────────────────────────────────────────*/
  { file: 'p181.gif', rarity: 'mythical', name: 'SHANK', position: 'GK', ovr: 122 },
  { file: 'p182.gif', rarity: 'mythical', name: 'KIZARU', position: 'CB', ovr: 122 },
  { file: 'p183.gif', rarity: 'mythical', name: 'ROGER', position: 'CB', ovr: 122 },
  { file: 'p184.gif', rarity: 'mythical', name: 'SABO', position: 'RB', ovr: 122 },
  { file: 'p185.gif', rarity: 'mythical', name: 'BROOK', position: 'CM', ovr: 122 },
  { file: 'p186.gif', rarity: 'mythical', name: 'USOPP', position: 'LB', ovr: 122 },
  { file: 'p187.gif', rarity: 'mythical', name: 'LUFFY', position: 'CAM', ovr: 122 },
];
