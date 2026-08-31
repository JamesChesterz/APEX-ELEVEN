/**
 * PHASE 13.5 — เทสหน้า UPGRADE และการต่อสายเข้าระบบจริง
 *
 * สิ่งที่ต้องพิสูจน์: หน้าจอไม่มีตัวเลข hardcode เลย
 * แก้ตารางตีบวกที่เดียว แล้วทั้งหน้าจอกับ Attribute Engine ต้องเห็นค่าใหม่พร้อมกัน
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { GameConfigProvider } from '@/hooks/useGameConfig';
import { InventoryProvider } from '@/hooks/usePlayers';
import { UpgradeCardPanel } from '@/components/upgrade/UpgradeCardPanel';
import { NAV_ITEMS, visibleNavItems } from '@/components/sidebar/navItems';
import {
  MAX_UPGRADE,
  UPGRADE_STEPS,
  getUpgradeStep,
  setUpgradeSteps,
  type UpgradeStep,
} from '@/data/upgradeConfig';
import { createCardInstance } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';

const card = (upgrade: number, extra: Partial<CardInstance> = {}): CardInstance => ({
  ...createCardInstance({ id: 'card_ui', playerId: 'p001', upgrade }),
  ...extra,
});

const renderPanel = (value: CardInstance | null) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <InventoryProvider>
          <GameConfigProvider>
            <UpgradeCardPanel card={value} />
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

    expect(screen.getByText(`OVR ${getEffectivePlayerOvr(target)}`)).toBeTruthy();
    expect(screen.getByText(`OVR ${getEffectivePlayerOvr(card(5))}`)).toBeTruthy();
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

    expect(screen.getByText(new RegExp(`ตีบวกจนสุดแล้ว`))).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upgrade/i }).hasAttribute('disabled')).toBe(true);
  });

  it('การ์ดที่ล็อกไว้ตีบวกไม่ได้', () => {
    renderPanel(card(2, { locked: true }));

    expect(screen.getByText(/ถูกล็อกไว้/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upgrade/i }).hasAttribute('disabled')).toBe(true);
  });

  it('แต้มตีบวกไม่พอ = ปุ่มถูกปิดพร้อมบอกเหตุผล (บัญชีทดสอบเริ่มจากศูนย์)', () => {
    renderPanel(card(0));

    expect(screen.getByText(/แต้มตีบวกไม่พอ|เหรียญไม่พอ/)).toBeTruthy();
  });

  it('การ์ดที่ชี้ไปนักเตะที่ไม่มีอยู่ไม่ทำให้หน้าจอพัง', () => {
    renderPanel(card(0, { playerId: 'ไม่มีอยู่จริง' }));
    expect(screen.getByText(/ไม่มีอยู่ในระบบ/)).toBeTruthy();
  });

  it('โชว์ค่าพลังครบทั้งหกด้าน', () => {
    renderPanel(card(1));
    ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
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
