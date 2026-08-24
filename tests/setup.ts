/** ค่าที่ jsdom ไม่มีให้ แต่โค้ดเกมเรียกใช้ */
import '@testing-library/react';

// เกมเล่นเสียงผ่าน Web Audio ซึ่ง jsdom ไม่มี — ใส่ตัวปลอมไว้กัน error
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  /** connect ต้องคืน node ตัวถัดไปเสมอ เพราะโค้ดจริงต่อกันเป็นลูกโซ่ osc.connect(gain).connect(master) */
  createOscillator() {
    const node = {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (next: unknown) => next,
      start() {},
      stop() {},
    };
    return node;
  }
  createGain() {
    const node = {
      gain: {
        value: 1,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      },
      connect: (next: unknown) => next,
    };
    return node;
  }
  /** เสียงบางตัวใช้ noise buffer (เสียงฝูงชน) — ใส่ของปลอมให้ครบกัน error รกจอเทส */
  createBuffer(channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, loop: false, connect: (next: unknown) => next, start() {}, stop() {} };
  }
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      },
      Q: { value: 1, setValueAtTime() {} },
      connect: (next: unknown) => next,
    };
  }
  resume() {
    return Promise.resolve();
  }
}

Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, writable: true });
Object.defineProperty(window, 'webkitAudioContext', { value: FakeAudioContext, writable: true });

// jsdom ไม่มี matchMedia / scrollTo
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

window.scrollTo = () => {};
