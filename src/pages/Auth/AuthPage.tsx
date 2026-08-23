/**
 * หน้าสมัคร / เข้าสู่ระบบ — ประตูหน้าของเกม
 *
 * สมัครไอดีใหม่ = ได้เหรียญเริ่มต้น 1,000,000 พร้อมนักเตะชุดเริ่มต้นทันที
 * (ค่าตั้งต้นทั้งหมดอยู่ที่ src/data/starter.ts)
 */
import { useState, type FormEvent } from 'react';
import { STARTING_COINS } from '@/data/starter';
import { useAuth } from '@/hooks/useAuth';
import { ONLINE, PASSWORD_MIN, USERNAME_MIN } from '@/services/accountStore';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

type Mode = 'login' | 'register';

/** สิ่งที่ผู้เล่นใหม่จะได้รับ — โชว์ให้เห็นก่อนกดสมัคร */
const WELCOME_GIFTS = [
  { icon: '⬤', label: `เหรียญเริ่มต้น ${formatNumber(STARTING_COINS)}`, tone: 'text-gold' },
  { icon: '⚽', label: 'นักเตะชุดเริ่มต้น 17 คน จัดทีมได้ทันที', tone: 'text-neon' },
  { icon: '▤', label: 'เริ่มไต่อันดับจาก BRONZE สู่ CHAMPION', tone: 'text-kit' },
];

export const AuthPage = () => {
  const { register, login, error, clearError, pending } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    clearError();
    playSfx('click');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return; // กันกดซ้ำระหว่างรอเซิร์ฟเวอร์ตอบ

    if (mode === 'register') void register(username, password, teamName);
    else void login(username, password);
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-ink-900/70 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-chalk/25 focus:border-neon/60';

  return (
    <div className="stadium-bg flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-glass md:grid-cols-[1.1fr_1fr]">
        {/* ── ฝั่งซ้าย: แบรนด์เกม + ของแถมตอนสมัคร ── */}
        <section className="relative hidden flex-col justify-between bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 p-8 md:flex">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(70% 50% at 50% 0%, rgba(49,224,109,0.18), transparent 65%)',
            }}
          />

          <div className="relative">
            <p className="eyebrow">Football Manager Card Game</p>
            <h1 className="mt-1 font-display text-5xl uppercase leading-none">
              FC <span className="text-neon">ALLSTAR</span>
            </h1>
            <p className="mt-3 max-w-xs text-sm text-chalk/55">
              สร้างสโมสรของคุณเอง เปิดซองล่านักเตะระดับตำนาน แล้วไต่ตารางอันดับไปให้ถึงอันดับ 1
            </p>
          </div>

          <ul className="relative mt-8 space-y-3">
            {WELCOME_GIFTS.map((gift) => (
              <li key={gift.label} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10',
                    gift.tone,
                  )}
                  aria-hidden
                >
                  {gift.icon}
                </span>
                <span className="text-chalk/75">{gift.label}</span>
              </li>
            ))}
          </ul>

          <p className="relative mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk/30">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', ONLINE ? 'bg-neon' : 'bg-chalk/30')}
              aria-hidden
            />
            {ONLINE ? 'บัญชีออนไลน์ · เล่นต่อได้ทุกเครื่อง' : 'โหมดออฟไลน์ · เก็บข้อมูลในเครื่องนี้'}
          </p>
        </section>

        {/* ── ฝั่งขวา: ฟอร์ม ── */}
        <section className="bg-ink-800/95 p-7 backdrop-blur-md">
          <div className="mb-6 flex rounded-lg bg-ink-900/70 p-1">
            {(
              [
                { key: 'login', label: 'เข้าสู่ระบบ' },
                { key: 'register', label: 'สมัครไอดี' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMode(tab.key)}
                className={cn(
                  'flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                  mode === tab.key ? 'bg-neon text-ink-900' : 'text-chalk/55 hover:text-chalk',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <h2 className="text-2xl uppercase md:hidden">FC ALLSTAR</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="eyebrow mb-1.5 block">ไอดีผู้เล่น</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder={`อย่างน้อย ${USERNAME_MIN} ตัวอักษร`}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">รหัสผ่าน</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={`อย่างน้อย ${PASSWORD_MIN} ตัวอักษร`}
                className={inputClass}
              />
            </label>

            {mode === 'register' && (
              <label className="block">
                <span className="eyebrow mb-1.5 block">ชื่อสโมสร (ไม่ใส่ก็ได้)</span>
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="เช่น Bangkok Aurora"
                  className={inputClass}
                />
              </label>
            )}

            {error && (
              <p className="rounded-lg border border-gem/40 bg-gem/10 px-3 py-2 text-xs text-gem">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์…'
                : mode === 'register'
                  ? 'สมัครและรับของเริ่มต้น'
                  : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {mode === 'register' ? (
            <p className="mt-4 text-center text-xs text-chalk/45">
              สมัครแล้วรับทันที{' '}
              <span className="font-mono text-gold">{formatNumber(STARTING_COINS)}</span> เหรียญ
              พร้อมนักเตะชุดเริ่มต้น
            </p>
          ) : (
            <p className="mt-4 text-center text-xs text-chalk/45">
              ยังไม่มีไอดี? กด “สมัครไอดี” ด้านบนเพื่อเริ่มเล่นฟรี
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
