/**
 * ระบบเสียงเอฟเฟกต์ของเกม (สังเคราะห์เสียงด้วย Web Audio API ล้วน ๆ)
 *
 * ทำไมถึงสังเคราะห์เอง ไม่โหลดไฟล์ mp3:
 *   - ไม่ต้องแนบไฟล์เสียงมากับโปรเจกต์ ขนาดบิลด์เท่าเดิม
 *   - ปรับจูนความยาว/ระดับเสียงได้จากโค้ดโดยตรง
 *   - ไม่มีดีเลย์รอโหลดไฟล์ตอนซองแตก (จังหวะสำคัญที่สุดของเกม)
 *
 * ข้อจำกัดของเบราว์เซอร์: AudioContext จะเริ่มทำงานได้ก็ต่อเมื่อผู้ใช้แตะหน้าจอมาแล้ว
 * ทุกฟังก์ชันจึงเรียก ensureContext() ซึ่งจะ resume ให้อัตโนมัติ และเงียบไปเฉย ๆ ถ้ายังไม่ได้
 */

/** ชื่อเอฟเฟกต์เสียงทั้งหมดที่เรียกใช้ได้ */
export type SfxName =
  | 'click'
  | 'error'
  | 'coin'
  | 'points'
  | 'swap'
  | 'packBuy'
  | 'packAppear'
  | 'packBurst'
  | 'summary'
  | 'rankUp'
  | 'levelUp'
  | 'goal'
  | 'concede'
  | 'whistle'
  | 'login';

const STORAGE_KEY = 'fcallstar.sound.v1';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMutedFromStorage();

/** ผู้ฟังการเปลี่ยนสถานะเปิด/ปิดเสียง (ให้ UI อัปเดตปุ่มลำโพงตาม) */
const listeners = new Set<(muted: boolean) => void>();

function readMutedFromStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

/** สร้าง/ปลุก AudioContext — คืน null ถ้าเบราว์เซอร์ยังไม่อนุญาต */
function ensureContext(): AudioContext | null {
  if (muted) return null;

  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;

      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    }

    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/* ── ตัวสร้างเสียงพื้นฐาน ───────────────────────────────────── */

interface ToneOptions {
  /** ความถี่เริ่มต้น (Hz) */
  freq: number;
  /** ความถี่ปลายทาง ถ้าใส่จะกวาดเสียงจาก freq ไปหาค่านี้ */
  slideTo?: number;
  /** ความยาวเสียง (วินาที) */
  duration: number;
  type?: OscillatorType;
  /** ระดับเสียงสูงสุด 0–1 */
  gain?: number;
  /** หน่วงก่อนเล่น (วินาที) */
  delay?: number;
  /** สัดส่วนเวลาที่ใช้ไต่ขึ้นถึงระดับสูงสุด 0–1 */
  attack?: number;
}

/** โน้ตหนึ่งตัว พร้อมซองเสียง attack/decay กันเสียงป๊อกตอนตัด */
function tone({
  freq,
  slideTo,
  duration,
  type = 'sine',
  gain = 0.3,
  delay = 0,
  attack = 0.12,
}: ToneOptions): void {
  const ctx = ensureContext();
  if (!ctx || !master) return;

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + duration * attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(envelope).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** เสียงซ่า (white noise) ผ่านฟิลเตอร์ ใช้ทำเสียงฉีกซอง/ระเบิด/ลมพัด */
function noise(
  duration: number,
  options: { gain?: number; delay?: number; from?: number; to?: number; type?: BiquadFilterType } = {},
): void {
  const ctx = ensureContext();
  if (!ctx || !master) return;

  const { gain = 0.25, delay = 0, from = 900, to = 240, type = 'bandpass' } = options;
  const start = ctx.currentTime + delay;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  filter.Q.value = 1.2;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + duration * 0.08);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter).connect(envelope).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

/** เล่นโน้ตหลายตัวไล่กัน ใช้ทำเสียงแฟนแฟร์ */
function arpeggio(freqs: number[], step: number, options: Partial<ToneOptions> = {}): void {
  freqs.forEach((freq, index) => {
    tone({ freq, duration: options.duration ?? 0.42, type: 'triangle', gain: 0.26, ...options, delay: (options.delay ?? 0) + index * step });
  });
}

/* ── เอฟเฟกต์สำเร็จรูป ─────────────────────────────────────── */

const EFFECTS: Record<SfxName, () => void> = {
  /** กดปุ่มทั่วไป */
  click: () => tone({ freq: 660, duration: 0.06, type: 'square', gain: 0.12 }),

  /** ทำอะไรไม่ได้ เช่น เงินไม่พอ / นักเตะซ้ำ */
  error: () => {
    tone({ freq: 240, slideTo: 150, duration: 0.22, type: 'sawtooth', gain: 0.16 });
    tone({ freq: 120, duration: 0.24, type: 'square', gain: 0.1, delay: 0.05 });
  },

  /** ได้เหรียญ */
  coin: () => {
    tone({ freq: 1046, duration: 0.09, type: 'triangle', gain: 0.2 });
    tone({ freq: 1568, duration: 0.14, type: 'triangle', gain: 0.18, delay: 0.07 });
  },

  /** ย่อยการ์ดเป็นแต้ม — เสียงการ์ดแตกแล้วแต้มไหลเข้ากระเป๋า */
  points: () => {
    noise(0.18, { gain: 0.16, from: 2600, to: 900, type: 'highpass' });
    tone({ freq: 880, slideTo: 1760, duration: 0.26, type: 'triangle', gain: 0.2, delay: 0.06 });
    tone({ freq: 1320, duration: 0.18, type: 'sine', gain: 0.14, delay: 0.2 });
  },

  /** สลับตัว/วางนักเตะลงช่อง */
  swap: () => {
    noise(0.12, { gain: 0.1, from: 1600, to: 600, type: 'bandpass' });
    tone({ freq: 520, slideTo: 780, duration: 0.12, type: 'sine', gain: 0.14 });
  },

  /** จ่ายเหรียญซื้อซอง */
  packBuy: () => {
    tone({ freq: 420, slideTo: 660, duration: 0.16, type: 'square', gain: 0.14 });
    tone({ freq: 880, duration: 0.2, type: 'triangle', gain: 0.14, delay: 0.12 });
  },

  /** ซองลอยขึ้นกลางจอ */
  packAppear: () => {
    tone({ freq: 70, slideTo: 180, duration: 0.7, type: 'sine', gain: 0.22, attack: 0.4 });
    noise(0.5, { gain: 0.08, from: 300, to: 1400, type: 'lowpass' });
  },

  /** ซองแตก (เสียงระเบิด + คลื่นกระแทก) */
  packBurst: () => {
    noise(0.42, { gain: 0.4, from: 5200, to: 260, type: 'lowpass' });
    tone({ freq: 160, slideTo: 42, duration: 0.6, type: 'sine', gain: 0.42, attack: 0.03 });
    tone({ freq: 1200, slideTo: 300, duration: 0.24, type: 'sawtooth', gain: 0.12 });
  },

  /** เข้าหน้าสรุปผลเปิดซอง */
  summary: () => arpeggio([523, 659, 784], 0.08, { duration: 0.34, gain: 0.18 }),

  /** เลื่อนขั้น rank */
  rankUp: () => {
    arpeggio([523, 659, 784, 1046], 0.11, { duration: 0.5, gain: 0.24, type: 'triangle' });
    tone({ freq: 1568, duration: 0.8, type: 'sine', gain: 0.16, delay: 0.44, attack: 0.25 });
  },

  /** อัปเลเวลการ์ดสำเร็จ */
  levelUp: () => {
    tone({ freq: 660, slideTo: 1320, duration: 0.28, type: 'triangle', gain: 0.22 });
    arpeggio([784, 988, 1319], 0.07, { duration: 0.4, gain: 0.18, delay: 0.16 });
  },

  /** ทีมเรายิงประตูได้ — เสียงฝูงชนเฮ + แตร */
  goal: () => {
    noise(1.3, { gain: 0.22, from: 500, to: 1500, type: 'bandpass' });
    arpeggio([523, 659, 784, 1046], 0.09, { duration: 0.7, gain: 0.24, type: 'triangle' });
  },

  /** เสียประตู — เสียงฮือผิดหวังสั้น ๆ */
  concede: () => {
    tone({ freq: 330, slideTo: 180, duration: 0.5, type: 'triangle', gain: 0.16 });
    noise(0.6, { gain: 0.1, from: 700, to: 300, type: 'lowpass' });
  },

  /** นกหวีดเริ่มและจบเกม */
  whistle: () => {
    tone({ freq: 2200, duration: 0.16, type: 'square', gain: 0.1 });
    tone({ freq: 2350, duration: 0.2, type: 'square', gain: 0.09, delay: 0.14 });
  },

  /** เข้าสู่ระบบสำเร็จ */
  login: () => arpeggio([392, 523, 659], 0.09, { duration: 0.4, gain: 0.2, type: 'triangle' }),
};

/** เล่นเอฟเฟกต์เสียงตามชื่อ (ไม่ทำอะไรเลยถ้าปิดเสียงอยู่) */
export const playSfx = (name: SfxName): void => {
  if (muted) return;
  EFFECTS[name]?.();
};

/* ── เสียงเฉพาะของฉากเปิดซอง ───────────────────────────────── */

/** ความดัง/ความอลังของเสียงตามระดับการ์ด (0 = ธรรมดา, 1 = ตำนาน) */
export type SoundRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';

const RARITY_LEVEL: Record<SoundRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythical: 4,
};

/**
 * เสียง "ไต่ระดับ" ระหว่างซองสั่นสะสมพลัง
 * ยิ่งการ์ดระดับสูง เสียงยิ่งไต่สูงและนานตามเวลาที่ซองสั่นจริง
 * คืนฟังก์ชันสำหรับหยุดเสียง ใช้ตอนผู้เล่นกดข้าม
 */
export const playCharge = (rarity: SoundRarity, durationMs: number): (() => void) => {
  const ctx = ensureContext();
  if (!ctx || !master) return () => undefined;

  const level = RARITY_LEVEL[rarity];
  const duration = durationMs / 1000;
  const start = ctx.currentTime;

  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  const tremolo = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  // เสียงหลัก: กวาดจากต่ำขึ้นสูง ยิ่งการ์ดดี ปลายทางยิ่งสูง
  osc.type = level >= 2 ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(90 + level * 20, start);
  osc.frequency.exponentialRampToValueAtTime(280 + level * 260, start + duration);

  // สั่นเป็นจังหวะให้รู้สึกว่าพลังงานกำลังสะสม ยิ่งการ์ดดียิ่งสั่นถี่
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5 + level * 2, start);
  lfo.frequency.linearRampToValueAtTime(11 + level * 5, start + duration);
  lfoGain.gain.value = 0.35;
  lfo.connect(lfoGain).connect(tremolo.gain);
  tremolo.gain.value = 0.65;

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.05 + level * 0.06, start + duration * 0.9);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(tremolo).connect(envelope).connect(master);
  osc.start(start);
  lfo.start(start);
  osc.stop(start + duration + 0.05);
  lfo.stop(start + duration + 0.05);

  return () => {
    try {
      osc.stop();
      lfo.stop();
    } catch {
      /* หยุดไปแล้ว ไม่ต้องทำอะไร */
    }
  };
};

/** เสียงตอนการ์ดโผล่ — ยิ่งระดับสูง คอร์ดยิ่งใหญ่และมีเสียงฝูงชนตาม */
export const playReveal = (rarity: SoundRarity): void => {
  if (muted) return;

  if (rarity === 'common') {
    tone({ freq: 440, duration: 0.32, type: 'sine', gain: 0.18 });
    return;
  }

  if (rarity === 'rare') {
    arpeggio([523, 784], 0.09, { duration: 0.5, gain: 0.22 });
    return;
  }

  if (rarity === 'epic') {
    arpeggio([523, 659, 784, 1046], 0.08, { duration: 0.7, gain: 0.24 });
    tone({ freq: 262, duration: 0.9, type: 'sine', gain: 0.16, attack: 0.2 });
    return;
  }

  if (rarity === 'legendary') {
    // legendary: แฟนแฟร์เต็มรูปแบบ + เสียงฮือของอัฒจันทร์
    arpeggio([523, 659, 784, 1046, 1319], 0.1, { duration: 0.9, gain: 0.26, type: 'triangle' });
    tone({ freq: 196, duration: 1.4, type: 'sawtooth', gain: 0.14, attack: 0.15 });
    tone({ freq: 2093, duration: 1.1, type: 'sine', gain: 0.1, delay: 0.5, attack: 0.3 });
    noise(1.6, { gain: 0.12, from: 400, to: 1200, type: 'bandpass', delay: 0.15 });
    return;
  }

  // mythical: แฟนแฟร์สองชั้น (ไล่ขึ้นแล้วซ้ำสูงอีกอ็อกเทฟ) + เบสค้างยาว + เสียงฝูงชนดังกว่าเดิม
  arpeggio([523, 659, 784, 1046, 1319, 1568], 0.09, { duration: 1, gain: 0.26, type: 'triangle' });
  arpeggio([1046, 1319, 1568, 2093], 0.08, { duration: 0.9, gain: 0.2, type: 'sine', delay: 0.62 });
  tone({ freq: 131, duration: 2.2, type: 'sawtooth', gain: 0.15, attack: 0.2 });
  tone({ freq: 2637, duration: 1.4, type: 'sine', gain: 0.11, delay: 0.85, attack: 0.35 });
  noise(2.4, { gain: 0.15, from: 300, to: 1600, type: 'bandpass', delay: 0.1 });
};

/* ── เปิด/ปิดเสียง ─────────────────────────────────────────── */

export const isMuted = (): boolean => muted;

export const setMuted = (value: boolean): void => {
  muted = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'off' : 'on');
  } catch {
    /* localStorage ใช้ไม่ได้ (โหมดส่วนตัว) — ยังเล่นเกมได้ปกติ */
  }
  listeners.forEach((listener) => listener(value));
};

export const toggleMuted = (): boolean => {
  setMuted(!muted);
  if (!muted) playSfx('click');
  return muted;
};

/** สมัครรับการเปลี่ยนสถานะเสียง คืนฟังก์ชันสำหรับยกเลิก */
export const onMuteChange = (listener: (muted: boolean) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
