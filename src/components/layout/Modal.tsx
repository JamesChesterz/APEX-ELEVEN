/**
 * หน้าต่างซ้อน (modal) ที่ใช้ร่วมกันทั้งเกม
 * ปิดได้ด้วยปุ่ม ✕ กดพื้นหลัง หรือกด Esc
 */
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export const Modal = ({ open, title, subtitle, onClose, children }: ModalProps) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="glass-panel flex max-h-[85vh] w-full max-w-4xl flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl uppercase">{title}</h2>
            {subtitle && <p className="text-xs text-chalk/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-chalk/60 hover:bg-white/10 hover:text-chalk"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};
