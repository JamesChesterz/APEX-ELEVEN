/**
 * จอที่ขึ้นเมื่อบัญชีถูกระงับ — บังทุกอย่างไว้ ไม่ให้เล่นต่อ
 *
 * นี่เป็นแค่ด่านหน้าบ้าน ด่านจริงอยู่ที่ firestore.rules ซึ่งปฏิเสธการเขียน
 * ของบัญชีที่ถูกระงับตั้งแต่ที่เซิร์ฟเวอร์ แก้โค้ดหน้าเว็บให้ผ่านจอนี้ไปก็เล่นไม่ได้อยู่ดี
 */
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { banReason } from '@/services/admin';

export const BannedScreen = () => {
  const { account, logout } = useAuth();
  const { bans } = useGameConfig();

  const reason = banReason(bans, account?.id);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900 p-4">
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <p className="font-display text-3xl uppercase text-[#F0A070]">บัญชีถูกระงับ</p>

        <p className="mt-3 text-sm text-chalk/60">
          บัญชีนี้ถูกผู้ดูแลระงับการใช้งาน จึงเข้าเล่นไม่ได้ชั่วคราว
        </p>

        {reason && (
          <p className="mt-4 rounded-lg border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-chalk/75">
            เหตุผล: {reason}
          </p>
        )}

        <p className="mt-4 font-mono text-[10px] text-chalk/35">
          ติดต่อผู้ดูแลเกมหากคิดว่าเป็นความเข้าใจผิด
        </p>

        <button
          type="button"
          onClick={logout}
          className="mt-6 w-full rounded-lg border border-white/15 py-3 text-sm font-bold uppercase tracking-wider text-chalk/70 transition-colors hover:text-chalk"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};
