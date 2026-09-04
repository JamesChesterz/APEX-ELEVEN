/**
 * ส่งประกาศอัตโนมัติเข้าห้องแชท
 *
 * ทำไมไม่ใช้ useChat: useChat เปิด onSnapshot ฟังห้องแชทตั้งแต่ถูกเรียก
 * ถ้าหน้าร้านซองกับหน้าอัปเกรดเรียก useChat เพื่อจะ "ส่งอย่างเดียว"
 * จะกลายเป็นเปิดการติดตามห้องแชทเพิ่มอีกสองชุด = จ่ายค่าอ่านฟรี ๆ
 * ฮุกนี้จึงมีแค่ฝั่งส่ง ไม่ฟังอะไรเลย
 *
 * ล้มเหลวก็เงียบ — ประกาศไม่ขึ้นไม่ควรทำให้การเปิดซองหรือการตีบวกพัง
 */
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useTeam } from '@/hooks/useTeam';
import { ONLINE } from '@/services/accountStore';
import { isBanned } from '@/services/admin';
import { ANNOUNCE_COOLDOWN_MS, type ChatKind } from '@/services/announcements';
import { sendChat } from '@/services/firebase/chat';
import { createId } from '@/utils/helpers';

/**
 * เวลาที่ประกาศครั้งล่าสุด — เก็บไว้ระดับโมดูล ไม่ใช่ใน state
 * เพราะต้องคุมข้ามหน้า (เปิดซองแล้วเด้งไปหน้าอัปเกรดต่อ ก็ยังนับคูลดาวน์เดียวกัน)
 */
let lastAnnouncedAt = 0;

export const useAnnounce = () => {
  const { account } = useAuth();
  const { rating, team } = useTeam();
  const { record } = useMatchmaking();
  const { bans } = useGameConfig();

  const uid = account?.id ?? null;
  const suspended = isBanned(bans, uid);

  return useCallback(
    async (kind: ChatKind, text: string): Promise<void> => {
      // ออฟไลน์/ยังไม่ล็อกอิน/ถูกระงับ = ไม่ประกาศ (คนถูกแบนพิมพ์เองก็ไม่ได้อยู่แล้ว)
      if (!ONLINE || !uid || suspended || !text) return;

      const at = Date.now();
      if (at - lastAnnouncedAt < ANNOUNCE_COOLDOWN_MS) return;
      lastAnnouncedAt = at;

      try {
        await sendChat({
          id: createId('a'),
          uid,
          managerName: account?.managerName ?? 'ผู้จัดการ',
          teamName: team.name,
          teamOvr: rating.matchOvr,
          points: record.points,
          text,
          kind,
          sentAt: new Date(at).toISOString(),
        });
      } catch (error) {
        console.error('[chat] ส่งประกาศไม่สำเร็จ', error);
      }
    },
    [account?.managerName, rating.matchOvr, record.points, suspended, team.name, uid],
  );
};
