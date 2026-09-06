/**
 * จุดต่อของ "ซื้อนักเตะจากตลาดสำเร็จ"
 *
 * ตั้งใจให้เล็กที่สุดเท่าที่จะเป็นไปได้ เพราะระบบภารกิจเต็มรูปแบบยังไม่ได้ทำในรอบนี้
 * สิ่งที่มีตอนนี้คือช่องเสียบไว้ให้อนาคตต่อภารกิจแบบ "ซื้อนักเตะจากตลาด 1 คน"
 * ได้โดยไม่ต้องแก้หน้าตลาดหรือฝั่งเซิร์ฟเวอร์อีกเลย
 *
 * ตัวนับจริงของภารกิจรายวันอยู่ที่ upgradeDaily.marketBuys (usePlayers)
 * ซึ่งใช้ชุดเดียวกับตัวนับ "เปิดซองการ์ด" ที่ services/missions.ts อ่านอยู่แล้ว
 *
 * เป็น pure module ห้าม import React
 */

/** ข้อมูลของการซื้อหนึ่งครั้งที่สำเร็จแล้ว (ยืนยันจากเซิร์ฟเวอร์) */
export interface MarketPurchaseEvent {
  playerId: string;
  listingId: string;
  /** ราคาที่จ่ายจริง */
  price: number;
  /** id ของการ์ดใบใหม่ในคลัง */
  cardId: string;
  /** ISO string */
  at: string;
}

type MarketPurchaseListener = (event: MarketPurchaseEvent) => void;

const listeners = new Set<MarketPurchaseListener>();

/**
 * ฟังเหตุการณ์ "ซื้อสำเร็จ" — คืนฟังก์ชันสำหรับเลิกฟัง
 *
 * ตัวอย่างการใช้ในอนาคต (ระบบภารกิจ):
 *   useEffect(() => onMarketPurchase((event) => bumpMission('buy-from-market', event)), []);
 */
export const onMarketPurchase = (listener: MarketPurchaseListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * ประกาศว่าซื้อสำเร็จแล้ว — เรียกหลังเซิร์ฟเวอร์ตอบกลับเท่านั้น
 * ห้ามเรียกตอนกดปุ่ม เพราะรายการอาจถูกปฏิเสธที่เซิร์ฟเวอร์
 */
export const emitMarketPurchase = (event: MarketPurchaseEvent): void => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      // ผู้ฟังตัวหนึ่งพังต้องไม่ทำให้ตัวอื่นไม่ได้รับเหตุการณ์
      console.error('[market] ตัวรับเหตุการณ์ซื้อสำเร็จทำงานผิดพลาด', error);
    }
  });
};
