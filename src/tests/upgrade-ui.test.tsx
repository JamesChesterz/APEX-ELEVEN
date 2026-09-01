/**
 * PHASE 13.5 — เทสหน้า UPGRADE และการต่อสายเข้าระบบจริง
 *
 * สิ่งที่ต้องพิสูจน์: หน้าจอไม่มีตัวเลข hardcode เลย
 * แก้ตารางตีบวกที่เดียว แล้วทั้งหน้าจอกับ Attribute Engine ต้องเห็นค่าใหม่พร้อมกัน
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { GameConfigProvider } from '@/hooks/useGameConfig';
import { InventoryProvider } from '@/hooks/usePlayers';
import { UpgradeCardPanel } from '@/components/upgrade/UpgradeCardPanel';
import { NAV_ITEMS, visibleNavItems } from '@/components/sidebar/navItems';
import {
  MATERIAL_CARD_SLOTS,
  MAX_UPGRADE,
  UPGRADE_STEPS,
  getBoostedSuccessRate,
  getUpgradeStep,
  setUpgradeSteps,
  type UpgradeStep,
} from '@/data/upgradeConfig';
import { PLAYERS } from '@/data/players';
import { createCardInstance } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';

const card = (upgrade: number, extra: Partial<CardInstance> = {}): CardInstance => ({
  ...createCardInstance({ id: 'card_ui', playerId: 'p001', upgrade }),
  ...extra,
});

const renderPanel = (value: CardInstance | null, materials: CardInstance[] = []) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <InventoryProvider>
          <GameConfigProvider>
            <UpgradeCardPanel card={value} materialCards={materials} />
          </GameConfigProvider>
        </InventoryProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

afterEach(() => setUpgradeSteps(null));

/* ── เมนูและเส้นทาง ─────────────────────────────────────────── */

describe('เมนู UPGRADE', () => {
  it('มีเมนูอยู่จริงและผู้เล่นทั่วไปเห็นได้', () => {
    const item = NAV_ITEMS.find((entry) => entry.id === 'upgrade');
    expect(item?.path).toBe('/upgrade');
    expect(item?.available).toBe(true);
    expect(item?.ownerOnly).toBeFalsy();
    expect(visibleNavItems(false).some((entry) => entry.id === 'upgrade')).toBe(true);
  });
});

/* ── หน้าตีบวก ─────────────────────────────────────────────── */

describe('หน้าตีบวกอ่านค่าจากระบบจริง', () => {
  it('ยังไม่ได้เลือกการ์ด = บอกให้เลือกก่อน ไม่พัง', () => {
    renderPanel(null);
    expect(screen.getByText(/เลือกการ์ด/)).toBeTruthy();
  });

  it('โชว์ OVR ปัจจุบันและ OVR หลังตีบวกติดตามที่ Attribute Engine คำนวณ', () => {
    const target = card(4);
    renderPanel(target);

    // คอลัมน์ซ้ายโชว์ค่าปัจจุบัน คอลัมน์ขวาโชว์ค่าถ้าตีติด
    expect(screen.getAllByText(String(getEffectivePlayerOvr(target))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(getEffectivePlayerOvr(card(5)))).length).toBeGreaterThan(0);
  });

  it('โอกาสสำเร็จและค่าใช้จ่ายมาจากตารางกลาง ไม่ได้เขียนตายตัวในหน้าจอ', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    renderPanel(card(4));
    expect(screen.getByText(`${Math.round(step.successRate * 100)}%`)).toBeTruthy();
  });

  it('แก้ตารางแล้วหน้าจอโชว์ตัวเลขใหม่ทันที (ไม่มีสำเนาของตัวเอง)', () => {
    const tweaked: UpgradeStep[] = UPGRADE_STEPS.map((step) =>
      step.from === 4 ? { ...step, successRate: 0.99 } : step,
    );
    expect(setUpgradeSteps(tweaked)).toEqual([]);

    renderPanel(card(4));
    expect(screen.getByText('99%')).toBeTruthy();
  });

  it('การ์ดที่ +8 แล้วปุ่มถูกปิดและบอกว่าตันแล้ว', () => {
    renderPanel(card(MAX_UPGRADE));

    expect(screen.getByText(/ตีบวกจนสุดแล้ว/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ตีบวก \+/ }).hasAttribute('disabled')).toBe(true);
  });

  it('การ์ดที่ล็อกไว้ตีบวกไม่ได้', () => {
    renderPanel(card(2, { locked: true }));

    expect(screen.getByText(/ถูกล็อกไว้/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ตีบวก \+/ }).hasAttribute('disabled')).toBe(true);
  });

  it('แต้มตีบวกไม่พอ = ปุ่มถูกปิดพร้อมบอกเหตุผล (บัญชีทดสอบเริ่มจากศูนย์)', () => {
    renderPanel(card(0));

    expect(screen.getByText(/แต้มตีบวกไม่พอ|เหรียญไม่พอ/)).toBeTruthy();
  });

  it('การ์ดที่ชี้ไปนักเตะที่ไม่มีอยู่ไม่ทำให้หน้าจอพัง', () => {
    renderPanel(card(0, { playerId: 'ไม่มีอยู่จริง' }));
    expect(screen.getByText(/ไม่มีอยู่ในระบบ/)).toBeTruthy();
  });

  it('โชว์ค่าพลังครบทั้งหกด้าน ทั้งฝั่งปัจจุบันและฝั่งถัดไป', () => {
    renderPanel(card(1));
    ['ความเร็ว', 'พลังการยิง', 'ส่งบอล', 'เลี้ยงบอล', 'ประกบตัว', 'ทายภาพ'].forEach((label) => {
      // ชื่อเดียวกันโผล่สองคอลัมน์ ซ้าย = ปัจจุบัน ขวา = ถ้าตีติด
      expect(screen.getAllByText(label)).toHaveLength(2);
    });
  });

  it('ฝั่งขวาโชว์ส่วนต่างของค่าพลังเป็น ▲', () => {
    const step = getUpgradeStep(1);
    if (!step) throw new Error('ตารางต้องมีขั้น +1');

    renderPanel(card(1));
    expect(screen.getAllByText(`▲${step.statBonus}`).length).toBe(6);
  });

  it('หลอดตีบวกโชว์ขั้นปัจจุบันเทียบกับเพดาน', () => {
    renderPanel(card(3));
    expect(screen.getByText(`+3 / +${MAX_UPGRADE}`)).toBeTruthy();
  });

  it('แถบที่วิ่งโผล่เฉพาะตอนกำลังลุ้น ไม่ค้างอยู่ตอนอยู่เฉย ๆ', () => {
    renderPanel(card(3));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

/* ── ของช่วยตีบวก (การ์ดช่วย + การ์ดป้องกัน) ─────────────── */

describe('ของช่วยตีบวก', () => {
  it('มีปุ่ม + ให้กดเพิ่มการ์ดช่วยครบทุกช่อง', () => {
    renderPanel(card(1));
    expect(screen.getAllByLabelText('เพิ่มการ์ดช่วยตีบวก')).toHaveLength(MATERIAL_CARD_SLOTS);
  });

  it('บอกเกณฑ์ OVR ของการ์ดช่วยด้วยค่าพื้นฐาน ไม่ใช่ค่าหลังตีบวก', () => {
    const base = PLAYERS.find((entry) => entry.id === 'p001');
    if (!base) throw new Error('ไม่พบนักเตะทดสอบ');

    // ตีบวกไป +6 แล้ว OVR จริงสูงกว่าค่าพื้นฐานมาก แต่เกณฑ์ต้องยังเป็นค่าพื้นฐาน
    renderPanel(card(6));
    expect(screen.getByText(new RegExp(`OVR ≥ ${base.ovr}`))).toBeTruthy();
  });

  it('ใส่การ์ดช่วยแล้วอัตราติดขยับขึ้นตามสูตรกลาง', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    const fodder = [card(0, { id: 'f1' }), card(0, { id: 'f2' })];
    renderPanel(card(4), fodder);

    const boosted = getBoostedSuccessRate(step.successRate, fodder.length);
    expect(screen.getByText(`${Math.round(boosted * 100)}%`)).toBeTruthy();
    // ช่องว่างต้องเหลือเท่ากับที่ยังใส่ได้
    expect(screen.getAllByLabelText('เพิ่มการ์ดช่วยตีบวก')).toHaveLength(
      MATERIAL_CARD_SLOTS - fodder.length,
    );
  });

  it('ขั้นที่ตีไม่ติดแล้วลดระดับ ต้องบอกผู้เล่นตรง ๆ', () => {
    const risky = UPGRADE_STEPS.find((entry) => entry.dropOnFail > 0);
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับอย่างน้อยหนึ่งขั้น');

    renderPanel(card(risky.from));
    expect(screen.getByText(/การ์ดป้องกันจะกันไม่ให้ลดระดับ/)).toBeTruthy();
  });

  it('ขั้นต้น ๆ ที่ไม่ลดระดับ บอกชัดว่าไม่ต้องใช้ป้องกัน', () => {
    const safe = UPGRADE_STEPS.find((entry) => entry.dropOnFail === 0);
    if (!safe) throw new Error('ตารางต้องมีขั้นที่ไม่ลดระดับ');

    renderPanel(card(safe.from));
    expect(screen.getByText(/ไม่ลดระดับอยู่แล้ว/)).toBeTruthy();
  });

  it('ไม่มีการ์ดป้องกันเหลือ = สวิตช์ถูกปิดไว้ (บัญชีทดสอบเริ่มจากศูนย์)', () => {
    renderPanel(card(6));
    const toggle = screen.getByRole('button', { name: /การ์ดป้องกัน/ });
    expect(toggle.hasAttribute('disabled')).toBe(true);
  });
});

/* ── กรอบแสงทองของการ์ด +8 ────────────────────────────────── */

describe('แสงทองที่ป้าย +8', () => {
  /** เลเยอร์แสงวิ่ง — อยู่ในป้ายค่าตีบวกบนตัวการ์ด ไม่ใช่รอบกรอบการ์ด */
  const halo = (container: HTMLElement) => container.querySelector('.animate-max-halo');

  it('ป้าย +8 มีแสงทองวิ่งรอบเลข', () => {
    const { container } = renderPanel(card(MAX_UPGRADE));
    expect(halo(container)).not.toBeNull();
  });

  it('แสงอยู่ในป้ายค่าตีบวก ไม่ได้ครอบทั้งการ์ด', () => {
    const { container } = renderPanel(card(MAX_UPGRADE));
    const badge = halo(container)?.parentElement;

    // ป้ายต้องมีเลข 8 ล้วนอยู่ข้างใน ถ้าไปครอบทั้งการ์ดจะเจอข้อความอื่นปนมาด้วย
    expect(badge?.textContent).toBe(String(MAX_UPGRADE));
  });

  it.each([0, 4, 7])('ป้าย +%i ยังไม่มีแสงวิ่ง', (plus) => {
    const { container } = renderPanel(card(plus));
    expect(halo(container)).toBeNull();
  });

  it('หลอดเต็มแล้วช่องทั้งแถวเรืองทอง', () => {
    const { container } = renderPanel(card(MAX_UPGRADE));
    expect(container.querySelectorAll('.animate-max-glow').length).toBeGreaterThan(0);
  });
});

/* ── ห้ามสปอยล์ผลก่อนหลอดเต็ม ─────────────────────────────── */

describe('ผลต้องไม่โผล่ก่อนหลอดวิ่งจนสุด', () => {
  /*
   * เคยเป็นบั๊กจริง: usePlayers.upgradeCard เล่น levelUp ทันทีที่กด
   * เสียง "ติด" เลยดังตั้งแต่หลอดยังไม่ทันวิ่ง = สปอยล์ผลก่อนเฉลย
   */
  it('hook ตีบวกไม่เล่นเสียงผลลัพธ์เอง — ปล่อยให้หน้าจอเลือกจังหวะ', () => {
    const source = readFileSync(resolvePath(process.cwd(), 'src/hooks/usePlayers.tsx'), 'utf8');
    const upgradeBlock = source.slice(source.indexOf('const upgradeCard = useCallback'));
    const body = upgradeBlock.slice(0, upgradeBlock.indexOf('const addProtectCards'));

    expect(body).not.toContain("playSfx('levelUp')");
  });

  it('หน้าจอเล่นเสียงผลลัพธ์หลังหลอดเต็มเท่านั้น', () => {
    const source = readFileSync(
      resolvePath(process.cwd(), 'src/components/upgrade/UpgradeCardPanel.tsx'),
      'utf8',
    );

    // เสียงผลลัพธ์อยู่ใน settle() ซึ่งออกก่อนถ้าหลอดยังไม่เต็ม
    const settle = source.slice(source.indexOf('const settle = ()'));
    expect(settle.slice(0, settle.indexOf('};'))).toContain('barFilled.current');
    expect(settle).toContain("playSfx(next === 'success' ? 'upgradeSuccess' : 'upgradeFail')");
  });

  it('ระหว่างหลอดวิ่งต้องเรนเดอร์จากภาพนิ่ง ไม่ใช่การ์ดสด', () => {
    const source = readFileSync(
      resolvePath(process.cwd(), 'src/components/upgrade/UpgradeCardPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('const shown = rolling && frozen ? frozen : card;');
  });
});

/* ── ตารางที่แอดมินตั้งต้องไหลเข้า Engine ─────────────────── */

describe('ตารางที่แอดมินตั้งมีผลกับ Attribute Engine จริง', () => {
  it('เพิ่มค่าพลังต่อขั้นแล้ว OVR จริงของการ์ดขยับตาม', () => {
    const before = getEffectivePlayerOvr(card(1));

    setUpgradeSteps(UPGRADE_STEPS.map((step) => ({ ...step, statBonus: step.statBonus + 3 })));

    expect(getEffectivePlayerOvr(card(1))).toBe(before + 3);
  });

  it('ตารางที่พังถูกปฏิเสธ แล้วถอยกลับไปใช้ค่าในโค้ด', () => {
    const broken = UPGRADE_STEPS.slice(0, 3);
    expect(setUpgradeSteps(broken).length).toBeGreaterThan(0);

    // ยังตีบวกถึง +8 ได้เหมือนเดิม แปลว่าถอยกลับสำเร็จ
    expect(getUpgradeStep(MAX_UPGRADE - 1)).not.toBeNull();
  });
});
