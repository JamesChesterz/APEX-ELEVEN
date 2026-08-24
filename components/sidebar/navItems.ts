/**
 * เมนูหลักของเกม — แหล่งข้อมูลเดียวที่ Sidebar และเมนูมือถือใช้ร่วมกัน
 * available = false คือหน้าที่ยังไม่ได้ทำในเฟสนี้ (แสดงเป็นเมนูจาง กดไม่ได้)
 */
export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: string;
  available: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: '⌂', available: true },
  { id: 'my-team', path: '/my-team', label: 'My Team', icon: '⚽', available: true },
  // ลีกประจำวัน + แมตช์กระชับมิตร
  { id: 'match', path: '/match', label: 'Match', icon: '⚑', available: true },
  { id: 'transfer', path: '/transfer-market', label: 'Transfer Market', icon: '⇅', available: false },
  { id: 'card-pack', path: '/card-pack', label: 'Card Pack', icon: '▣', available: true },
  { id: 'exchange', path: '/exchange', label: 'Exchange', icon: '✦', available: true },
  // หน้านี้มีทั้งโปรไฟล์ (ตั้งรูป/ระดับ/สถิติ) และคลังการ์ด — ชื่อเดิม "My Cards" ทำให้หาที่ตั้งรูปไม่เจอ
  { id: 'profile', path: '/profile', label: 'Profile', icon: '◧', available: true },
  { id: 'leaderboard', path: '/leaderboard', label: 'Leaderboard', icon: '▤', available: true },
  { id: 'missions', path: '/missions', label: 'Missions', icon: '✓', available: false },
  { id: 'events', path: '/events', label: 'Events', icon: '★', available: false },
  { id: 'club', path: '/club', label: 'Club', icon: '◈', available: false },
  { id: 'store', path: '/store', label: 'Store', icon: '⬡', available: false },
  { id: 'settings', path: '/settings', label: 'Settings', icon: '⚙', available: true },
];

/** ชื่อหน้าใช้แสดงบน Header */
export const getPageTitle = (pathname: string): string =>
  NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'My Team';
