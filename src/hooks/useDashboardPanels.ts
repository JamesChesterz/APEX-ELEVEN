/**
 * จำว่าผู้เล่นซ่อนการ์ดไหนไว้บ้างในคอลัมน์ขวาของหน้า MY TEAM
 *
 * เก็บในเครื่อง (localStorage) ไม่ต้องขึ้นคลาวด์ — เป็นความชอบส่วนตัวของแต่ละเครื่อง
 * คนละเครื่องตั้งคนละแบบได้ และไม่เปลืองโควตาอ่าน/เขียนฐานข้อมูล
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * การ์ดในคอลัมน์ขวา เรียงตามลำดับที่แสดงจริง
 *
 * Live แชทมาแทนที่แผงสรุปการตีบวก (สรุปการตีบวกดูได้ที่หน้า INVENTORY)
 * และตอนนี้ไม่มีแดชบอร์ดแถวล่างแล้ว การ์ดทั้งหมดของหน้านี้อยู่ในคอลัมน์เดียว
 */
export const SIDE_PANELS = [
  { id: 'teamOvr', label: 'Team OVR' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'teamValue', label: 'Total Value' },
  { id: 'chat', label: 'Live แชท' },
] as const;

/** ทุกการ์ดที่ซ่อนได้ในหน้านี้ — ใช้ตัวเดียวกันทั้งการเก็บค่าและการกรองค่าที่อ่านมา */
export const ALL_PANELS = SIDE_PANELS;

export type DashboardPanelId = (typeof ALL_PANELS)[number]['id'];

const STORAGE_KEY = 'apex:dashboard:hidden';

/** อ่านรายการที่ซ่อนไว้จากเครื่อง — พังก็ถือว่าไม่เคยซ่อนอะไร */
const readHidden = (): DashboardPanelId[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return [];

    // กรองเฉพาะ id ที่ยังมีอยู่จริง เผื่อวันหลังเปลี่ยนชุดการ์ด
    return ALL_PANELS.map((panel) => panel.id).filter((id) => parsed.includes(id));
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

  /** แสดงทุกใบในกลุ่มที่ระบุ (ไม่ยุ่งกับกลุ่มอื่น) */
  const showGroup = useCallback((ids: readonly DashboardPanelId[]) => {
    setHidden((current) => current.filter((entry) => !ids.includes(entry)));
  }, []);

  /** ซ่อนทุกใบในกลุ่มที่ระบุ */
  const hideGroup = useCallback((ids: readonly DashboardPanelId[]) => {
    setHidden((current) => [...new Set([...current, ...ids])]);
  }, []);

  /** ในกลุ่มนี้ยังโชว์อยู่กี่ใบ */
  const visibleIn = useCallback(
    (ids: readonly DashboardPanelId[]) => ids.filter((id) => !hidden.includes(id)).length,
    [hidden],
  );

  return useMemo(
    () => ({
      hidden,
      isVisible,
      toggle,
      hide,
      showGroup,
      hideGroup,
      visibleIn,
    }),
    [hidden, hide, hideGroup, isVisible, showGroup, toggle, visibleIn],
  );
};
