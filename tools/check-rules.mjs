/**
 * ═══════════════════════════════════════════════════════════════
 *  ตรวจกฎความปลอดภัยของ Firestore ด้วยตัวจำลอง (emulator)
 * ═══════════════════════════════════════════════════════════════
 *
 * ยิงคำขอปลอมใส่ firestore.rules จริง ๆ แล้วดูว่ากฎ "อนุญาต/ปฏิเสธ" ตรงตามที่ตั้งใจไหม
 * ไม่ได้แตะฐานข้อมูลจริงเลย — ทุกอย่างเกิดในตัวจำลองบนเครื่องคุณ
 *
 * ── วิธีใช้ ─────────────────────────────────────────────────
 *   1) ติดตั้งของที่ต้องใช้ (ครั้งเดียว — ต้องมี Java ในเครื่องด้วย)
 *        npm i -D --legacy-peer-deps firebase-tools @firebase/rules-unit-testing
 *   2) รัน
 *        npm run check:rules
 *
 * ควรรันทุกครั้งหลังแก้ firestore.rules ก่อน deploy
 * ถ้าขึ้น "กฎทั้งหมดผ่าน" แปลว่ากฎยังกันของที่ควรกันอยู่ครบ
 *
 * หมายเหตุ: สคริปต์นี้แทนที่ uid เจ้าของในกฎด้วย uid ทดสอบให้อัตโนมัติ
 * จึงรันได้เลยแม้คุณยังไม่ได้ใส่ uid จริงลงในไฟล์กฎ
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const OWNER_UID = 'ownerUid123';
let rules = readFileSync('firestore.rules', 'utf8');
rules = rules.replace("'ใส่-uid-ของเจ้าของที่นี่'", `'${OWNER_UID}'`);

const env = await initializeTestEnvironment({
  projectId: 'apex-rules-test',
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

const profile = (points, extra = {}) => ({
  uid: 'alice',
  points,
  teamOvr: 90,
  teamName: 'Alice FC',
  managerName: 'Alice',
  pointsUpdatedAt: serverTimestamp(),
  ...extra,
});

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const owner = env.authenticatedContext(OWNER_UID).firestore();
const ref = (db) => doc(db, 'profiles/alice');

let failed = 0;
const check = async (name, promise) => {
  try { await promise; console.log('ผ่าน  ', name); }
  catch (error) { failed += 1; console.log('ไม่ผ่าน', name, '→', error.message.split('\n')[0]); }
};

// สร้างโปรไฟล์ครั้งแรก
await check('สร้างโปรไฟล์ใหม่ด้วยดาว 0 ได้', assertSucceeds(setDoc(ref(alice), profile(0))));
await check('คนอื่นเขียนโปรไฟล์เราไม่ได้', assertFails(setDoc(ref(bob), profile(5))));

// เพิ่มดาวทีละนิด (จำลองเล่นจริง)
await check('เพิ่มดาวทีละนิดผ่าน', assertSucceeds(setDoc(ref(alice), profile(30), { merge: true })));

// ยัดดาวทีเดียวหลายพัน
await check('ยัดดาว 4000 ถูกปฏิเสธ', assertFails(setDoc(ref(alice), profile(4000), { merge: true })));
await check('ยัดดาว 500 ถูกปฏิเสธ', assertFails(setDoc(ref(alice), profile(500), { merge: true })));

// ปลอมเวลาเองไม่ได้
await check(
  'ประทับเวลาปลอมถูกปฏิเสธ',
  assertFails(setDoc(ref(alice), profile(60, { pointsUpdatedAt: new Date(Date.now() + 86400000) }), { merge: true })),
);

// ดาวลดได้เสมอ
await check('ดาวลดลงผ่าน', assertSucceeds(setDoc(ref(alice), profile(5), { merge: true })));

// แอดมินรีเซ็ตดาวของคนอื่นได้
await check(
  'แอดมินรีเซ็ตดาวคนอื่นได้',
  assertSucceeds(setDoc(doc(owner, 'profiles/alice'), { points: 0, wins: 0 }, { merge: true })),
);
await check(
  'คนธรรมดารีเซ็ตดาวคนอื่นไม่ได้',
  assertFails(setDoc(doc(bob, 'profiles/alice'), { points: 0 }, { merge: true })),
);

// config เขียนได้เฉพาะแอดมิน
await check(
  'แอดมินตั้งค่ารางวัลได้',
  assertSucceeds(setDoc(doc(owner, 'config/rankRewards'), { cards: ['p061'] })),
);
await check(
  'คนธรรมดาตั้งค่ารางวัลไม่ได้',
  assertFails(setDoc(doc(bob, 'config/rankRewards'), { cards: ['p061'] })),
);
await check('ทุกคนอ่านค่าตั้งได้', assertSucceeds(getDoc(doc(bob, 'config/rankRewards'))));

// ของขวัญ
const gift = {
  fromUid: OWNER_UID, fromName: 'Admin', coins: 1000, points: 0, upgradePoints: 0,
  cardPlayerIds: [], note: '', sentAt: new Date().toISOString(),
};
await check('แอดมินหย่อนของขวัญได้', assertSucceeds(setDoc(doc(owner, 'gifts/alice/items/g1'), gift)));
await check(
  'คนธรรมดาหย่อนของขวัญให้ตัวเองไม่ได้',
  assertFails(setDoc(doc(alice, 'gifts/alice/items/g2'), gift)),
);
await check(
  'ของขวัญเกินเพดานถูกปฏิเสธ',
  assertFails(setDoc(doc(owner, 'gifts/alice/items/g3'), { ...gift, coins: 999999999999 })),
);

/*
 * โหมดเซิร์ฟเวอร์เป็นเจ้าของดาว — ทดสอบกฎชุดที่เปิด serverOwnsPoints() แล้ว
 * (สลับค่าในกฎชั่วคราวเฉพาะตอนเทส ไม่ได้แตะไฟล์จริง)
 */
const lockedEnv = await initializeTestEnvironment({
  projectId: 'apex-rules-locked',
  firestore: {
    rules: rules.replace(
      'function serverOwnsPoints() {\n      return false;',
      'function serverOwnsPoints() {\n      return true;',
    ),
    host: '127.0.0.1',
    port: 8080,
  },
});

const locked = lockedEnv.authenticatedContext('alice').firestore();
const lockedRef = doc(locked, 'profiles/alice');

await lockedEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), 'profiles/alice'), {
    uid: 'alice', points: 100, wins: 10, draws: 0, losses: 0,
    teamOvr: 90, teamName: 'Alice FC', managerName: 'Alice',
  });
});

await check(
  'โหมดเซิร์ฟเวอร์: เพิ่มดาวเองแม้แต่ดวงเดียวก็ไม่ได้',
  assertFails(setDoc(lockedRef, profile(101), { merge: true })),
);
await check(
  'โหมดเซิร์ฟเวอร์: ลดดาวเองก็ไม่ได้ (กันปั่นอันดับให้คนอื่น)',
  assertFails(setDoc(lockedRef, profile(50), { merge: true })),
);
await check(
  'โหมดเซิร์ฟเวอร์: แก้ชื่อทีมโดยไม่แตะดาว ยังทำได้ปกติ',
  assertSucceeds(
    setDoc(
      lockedRef,
      { uid: 'alice', points: 100, wins: 10, draws: 0, losses: 0, teamOvr: 92, teamName: 'ทีมใหม่', managerName: 'Alice' },
      { merge: true },
    ),
  ),
);
await check(
  'โหมดเซิร์ฟเวอร์: แก้สถิติแพ้-ชนะเองก็ไม่ได้',
  assertFails(
    setDoc(
      lockedRef,
      { uid: 'alice', points: 100, wins: 999, draws: 0, losses: 0, teamOvr: 90, teamName: 'Alice FC', managerName: 'Alice' },
      { merge: true },
    ),
  ),
);

/* บัญชีที่ถูกระงับต้องเขียนอะไรไม่ได้เลย */
await env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), 'config/bans'), { uids: ['bob'] });
});

await check(
  'บัญชีที่ถูกระงับเขียนโปรไฟล์ไม่ได้',
  assertFails(setDoc(doc(bob, 'profiles/bob'), { ...profile(1), uid: 'bob' })),
);
await check(
  'บัญชีที่ไม่ถูกระงับยังเขียนได้ปกติ',
  assertSucceeds(setDoc(ref(alice), profile(6), { merge: true })),
);
await check(
  'คนธรรมดาแก้รายชื่อแบนเองไม่ได้',
  assertFails(setDoc(doc(alice, 'config/bans'), { uids: [] })),
);
await check(
  'แอดมินแก้รายชื่อแบนได้',
  assertSucceeds(setDoc(doc(owner, 'config/bans'), { uids: ['bob'] })),
);
await check(
  'แอดมินอ่านบัญชีของคนอื่นได้ (ใช้ส่องคลังการ์ด/ประวัติ)',
  assertSucceeds(getDoc(doc(owner, 'accounts/alice'))),
);
await check(
  'คนธรรมดาอ่านบัญชีของคนอื่นไม่ได้',
  assertFails(getDoc(doc(alice, 'accounts/bob'))),
);

await lockedEnv.cleanup();
await env.cleanup();
console.log(failed === 0 ? '\nกฎทั้งหมดผ่าน' : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
