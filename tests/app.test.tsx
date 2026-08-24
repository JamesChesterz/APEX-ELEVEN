/**
 * เทสว่าเกมเปิดได้จริงและเล่นครบรอบ (สมัคร → จัดทีม → หาคู่ → แข่งจนจบ)
 * รันในโหมดออฟไลน์ (ไม่ได้ตั้งค่า Firebase ตอนเทส) จึงเจอบอทได้ตามที่ออกแบบไว้
 *
 * จุดประสงค์หลักคือจับ error ตอน render และตรวจว่าปุ่ม "ข้ามไปดูผล" หายไปแล้วจริง
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';

afterEach(() => {
  window.localStorage.clear();
  // BrowserRouter อ่าน URL จริงของ jsdom ซึ่งค้างข้ามเทส
  // ไม่รีเซ็ตกลับหน้าแรก เทสถัดไปจะเริ่มที่หน้าเดิมของเทสก่อน
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

/** สมัครบัญชีใหม่แล้วเข้าเกม */
const signUp = async (username = 'tester01') => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole('button', { name: /สมัครไอดี/ }));
  await user.type(screen.getByLabelText(/ไอดีผู้เล่น/), username);
  await user.type(screen.getByLabelText(/รหัสผ่าน/), 'secret99');
  await user.click(screen.getByRole('button', { name: /สมัครและรับของเริ่มต้น/ }));

  await screen.findByText(/Matchmaking/i, undefined, { timeout: 5000 });
  return user;
};

/** ชื่อของลิงก์เมนูมีไอคอนติดมาด้วย จึงต้องจับด้วย regex ไม่ใช่ข้อความตรงตัว */
const goTo = async (user: ReturnType<typeof userEvent.setup>, label: RegExp) => {
  const links = screen.getAllByRole('link', { name: label });
  await user.click(links[0]);
};

describe('เปิดเกมและเล่นหนึ่งนัด', () => {
  it('สมัครแล้วเข้าหน้าหลักได้ พร้อมของเริ่มต้น', async () => {
    await signUp();
    expect(screen.getAllByText(/1,000,000/).length).toBeGreaterThan(0);
  });

  it('หาคู่ → เริ่มแข่ง → จบเกม โดยไม่มีปุ่มข้ามให้กด', async () => {
    const user = await signUp();

    await goTo(user, /My Team/);
    await user.click((await screen.findAllByRole('button', { name: 'หาคู่แข่ง' }))[0]);
    await screen.findByText('เจอคู่แข่งแล้ว!', undefined, { timeout: 6000 });

    await user.click(screen.getAllByRole('button', { name: 'เริ่มแข่ง' })[0]);
    await screen.findByText('กำลังแข่งขัน...', undefined, { timeout: 4000 });

    // ปุ่มข้ามต้องไม่มีอยู่แล้ว — ต้องดูจนจบเกมเท่านั้น
    expect(screen.queryByRole('button', { name: /ข้ามไปดูผล/ })).toBeNull();

    // 90 นาทีในเกม ≈ 12 วินาทีจริง
    await screen.findByText('จบการแข่งขัน', undefined, { timeout: 30_000 });
    expect(screen.getAllByText(/⭐/).length).toBeGreaterThan(0);
  }, 45_000);

  it('ผู้เล่นทั่วไปไม่เห็นเมนู ADMIN', async () => {
    await signUp();
    expect(screen.queryAllByRole('link', { name: /Admin/ })).toHaveLength(0);
  });

  it('เจ้าของโปรเจคเห็นเมนู ADMIN และเปิดหน้าได้', async () => {
    // ไอดี 'owner' อยู่ใน OWNER_USERNAMES (src/data/rankRewards.ts)
    const user = await signUp('owner');

    await goTo(user, /Admin/);
    await screen.findByText('เสกของ');
    expect(screen.getByText('ประกาศกลางจอ')).toBeTruthy();
  }, 20_000);

  it('เข้าทุกหน้าจากเมนูได้โดยไม่พัง', async () => {
    const user = await signUp();

    for (const label of [/My Team/, /Match/, /Leaderboard/, /Profile/, /Card Pack/, /Settings/]) {
      await goTo(user, label);
      await waitFor(() => expect(document.body.textContent).toBeTruthy());
    }
  }, 30_000);
});
