#!/usr/bin/env python3
"""
สแกนไฟล์รูปใน public/players/ แล้วพิมพ์บรรทัด roster ของไฟล์ที่ยังไม่มีในระบบ
ใช้ตอนเพิ่มรูปทีละหลาย ๆ ใบ: ก๊อปผลลัพธ์ไปวางใน src/data/roster.ts ได้เลย

    python3 tools/scan-players.py                  # ระดับการ์ดเริ่มต้นเป็น common
    python3 tools/scan-players.py --rarity epic    # กำหนดระดับให้ทุกใบที่เจอ
    python3 tools/scan-players.py --with-ext       # ใส่นามสกุลไฟล์ลงไปด้วย (โหลดเร็วกว่า)
"""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE_DIR = ROOT / "public" / "players"
ROSTER_FILE = ROOT / "src" / "data" / "roster.ts"
PLAYERS_FILE = ROOT / "src" / "data" / "players.ts"
EXTENSIONS = {".png", ".gif", ".webp", ".jpg", ".jpeg"}


def strip_comments(text: str) -> str:
    """ตัดคอมเมนต์ออกก่อน เพื่อไม่ให้ตัวอย่างในคอมเมนต์ถูกนับเป็นนักเตะจริง"""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def known_ids() -> set[str]:
    """id ที่มีอยู่แล้ว ทั้งใน roster และในข้อมูลที่เขียนมือ"""
    ids: set[str] = set()
    for path in (ROSTER_FILE, PLAYERS_FILE):
        if not path.exists():
            continue
        text = strip_comments(path.read_text(encoding="utf-8"))
        ids |= set(re.findall(r"file:\s*'([^']+)'", text))
        ids |= set(re.findall(r"\bid:\s*'([^']+)'", text))
    # ตัดนามสกุลออกให้เหลือแต่ id
    return {re.sub(r"\.[^.]+$", "", value) for value in ids}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rarity", default="common",
                        choices=["common", "rare", "epic", "legendary"])
    parser.add_argument("--with-ext", action="store_true",
                        help="ใส่นามสกุลไฟล์ในบรรทัดที่พิมพ์ออกมา")
    args = parser.parse_args()

    if not IMAGE_DIR.exists():
        print(f"ไม่พบโฟลเดอร์ {IMAGE_DIR}")
        return

    existing = known_ids()
    files = sorted(p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in EXTENSIONS)
    missing = [p for p in files if p.stem not in existing]

    print(f"พบไฟล์รูป {len(files)} ใบ · อยู่ในระบบแล้ว {len(files) - len(missing)} ใบ")

    if not missing:
        print("ไม่มีไฟล์ใหม่ที่ต้องเพิ่ม")
        return

    print(f"\nยังไม่มีในระบบ {len(missing)} ใบ — ก๊อปบรรทัดข้างล่างไปวางใน src/data/roster.ts:\n")
    for path in missing:
        name = path.name if args.with_ext else path.stem
        print(f"  {{ file: '{name}', rarity: '{args.rarity}' }},")


if __name__ == "__main__":
    main()
