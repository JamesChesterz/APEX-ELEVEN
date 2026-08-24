/**
 * เลือก/เปลี่ยน/ลบรูปโปรไฟล์ (อยู่ในหน้า Profile)
 *
 * ไฟล์ที่เลือกถูกย่อในเครื่องก่อนเสมอ (services/avatar.ts) แล้วค่อยเซฟลงบัญชี
 * จากนั้นระบบเซฟปกติจะพาขึ้นคลาวด์ให้เอง — เปลี่ยนรูปแล้วเห็นทุกเครื่องที่ล็อกอินไอดีนี้
 * และคนอื่นจะเห็นรูปใหม่ในตารางอันดับหลังจากนั้นไม่กี่วินาที
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { Avatar } from '@/components/profile/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { AVATAR_HINT, fileToAvatar } from '@/services/avatar';
import { playSfx } from '@/services/sound';

export const AvatarPicker = () => {
  const { account, patchState } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const avatar = account?.state.avatar ?? null;
  const name = account?.username ?? 'ผู้เล่น';

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // เคลียร์ค่าใน input ทันที ไม่งั้นเลือกไฟล์เดิมซ้ำจะไม่ทำงาน (onChange ไม่ยิง)
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const dataUrl = await fileToAvatar(file);
      patchState({ avatar: dataUrl });
      playSfx('click');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'ตั้งรูปไม่สำเร็จ');
      playSfx('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar src={avatar} name={name} size="lg" />

      <div className="min-w-0">
        <p className="eyebrow">รูปโปรไฟล์</p>

        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-lg bg-neon px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:opacity-60"
          >
            {busy ? 'กำลังย่อรูป...' : avatar ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          </button>

          {avatar && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                patchState({ avatar: undefined });
                setError(null);
                playSfx('click');
              }}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-chalk/70 transition-colors hover:text-chalk disabled:opacity-60"
            >
              ลบรูป
            </button>
          )}
        </div>

        <p className="mt-1.5 text-xs text-chalk/40">{AVATAR_HINT}</p>
        {error && <p className="mt-1 text-xs text-[#F07070]">{error}</p>}

        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event)}
        />
      </div>
    </div>
  );
};
