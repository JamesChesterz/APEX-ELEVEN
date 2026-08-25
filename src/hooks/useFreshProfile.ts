/**
 * โปรไฟล์ของผู้เล่นคนหนึ่งแบบสดที่สุดเท่าที่ทำได้
 *
 * ตารางอันดับถูกดึงเป็นรอบทุกไม่กี่นาที (เพื่อประหยัดค่าอ่าน) ข้อมูลในมือจึงอาจเก่าไปนิด
 * แต่จังหวะที่คนอยากเห็นของสดที่สุดคือ "ตอนกดเปิดดูทีมของเขา" พอดี
 *
 * ฮุกนี้จึงคืนของที่มีอยู่ให้ทันที (จะได้ไม่ต้องรอหน้าจอว่าง) แล้วยิงดึงใบเดียวใหม่
 * เบื้องหลัง พอได้ของสดก็สลับให้เอง — ราคาแค่ 1 การอ่านต่อการกดหนึ่งครั้ง
 */
import { useEffect } from 'react';
import { useOnline } from '@/hooks/useOnline';
import type { PublicProfile } from '@/services/firebase/profiles';

/** @param uid uid ที่กำลังเปิดดู (null = ยังไม่ได้เปิด) */
export const useFreshProfile = (uid: string | null): PublicProfile | null => {
  const { profileByUid, refreshProfile } = useOnline();

  useEffect(() => {
    if (!uid) return;
    void refreshProfile(uid);
  }, [refreshProfile, uid]);

  return uid ? profileByUid[uid] ?? null : null;
};
