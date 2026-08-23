/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* พื้นหลังและแผงกระจก */
        ink: {
          900: '#07090A',
          800: '#0E1214',
          700: '#151A1D',
          600: '#1D2429',
          500: '#283138',
        },
        /* สนามหญ้า */
        pitch: {
          900: '#08110D',
          800: '#0C1A14',
          700: '#12241C',
          600: '#1A3227',
          500: '#245239',
          turf: '#2E7D3C',
          turfDark: '#1B4F27',
        },
        /* accent หลักของเกม */
        neon: {
          DEFAULT: '#31E06D',
          dim: '#1E9E4A',
          deep: '#0F5E2C',
        },
        chalk: '#E8F1EA',
        gold: '#F5B93E',
        gem: '#E24A6E',
        token: '#3ED2A0',
        kit: '#F5C445',
        rarity: {
          common: '#9AA7A0',
          rare: '#4FB3D9',
          epic: '#A46BF5',
          legendary: '#F5C445',
          mythical: '#FF3FA4',
        },
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        /* แสงสว่างวาบเต็มจอตอนการ์ดโผล่ */
        burstFlash: {
          '0%': { opacity: '0', transform: 'scale(0.2)' },
          '35%': { opacity: '1', transform: 'scale(1.1)' },
          '100%': { opacity: '0', transform: 'scale(3)' },
        },
        /* ลำแสงหมุนรอบการ์ด */
        raySpin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        /* ลูกแสงเต้นตอนกำลังลุ้นว่าจะได้ระดับไหน */
        chargePulse: {
          '0%, 100%': { transform: 'scale(0.88)', opacity: '0.55' },
          '50%': { transform: 'scale(1.14)', opacity: '1' },
        },
        /* การ์ดลอยขึ้นจากเงามืดแล้วค่อยติดสี */
        walkoutIn: {
          '0%': { opacity: '0', transform: 'translateY(70px) scale(0.78)', filter: 'brightness(0)' },
          '45%': { opacity: '1', filter: 'brightness(0.25)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        },
        /* ข้อความไล่ขึ้นตามการ์ด */
        riseIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* จอสั่นตอนได้การ์ดระดับสูง */
        screenShake: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-6px, 3px)' },
          '40%': { transform: 'translate(5px, -4px)' },
          '60%': { transform: 'translate(-4px, -3px)' },
          '80%': { transform: 'translate(4px, 3px)' },
        },
        /* คลื่นกระแทกวงแหวนตอนซองแตก */
        shockwave: {
          '0%': { opacity: '0.85', transform: 'translate(-50%, -50%) scale(0.1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(2.8)' },
        },
        /* ประกายพุ่งออกจากจุดกลางเป็นเส้น */
        sparkFly: {
          '0%': { opacity: '0', transform: 'translateX(0) scaleX(0.25)' },
          '18%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateX(46vmin) scaleX(1)' },
        },
        /* ซองลอยขึ้นลงเบา ๆ ก่อนถูกฉีก */
        packFloat: {
          '0%, 100%': { transform: 'translateY(-7px) rotate(-1deg)' },
          '50%': { transform: 'translateY(7px) rotate(1deg)' },
        },
        /* ซองสั่นถี่ตอนพลังงานสะสม */
        tearShake: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-3px, 2px) rotate(-1.5deg)' },
          '50%': { transform: 'translate(3px, -2px) rotate(1.5deg)' },
          '75%': { transform: 'translate(-2px, -2px) rotate(-1deg)' },
        },
        /* ลำแสงยืดขึ้นจากพื้นเวที */
        beamRise: {
          '0%': { opacity: '0', transform: 'scaleY(0.15)' },
          '100%': { opacity: '1', transform: 'scaleY(1)' },
        },
        /* เศษกระดาษ/ริบบิ้นร่วงลงมา */
        confettiFall: {
          '0%': { opacity: '0', transform: 'translateY(-12vh) rotate(0deg)' },
          '12%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(88vh) rotate(720deg)' },
        },
        /* แท่นเวทีดันขึ้นมารับการ์ด */
        podiumRise: {
          from: { opacity: '0', transform: 'translateY(46px) scaleX(0.7)' },
          to: { opacity: '1', transform: 'translateY(0) scaleX(1)' },
        },
        /* ประกายลอยขึ้นรอบการ์ด */
        sparkFloat: {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.4)' },
          '25%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(-180px) scale(1.1)' },
        },
        /* ม่านแสงออโรราหมุนไล่สี — ใช้เฉพาะการ์ดระดับ mythical */
        auroraSweep: {
          '0%': { transform: 'rotate(0deg) scale(1)', filter: 'hue-rotate(0deg)' },
          '50%': { transform: 'rotate(180deg) scale(1.15)', filter: 'hue-rotate(120deg)' },
          '100%': { transform: 'rotate(360deg) scale(1)', filter: 'hue-rotate(360deg)' },
        },
        /* เศษคริสตัลโคจรรอบการ์ด (mythical) */
        shardOrbit: {
          from: { transform: 'rotate(0deg) translateX(26vmin) rotate(0deg)' },
          to: { transform: 'rotate(360deg) translateX(26vmin) rotate(-360deg)' },
        },
        /* วงแหวนรูนขยายออกเป็นจังหวะ (mythical) */
        runePulse: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.55) rotate(0deg)' },
          '35%': { opacity: '0.9' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(1.9) rotate(140deg)' },
        },
      },
      animation: {
        'burst-flash': 'burstFlash 700ms ease-out forwards',
        'ray-spin': 'raySpin 14s linear infinite',
        'ray-spin-fast': 'raySpin 6s linear infinite',
        'charge-pulse': 'chargePulse 900ms ease-in-out infinite',
        'walkout-in': 'walkoutIn 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'rise-in': 'riseIn 500ms ease-out forwards',
        'screen-shake': 'screenShake 550ms ease-in-out',
        'spark-float': 'sparkFloat 2.2s ease-out infinite',
        shockwave: 'shockwave 900ms cubic-bezier(0.15, 0.7, 0.3, 1) forwards',
        'spark-fly': 'sparkFly 1.1s ease-out forwards',
        'pack-float': 'packFloat 2.6s ease-in-out infinite',
        'tear-shake': 'tearShake 140ms linear infinite',
        'beam-rise': 'beamRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'confetti-fall': 'confettiFall 3.4s linear infinite',
        'podium-rise': 'podiumRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'aurora-sweep': 'auroraSweep 9s linear infinite',
        'shard-orbit': 'shardOrbit 7s linear infinite',
        'rune-pulse': 'runePulse 2.4s ease-out infinite',
      },
      boxShadow: {
        card: '0 12px 30px -12px rgba(0, 0, 0, 0.7)',
        glass: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -28px rgba(0,0,0,0.95)',
        neon: '0 0 0 1px rgba(49,224,109,0.35), 0 8px 24px -8px rgba(49,224,109,0.45)',
      },
    },
  },
  plugins: [],
};
