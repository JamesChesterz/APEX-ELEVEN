/**
 * หน้า Settings — ที่รวมของที่ "ตั้งค่าครั้งเดียวแล้วจบ"
 *
 * แยกออกมาจากหน้าโปรไฟล์เพราะคนละเรื่องกัน: หน้าโปรไฟล์คือของที่ดูบ่อย
 * (คลังการ์ด สถิติ ระดับ) ส่วนหน้านี้คือของที่แก้นาน ๆ ครั้ง — รูป เสียง บัญชี
 */
import { useEffect, useState } from 'react';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import {
  DESKTOP_WIDTH,
  isDesktopMode,
  isHandheld,
  onDesktopModeChange,
  toggleDesktopMode,
} from '@/services/display';
import {
  isFullscreen,
  isFullscreenSupported,
  isStandalone,
  onFullscreenChange,
  toggleFullscreen,
} from '@/services/fullscreen';
import { isMuted, onMuteChange, playSfx, toggleMuted } from '@/services/sound';
import { cn } from '@/utils/helpers';

/**
 * คำอธิบายของแถว "เต็มจอ" — ต่างกันสามแบบตามความสามารถของเครื่อง
 *
 * iPhone สั่งเต็มจอผ่าน Fullscreen API ไม่ได้เลย (Apple ไม่เปิดให้ element ทั่วไป)
 * จึงต้องบอกทางออกจริงแทนที่จะโชว์ปุ่มที่กดแล้วไม่เกิดอะไรขึ้น
 */
const fullscreenHint = (active: boolean): string => {
  if (isStandalone()) return 'เปิดจากไอคอนบนหน้าจอโฮมอยู่ — ไม่มีแถบเบราว์เซอร์บังอยู่แล้ว';

  if (!isFullscreenSupported()) {
    return 'iPhone สั่งเต็มจอจากในเว็บไม่ได้ — กดปุ่มแชร์ในเบราว์เซอร์ แล้วเลือก ' +
      '"เพิ่มลงในหน้าจอโฮม" จากนั้นเปิดเกมจากไอคอนนั้น จะได้เต็มจอจริงและจำไว้ตลอด';
  }

  return active
    ? 'ซ่อนแถบ URL และแถบระบบไว้ — กดปุ่มย้อนกลับของเครื่องเพื่อออกได้ตลอด'
    : 'ซ่อนแถบ URL ให้เหลือแต่ตัวเกม · จำค่าไว้ให้ แล้วกลับเข้าเต็มจอตอนแตะครั้งแรกหลังเปิดเกม';
};

/** แถวตั้งค่าหนึ่งแถว: หัวข้อ + คำอธิบาย + ตัวควบคุมด้านขวา */
const SettingRow = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-4 last:border-0">
    <div className="min-w-0">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-chalk/45">{description}</p>
    </div>
    {children}
  </div>
);

export const SettingsPage = () => {
  const { account, online, logout } = useAuth();
  const { team } = useTeam();
  const [muted, setMuted] = useState(isMuted);
  const [desktop, setDesktop] = useState(isDesktopMode);
  const [fullscreen, setFullscreen] = useState(isFullscreen);

  // สถานะเสียงเป็นค่ากลางของทั้งแอป (ปุ่มบนแถบหัวก็เปลี่ยนได้) จึงต้องฟังจากที่อื่นด้วย
  useEffect(() => onMuteChange(setMuted), []);
  useEffect(() => onDesktopModeChange(setDesktop), []);
  // สถานะเต็มจอเปลี่ยนได้จากนอกปุ่มของเรา (กดปุ่มย้อนกลับของเครื่อง / ปัดออกจากเต็มจอ)
  useEffect(() => onFullscreenChange(setFullscreen), []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* ── รูปโปรไฟล์ ── */}
      <section className="panel p-4">
        <AvatarPicker />
      </section>

      {/* ── ตั้งค่าทั่วไป ── */}
      <section className="panel px-4 py-1">
        <SettingRow title="เสียงเอฟเฟกต์" description="เสียงตอนเปิดซอง จัดทีม และจบแมตช์">
          <button
            type="button"
            onClick={() => {
              setMuted(toggleMuted());
              playSfx('click');
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
              muted
                ? 'border border-white/15 text-chalk/60 hover:text-chalk'
                : 'bg-neon text-ink-900 hover:bg-neon-dim',
            )}
          >
            {muted ? 'ปิดอยู่' : 'เปิดอยู่'}
          </button>
        </SettingRow>

        <SettingRow
          title="โหมดคอมพิวเตอร์"
          description={
            desktop
              ? `วาดเกมที่ความกว้าง ${DESKTOP_WIDTH}px แล้วย่อให้พอดีจอ ` +
                'ได้เลย์เอาต์เต็มเหมือนบนคอม (เมนูซ้าย + 3 คอลัมน์) ซูมนิ้วอ่านได้ตามปกติ ' +
                'ใช้ได้ทั้ง iOS และ Android โดยไม่ต้องกด "ขอเว็บไซต์บนเดสก์ท็อป" ของเบราว์เซอร์'
              : 'ใช้เลย์เอาต์ตามความกว้างจอจริง' +
                (isHandheld() ? ' — หน้าอย่าง MATCHMAKING จะเรียงซ้อนกันเป็นแถวเดียว' : '')
          }
        >
          <button
            type="button"
            onClick={() => {
              setDesktop(toggleDesktopMode());
              playSfx('click');
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
              desktop
                ? 'bg-neon text-ink-900 hover:bg-neon-dim'
                : 'border border-white/15 text-chalk/60 hover:text-chalk',
            )}
          >
            {desktop ? 'เปิดอยู่' : 'ปิดอยู่'}
          </button>
        </SettingRow>

        <SettingRow title="เต็มจอ" description={fullscreenHint(fullscreen)}>
          {isStandalone() ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-neon">
              เต็มจออยู่แล้ว
            </span>
          ) : isFullscreenSupported() ? (
            <button
              type="button"
              onClick={async () => {
                playSfx('click');
                setFullscreen(await toggleFullscreen());
              }}
              className={cn(
                'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                fullscreen
                  ? 'bg-neon text-ink-900 hover:bg-neon-dim'
                  : 'border border-white/15 text-chalk/60 hover:text-chalk',
              )}
            >
              {fullscreen ? 'เปิดอยู่' : 'ปิดอยู่'}
            </button>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider text-chalk/40">
              เครื่องนี้ไม่รองรับ
            </span>
          )}
        </SettingRow>
      </section>

      {/* ── บัญชี ── */}
      <section className="panel px-4 py-1">
        <SettingRow title="ไอดีผู้เล่น" description="ใช้เข้าสู่ระบบ เปลี่ยนไม่ได้">
          <span className="font-mono text-sm">{account?.username}</span>
        </SettingRow>

        <SettingRow title="ชื่อสโมสร" description="ชื่อที่คนอื่นเห็นในตารางอันดับ">
          <span className="font-mono text-sm">{team.name}</span>
        </SettingRow>

        <SettingRow
          title="การเก็บข้อมูล"
          description={
            online
              ? 'เซฟอยู่บนเซิร์ฟเวอร์ เล่นต่อได้ทุกเครื่องที่ล็อกอินไอดีนี้'
              : 'โหมดออฟไลน์ — เซฟอยู่ในเครื่องนี้เท่านั้น ล้างข้อมูลเบราว์เซอร์แล้วหาย'
          }
        >
          <span
            className={cn(
              'flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider',
              online ? 'text-neon' : 'text-chalk/50',
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-neon' : 'bg-chalk/30')}
              aria-hidden
            />
            {online ? 'ออนไลน์' : 'ออฟไลน์'}
          </span>
        </SettingRow>

        <SettingRow title="ออกจากระบบ" description="ความคืบหน้าถูกเซฟไว้ก่อนออกเสมอ">
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-[#F07070]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#F07070] transition-colors hover:bg-[#F07070]/10"
          >
            ออกจากระบบ
          </button>
        </SettingRow>
      </section>
    </div>
  );
};
