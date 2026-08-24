/**
 * ค่าประจำแต่ละระดับการ์ดสำหรับเอฟเฟกต์เปิดซอง
 *
 * ไฟล์นี้คือ "หน้าปัดปรับจูน" ของทั้งฉาก — อยากให้ระดับไหนอลังขึ้นหรือเบาลง
 * แก้ที่นี่ที่เดียว ไม่ต้องไปแตะโค้ดแอนิเมชัน
 *
 * layers บอกว่าระดับนั้นเปิดเลเยอร์ไหนบ้าง (ดูตัวเลเยอร์ที่ PackFxLayers.tsx)
 * ยิ่งการ์ดดี ยิ่งเปิดเลเยอร์เยอะและลุ้นนานขึ้น ทำให้รู้ตั้งแต่จังหวะซองสั่น
 * ว่ากำลังจะได้ของดีหรือของธรรมดา
 */
import type { Rarity } from '@/types/player';

/** เลเยอร์เอฟเฟกต์ทั้งหมดที่ประกอบกันเป็นฉากเปิดซอง */
export interface FxLayers {
  /** พลังงานวิ่งตามรอยแตกของซอง */
  energy: boolean;
  /** วงแหวนคลื่นกระแทกตอนซองแตก */
  shockwave: boolean;
  /** ลำแสงหมุนรอบการ์ด */
  rays: boolean;
  /** ลำแสงตั้งพุ่งขึ้นจากพื้นเวที */
  beams: boolean;
  /** ประกายพุ่งออกจากจุดกลาง */
  sparks: boolean;
  /** เศษริบบิ้นร่วงจากด้านบน */
  confetti: boolean;
  /** แท่นเวทีใต้การ์ด */
  podium: boolean;
  /** ไฟสปอตไลต์สเตเดียมด้านบน */
  floodlights: boolean;
  /** จอสั่นตอนการ์ดโผล่ */
  shake: boolean;
  /** ม่านออโรราไล่สี + คริสตัลโคจร + วงแหวนรูน (เปิดเฉพาะ mythical) */
  aurora: boolean;
}

export interface RarityFx {
  /** สีหลักของฉาก */
  color: string;
  /** สีรอง ใช้ไล่เฉดกับสีหลักในออร่าและลำแสง */
  accent: string;
  label: string;
  verdict: string;
  /** ข้อความระหว่างซองสั่น */
  teaser: string;
  /** เวลาที่ซองสั่นสะสมพลังก่อนแตก (ms) */
  tearMs: number;
  /** ความเข้มโดยรวม 0–1 คูณกับความทึบของทุกเลเยอร์ */
  intensity: number;
  /** จำนวนประกายที่พุ่งออกตอนซองแตก */
  sparkCount: number;
  /** จำนวนประกายลอยขึ้นรอบการ์ด */
  emberCount: number;
  layers: FxLayers;
}

/** เลเยอร์ที่ปิดหมด ใช้เป็นฐานแล้วเปิดเฉพาะที่ต้องการ */
const NO_LAYERS: FxLayers = {
  energy: false,
  shockwave: false,
  rays: false,
  beams: false,
  sparks: false,
  confetti: false,
  podium: false,
  floodlights: false,
  shake: false,
  aurora: false,
};

export const RARITY_FX: Record<Rarity, RarityFx> = {
  common: {
    color: '#9AA7A0',
    accent: '#C8D2CC',
    label: 'COMMON',
    verdict: 'การ์ดธรรมดา',
    teaser: 'กำลังเปิดซอง',
    tearMs: 550,
    intensity: 0.32,
    sparkCount: 0,
    emberCount: 0,
    layers: { ...NO_LAYERS, energy: true },
  },
  rare: {
    color: '#4FB3D9',
    accent: '#A8E4FF',
    label: 'RARE',
    verdict: 'ได้ของหายาก',
    teaser: 'ซองเริ่มสั่น...',
    tearMs: 950,
    intensity: 0.6,
    sparkCount: 10,
    emberCount: 8,
    layers: { ...NO_LAYERS, energy: true, shockwave: true, rays: true, sparks: true },
  },
  epic: {
    color: '#A46BF5',
    accent: '#E0C4FF',
    label: 'EPIC',
    verdict: 'ของดี!',
    teaser: 'มีบางอย่างกำลังมา...',
    tearMs: 1450,
    intensity: 0.82,
    sparkCount: 18,
    emberCount: 16,
    layers: {
      ...NO_LAYERS,
      energy: true,
      shockwave: true,
      rays: true,
      beams: true,
      sparks: true,
      podium: true,
      shake: true,
    },
  },
  legendary: {
    color: '#F5C445',
    accent: '#FFF3C4',
    label: 'LEGENDARY',
    verdict: 'WALKOUT!',
    teaser: 'ซองแทบระเบิด!',
    tearMs: 2200,
    intensity: 1,
    sparkCount: 28,
    emberCount: 26,
    layers: {
      ...NO_LAYERS,
      energy: true,
      shockwave: true,
      rays: true,
      beams: true,
      sparks: true,
      confetti: true,
      podium: true,
      floodlights: true,
      shake: true,
    },
  },
  mythical: {
    color: '#FF3FA4',
    accent: '#7CE7FF',
    label: 'MYTHICAL',
    verdict: 'MYTHICAL WALKOUT!!',
    teaser: 'มีบางอย่างที่ไม่ควรอยู่ในซองนี้...',
    // สั่นนานกว่า legendary เกือบเท่าตัว เพราะผู้เล่นจะเจอไม่กี่ครั้งต่อซีซัน — ให้ลุ้นคุ้ม
    tearMs: 3200,
    intensity: 1,
    sparkCount: 40,
    emberCount: 34,
    layers: {
      energy: true,
      shockwave: true,
      rays: true,
      beams: true,
      sparks: true,
      confetti: true,
      podium: true,
      floodlights: true,
      shake: true,
      aurora: true,
    },
  },
};

/** ลำดับความดีของระดับการ์ด ใช้เรียงให้ใบดีที่สุดถูกเปิดเป็นใบสุดท้าย */
export const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythical: 4,
};

/** แปลงสี hex เป็น rgba เพื่อผสมแสงหลายชั้นได้ */
export const alpha = (hex: string, value: number): string => {
  const int = parseInt(hex.slice(1), 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${value})`;
};
