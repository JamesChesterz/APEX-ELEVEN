/**
 * ช่องใส่รูปหนึ่งใบสำหรับหน้า ADMIN — ใช้ร่วมกันทั้งกล่องสุ่มและพาสประจำซีซัน
 *
 * เลือกได้สองทาง
 *   • อัปโหลดไฟล์ (.png .webp .gif .jpg) → เก็บเป็น data URL ในค่าตั้ง
 *     ไฟล์เล็กเก็บทั้งไฟล์ GIF จึงยังขยับได้ · ไฟล์ใหญ่ถูกย่อและจะกลายเป็นภาพนิ่ง (มีข้อความบอก)
 *   • พิมพ์พาธไฟล์ใน public/ เช่น /lucky/coin.gif ← ไม่กินพื้นที่เอกสารเลย เหมาะกับ GIF และรูปใหญ่
 */
import { useRef, useState } from 'react';
import { fileToLuckyImage, isSafeLuckyImage, LUCKY_IMAGE_HINT } from '@/services/luckyImage';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

export const ImagePicker = ({
  label,
  value,
  onChange,
  onError,
}: {
  label: string;
  value: string;
  onChange: (image: string) => void;
  /** ข้อความผลลัพธ์/ข้อผิดพลาด ส่งกลับไปแสดงในแถบสถานะของแผง */
  onError: (message: string) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl, resized } = await fileToLuckyImage(file);
      onChange(dataUrl);
      onError(
        resized
          ? 'ใส่รูปแล้ว — ไฟล์ใหญ่จึงถูกย่อให้ (ถ้าเป็น GIF จะกลายเป็นภาพนิ่ง วางไฟล์ไว้ใน public/ แล้วใส่พาธแทนถ้าอยากให้ขยับ)'
          : 'ใส่รูปแล้ว',
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'ใช้ไฟล์นี้ไม่ได้');
      playSfx('error');
    } finally {
      setBusy(false);
      // ล้างค่าเดิมทิ้ง ไม่งั้นเลือกไฟล์เดิมซ้ำแล้ว onChange จะไม่ยิง
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-ink-900/40 p-3">
      <span className="eyebrow">{label}</span>

      <div className="flex flex-wrap items-start gap-3">
        {/* ตัวอย่างรูป — ค่าที่ใช้ไม่ได้จะขึ้นกรอบประให้เห็นว่ายังไม่ผ่าน */}
        <div
          className={cn(
            'flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
            isSafeLuckyImage(value) ? 'border-white/15 bg-ink-800' : 'border-dashed border-white/15',
          )}
        >
          {isSafeLuckyImage(value) ? (
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-chalk/35">ไม่มีรูป</span>
          )}
        </div>

        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <input
            value={value.startsWith('data:') ? '' : value}
            placeholder="/lucky/coin.gif หรือ https://..."
            onChange={(event) => onChange(event.target.value.trim())}
            // รูปที่อัปโหลดแล้วเป็นข้อความยาวหลายหมื่นตัว แก้ในช่องนี้ไม่ไหว จึงล็อกไว้ให้กดล้างแทน
            disabled={value.startsWith('data:')}
            className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 font-mono text-xs outline-none focus:border-neon/50 disabled:opacity-40"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/gif,image/jpeg"
              className="hidden"
              onChange={(event) => void pick(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-neon/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
            >
              {busy ? 'กำลังอ่านไฟล์…' : 'อัปโหลดรูป'}
            </button>

            {value && (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onChange('');
                }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
              >
                ล้างรูป
              </button>
            )}

            {value.startsWith('data:') && (
              <span className="font-mono text-[10px] text-chalk/40">
                ฝังไว้ในค่าตั้ง ~{Math.round(value.length / 1024)} KB
              </span>
            )}
          </div>

          <p className="text-[10px] text-chalk/40">{LUCKY_IMAGE_HINT}</p>
          <p className="text-[10px] text-chalk/40">
            อยากให้ GIF ขยับและไม่กินพื้นที่ ให้วางไฟล์ไว้ที่ <code>public/lucky/</code> แล้วใส่พาธ เช่น{' '}
            <code>/lucky/coin.gif</code>
          </p>
        </div>
      </div>
    </div>
  );
};
