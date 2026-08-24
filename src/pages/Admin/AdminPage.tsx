/**
 * หน้า ADMIN — เห็นเฉพาะไอดีที่อยู่ใน OWNER_USERNAMES (src/data/rankRewards.ts)
 *
 * รอบแรกมี 3 อย่าง: เสกของ · รีเซ็ตดาว/ซีซัน · ประกาศกลางจอ
 * (รอบสองจะเพิ่ม: สร้าง card pack · จัดร้านแลกแต้ม · แบนผู้เล่น)
 *
 * คนที่ไม่ใช่เจ้าของ ต่อให้พิมพ์ /admin เข้ามาเองก็เห็นแค่ข้อความปฏิเสธ
 * และต่อให้แก้โค้ดฝั่งหน้าเว็บ Firestore ก็ยังปฏิเสธการเขียนอยู่ดี (ดู firestore.rules)
 */
import { AnnouncementPanel } from '@/components/admin/AnnouncementPanel';
import { GiftPanel } from '@/components/admin/GiftPanel';
import { LadderPanel } from '@/components/admin/LadderPanel';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useOnline } from '@/hooks/useOnline';

export const AdminPage = () => {
  const { isOwner, uid } = useGameConfig();
  const { connected, playerCount } = useOnline();

  if (!isOwner) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl uppercase">เข้าไม่ได้</p>
        <p className="mt-2 text-sm text-chalk/50">หน้านี้สำหรับผู้ดูแลเกมเท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl">ผู้ดูแลเกม</h2>
        <p className="text-sm text-chalk/50">
          {connected ? `ต่อกับเซิร์ฟเวอร์อยู่ · ผู้เล่น ${playerCount} คน` : 'ยังไม่ได้ต่อเซิร์ฟเวอร์'}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-chalk/35">
          uid ของคุณ: {uid ?? '—'} (ต้องอยู่ใน isProjectOwner() ของ firestore.rules ถึงจะบันทึกได้)
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <GiftPanel />
        </div>
        <div className="space-y-4">
          <LadderPanel />
          <AnnouncementPanel />
        </div>
      </div>
    </div>
  );
};
