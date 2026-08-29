/**
 * หน้า Settings — ที่รวมของที่ "ตั้งค่าครั้งเดียวแล้วจบ"
 *
 * แยกออกมาจากหน้าโปรไฟล์เพราะคนละเรื่องกัน: หน้าโปรไฟล์คือของที่ดูบ่อย
 * (คลังการ์ด สถิติ ระดับ) ส่วนหน้านี้คือของที่แก้นาน ๆ ครั้ง — รูป เสียง บัญชี
 */
import { useEffect, useMemo, useState } from 'react';
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
import {
  motionPref,
  onMotionPrefChange,
  setMotionPref,
  systemReducedMotion,
  type MotionPref,
} from '@/services/motion';
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

  // ขั้นตอนละเอียดอยู่ในบล็อกที่ปุ่ม "ดูวิธี" กางออก จึงเขียนสั้น ๆ ตรงนี้พอ
  if (!isFullscreenSupported()) {
    return 'iPhone สั่งเต็มจอจากในเว็บไม่ได้ — ต้องติดตั้งลงหน้าจอโฮมแทน กดดูวิธีได้เลย';
  }

  return active
    ? 'ซ่อนแถบ URL และแถบระบบไว้ — กดปุ่มย้อนกลับของเครื่องเพื่อออกได้ตลอด'
    : 'ซ่อนแถบ URL ให้เหลือแต่ตัวเกม · จำค่าไว้ให้ แล้วกลับเข้าเต็มจอตอนแตะครั้งแรกหลังเปิดเกม';
};

/** แถวตั้งค่าหนึ่งแถว: หัวข้อ + คำอธิบาย + ตัวควบคุมด้านขวา (+ เนื้อหาเสริมใต้แถวถ้ามี) */
const SettingRow = ({
  title,
  description,
  children,
  extra,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** บล็อกที่กางออกใต้แถว เช่นขั้นตอนติดตั้งบน iPhone */
  extra?: React.ReactNode;
}) => (
  <div className="border-b border-white/5 py-4 last:border-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-chalk/45">{description}</p>
      </div>
      {children}
    </div>
    {extra}
  </div>
);

export const SettingsPage = () => {
  const { account, online, logout } = useAuth();
  const { team } = useTeam();
  const [muted, setMuted] = useState(isMuted);
  const [desktop, setDesktop] = useState(isDesktopMode);
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  /** กางขั้นตอนติดตั้งลงหน้าจอโฮมอยู่ไหม (ใช้เฉพาะเครื่องที่สั่งเต็มจอเองไม่ได้) */
  const [iosHelp, setIosHelp] = useState(false);
  const [motion, setMotion] = useState<MotionPref>(motionPref);

  /*
   * เช็คครั้งเดียวตอน mount — ความสามารถของเครื่องไม่เปลี่ยนระหว่างที่หน้าเปิดอยู่
   * และเรียกซ้ำทุก render โดยไม่จำเป็นก็เปลืองเปล่า ๆ
   */
  const supportsFullscreen = useMemo(isFullscreenSupported, []);
  const standalone = useMemo(isStandalone, []);

  // สถานะเสียงเป็นค่ากลางของทั้งแอป (ปุ่มบนแถบหัวก็เปลี่ยนได้) จึงต้องฟังจากที่อื่นด้วย
  useEffect(() => onMuteChange(setMuted), []);
  useEffect(() => onDesktopModeChange(setDesktop), []);
  // สถานะเต็มจอเปลี่ยนได้จากนอกปุ่มของเรา (กดปุ่มย้อนกลับของเครื่อง / ปัดออกจากเต็มจอ)
  useEffect(() => onFullscreenChange(setFullscreen), []);
  useEffect(() => onMotionPrefChange(setMotion), []);

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
          title="เอฟเฟกต์การเคลื่อนไหว"
          description={
            'ใช้กับวงวิ่งรูเล็ตของ Lucky Box · ' +
            (systemReducedMotion()
              ? 'ตอนนี้เครื่องของคุณตั้ง "ลดการเคลื่อนไหว" ไว้ ' +
                'ถ้าเลือก "ตามระบบ" เอฟเฟกต์จะถูกข้ามไป — เลือก "เปิด" เพื่อให้เล่นเสมอ'
              : 'เครื่องของคุณไม่ได้ตั้งลดการเคลื่อนไหวไว้ เอฟเฟกต์จึงเล่นตามปกติ')
          }
        >
          <div className="flex gap-1">
            {(
              [
                { key: 'system', label: 'ตามระบบ' },
                { key: 'on', label: 'เปิด' },
                { key: 'off', label: 'ปิด' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setMotionPref(option.key);
                  playSfx('click');
                }}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                  motion === option.key
                    ? 'bg-neon text-ink-900 hover:bg-neon-dim'
                    : 'border border-white/15 text-chalk/60 hover:text-chalk',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
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

        <SettingRow
          title="เต็มจอ"
          description={fullscreenHint(fullscreen)}
          extra={
            iosHelp && (
              /*
                iPhone สั่งเต็มจอจากในเว็บไม่ได้ (Apple ไม่เปิด Fullscreen API ให้ element ทั่วไป)
                ปุ่มจึงกางขั้นตอนติดตั้งลงหน้าจอโฮมแทน ซึ่งเป็นทางเดียวที่ได้เต็มจอจริงบนเครื่องนั้น
              */
              <ol className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-ink-700/40 p-3 text-xs text-chalk/70">
                <li>1. กดปุ่มแชร์ของเบราว์เซอร์ (ไอคอนสี่เหลี่ยมมีลูกศรขึ้น)</li>
                <li>2. เลื่อนหาแล้วเลือก "เพิ่มลงในหน้าจอโฮม"</li>
                <li>3. เปิดเกมจากไอคอนที่เพิ่งสร้าง — จะไม่มีแถบ URL บังอีกเลย</li>
                <li className="pt-1 text-chalk/40">
                  วิธีนี้จำไว้ถาวร ไม่ต้องมากดปุ่มนี้ใหม่ทุกครั้ง
                </li>
              </ol>
            )
          }
        >
          <button
            type="button"
            disabled={standalone}
            onClick={async () => {
              playSfx('click');

              // เครื่องที่ไม่มี Fullscreen API — ปุ่มทำหน้าที่กาง/พับวิธีติดตั้งแทน
              if (!supportsFullscreen) {
                setIosHelp((open) => !open);
                return;
              }
              setFullscreen(await toggleFullscreen());
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
              standalone
                ? 'cursor-default bg-neon/20 text-neon'
                : !supportsFullscreen
                  ? 'border border-kit/40 text-kit hover:bg-kit/10'
                  : fullscreen
                    ? 'bg-neon text-ink-900 hover:bg-neon-dim'
                    : 'border border-white/15 text-chalk/60 hover:text-chalk',
            )}
          >
            {standalone
              ? 'เปิดอยู่'
              : !supportsFullscreen
                ? iosHelp
                  ? 'ปิดวิธี'
                  : 'ดูวิธี'
                : fullscreen
                  ? 'เปิดอยู่'
                  : 'ปิดอยู่'}
          </button>
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
