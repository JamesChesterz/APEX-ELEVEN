import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * แยกไลบรารีใหญ่ออกเป็นไฟล์ต่างหาก
         * ผู้เล่นที่เคยเข้าเว็บแล้วจะโหลดเฉพาะโค้ดเกมที่เปลี่ยน ส่วน react/firebase
         * ยังใช้ของเดิมจากแคชเบราว์เซอร์ — เปิดเกมครั้งถัดไปไวขึ้นมาก
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    // ก้อน firebase ใหญ่กว่า 500 kB โดยธรรมชาติ ปรับเพดานเตือนให้ตรงความจริง
    chunkSizeWarningLimit: 900,
  },
});
