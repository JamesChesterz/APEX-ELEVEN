/**
 * ประกาศกลางจอตอนเข้าเกม — ข้อความที่แอดมินตั้งไว้ที่หน้า ADMIN
 *
 * ขึ้นครั้งเดียวต่อหนึ่งเวอร์ชันประกาศ: กดปิดแล้วจะจำไว้ในเครื่อง
 * แอดมินแก้ข้อความเมื่อไหร่ (เวอร์ชันเปลี่ยน) ทุกคนจะเห็นใหม่อีกครั้ง
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { announcementSeenKey, shouldShowAnnouncement } from '@/services/admin';
import { playSfx } from '@/services/sound';

export const AnnouncementModal = () => {
  const { account } = useAuth();
  const { announcement } = useGameConfig();
  const [open, setOpen] = useState(false);

  const uid = account?.id ?? null;

  useEffect(() => {
    if (!uid) return;

    const seen = window.localStorage.getItem(announcementSeenKey(uid));
    setOpen(shouldShowAnnouncement(announcement, seen));
  }, [announcement, uid]);

  if (!open || !announcement || !uid) return null;

  const close = () => {
    playSfx('click');
    window.localStorage.setItem(announcementSeenKey(uid), announcement.version ?? '');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6">
        <p className="eyebrow text-neon">ประกาศจากผู้ดูแล</p>
        <h2 className="mt-1 font-display text-2xl uppercase leading-tight">
          {announcement.title?.trim() || 'ประกาศ'}
        </h2>

        {/* whitespace-pre-line = ขึ้นบรรทัดใหม่ตามที่แอดมินพิมพ์มาจริง ๆ */}
        <p className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-chalk/75">
          {announcement.message}
        </p>

        <button
          type="button"
          onClick={close}
          className="mt-6 w-full rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim"
        >
          รับทราบ
        </button>
      </div>
    </div>
  );
};
