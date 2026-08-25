/**
 * หน้าต่างตั้งค่ารางวัลอันดับ (ปุ่มในหน้า Leaderboard — เห็นเฉพาะเจ้าของโปรเจค)
 * เนื้อหาจริงอยู่ที่ RankRewardEditor ซึ่งใช้ร่วมกับแท็บในหน้า ADMIN
 */
import { Modal } from '@/components/layout/Modal';
import { RankRewardEditor } from '@/components/leaderboard/RankRewardEditor';

interface RankRewardPickerProps {
  open: boolean;
  onClose: () => void;
}

export const RankRewardPicker = ({ open, onClose }: RankRewardPickerProps) => (
  <Modal
    open={open}
    title="ตั้งค่ารางวัลอันดับ"
    subtitle="ตั้งจำนวนรางวัล และเลือกการ์ดของแต่ละอันดับ"
    onClose={onClose}
  >
    <RankRewardEditor />
  </Modal>
);
