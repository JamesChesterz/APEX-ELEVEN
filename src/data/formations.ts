/**
 * Mock data: แผนการเล่นและพิกัดของแต่ละช่องในสนาม
 * พิกัด x/y เป็นเปอร์เซ็นต์ (0–100) ใช้วางตำแหน่งแบบ absolute บนคอมโพเนนต์ Pitch
 * y = 0 คือเส้นประตูฝั่งเรา, y = 100 คือฝั่งคู่แข่ง
 */
import type { Formation, FormationId } from '@/types/team';

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    description: 'สมดุล เล่นง่าย เหมาะกับผู้เริ่มต้น',
    slots: [
      { id: 'GK', position: 'GK', x: 50, y: 6 },
      { id: 'LB', position: 'LB', x: 15, y: 26 },
      { id: 'CB1', position: 'CB', x: 38, y: 22 },
      { id: 'CB2', position: 'CB', x: 62, y: 22 },
      { id: 'RB', position: 'RB', x: 85, y: 26 },
      { id: 'LM', position: 'LM', x: 15, y: 55 },
      { id: 'CM1', position: 'CM', x: 38, y: 50 },
      { id: 'CM2', position: 'CM', x: 62, y: 50 },
      { id: 'RM', position: 'RM', x: 85, y: 55 },
      { id: 'ST1', position: 'ST', x: 38, y: 82 },
      { id: 'ST2', position: 'ST', x: 62, y: 82 },
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3 Attack',
    description: 'บุกด้วยปีกสองข้าง มีตัวรุกกลางคอยจ่าย',
    slots: [
      { id: 'GK', position: 'GK', x: 30, y: 10 },
      { id: 'LB', position: 'LB', x: 12, y: 27 },
      { id: 'CB1', position: 'CB', x: 35, y: 24 },
      { id: 'CB2', position: 'CB', x: 65, y: 24 },
      { id: 'RB', position: 'RB', x: 88, y: 27 },
      { id: 'CM1', position: 'CM', x: 24, y: 54 },
      { id: 'CAM', position: 'CAM', x: 50, y: 58 },
      { id: 'CM2', position: 'CM', x: 76, y: 54 },
      { id: 'LW', position: 'LW', x: 20, y: 86 },
      { id: 'ST1', position: 'ST', x: 50, y: 90 },
      { id: 'RW', position: 'RW', x: 80, y: 86 },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    description: 'กลางแน่น ใช้ตัวรุกเบอร์ 10 เป็นแกน',
    slots: [
      { id: 'GK', position: 'GK', x: 50, y: 6 },
      { id: 'LB', position: 'LB', x: 15, y: 26 },
      { id: 'CB1', position: 'CB', x: 38, y: 22 },
      { id: 'CB2', position: 'CB', x: 62, y: 22 },
      { id: 'RB', position: 'RB', x: 85, y: 26 },
      { id: 'CDM1', position: 'CDM', x: 36, y: 44 },
      { id: 'CDM2', position: 'CDM', x: 64, y: 44 },
      { id: 'LM', position: 'LM', x: 16, y: 68 },
      { id: 'CAM', position: 'CAM', x: 50, y: 68 },
      { id: 'RM', position: 'RM', x: 84, y: 68 },
      { id: 'ST1', position: 'ST', x: 50, y: 88 },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    description: 'ครองบอลกลางสนาม ใช้วิงแบ็กเติมเกม',
    slots: [
      { id: 'GK', position: 'GK', x: 50, y: 6 },
      { id: 'CB1', position: 'CB', x: 28, y: 22 },
      { id: 'CB2', position: 'CB', x: 50, y: 20 },
      { id: 'CB3', position: 'CB', x: 72, y: 22 },
      { id: 'LM', position: 'LM', x: 12, y: 52 },
      { id: 'CM1', position: 'CM', x: 34, y: 48 },
      { id: 'CDM', position: 'CDM', x: 50, y: 40 },
      { id: 'CM2', position: 'CM', x: 66, y: 48 },
      { id: 'RM', position: 'RM', x: 88, y: 52 },
      { id: 'ST1', position: 'ST', x: 38, y: 82 },
      { id: 'ST2', position: 'ST', x: 62, y: 82 },
    ],
  },
];

export const DEFAULT_FORMATION_ID: FormationId = '4-3-3';

export const getFormationById = (id: FormationId): Formation =>
  FORMATIONS.find((formation) => formation.id === id) ?? FORMATIONS[0];
