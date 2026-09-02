/**
 * เมนูหลักของเกม — แหล่งข้อมูลเดียวที่ Sidebar และเมนูมือถือใช้ร่วมกัน
 * available = false คือหน้าที่ยังไม่ได้ทำในเฟสนี้ (แสดงเป็นเมนูจาง กดไม่ได้)
 * ownerOnly = true คือเมนูที่โผล่เฉพาะเจ้าของโปรเจค (ดู OWNER_USERNAMES)
 * configKey = เมนูที่แอดมินเปิด/ปิดได้จากหน้า ADMIN (ปิดแล้วซ่อนจากทุกคน)
 */
export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: string;
  available: boolean;
  /** true = ซ่อนจากผู้เล่นทั่วไป โผล่เฉพาะเจ้าของโปรเจค */
  ownerOnly?: boolean;
  /** เมนูนี้ขึ้นกับสวิตช์ในหน้า ADMIN ตัวไหน (ไม่ใส่ = เปิดตลอด) */
  configKey?: 'luckyBox' | 'pass';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: '⌂', available: true },
  { id: 'my-team', path: '/my-team', label: 'My Team', icon: '⚽', available: true },
  // ท้าผู้เล่นจริงเมื่อไหร่ก็ได้ (เดิมซ่อนอยู่ในแดชบอร์ดล่างของหน้า MY TEAM)
  { id: 'matchmaking', path: '/matchmaking', label: 'Matchmaking', icon: '⚔', available: true },
  // ลีกประจำวัน — ระบบเดินรอบให้เองทุก 30 นาที
  { id: 'match', path: '/match', label: 'Match', icon: '⚑', available: true },
  { id: 'transfer', path: '/transfer-market', label: 'Transfer Market', icon: '⇅', available: false },
  { id: 'card-pack', path: '/card-pack', label: 'Card Pack', icon: '▣', available: true },
  { id: 'exchange', path: '/exchange', label: 'Exchange', icon: '✦', available: true },
  // กล่องสุ่มรางวัลแบบตาราง — แอดมินเปิด/ปิดได้ ปิดแล้วเมนูนี้หายไปเลย
  { id: 'lucky', path: '/lucky', label: 'Lucky Box', icon: '◆', available: true, configKey: 'luckyBox' },
  // พาสประจำซีซัน — แอดมินเปิด/ปิดได้ ปิดแล้วเมนูนี้หายไปเลย
  { id: 'pass', path: '/pass', label: 'Pass', icon: '★', available: true, configKey: 'pass' },
  // ตีบวกนักเตะ +0 → +8 (PHASE 13.5)
  { id: 'upgrade', path: '/upgrade', label: 'Upgrade', icon: '🔨', available: true },
  // คลังการ์ดเต็มรูปแบบ: ตัวกรอง ค้นหา ล็อกการ์ด ขายทีละหลายใบ
  { id: 'inventory', path: '/inventory', label: 'Inventory', icon: '◧', available: true },
  // โปรไฟล์และสถิติของบัญชี (ตั้งรูป/ระดับ/ย่อยการ์ดแบบเดิม) — ยังใช้งานได้ตามปกติ
  { id: 'profile', path: '/profile', label: 'Profile', icon: '☺', available: true },
  { id: 'leaderboard', path: '/leaderboard', label: 'Leaderboard', icon: '▤', available: true },
  { id: 'events', path: '/events', label: 'Events', icon: '★', available: false },
  { id: 'club', path: '/club', label: 'Club', icon: '◈', available: false },
  { id: 'store', path: '/store', label: 'Store', icon: '⬡', available: false },
  { id: 'settings', path: '/settings', label: 'Settings', icon: '⚙', available: true },
  { id: 'admin', path: '/admin', label: 'Admin', icon: '⚒', available: true, ownerOnly: true },
];

/** สวิตช์ของเมนูที่แอดมินเปิด/ปิดได้ */
export interface NavToggles {
  luckyBox: boolean;
  pass: boolean;
}

/**
 * เมนูที่บัญชีนี้ควรเห็น
 * ตัดเมนูเจ้าของออกถ้าไม่ใช่เจ้าของ และตัดเมนูที่แอดมินปิดสวิตช์ไว้ออกด้วย
 */
export const visibleNavItems = (isOwner: boolean, toggles?: NavToggles): NavItem[] =>
  NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.configKey && toggles && !toggles[item.configKey]) return false;
    return true;
  });

/** ชื่อหน้าใช้แสดงบน Header */
export const getPageTitle = (pathname: string): string =>
  NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'My Team';
