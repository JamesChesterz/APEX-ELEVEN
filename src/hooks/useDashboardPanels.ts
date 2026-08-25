/**
 * จำว่าผู้เล่นซ่อนการ์ดไหนไว้บ้างในแดชบอร์ดหน้า MY TEAM
 *
 * เก็บในเครื่อง (localStorage) ไม่ต้องขึ้นคลาวด์ — เป็นความชอบส่วนตัวของแต่ละเครื่อง
 * คนละเครื่องตั้งคนละแบบได้ และไม่เปลืองโควตาอ่าน/เขียนฐานข้อมูล
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

/** การ์ดทั้งหมดในแดชบอร์ด เรียงตามลำดับที่แสดงจริง */
export const DASHBOARD_PANELS = [
  { id: 'chat', label: 'Live แชท' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'matchmaking', label: 'Matchmaking' },
  { id: 'leaderboard', label: 'Leaderboard' },
] as const;

export type DashboardPanelId = (typeof DASHBOARD_PANELS)[number]['id'];

const STORAGE_KEY = 'apex:dashboard:hidden';

/** อ่านรายการที่ซ่อนไว้จากเครื่อง — พังก็ถือว่าไม่เคยซ่อนอะไร */
const readHidden = (): DashboardPanelId[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return [];

    // กรองเฉพาะ id ที่ยังมีอยู่จริง เผื่อวันหลังเปลี่ยนชุดการ์ด
    return DASHBOARD_PANELS.map((panel) => panel.id).filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
};

export const useDashboardPanels = () => {
  const [hidden, setHidden] = useState<DashboardPanelId[]>(readHidden);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    } catch {
      // เขียนไม่ได้ (โหมดส่วนตัว/พื้นที่เต็ม) ก็ปล่อยไป แค่จำข้ามรอบไม่ได้เท่านั้น
    }
  }, [hidden]);

  const isVisible = useCallback((id: DashboardPanelId) => !hidden.includes(id), [hidden]);

  const toggle = useCallback((id: DashboardPanelId) => {
    setHidden((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }, []);

  const hide = useCallback((id: DashboardPanelId) => {
    setHidden((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const showAll = useCallback(() => setHidden([]), []);

  const hideAll = useCallback(
    () => setHidden(DASHBOARD_PANELS.map((panel) => panel.id)),
    [],
  );

  return useMemo(
    () => ({
      hidden,
      /** จำนวนการ์ดที่ยังโชว์อยู่ */
      visibleCount: DASHBOARD_PANELS.length - hidden.length,
      isVisible,
      toggle,
      hide,
      showAll,
      hideAll,
    }),
    [hidden, hide, hideAll, isVisible, showAll, toggle],
  );
};
