/**
 * เมนูหลักของเกม — แหล่งข้อมูลเดียวที่ Sidebar และเมนูมือถือใช้ร่วมกัน
 *
 * available = false คือหน้าที่ยังไม่ได้ทำในเฟสนี้ (แสดงเป็นเมนูจาง กดไม่ได้)
 * ownerOnly = true คือเมนูที่โผล่เฉพาะเจ้าของโปรเจค (ดู OWNER_USERNAMES)
 * configKey = เมนูที่แอดมินเปิด/ปิดได้จากหน้า ADMIN (ปิดแล้วซ่อนจากทุกคน)
 * group     = หมวดที่เมนูนี้อยู่ ใช้แบ่งหัวข้อในแถบซ้าย
 */

/** หมวดของเมนู เรียงตามลำดับที่อยากให้โผล่ในแถบซ้าย */
export type NavGroup = 'main' | 'compete' | 'collect' | 'season' | 'account';

export const NAV_GROUPS: Array<{ id: NavGroup; label: string }> = [
  { id: 'main', label: 'ทีมของฉัน' },
  { id: 'compete', label: 'ลงแข่ง' },
  { id: 'collect', label: 'หาการ์ด & พัฒนา' },
  { id: 'season', label: 'ซีซัน & กิจกรรม' },
  { id: 'account', label: 'บัญชี' },
];

export interface NavItem {
  id: string;
  path: string;
  label: string;
  /** ไอคอนสำรอง ใช้เมื่อเมนูนั้นยังไม่มีไฟล์รูป */
  icon: string;
  /** ไฟล์ไอคอนใน public/nav/ — ไม่มี = ตกไปใช้ icon ตัวอักษรแทน */
  iconUrl?: string;
  group: NavGroup;
  available: boolean;
  /** true = ซ่อนจากผู้เล่นทั่วไป โผล่เฉพาะเจ้าของโปรเจค */
  ownerOnly?: boolean;
  /** เมนูนี้ขึ้นกับสวิตช์ในหน้า ADMIN ตัวไหน (ไม่ใส่ = เปิดตลอด) */
  configKey?: 'luckyBox' | 'pass';
}

/** โฟลเดอร์ไอคอนเมนู — เปลี่ยนรูปได้โดยทับไฟล์เดิม ไม่ต้องแก้โค้ด */
const ICON = '/nav/';

export const NAV_ITEMS: NavItem[] = [
  /* ── ทีมของฉัน ── */
  { id: 'home', path: '/', label: 'Home', icon: '⌂', group: 'main', available: true },
  { id: 'my-team', path: '/my-team', label: 'My Team', icon: '⚽', iconUrl: `${ICON}my-team.png`, group: 'main', available: true },
  // คลังการ์ดเต็มรูปแบบ: ตัวกรอง ค้นหา ล็อกการ์ด ขายทีละหลายใบ
  { id: 'inventory', path: '/inventory', label: 'Inventory', icon: '◧', iconUrl: `${ICON}inventory.png`, group: 'main', available: true },

  /* ── ลงแข่ง ── */
  // ท้าผู้เล่นจริงเมื่อไหร่ก็ได้
  { id: 'matchmaking', path: '/matchmaking', label: 'Matchmaking', icon: '⚔', iconUrl: `${ICON}matchmaking.png`, group: 'compete', available: true },
  // ลีกประจำวัน — ระบบเดินรอบให้เองทุก 30 นาที
  { id: 'match', path: '/match', label: 'Match', icon: '⚑', iconUrl: `${ICON}match.png`, group: 'compete', available: true },
  { id: 'leaderboard', path: '/leaderboard', label: 'Leaderboard', icon: '▤', iconUrl: `${ICON}leaderboard.png`, group: 'compete', available: true },

  /* ── หาการ์ด & พัฒนา ── */
  { id: 'card-pack', path: '/card-pack', label: 'Card Pack', icon: '▣', iconUrl: `${ICON}card-pack.png`, group: 'collect', available: true },
  { id: 'exchange', path: '/exchange', label: 'Exchange', icon: '✦', iconUrl: `${ICON}exchange.png`, group: 'collect', available: true },
  // ตีบวกนักเตะ +0 → +8
  { id: 'upgrade', path: '/upgrade', label: 'Upgrade', icon: '🔨', iconUrl: `${ICON}upgrade.png`, group: 'collect', available: true },
  // กล่องสุ่มรางวัลแบบตาราง — แอดมินเปิด/ปิดได้ ปิดแล้วเมนูนี้หายไปเลย
  { id: 'lucky', path: '/lucky', label: 'Lucky Box', icon: '◆', iconUrl: `${ICON}lucky.png`, group: 'collect', available: true, configKey: 'luckyBox' },
  { id: 'transfer', path: '/transfer-market', label: 'Transfer Market', icon: '⇅', iconUrl: `${ICON}transfer.png`, group: 'collect', available: false },
  { id: 'store', path: '/store', label: 'Store', icon: '⬡', iconUrl: `${ICON}store.png`, group: 'collect', available: false },

  /* ── ซีซัน & กิจกรรม ── */
  // รางวัลล็อกอินรายสัปดาห์/รายเดือน — แอดมินตั้งของรางวัลได้ทุกช่อง
  { id: 'login-bonus', path: '/login-bonus', label: 'Login Bonus', icon: '📅', group: 'season', available: true },
  // พาสประจำซีซัน — แอดมินเปิด/ปิดได้ ปิดแล้วเมนูนี้หายไปเลย
  { id: 'pass', path: '/pass', label: 'Pass', icon: '★', group: 'season', available: true, configKey: 'pass' },
  { id: 'events', path: '/events', label: 'Events', icon: '★', iconUrl: `${ICON}events.png`, group: 'season', available: false },
  { id: 'club', path: '/club', label: 'Club', icon: '◈', iconUrl: `${ICON}club.png`, group: 'season', available: false },

  /* ── บัญชี ── */
  { id: 'profile', path: '/profile', label: 'Profile', icon: '☺', iconUrl: `${ICON}profile.png`, group: 'account', available: true },
  { id: 'settings', path: '/settings', label: 'Settings', icon: '⚙', group: 'account', available: true },
  { id: 'admin', path: '/admin', label: 'Admin', icon: '⚒', group: 'account', available: true, ownerOnly: true },
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

/**
 * เมนูที่เห็นได้ จัดกลุ่มตามหมวดพร้อมหัวข้อ
 * หมวดที่ไม่เหลือเมนูเลย (เช่นปิด Lucky Box กับ Pass หมด) จะถูกตัดทิ้ง ไม่ค้างหัวข้อเปล่า
 */
export const groupedNavItems = (
  isOwner: boolean,
  toggles?: NavToggles,
): Array<{ id: NavGroup; label: string; items: NavItem[] }> => {
  const items = visibleNavItems(isOwner, toggles);

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
};

/** ชื่อหน้าใช้แสดงบน Header */
export const getPageTitle = (pathname: string): string =>
  NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'My Team';
