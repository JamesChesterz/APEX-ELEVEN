/**
 * คำสั่งที่แอดมินยิงตรงไปที่เซิร์ฟเวอร์ (นอกเหนือจากการตั้งค่าใน config/)
 *
 * มีสองเรื่อง: รีเซ็ตดาวทั้งกระดาน และส่อง/แก้บัญชีของผู้เล่นรายคน
 *
 * ทำไมแตะ profiles ได้แต่ accounts ไม่ได้:
 *   profiles = ข้อมูลสาธารณะ (ชื่อทีม/ค่าพลัง/ดาว) ไม่มีของมีค่าอยู่ในนั้น
 *   accounts = เซฟทั้งก้อน (เหรียญ, คลังการ์ด) — ปลดล็อกให้ใครเขียนของคนอื่นได้ถือว่าเสี่ยงเกิน
 * ตารางอันดับจึงกลายเป็นศูนย์ทันทีทั้งกระดาน ส่วนดาวในบัญชีจริงของแต่ละคน
 * จะถูกล้างตอนเขาเปิดเกมครั้งถัดไป (ดู hooks/useLadderReset.ts)
 */
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getPlayerById } from '@/data/players';
import { COLLECTIONS, getFirebase } from '@/services/firebase/config';
import { MAX_LEVEL } from '@/services/upgrade';
import type { PlayerCard } from '@/types/card';
import type { AccountState } from '@/types/account';
import type { RankRecord } from '@/types/match';

/** Firestore เขียนได้สูงสุด 500 operation ต่อหนึ่ง batch — เผื่อไว้ที่ 400 */
const BATCH_LIMIT = 400;

/** ดาวใหม่ของแต่ละ uid ที่จะเขียนทับลงตารางอันดับ */
export interface ProfilePointsUpdate {
  uid: string;
  points: number;
}

/**
 * เขียนทับดาว + สถิติแพ้-ชนะในตารางอันดับของหลายบัญชีพร้อมกัน
 * คืนจำนวนแถวที่เขียนสำเร็จ
 */
export const resetProfilePoints = async (updates: ProfilePointsUpdate[]): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase || updates.length === 0) return 0;

  let written = 0;

  for (let start = 0; start < updates.length; start += BATCH_LIMIT) {
    const chunk = updates.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(firebase.db);

    chunk.forEach((update) => {
      batch.set(
        doc(firebase.db, COLLECTIONS.profiles, update.uid),
        { points: Math.max(0, Math.round(update.points)), wins: 0, draws: 0, losses: 0 },
        { merge: true },
      );
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
};

/* ── ส่องบัญชีผู้เล่น ──────────────────────────────────────── */

/** สิ่งที่แอดมินเห็นเมื่อเปิดดูบัญชีคนหนึ่ง */
export interface AdminAccountView {
  uid: string;
  username?: string;
  managerName?: string;
  teamName?: string;
  createdAt?: string;
  state?: AccountState;
}

/**
 * อ่านบัญชีของผู้เล่นคนหนึ่ง (เฉพาะเจ้าของโปรเจค)
 * กฎอนุญาตให้เจ้าของโปรเจคอ่านทุกบัญชี — ดู firestore.rules
 */
export const readAccountForAdmin = async (uid: string): Promise<AdminAccountView | null> => {
  const firebase = getFirebase();
  if (!firebase) return null;

  const snapshot = await getDoc(doc(firebase.db, COLLECTIONS.accounts, uid));
  if (!snapshot.exists()) return null;

  return { uid, ...(snapshot.data() as Omit<AdminAccountView, 'uid'>) };
};

/**
 * ตั้งดาวและสถิติแพ้-ชนะของผู้เล่นคนหนึ่งตรง ๆ
 *
 * เขียนสองที่พร้อมกัน: บัญชีจริง (ค่าที่เกมใช้) และโปรไฟล์ (ค่าที่ตารางอันดับอ่าน)
 * ถ้าเขียนที่เดียวจะกลายเป็นเลขสองชุดไม่ตรงกัน แล้วเด้งกลับตอนเจ้าตัวเปิดเกม
 */
export const setPlayerRecord = async (uid: string, record: RankRecord): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const safe: RankRecord = {
    points: Math.max(0, Math.round(record.points)),
    wins: Math.max(0, Math.round(record.wins)),
    draws: Math.max(0, Math.round(record.draws)),
    losses: Math.max(0, Math.round(record.losses)),
  };

  await Promise.all([
    updateDoc(doc(firebase.db, COLLECTIONS.accounts, uid), { 'state.record': safe }),
    setDoc(doc(firebase.db, COLLECTIONS.profiles, uid), { ...safe }, { merge: true }),
  ]);
};

/**
 * เขียนทับคลังการ์ดของผู้เล่นคนหนึ่ง (เพิ่ม / ลบ / ตีบวก จากหน้า ADMIN)
 *
 * ⚠️ ข้อจำกัดที่ต้องรู้: เครื่องผู้เล่นอ่านบัญชีตัวเองครั้งเดียวตอนล็อกอิน
 * แล้วถือ state ทั้งก้อนไว้ในหน่วยความจำ ไม่ได้ subscribe เอกสารนี้แบบเรียลไทม์
 * ถ้าเจ้าตัวกำลังเปิดเกมอยู่ตอนที่แอดมินแก้ พอเขาทำอะไรที่ทำให้เกมเซฟ
 * (เปิดซอง จบแมตช์ จัดตัว) เครื่องเขาจะเขียน state ชุดเก่าทับของที่เพิ่งแก้ไป
 *
 * จึงควรแก้ตอนเจ้าตัวออกจากเกมแล้ว และให้เขาล็อกอินใหม่ถึงจะเห็นผล
 * ถ้าอยากแจกการ์ดแบบไม่มีความเสี่ยงนี้เลย ให้ใช้หน้า "เสกของขวัญ" แทน
 * (ใบสั่งจะรอในกล่อง แล้วเครื่องเจ้าตัวเป็นคนเพิ่มของเข้าบัญชีเอง)
 *
 * บีบค่าก่อนเขียนเสมอ — level ต้องอยู่ในช่วง 1–MAX_LEVEL และการ์ดต้องอ้างนักเตะที่มีจริง
 */
export const setPlayerCards = async (uid: string, cards: PlayerCard[]): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const safe: PlayerCard[] = cards
    .filter((card) => getPlayerById(card.playerId) !== undefined)
    .slice(0, ADMIN_CARD_LIMIT)
    .map((card) => ({
      id: card.id,
      playerId: card.playerId,
      acquiredAt: card.acquiredAt,
      level: Math.min(Math.max(Math.round(card.level) || 1, 1), MAX_LEVEL),
      inSquad: card.inSquad === true,
    }));

  await updateDoc(doc(firebase.db, COLLECTIONS.accounts, uid), { 'state.cards': safe });
  return safe.length;
};

/** จำนวนการ์ดสูงสุดที่ยอมให้เขียนกลับในหนึ่งครั้ง — กันเอกสารบวมจนชนเพดาน Firestore */
export const ADMIN_CARD_LIMIT = 2_000;

/* ── ตรวจ/ซ่อมดาวที่ไม่ตรงกัน ──────────────────────────────── */

/**
 * ดาวของผู้เล่นหนึ่งคนถูกเก็บไว้สองที่:
 *   accounts/{uid}.state.record — ค่าจริงที่เกมใช้คิดทุกอย่าง
 *   profiles/{uid}              — สำเนาสาธารณะที่ตารางอันดับอ่าน
 *
 * ปกติสองค่านี้ตรงกันเพราะเครื่องผู้เล่นประกาศโปรไฟล์ทุกครั้งที่ค่าเปลี่ยน
 * แต่ถ้าการประกาศถูกกฎปฏิเสธ (เช่นค่าพลังทีมเกินเพดานใน firestore.rules)
 * ฝั่ง profiles จะค้างอยู่กับค่าเก่าแบบเงียบ ๆ ตารางอันดับจึงเพี้ยนจากบัญชีจริง
 *
 * ตัวตรวจนี้ไล่อ่านบัญชีจริงของทุกคนมาเทียบ แล้วให้แอดมินกดเขียนทับให้ตรงได้
 * ⚠️ กินโควตาอ่านเท่ากับจำนวนบัญชีที่ตรวจ (หนึ่งคน = หนึ่ง read) จึงควรกดเมื่อสงสัยเท่านั้น
 */
export interface RecordMismatch {
  uid: string;
  teamName: string;
  managerName: string;
  /** ดาวที่ตารางอันดับแสดงอยู่ตอนนี้ */
  profilePoints: number;
  /** ดาวในบัญชีจริง */
  accountPoints: number;
  /** สถิติเต็มชุดจากบัญชีจริง ใช้เขียนทับตอนซ่อม */
  record: RankRecord;
}

/** ผู้เล่นหนึ่งแถวที่จะเอาไปตรวจ (มาจากตารางอันดับที่โหลดไว้แล้ว) */
export interface AuditTarget {
  uid: string;
  teamName: string;
  managerName: string;
  points: number;
}

/**
 * ไล่เทียบดาวในตารางอันดับกับบัญชีจริงทีละคน คืนเฉพาะคนที่ไม่ตรง
 * อ่านทีละชุดเพื่อไม่ให้ยิงคำขอพร้อมกันเป็นร้อยจนโดนจำกัดอัตรา
 */
export const auditPlayerRecords = async (
  targets: AuditTarget[],
  onProgress?: (done: number, total: number) => void,
): Promise<RecordMismatch[]> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const mismatches: RecordMismatch[] = [];
  const CHUNK = 10;

  for (let start = 0; start < targets.length; start += CHUNK) {
    const chunk = targets.slice(start, start + CHUNK);

    const rows = await Promise.all(
      chunk.map(async (target) => {
        const account = await readAccountForAdmin(target.uid);
        const record = account?.state?.record;
        if (!record) return null;

        // ต่างกันแม้แต่ดาวอย่างเดียวก็ถือว่าไม่ตรง (สถิติแพ้-ชนะเขียนทับให้ด้วยอยู่แล้ว)
        if (record.points === target.points) return null;

        return {
          uid: target.uid,
          teamName: target.teamName,
          managerName: target.managerName,
          profilePoints: target.points,
          accountPoints: record.points,
          record,
        } satisfies RecordMismatch;
      }),
    );

    rows.forEach((row) => {
      if (row) mismatches.push(row);
    });

    onProgress?.(Math.min(targets.length, start + CHUNK), targets.length);
  }

  return mismatches.sort((a, b) => b.accountPoints - a.accountPoints);
};

/**
 * ทิศทางที่จะซ่อมความไม่ตรงกันหนึ่งแถว
 *   toProfile — เชื่อบัญชี แล้วเขียนทับตารางอันดับ
 *   toAccount — เชื่อตารางอันดับ แล้วเขียนทับบัญชี
 */
export type FixDirection = 'toProfile' | 'toAccount';

/**
 * ซ่อมความไม่ตรงกันตามทิศทางที่แอดมินเลือกทีละแถว คืนจำนวนแถวที่เขียน
 *
 * ⚠️ ทำไมต้องให้เลือกทิศทาง ไม่ใช่ยึดบัญชีเป็นหลักเสมอ
 *
 * ในโหมด VITE_SERVER_AUTHORITY=1 เครื่องผู้เล่นถูกห้ามเขียนฟิลด์ state.record
 * (ดู SERVER_OWNED_STATE_FIELDS ใน cloudAccount.ts) มีแต่ Cloud Functions ที่เขียนได้
 * แต่แมตช์ที่เจอบอทถูกตัดสินในเครื่องผู้เล่นเอง ไม่ได้ผ่านเซิร์ฟเวอร์
 * ดาวจากแมตช์เหล่านั้นจึงขึ้นแค่ในหน่วยความจำของเครื่องเขาและในตารางอันดับ
 * แต่ "ไม่เคยไปถึงเอกสารบัญชี" เลย — บัญชีจึงต่ำกว่าความจริง
 *
 * ถ้าซ่อมโดยยึดบัญชีเป็นหลักในกรณีนั้น เท่ากับลบดาวที่เขาเล่นได้จริงทิ้ง
 * แล้วเครื่องเขาก็จะประกาศค่าเดิมกลับมาภายในไม่กี่นาที กลายเป็นดาวเด้งไปมา
 *
 * กติกาที่ปลอดภัยคือ "เลือกค่าที่สูงกว่า" เพราะดาวในเกมนี้ไม่มีทางลดเองจากการเล่น
 */
export const fixRecordMismatches = async (
  rows: Array<{ row: RecordMismatch; direction: FixDirection }>,
): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase || rows.length === 0) return 0;

  let written = 0;

  for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
    const chunk = rows.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(firebase.db);

    chunk.forEach(({ row, direction }) => {
      if (direction === 'toProfile') {
        batch.set(
          doc(firebase.db, COLLECTIONS.profiles, row.uid),
          {
            points: Math.max(0, Math.round(row.record.points)),
            wins: Math.max(0, Math.round(row.record.wins)),
            draws: Math.max(0, Math.round(row.record.draws)),
            losses: Math.max(0, Math.round(row.record.losses)),
            /*
             * ประทับเวลาด้วยเสมอ ไม่งั้นเพดานอัตราการโตของดาว (pointsRateOk)
             * จะยังนับจากครั้งที่เครื่องผู้เล่นแก้ล่าสุด ทำให้เปิดช่องกระโดดทีเดียวหลายร้อยดาว
             */
            pointsUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        return;
      }

      /*
       * เชื่อตารางอันดับ: เขียนดาวกลับเข้าบัญชี
       * ต้องเขียนฝั่งบัญชีด้วย ไม่งั้นตัวตรวจจะเจอแถวเดิมซ้ำทุกครั้งที่กดตรวจ
       * (แอดมินมีสิทธิ์เขียน state.record ผ่าน isProjectOwner ซึ่งข้ามข้อห้ามของผู้เล่น)
       */
      batch.set(
        doc(firebase.db, COLLECTIONS.accounts, row.uid),
        {
          state: {
            record: {
              points: Math.max(0, Math.round(row.profilePoints)),
              wins: Math.max(0, Math.round(row.record.wins)),
              draws: Math.max(0, Math.round(row.record.draws)),
              losses: Math.max(0, Math.round(row.record.losses)),
            },
          },
        },
        { merge: true },
      );
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
};

/**
 * ทิศทางที่ปลอดภัยที่สุดของแถวหนึ่ง — ยึดค่าที่สูงกว่า
 * ดาวในเกมนี้ไม่มีทางลดลงเองจากการเล่น ค่าที่ต่ำกว่าจึงคือฝั่งที่ "ตกหล่น" เสมอ
 */
export const saferDirection = (row: RecordMismatch): FixDirection =>
  row.accountPoints >= row.profilePoints ? 'toProfile' : 'toAccount';

/**
 * เขียนดาวจากบัญชีจริงทับลงตารางอันดับ คืนจำนวนแถวที่เขียน
 * เขียนเฉพาะ profiles — ไม่แตะบัญชีจริง เพราะบัญชีคือค่าที่ถูกต้องอยู่แล้ว
 */
export const syncProfileRecords = async (rows: RecordMismatch[]): Promise<number> => {
  const firebase = getFirebase();
  if (!firebase || rows.length === 0) return 0;

  let written = 0;

  for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
    const chunk = rows.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(firebase.db);

    chunk.forEach((row) => {
      batch.set(
        doc(firebase.db, COLLECTIONS.profiles, row.uid),
        {
          points: Math.max(0, Math.round(row.record.points)),
          wins: Math.max(0, Math.round(row.record.wins)),
          draws: Math.max(0, Math.round(row.record.draws)),
          losses: Math.max(0, Math.round(row.record.losses)),
        },
        { merge: true },
      );
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
};
