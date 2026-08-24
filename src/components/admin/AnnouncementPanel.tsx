/**
 * แผงตั้งประกาศกลางจอ
 *
 * กดบันทึกทีไร "เวอร์ชัน" จะเปลี่ยนใหม่เสมอ ผู้เล่นทุกคนจึงเห็นประกาศอีกครั้ง
 * แม้จะเคยกดรับทราบไปแล้ว (แก้คำผิดนิดเดียวก็เด้งใหม่ทุกคน — ตั้งใจให้เป็นแบบนั้น)
 */
import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { ANNOUNCEMENT_MAX_CHARS } from '@/services/admin';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

export const AnnouncementPanel = () => {
  const { announcement, saveAnnouncement } = useGameConfig();

  const [title, setTitle] = useState(announcement?.title ?? '');
  const [message, setMessage] = useState(announcement?.message ?? '');
  const [enabled, setEnabled] = useState(announcement?.enabled ?? false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน (คนอื่นแก้ หรือโหลดเสร็จทีหลัง) = ดึงมาแสดงแทนของเดิม */
  const [syncedWith, setSyncedWith] = useState(announcement?.version ?? null);
  if ((announcement?.version ?? null) !== syncedWith) {
    setSyncedWith(announcement?.version ?? null);
    setTitle(announcement?.title ?? '');
    setMessage(announcement?.message ?? '');
    setEnabled(announcement?.enabled ?? false);
  }

  const submit = async (nextEnabled: boolean) => {
    setBusy(true);
    setStatus(null);

    const error = await saveAnnouncement({
      title: title.trim().slice(0, 60),
      message: message.trim().slice(0, ANNOUNCEMENT_MAX_CHARS),
      enabled: nextEnabled,
      // เวอร์ชันใหม่ทุกครั้ง = ทุกคนได้เห็นประกาศรอบนี้แม้เคยกดรับทราบไปแล้ว
      version: `${Date.now()}`,
    });

    setBusy(false);
    setEnabled(nextEnabled);
    setStatus(
      error ?? (nextEnabled ? 'ประกาศขึ้นแล้ว — ทุกคนจะเห็นตอนเปิดเกม' : 'ปิดประกาศแล้ว'),
    );
    if (!error) playSfx('click');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ประกาศกลางจอ</p>
          <p className="mt-1 text-xs text-chalk/45">ขึ้นครั้งเดียวต่อคนตอนเข้าเกม กดรับทราบแล้วหาย</p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 font-mono text-[10px] uppercase',
            enabled ? 'bg-neon/15 text-neon' : 'bg-white/5 text-chalk/40',
          )}
        >
          {enabled ? 'กำลังแสดงอยู่' : 'ปิดอยู่'}
        </span>
      </div>

      <label className="block">
        <span className="eyebrow">หัวข้อ</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={60}
          placeholder="เช่น อัปเดตซีซัน 2"
          className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
        />
      </label>

      <label className="block">
        <span className="eyebrow">เนื้อหา</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={ANNOUNCEMENT_MAX_CHARS}
          rows={6}
          placeholder={'พิมพ์ข้อความที่อยากให้ทุกคนเห็น\nขึ้นบรรทัดใหม่ได้ตามปกติ'}
          className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-chalk/30 focus:border-neon/50"
        />
        <span className="mt-1 block text-right font-mono text-[10px] text-chalk/35">
          {message.length}/{ANNOUNCEMENT_MAX_CHARS}
        </span>
      </label>

      {status && <p className="text-xs text-chalk/70">{status}</p>}

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={busy || !message.trim()}
          onClick={() => submit(true)}
          className="flex-1 rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
        >
          {busy ? 'กำลังบันทึก…' : 'บันทึกและแสดงประกาศ'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(false)}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk disabled:opacity-40"
        >
          ปิดประกาศ
        </button>
      </div>
    </section>
  );
};
