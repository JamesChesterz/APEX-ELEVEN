/**
 * โปรไฟล์ของผู้เล่นคนหนึ่งแบบสดที่สุดเท่าที่ทำได้
 *
 * ตารางอันดับถูกดึงเป็นรอบทุกไม่กี่นาที (เพื่อประหยัดค่าอ่าน) ข้อมูลในมือจึงอาจเก่าไปนิด
 * แต่จังหวะที่คนอยากเห็นของสดที่สุดคือ "ตอนกดเปิดดูทีมของเขา" พอดี
 *
 * ฮุกนี้จึงคืนของที่มีอยู่ให้ทันที (จะได้ไม่ต้องรอหน้าจอว่าง) แล้วยิงดึงใบเดียวใหม่
 * เบื้องหลัง พอได้ของสดก็สลับให้เอง — ราคาแค่ 1 การอ่านต่อการกดหนึ่งครั้ง
 */
import { useEffect, useMemo } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useOnline } from '@/hooks/useOnline';
import { botTickAt } from '@/services/bots';
import { botProfileById, isBotId } from '@/services/botSquad';
import type { PublicProfile } from '@/services/firebase/profiles';

/** @param uid uid ที่กำลังเปิดดู (null = ยังไม่ได้เปิด) */
export const useFreshProfile = (uid: string | null): PublicProfile | null => {
  const { profileByUid, refreshProfile } = useOnline();
  const { bots } = useGameConfig();

  useEffect(() => {
    // ทีมจำลองไม่มีเอกสารบนเซิร์ฟเวอร์ ยิงไปก็เสียค่าอ่านฟรี ๆ แล้วได้ null
    if (!uid || isBotId(uid)) return;
    void refreshProfile(uid);
  }, [refreshProfile, uid]);

  /** ตัวจริงของทีมจำลองปั้นสดจาก seed — ทีมเดิมได้ผู้เล่นชุดเดิมทุกครั้ง */
  const botProfile = useMemo(
    () => (uid && isBotId(uid) ? botProfileById(uid, botTickAt(), bots) : null),
    [bots, uid],
  );

  if (botProfile) return botProfile;

  return uid ? profileByUid[uid] ?? null : null;
};
