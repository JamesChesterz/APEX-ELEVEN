/**
 * Live แชท — ห้องเดียวสำหรับทุกคนในเกม
 *
 * เก็บที่ collection `chat` แบนราบ ไม่แยกห้อง
 * อ่านย้อนหลังแค่ข้อความล่าสุดตาม CHAT_HISTORY_LIMIT เพื่อไม่ให้โหลดหนัก
 *
 * แก้ข้อความที่ส่งไปแล้วไม่ได้ (กันคนเปลี่ยนคำหลังคนอื่นตอบไปแล้ว)
 * ลบได้เฉพาะเจ้าของข้อความและเจ้าของโปรเจค — ดู firestore.rules
 */
import {
  collection,
  deleteDoc,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';
import { CHAT_HISTORY_LIMIT, type ChatMessage } from '@/services/chat';

const CHAT = 'chat';

/**
 * เฝ้าข้อความล่าสุดแบบเรียลไทม์
 * Firestore เรียงจากใหม่ไปเก่า เราพลิกกลับให้เก่าอยู่บนตามธรรมชาติของแชท
 */
export const watchChat = (onMessages: (messages: ChatMessage[]) => void): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) return () => undefined;

  const recent = query(
    collection(firebase.db, CHAT),
    orderBy('createdAt', 'desc'),
    fbLimit(CHAT_HISTORY_LIMIT),
  );

  return onSnapshot(
    recent,
    (snapshot) => {
      const messages = snapshot.docs.map((entry) => ({
        ...(entry.data() as ChatMessage),
        id: entry.id,
      }));

      onMessages(messages.reverse());
    },
    (error) => console.error('[firebase] อ่านแชทไม่สำเร็จ', error),
  );
};

/** ส่งข้อความเข้าห้องแชท */
export const sendChat = async (message: ChatMessage): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  await setDoc(doc(firebase.db, CHAT, message.id), {
    ...message,
    createdAt: serverTimestamp(),
  });
};

/** ลบข้อความ (เจ้าของข้อความ หรือเจ้าของโปรเจค) */
export const deleteChat = async (id: string): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  await deleteDoc(doc(firebase.db, CHAT, id));
};
