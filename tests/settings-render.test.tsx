/**
 * หน้า Settings ต้อง render ได้จริงพร้อมแถวใหม่ (โหมดคอมพิวเตอร์ / เต็มจอ)
 *
 * jsdom ไม่มี Fullscreen API เลย — เคสนี้จึงกินทางที่ "เครื่องไม่รองรับ" ไปด้วย
 * ซึ่งเป็นทางเดียวกับที่ iPhone จะเจอ จึงยืนยันได้ว่าหน้าไม่พังบนเครื่องแบบนั้น
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { GameConfigProvider } from '@/hooks/useGameConfig';
import { InventoryProvider } from '@/hooks/usePlayers';
import { TeamProvider } from '@/hooks/useTeam';
import { SettingsPage } from '@/pages/Settings/SettingsPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <InventoryProvider>
          <GameConfigProvider>
            <TeamProvider>
              <SettingsPage />
            </TeamProvider>
          </GameConfigProvider>
        </InventoryProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

describe('หน้า Settings', () => {
  it('มีแถวโหมดคอมพิวเตอร์', () => {
    renderPage();
    expect(screen.getByText('โหมดคอมพิวเตอร์')).toBeTruthy();
  });

  it('มีปุ่มเต็มจอเสมอ แม้เครื่องจะไม่มี Fullscreen API', () => {
    renderPage();
    expect(screen.getByText('เต็มจอ')).toBeTruthy();
    // jsdom ไม่มี Fullscreen API → ปุ่มต้องกลายเป็น "ดูวิธี" ไม่ใช่หายไป
    expect(screen.getByRole('button', { name: 'ดูวิธี' })).toBeTruthy();
  });

  it('กดปุ่มบนเครื่องที่ไม่รองรับแล้วกางขั้นตอนติดตั้งให้', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'ดูวิธี' }));
    expect(screen.getByText(/กดปุ่มแชร์ของเบราว์เซอร์/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ปิดวิธี' })).toBeTruthy();
  });
});
