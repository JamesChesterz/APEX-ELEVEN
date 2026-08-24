/**
 * ═══════════════════════════════════════════════════════════════
 *  รีเซ็ตแต้ม (⭐) ของตารางอันดับทั้งเซิร์ฟเวอร์ — รันครั้งเดียวจบ
 * ═══════════════════════════════════════════════════════════════
 *
 * ทำไมต้องใช้สคริปต์ (แก้ใน Firebase Console เฉย ๆ ไม่พอ):
 *   แต้มจริงอยู่ที่ accounts/{uid}.state.record — ส่วน profiles/{uid}.points
 *   เป็นแค่ "สำเนา" ที่เกมเขียนทับใหม่ทุกครั้งที่เจ้าของบัญชีเปิดเกม
 *   ถ้าแก้แต่ profiles พอเจ้าของเปิดเกม แต้มเก่าจะเด้งกลับมาทันที
 *   สคริปต์นี้จึงล้างทั้งสองที่พร้อมกัน
 *
 * ── วิธีใช้ ─────────────────────────────────────────────────
 * 1) ดาวน์โหลดกุญแจแอดมิน (ทำครั้งเดียว)
 *    Firebase Console → ⚙️ Project settings → Service accounts
 *    → Generate new private key → ได้ไฟล์ .json มา
 *    วางไว้ข้างสคริปต์นี้แล้วตั้งชื่อว่า  serviceAccount.json
 *    ⚠️ ห้าม commit ไฟล์นี้ขึ้น GitHub เด็ดขาด (ใส่ใน .gitignore แล้ว)
 *
 * 2) ติดตั้งไลบรารีแอดมิน (ทำครั้งเดียว)
 *      npm i -D firebase-admin
 *
 * 3) ลองดูก่อนว่าจะกระทบใครบ้าง (ยังไม่เขียนอะไรลงฐานข้อมูล)
 *      node tools/reset-leaderboard.mjs --dry-run
 *
 * 4) รีเซ็ตจริง
 *      node tools/reset-leaderboard.mjs            ← ล้างแต้มเป็น 0 ทุกคน
 *      node tools/reset-leaderboard.mjs --keep 0.3 ← เก็บแต้มไว้ 30% (soft reset)
 *      node tools/reset-leaderboard.mjs --season   ← ขึ้นเลขซีซันใหม่ให้ด้วย
 *
 * หลังรันเสร็จ ผู้เล่นที่เปิดเกมค้างไว้ให้กด F5 หนึ่งครั้ง
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const here = dirname(fileURLToPath(import.meta.url));

/* ── อ่านตัวเลือกจากบรรทัดคำสั่ง ──────────────────────────── */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bumpSeason = args.includes('--season');

/** สัดส่วนแต้มที่เก็บไว้ (0 = ล้างหมด, 0.3 = เหลือ 30%) */
const keepIndex = args.indexOf('--keep');
const keep = keepIndex >= 0 ? Number(args[keepIndex + 1]) : 0;

if (!Number.isFinite(keep) || keep < 0 || keep > 1) {
  console.error('ค่า --keep ต้องอยู่ระหว่าง 0 ถึง 1 (เช่น --keep 0.3)');
  process.exit(1);
}

/* ── เชื่อมต่อ Firestore ด้วยสิทธิ์แอดมิน ─────────────────── */

let credentials;
try {
  credentials = JSON.parse(readFileSync(join(here, 'serviceAccount.json'), 'utf8'));
} catch {
  console.error('หาไฟล์ tools/serviceAccount.json ไม่เจอ — ดูวิธีดาวน์โหลดในหัวไฟล์นี้');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(credentials) });
const db = admin.firestore();

/* ── ลงมือรีเซ็ต ──────────────────────────────────────────── */

/** เขียนทีละก้อน — Firestore จำกัด batch ละ 500 operation */
const BATCH_LIMIT = 400;

const run = async () => {
  const accounts = await db.collection('accounts').get();
  console.log(`เจอบัญชีทั้งหมด ${accounts.size} บัญชี · โหมด: ${dryRun ? 'ลองดูเฉย ๆ' : 'รีเซ็ตจริง'}`);
  console.log(`เก็บแต้มไว้ ${Math.round(keep * 100)}%${bumpSeason ? ' · ขึ้นซีซันใหม่ด้วย' : ''}\n`);

  let batch = db.batch();
  let pending = 0;
  let changed = 0;

  const flush = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = db.batch();
    pending = 0;
  };

  for (const snapshot of accounts.docs) {
    const data = snapshot.data();
    const record = data?.state?.record ?? {};
    const before = Number(record.points) || 0;
    const after = Math.round(before * keep);

    console.log(
      `  ${(data?.teamName ?? '(ไม่มีชื่อทีม)').padEnd(24)} ${String(before).padStart(6)} ⭐ → ${after} ⭐`,
    );

    if (dryRun) {
      changed += 1;
      continue;
    }

    // 1) แต้มจริงในบัญชี — สถิติแพ้-ชนะเริ่มนับใหม่ทั้งหมด
    const accountUpdate = {
      'state.record.points': after,
      'state.record.wins': 0,
      'state.record.draws': 0,
      'state.record.losses': 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (bumpSeason) {
      accountUpdate['state.season.number'] = (Number(data?.state?.season?.number) || 1) + 1;
      accountUpdate['state.season.startedAt'] = new Date().toISOString();
    }

    batch.update(snapshot.ref, accountUpdate);

    // 2) สำเนาที่ตารางอันดับอ่าน — ต้องล้างพร้อมกัน ไม่งั้นตารางยังโชว์เลขเก่าจนกว่าเจ้าของจะเปิดเกม
    batch.set(
      db.collection('profiles').doc(snapshot.id),
      { points: after, wins: 0, draws: 0, losses: 0 },
      { merge: true },
    );

    pending += 2;
    changed += 1;

    if (pending >= BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(
    `\n${dryRun ? 'ถ้ารันจริงจะแก้' : 'รีเซ็ตเรียบร้อย'} ${changed} บัญชี` +
      (dryRun ? '\nรันซ้ำโดยไม่ใส่ --dry-run เพื่อลงมือจริง' : '\nบอกผู้เล่นให้กด F5 หนึ่งครั้ง'),
  );
};

run().catch((error) => {
  console.error('รีเซ็ตไม่สำเร็จ:', error);
  process.exit(1);
});
