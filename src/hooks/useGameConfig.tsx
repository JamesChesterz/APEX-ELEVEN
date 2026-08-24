/**
 * ค่าตั้งกลางที่แอดมินกำหนด แล้วทุกเครื่องต้องเห็นตรงกัน
 *
 * ตอนนี้ดูแลสองเรื่อง:
 *   1. คำสั่งรีเซ็ตดาว/ซีซัน (config/ladder) — รวมถึงจำนวนวันต่อซีซัน
 *   2. ประกาศกลางจอ (config/announcement)
 *
 * ฝั่งผู้เล่นแค่ "อ่านแล้วทำตาม" ส่วนฝั่งแอดมินใช้ saveLadder/saveAnnouncement
 * เขียนค่าใหม่ (คนที่ไม่ใช่เจ้าของโปรเจคจะถูก Firestore ปฏิเสธตั้งแต่ที่เซิร์ฟเวอร์)
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ONLINE } from '@/services/accountStore';
import { EMPTY_LADDER, type Announcement, type LadderCommand } from '@/services/admin';
import { CONFIG_DOCS, saveConfigDoc, watchConfigDoc } from '@/services/firebase/gameConfig';
import { isOwnerUsername } from '@/services/rankRewards';

interface GameConfigContextValue {
  /** คำสั่งรีเซ็ตดาว/ซีซันล่าสุดจากแอดมิน */
  ladder: LadderCommand;
  /** ประกาศกลางจอ (null = ไม่มี) */
  announcement: Announcement | null;
  /** true = บัญชีนี้เป็นเจ้าของโปรเจค */
  isOwner: boolean;
  uid: string | null;
  /** บันทึกคำสั่งรีเซ็ต คืนข้อความ error (null = สำเร็จ) */
  saveLadder: (command: LadderCommand) => Promise<string | null>;
  /** บันทึกประกาศ คืนข้อความ error (null = สำเร็จ) */
  saveAnnouncement: (announcement: Announcement) => Promise<string | null>;
}

const GameConfigContext = createContext<GameConfigContextValue | null>(null);

/** ข้อความ error ที่เจอบ่อยที่สุด: ยังไม่ได้ใส่ uid ของตัวเองใน firestore.rules */
const DENIED =
  'บันทึกไม่สำเร็จ — ต้องเพิ่ม uid ของคุณใน firestore.rules ก่อน (ดูวิธีในไฟล์นั้น)';

export const GameConfigProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const [ladder, setLadder] = useState<LadderCommand>(EMPTY_LADDER);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!ONLINE) return undefined;

    const stopLadder = watchConfigDoc<LadderCommand>(CONFIG_DOCS.ladder, (value) =>
      setLadder(value ?? EMPTY_LADDER),
    );
    const stopAnnouncement = watchConfigDoc<Announcement>(CONFIG_DOCS.announcement, setAnnouncement);

    return () => {
      stopLadder();
      stopAnnouncement();
    };
  }, []);

  const uid = account?.id ?? null;
  const isOwner = isOwnerUsername(account?.username);

  /** ตัวช่วยเขียนเอกสารตั้งค่า แปลง error เป็นข้อความไทยให้ UI แสดงได้เลย */
  const write = useCallback(
    async (docId: string, value: Record<string, unknown>): Promise<string | null> => {
      if (!uid) return 'ยังไม่ได้เข้าสู่ระบบ';
      if (!ONLINE) return 'โหมดออฟไลน์บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้';

      try {
        await saveConfigDoc(docId, value, uid);
        return null;
      } catch (error) {
        console.error(`[admin] บันทึก ${docId} ไม่สำเร็จ`, error);
        return DENIED;
      }
    },
    [uid],
  );

  const saveLadder = useCallback(
    (command: LadderCommand) => write(CONFIG_DOCS.ladder, { ...command }),
    [write],
  );

  const saveAnnouncement = useCallback(
    (next: Announcement) => write(CONFIG_DOCS.announcement, { ...next }),
    [write],
  );

  const value = useMemo<GameConfigContextValue>(
    () => ({ ladder, announcement, isOwner, uid, saveLadder, saveAnnouncement }),
    [announcement, isOwner, ladder, saveAnnouncement, saveLadder, uid],
  );

  return <GameConfigContext.Provider value={value}>{children}</GameConfigContext.Provider>;
};

export const useGameConfig = (): GameConfigContextValue => {
  const context = useContext(GameConfigContext);
  if (!context) throw new Error('useGameConfig ต้องถูกใช้ภายใน <GameConfigProvider>');
  return context;
};
