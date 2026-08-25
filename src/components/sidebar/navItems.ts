/**
 * เมนูหลักของเกม — แหล่งข้อมูลเดียวที่ Sidebar และเมนูมือถือใช้ร่วมกัน
 * available = false คือหน้าที่ยังไม่ได้ทำในเฟสนี้ (แสดงเป็นเมนูจาง กดไม่ได้)
 * ownerOnly = true คือเมนูที่โผล่เฉพาะเจ้าของโปรเจค (ดู OWNER_USERNAMES)
 */
export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: string;
  available: boolean;
  /** true = ซ่อนจากผู้เล่นทั่วไป โผล่เฉพาะเจ้าของโปรเจค */
  ownerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: '⌂', available: true },
  { id: 'my-team', path: '/my-team', label: 'My Team', icon: '⚽', available: true },
  // ลีกประจำวัน + แมตช์กระชับมิตร
  { id: 'match', path: '/match', label: 'Match', icon: '⚑', available: true },
  { id: 'transfer', path: '/transfer-market', label: 'Transfer Market', icon: '⇅', available: false },
  { id: 'card-pack', path: '/card-pack', label: 'Card Pack', icon: '▣', available: true },
  { id: 'exchange', path: '/exchange', label: 'Exchange', icon: '✦', available: true },
  // หน้านี้มีทั้งคลังการ์ดและโปรไฟล์ (ตั้งรูป/ระดับ/สถิติ) — คลังการ์ดเป็นสิ่งที่คนเข้ามาหาบ่อยกว่า
  { id: 'profile', path: '/profile', label: 'Inventory', icon: '◧', available: true },
  { id: 'leaderboard', path: '/leaderboard', label: 'Leaderboard', icon: '▤', available: true },
  { id: 'events', path: '/events', label: 'Events', icon: '★', available: false },
  { id: 'club', path: '/club', label: 'Club', icon: '◈', available: false },
  { id: 'store', path: '/store', label: 'Store', icon: '⬡', available: false },
  { id: 'settings', path: '/settings', label: 'Settings', icon: '⚙', available: true },
  { id: 'admin', path: '/admin', label: 'Admin', icon: '⚒', available: true, ownerOnly: true },
];

/** เมนูที่บัญชีนี้ควรเห็น (ตัดเมนูเจ้าของออกถ้าไม่ใช่เจ้าของ) */
export const visibleNavItems = (isOwner: boolean): NavItem[] =>
  NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);

/** ชื่อหน้าใช้แสดงบน Header */
export const getPageTitle = (pathname: string): string =>
  NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'My Team';
