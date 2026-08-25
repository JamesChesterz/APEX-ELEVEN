/**
 * Live แชทของทั้งเกม
 *
 * ฝั่งนี้ดูแล: โหลดข้อความล่าสุด · คูลดาวน์กันสแปม · ส่งข้อความพร้อมข้อมูลทีมล่าสุด
 *
 * ข้อมูลที่ติดไปกับข้อความ (ชื่อ ค่าพลัง ดาว) เป็น "ภาพ ณ ตอนที่พิมพ์"
 * ไม่ได้ไปดึงโปรไฟล์ใหม่ทุกครั้งที่แสดงผล — แชทเก่าจึงยังเห็นค่าพลังตอนนั้นจริง ๆ
 * และไม่ต้องยิงอ่านโปรไฟล์เพิ่มทีละข้อความ
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useTeam } from '@/hooks/useTeam';
import { ONLINE } from '@/services/accountStore';
import { isBanned } from '@/services/admin';
import {
  chatCooldownLeft,
  cleanChatText,
  isSendableChat,
  type ChatMessage,
} from '@/services/chat';
import { deleteChat, sendChat, watchChat } from '@/services/firebase/chat';
import { playSfx } from '@/services/sound';
import { createId } from '@/utils/helpers';

export const useChat = () => {
  const { account } = useAuth();
  const { rating, team } = useTeam();
  const { record } = useMatchmaking();
  const { bans, isOwner } = useGameConfig();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /** เวลาที่ส่งข้อความล่าสุด ใช้คิดคูลดาวน์ */
  const lastSentAt = useRef<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const uid = account?.id ?? null;
  const suspended = isBanned(bans, uid);

  useEffect(() => {
    if (!ONLINE) return undefined;
    return watchChat(setMessages);
  }, []);

  // เดินนาฬิกาคูลดาวน์เฉพาะตอนที่ยังนับไม่หมด
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;

    const id = window.setInterval(
      () => setCooldownLeft(chatCooldownLeft(lastSentAt.current, Date.now())),
      250,
    );

    return () => window.clearInterval(id);
  }, [cooldownLeft]);

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      setError(null);

      if (!ONLINE || !uid) {
        setError('ต้องต่อเซิร์ฟเวอร์ก่อนถึงจะคุยได้');
        return false;
      }

      if (suspended) {
        setError('บัญชีถูกระงับ พิมพ์ไม่ได้');
        return false;
      }

      const text = cleanChatText(raw);
      if (!isSendableChat(text)) return false;

      const wait = chatCooldownLeft(lastSentAt.current, Date.now());
      if (wait > 0) {
        setCooldownLeft(wait);
        setError(`พิมพ์ถี่เกินไป รออีก ${Math.ceil(wait / 1000)} วินาที`);
        return false;
      }

      setSending(true);

      try {
        await sendChat({
          id: createId('m'),
          uid,
          managerName: account?.managerName ?? 'ผู้จัดการ',
          teamName: team.name,
          teamOvr: rating.matchOvr,
          points: record.points,
          text,
          sentAt: new Date().toISOString(),
        });

        lastSentAt.current = Date.now();
        setCooldownLeft(chatCooldownLeft(lastSentAt.current, Date.now()));
        playSfx('click');
        return true;
      } catch (sendError) {
        console.error('[chat] ส่งข้อความไม่สำเร็จ', sendError);
        setError('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง');
        return false;
      } finally {
        setSending(false);
      }
    },
    [account?.managerName, rating.matchOvr, record.points, suspended, team.name, uid],
  );

  /** ลบข้อความ — เจ้าของข้อความหรือเจ้าของโปรเจคเท่านั้น */
  const remove = useCallback(
    async (message: ChatMessage) => {
      if (message.uid !== uid && !isOwner) return;

      try {
        await deleteChat(message.id);
      } catch (deleteError) {
        console.error('[chat] ลบข้อความไม่สำเร็จ', deleteError);
      }
    },
    [isOwner, uid],
  );

  return useMemo(
    () => ({
      messages,
      /** uid ของเรา ใช้ไฮไลต์ข้อความตัวเอง */
      uid,
      /** true = ลบข้อความของคนอื่นได้ */
      canModerate: isOwner,
      /** true = ถูกระงับ พิมพ์ไม่ได้ */
      suspended,
      cooldownLeft,
      sending,
      error,
      send,
      remove,
    }),
    [cooldownLeft, error, isOwner, messages, remove, send, sending, suspended, uid],
  );
};
