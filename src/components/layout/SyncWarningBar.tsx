/**
 * แถบเตือนใต้ Header — ขึ้นเมื่อข้อมูลทีมเขียนขึ้นเซิร์ฟเวอร์ไม่สำเร็จ
 *
 * ทำไมต้องมี: เดิมเวลาเขียนโปรไฟล์ไม่ผ่าน (กฎปฏิเสธ / โควตาหมด / เน็ตล่ม)
 * โค้ดแค่บันทึกลง console เงียบ ๆ ผู้เล่นไม่รู้เลยว่าคนอื่นยังเห็นทีมชุดเก่าของตัวเอง
 * กว่าจะรู้ก็ต่อเมื่อมีคนมาทักว่า "ทำไมทีมมึงไม่อัปเดต"
 *
 * เกมยังเล่นได้ปกติทุกอย่าง เสียแค่ "ภาพทีมที่คนอื่นเห็น" จึงเตือนแบบไม่ปิดกั้นการเล่น
 */
import { useOnline } from '@/hooks/useOnline';
import { playSfx } from '@/services/sound';

export const SyncWarningBar = () => {
  const { publishFailed, retryPublish } = useOnline();

  if (!publishFailed) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0A070]/30 bg-[#F0A070]/10 px-4 py-2">
      <span className="text-sm text-[#F0A070]">
        ⚠ ข้อมูลทีมยังไม่ถูกบันทึกขึ้นเซิร์ฟเวอร์
      </span>

      <span className="text-xs text-chalk/55">
        คนอื่นจะเห็นทีมชุดเก่าของคุณ · เกมยังเล่นได้ตามปกติ
      </span>

      <button
        type="button"
        onClick={() => {
          playSfx('click');
          retryPublish();
        }}
        className="ml-auto shrink-0 rounded-lg border border-[#F0A070]/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] transition-colors hover:bg-[#F0A070]/15"
      >
        ลองใหม่
      </button>
    </div>
  );
};
