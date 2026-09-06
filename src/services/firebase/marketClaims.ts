/**
 * "ใบจอง" ของตลาดซื้อขาย — จุดเดียวของระบบนี้ที่ต้องใช้ฐานข้อมูลจริง
 *
 * ตัวประกาศขายไม่ได้ถูกเก็บไว้ที่ไหน (คำนวณจากรอบเวลา — services/market.ts)
 * สิ่งเดียวที่ทุกคนต้องเห็นตรงกันคือ "ใบไหนถูกซื้อไปแล้ว" ซึ่งเก็บเป็นเอกสาร
 * หนึ่งใบต่อหนึ่งประกาศ โดยใช้ listingId เป็นชื่อเอกสาร
 *
 * ⚠️ หัวใจของการกันซื้อซ้ำอยู่ที่ firestore.rules:
 *   marketClaims/{listingId} — allow create เท่านั้น · update/delete ปิดตาย
 * เอกสารชื่อเดียวกันจึงถูกสร้างได้ครั้งเดียวในระบบ ใครสร้างสำเร็จคือคนที่ได้ไป
 * สองคนกดพร้อมกัน คนที่สองจะถูกเซิร์ฟเวอร์ปฏิเสธเสมอ ไม่ใช่แค่เช็คในเครื่อง
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';
import type { MarketListing } from '@/types/market';

/** ชื่อ collection ของใบจอง */
export const MARKET_CLAIMS = 'marketClaims';

/** ใบจองหนึ่งใบ (ต้องตรงกับเงื่อนไขใน firestore.rules) */
export interface MarketClaim {
  listingId: string;
  buyerUid: string;
  playerId: string;
  price: number;
  /** รอบที่ประกาศใบนี้เกิด — ใช้เป็นตัวกรองตอนอ่าน ไม่ต้องโหลดใบเก่าทั้งหมด */
  windowIndex: number;
}

/** ผลของการจองหนึ่งครั้ง */
export type ClaimOutcome =
  /** จองสำเร็จ — คนนี้คือคนที่ได้นักเตะไป */
  | 'ok'
  /** มีคนจองไปก่อนแล้ว */
  | 'taken'
  /** เล่นแบบออฟไลน์ (ยังไม่ได้ตั้งค่า Firebase) — ไม่มีใครให้แย่งอยู่แล้ว */
  | 'offline'
  /** เซิร์ฟเวอร์ปฏิเสธ — มักแปลว่ายังไม่ได้ deploy firestore.rules ชุดใหม่ */
  | 'denied'
  | 'error';

/** สัญญาณภายในว่าใบนี้ถูกจองไปแล้ว (ไม่ใช่ error จริง จึงไม่ log) */
const TAKEN = 'market/taken';

/**
 * ติดตามใบจองของรอบที่ยังมีของอยู่ (เรียลไทม์)
 *
 * ใช้ onSnapshot เพื่อให้ของที่คนอื่นเพิ่งซื้อหายจากจอเราทันที
 * โดยไม่ต้องกดรีเฟรช — และประหยัดกว่าการดึงทั้ง collection ทุกนาที
 *
 * @param sinceWindow อ่านเฉพาะใบจองของรอบนี้ขึ้นไป (รอบเก่ากว่านั้นหมดอายุไปแล้ว)
 * @returns ฟังก์ชันสำหรับเลิกติดตาม
 */
export const watchMarketClaims = (
  sinceWindow: number,
  onChange: (claimed: Map<string, string>) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange(new Map());
    return () => undefined;
  }

  const claims = query(
    collection(firebase.db, MARKET_CLAIMS),
    where('windowIndex', '>=', sinceWindow),
  );

  return onSnapshot(
    claims,
    (snapshot) => {
      const map = new Map<string, string>();
      snapshot.forEach((entry) => {
        const data = entry.data() as Partial<MarketClaim>;
        map.set(entry.id, String(data.buyerUid ?? ''));
      });
      onChange(map);
    },
    (error) => {
      // อ่านไม่ได้ = ยังไม่ได้ deploy rules ชุดใหม่ — ตลาดยังเปิดได้ แค่ไม่รู้ว่าใครซื้ออะไรไป
      console.error('[market] อ่านใบจองไม่สำเร็จ', error);
      onChange(new Map());
    },
  );
};

/**
 * จองประกาศหนึ่งใบให้ผู้เล่นคนนี้
 *
 * ใช้ transaction เพื่อให้ "เช็คว่ามีคนจองยัง" กับ "สร้างใบจอง" เป็นขั้นตอนเดียวกัน
 * ต่อให้สองเครื่องอ่านเห็นว่ายังว่างพร้อมกัน ก็จะมีแค่เครื่องเดียวที่เขียนผ่าน
 *
 * ⚠️ ต้องเรียก "ก่อน" หักเหรียญเสมอ — ถ้าจองไม่ได้ต้องไม่มีอะไรถูกหักเลย
 */
export const claimMarketListing = async (
  listing: MarketListing,
  buyerUid: string,
): Promise<ClaimOutcome> => {
  const firebase = getFirebase();
  if (!firebase) return 'offline';

  const claim: MarketClaim = {
    listingId: listing.id,
    buyerUid,
    playerId: listing.playerId,
    price: listing.price,
    windowIndex: listing.windowIndex,
  };

  try {
    await runTransaction(firebase.db, async (transaction) => {
      const ref = doc(firebase.db, MARKET_CLAIMS, listing.id);
      const snapshot = await transaction.get(ref);

      if (snapshot.exists()) throw new Error(TAKEN);

      transaction.set(ref, { ...claim, at: serverTimestamp() });
    });

    return 'ok';
  } catch (error) {
    if ((error as Error)?.message === TAKEN) return 'taken';

    const code = String((error as { code?: string } | null)?.code ?? '');
    if (code.includes('permission-denied')) {
      /*
       * rules ปิด update/delete ไว้ การเขียนทับใบที่มีอยู่แล้วจึงถูกปฏิเสธด้วยรหัสนี้
       * เท่ากับ "มีคนจองไปแล้ว" อีกทางหนึ่ง — แต่ก็เป็นรหัสเดียวกับตอนที่ยังไม่ได้
       * deploy rules ชุดใหม่ ผู้เรียกจึงควรบอกผู้เล่นให้ครอบคลุมทั้งสองแบบ
       */
      return 'denied';
    }

    console.error('[market] จองนักเตะไม่สำเร็จ', error);
    return 'error';
  }
};

/* ══════════════════════════════════════════════════════════════
 *  สำหรับหน้าแอดมิน
 * ══════════════════════════════════════════════════════════════ */

/** ใบจองหนึ่งใบพร้อมเวลาที่ซื้อ (ใช้แสดงประวัติในหน้าแอดมิน) */
export interface MarketClaimRecord extends MarketClaim {
  /** เวลาที่ซื้อ (มิลลิวินาที) — 0 = เซิร์ฟเวอร์ยังไม่ได้ประทับเวลากลับมา */
  atMs: number;
}

/**
 * ประวัติการซื้อล่าสุด เรียงจากใหม่ไปเก่า (ADMIN → ตลาดซื้อขาย)
 *
 * อ่านเฉพาะรอบที่ยังใหม่พอ เพื่อไม่ให้ลากใบจองทั้งหมดตั้งแต่เปิดเกม
 */
export const watchRecentClaims = (
  sinceWindow: number,
  onChange: (rows: MarketClaimRecord[]) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange([]);
    return () => undefined;
  }

  const claims = query(
    collection(firebase.db, MARKET_CLAIMS),
    where('windowIndex', '>=', sinceWindow),
  );

  return onSnapshot(
    claims,
    (snapshot) => {
      const rows = snapshot.docs.map((entry) => {
        const data = entry.data() as Partial<MarketClaim> & { at?: { toMillis?: () => number } };

        return {
          listingId: entry.id,
          buyerUid: String(data.buyerUid ?? ''),
          playerId: String(data.playerId ?? ''),
          price: Number(data.price) || 0,
          windowIndex: Number(data.windowIndex) || 0,
          atMs: typeof data.at?.toMillis === 'function' ? data.at.toMillis() : 0,
        } satisfies MarketClaimRecord;
      });

      rows.sort((left, right) => right.atMs - left.atMs);
      onChange(rows);
    },
    (error) => {
      console.error('[market] อ่านประวัติการซื้อไม่สำเร็จ', error);
      onChange([]);
    },
  );
};

/**
 * ปล่อยประกาศคืนตลาด (ลบใบจอง) — ทำได้เฉพาะเจ้าของโปรเจค
 *
 * ⚠️ ไม่ได้ดึงการ์ดคืนจากคนที่ซื้อไป และไม่ได้คืนเหรียญให้
 * ใช้สำหรับเคลียร์ของตอนทดสอบหรือกรณีที่ตกลงกับผู้เล่นแล้วเท่านั้น
 *
 * @returns ข้อความ error (null = สำเร็จ)
 */
export const releaseMarketClaim = async (listingId: string): Promise<string | null> => {
  const firebase = getFirebase();
  if (!firebase) return 'ต้องต่อออนไลน์ก่อน';

  try {
    await deleteDoc(doc(firebase.db, MARKET_CLAIMS, listingId));
    return null;
  } catch (error) {
    console.error('[market] ปล่อยใบจองคืนไม่สำเร็จ', error);
    return 'ลบไม่สำเร็จ — ตรวจว่าใส่ uid ของคุณไว้ใน firestore.rules แล้ว';
  }
};
