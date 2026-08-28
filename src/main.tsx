/** จุดเริ่มต้นของแอป: mount React ลง #root */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initDisplayMode } from './services/display';
import './index.css';

/*
 * ตั้ง viewport ก่อน mount — ถ้าเล่นบนมือถือจะเปิดโหมดคอมพิวเตอร์ให้อัตโนมัติ
 * (เปลี่ยนเองได้ที่หน้า Settings) ต้องทำก่อน React วาดครั้งแรก
 * ไม่งั้นจะเห็นเลย์เอาต์มือถือแวบหนึ่งแล้วค่อยกระโดดเป็นเดสก์ท็อป
 */
initDisplayMode();

const container = document.getElementById('root');
if (!container) throw new Error('ไม่พบ element #root ใน index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
