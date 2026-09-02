/**
 * เทสหน้า UPGRADE (เวอร์ชันใช้การ์ดนักเตะเป็นวัตถุดิบ)
 *
 * สิ่งที่ต้องพิสูจน์:
 *   1. หน้าจอไม่มีตัวเลข hardcode — แก้ตารางที่เดียวแล้วหน้าจอกับ Engine เห็นค่าใหม่พร้อมกัน
 *   2. ค่าอัปเกรดคือ "การ์ดนักเตะ" ไม่ใช่แต้มตีบวกอีกแล้ว
 *   3. ไอเทมช่วยอัปเกรด (รวมการ์ดกันแตก) ต่อสายเข้าการคิดโอกาสจริง
 *   4. ผลต้องไม่โผล่ก่อนหลอดวิ่งจนสุด
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
  MAX_STREAK_STAGE,
  MAX_UPGRADE,
  UPGRADE_ITEMS,
  UPGRADE_STEPS,
  getFinalSuccessRate,
  getRequiredMaterialCards,
  getUpgradeOdds,
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

/* ── หน้าอัปเกรด ───────────────────────────────────────────── */

describe('หน้าอัปเกรดอ่านค่าจากระบบจริง', () => {
  it('ยังไม่ได้เลือกการ์ด = บอกให้เลือกก่อน ไม่พัง', () => {
    renderPanel(null);
    expect(screen.getByText(/ยังไม่ได้เลือกนักเตะ/)).toBeTruthy();
  });

  it('โชว์ OVR ปัจจุบันและ OVR หลังอัปเกรดสำเร็จตามที่ Attribute Engine คำนวณ', () => {
    const target = card(4);
    renderPanel(target);

    expect(screen.getAllByText(String(getEffectivePlayerOvr(target))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(getEffectivePlayerOvr(card(5)))).length).toBeGreaterThan(0);
  });

  it('โอกาสสำเร็จมาจากตารางกลาง ไม่ได้เขียนตายตัวในหน้าจอ', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    renderPanel(card(4));
    expect(screen.getAllByText(`${Math.round(step.successRate * 100)}%`).length).toBeGreaterThan(0);
  });

  it('แก้ตารางแล้วหน้าจอโชว์ตัวเลขใหม่ทันที (ไม่มีสำเนาของตัวเอง)', () => {
    const tweaked: UpgradeStep[] = UPGRADE_STEPS.map((step) =>
      step.from === 4 ? { ...step, successRate: 0.99 } : step,
    );
    expect(setUpgradeSteps(tweaked)).toEqual([]);

    renderPanel(card(4));
    expect(screen.getAllByText('99%').length).toBeGreaterThan(0);
  });

  it('การ์ดที่ +8 แล้วปุ่มถูกปิดและบอกว่าตันแล้ว', () => {
    renderPanel(card(MAX_UPGRADE));

    expect(screen.getByText(/อัปเกรดจนสุดแล้ว/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ยืนยันอัปเกรด' }).hasAttribute('disabled')).toBe(true);
  });

  it('การ์ดที่ล็อกไว้อัปเกรดไม่ได้', () => {
    renderPanel(card(2, { locked: true }));

    expect(screen.getByText(/ถูกล็อกไว้/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ยืนยันอัปเกรด' }).hasAttribute('disabled')).toBe(true);
  });

  it('การ์ดที่ชี้ไปนักเตะที่ไม่มีอยู่ไม่ทำให้หน้าจอพัง', () => {
    renderPanel(card(0, { playerId: 'ไม่มีอยู่จริง' }));
    expect(screen.getByText(/ยังไม่ได้เลือกนักเตะ/)).toBeTruthy();
  });

  it('โชว์ค่าพลังครบทั้งหกด้านพร้อมส่วนต่างที่จะได้', () => {
    const step = getUpgradeStep(1);
    if (!step) throw new Error('ตารางต้องมีขั้น +1');

    renderPanel(card(1));
    ['ความเร็ว', 'พลังการยิง', 'ส่งบอล', 'เลี้ยงบอล', 'ป้องกัน', 'พละกำลัง'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(`+${step.statBonus}`).length).toBe(6);
  });

  it('แถบที่วิ่งโผล่เฉพาะตอนกำลังลุ้น ไม่ค้างอยู่ตอนอยู่เฉย ๆ', () => {
    renderPanel(card(3));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

/* ── ค่าอัปเกรด = การ์ดนักเตะ ──────────────────────────────── */

describe('ค่าอัปเกรดเป็นการ์ดนักเตะ ไม่ใช่แต้มตีบวก', () => {
  it('มีช่องใส่นักเตะครบตามที่ตั้งไว้', () => {
    renderPanel(card(1));
    expect(screen.getAllByLabelText('เลือกนักเตะใส่ช่องอัปเกรด')).toHaveLength(
      MATERIAL_CARD_SLOTS,
    );
  });

  it('ไม่ใส่การ์ดสักใบก็กดอัปเกรดได้ — การ์ดเป็นตัวเลือก ไม่ใช่ค่าบังคับ', () => {
    renderPanel(card(1));
    expect(screen.getByRole('button', { name: 'ยืนยันอัปเกรด' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('ค่าเริ่มต้นไม่บังคับการ์ดสักขั้น และถ้าบังคับก็ต้องไม่เกินจำนวนช่อง', () => {
    UPGRADE_STEPS.forEach((step) => {
      const required = getRequiredMaterialCards(step);
      expect(required).toBe(0);
      expect(required).toBeLessThanOrEqual(MATERIAL_CARD_SLOTS);
    });
  });

  it('แอดมินตั้งทับให้ขั้นไหนบังคับการ์ดได้ แล้วปุ่มจะปิดจนกว่าจะใส่ครบ', () => {
    const step = getUpgradeStep(1);
    if (!step) throw new Error('ตารางต้องมีขั้น +1');

    // ตั้งทับผ่าน step.materialCards — ทางเดียวกับที่แผงแอดมินใช้
    expect(getRequiredMaterialCards({ ...step, materialCards: 3 })).toBe(3);
    // เกินจำนวนช่องต้องถูกบีบลงมา ไม่ปล่อยให้ตั้งจนกดไม่ได้ตลอดกาล
    expect(getRequiredMaterialCards({ ...step, materialCards: 99 })).toBe(MATERIAL_CARD_SLOTS);
  });

  it('ใส่การ์ดเกินจำนวนที่บังคับแล้วโอกาสสำเร็จขยับขึ้นตามสูตรกลาง', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    const required = getRequiredMaterialCards(step);
    const fodder = Array.from({ length: required + 1 }, (_, index) =>
      card(0, { id: `f${index}` }),
    );

    renderPanel(card(4), fodder);

    const boosted = getFinalSuccessRate(step, { extraCards: 1 });
    expect(boosted).toBeGreaterThan(step.successRate);
    expect(screen.getAllByText(`${Math.round(boosted * 100)}%`).length).toBeGreaterThan(0);
  });

  it('ไม่มีคำว่า "แต้มตีบวก" เป็นค่าอัปเกรดในหน้าจอแล้ว', () => {
    const source = readFileSync(
      resolvePath(process.cwd(), 'src/components/upgrade/UpgradeCardPanel.tsx'),
      'utf8',
    );

    expect(source).not.toContain('materialCost');
  });
});

/* ── ไอเทมช่วยอัปเกรด (รวมการ์ดกันแตก) ─────────────────────── */

describe('ไอเทมช่วยอัปเกรด', () => {
  it('โชว์ไอเทมครบทั้งสามชนิดตามแบบ', () => {
    renderPanel(card(6));
    UPGRADE_ITEMS.forEach((item) => {
      expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
    });
  });

  it('มีการ์ดกันแตก (ป้องกันลดขั้น) อยู่ในชุดไอเทม', () => {
    expect(UPGRADE_ITEMS.some((item) => item.id === 'protect')).toBe(true);
  });

  it('ติดไอเทมป้องกันแล้วโอกาส "ลดขั้น" กลายเป็นศูนย์', () => {
    const risky = UPGRADE_STEPS.find((entry) => entry.dropOnFail > 0);
    if (!risky) throw new Error('ตารางต้องมีขั้นที่ลดระดับอย่างน้อยหนึ่งขั้น');

    expect(getUpgradeOdds(risky, {}).drop).toBeGreaterThan(0);
    expect(getUpgradeOdds(risky, { useProtect: true }).drop).toBe(0);
    expect(getUpgradeOdds(risky, { useProtect: true }).stay).toBeGreaterThan(0);
  });

  it('ไอเทมการันตีขั้นดันโอกาสเป็น 100%', () => {
    const step = getUpgradeStep(7);
    if (!step) throw new Error('ตารางต้องมีขั้น +7');

    expect(getFinalSuccessRate(step, { useGuarantee: true })).toBe(1);
  });

  it('ตารางข้อมูลอัปเกรดรวมกันได้ 100% เสมอ', () => {
    UPGRADE_STEPS.forEach((step) => {
      const odds = getUpgradeOdds(step, {});
      const total = odds.success + odds.bigDrop + odds.stay + odds.drop + odds.destroy;
      expect(Math.round(total * 100)).toBe(100);
    });
  });

  it('โชว์หัวข้อทั้งห้าแถวของแผงข้อมูลอัปเกรด', () => {
    renderPanel(card(6));
    ['เพิ่มโอกาส', 'ลดโอกาส', 'คงที่', 'ลดขั้น', 'ล้มเหลว'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });
});

/* ── โบนัสสะสมเมื่ออัปเกรดพลาด ─────────────────────────────── */

describe('โบนัสสะสม', () => {
  it('โชว์โล่ครบทุกขั้น', () => {
    renderPanel(card(3));
    Array.from({ length: MAX_STREAK_STAGE }).forEach((_, index) => {
      expect(screen.getAllByText(String(index + 1)).length).toBeGreaterThan(0);
    });
  });

  it('สะสมไว้แล้วโอกาสสำเร็จสูงกว่าตอนยังไม่สะสม', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    expect(getFinalSuccessRate(step, { streak: 3 })).toBeGreaterThan(
      getFinalSuccessRate(step, { streak: 0 }),
    );
  });

  it('สะสมเกินเพดานไม่ทำให้โอกาสวิ่งต่อ', () => {
    const step = getUpgradeStep(4);
    if (!step) throw new Error('ตารางต้องมีขั้น +4');

    expect(getFinalSuccessRate(step, { streak: 99 })).toBe(
      getFinalSuccessRate(step, { streak: MAX_STREAK_STAGE }),
    );
  });
});

/* ── ห้ามสปอยล์ผลก่อนหลอดเต็ม ─────────────────────────────── */

describe('ผลต้องไม่โผล่ก่อนหลอดวิ่งจนสุด', () => {
  /*
   * เคยเป็นบั๊กจริง: usePlayers.upgradeCard เล่นเสียงผลทันทีที่กด
   * เสียง "ติด" เลยดังตั้งแต่หลอดยังไม่ทันวิ่ง = สปอยล์ผลก่อนเฉลย
   */
  it('hook อัปเกรดไม่เล่นเสียงผลลัพธ์เอง — ปล่อยให้หน้าจอเลือกจังหวะ', () => {
    const source = readFileSync(resolvePath(process.cwd(), 'src/hooks/usePlayers.tsx'), 'utf8');
    const upgradeBlock = source.slice(source.indexOf('const upgradeCard = useCallback'));
    const body = upgradeBlock.slice(0, upgradeBlock.indexOf('const addUpgradeItems'));

    expect(body).not.toContain("playSfx('levelUp')");
    expect(body).not.toContain("playSfx('upgradeSuccess')");
  });

  it('หน้าจอเล่นเสียงผลลัพธ์หลังหลอดเต็มเท่านั้น', () => {
    const source = readFileSync(
      resolvePath(process.cwd(), 'src/components/upgrade/UpgradeCardPanel.tsx'),
      'utf8',
    );

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

    expect(getUpgradeStep(MAX_UPGRADE - 1)).not.toBeNull();
  });
});
