"""
สร้างรูปการ์ดตัวอย่าง (256x256 PNG) ให้นักเตะทุกคนใน src/data/players.ts

ใช้เมื่อยังไม่มีไฟล์รูปจริง — งานศิลป์ทั้งหมดวาดขึ้นเองในสคริปต์นี้
วิธีใช้:  python3 tools/generate-cards.py
ผลลัพธ์:  public/players/<playerId>.png
"""
import json, math, re, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "players"
SRC = ROOT / "src" / "data" / "players.ts"
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"

RARITY = {
    "legendary": ((250, 226, 140), (196, 145, 41), (96, 66, 12)),
    "epic":      ((219, 190, 255), (134, 79, 224), (49, 25, 92)),
    "rare":      ((178, 227, 255), (62, 156, 214), (16, 56, 82)),
    "common":    ((226, 232, 229), (139, 151, 145), (52, 59, 55)),
}
NATION = {"Italy":"ITA","Japan":"JPN","Brazil":"BRA","Norway":"NOR","Nigeria":"NGA","France":"FRA",
          "Thailand":"THA","Poland":"POL","Portugal":"POR","England":"ENG","Germany":"GER","Morocco":"MAR",
          "Spain":"ESP","Serbia":"SRB","South Korea":"KOR","Czechia":"CZE","Ghana":"GHA","Denmark":"DEN",
          "Argentina":"ARG","Netherlands":"NED"}


def read_players():
    """ดึงข้อมูลที่ต้องใช้จากไฟล์ TypeScript แบบง่าย ๆ ด้วย regex"""
    text = SRC.read_text(encoding="utf-8")
    players = []
    for block in re.findall(r"\{\s*id: '(p\d+)',(.*?)\n  \}", text, re.S):
        pid, body = block
        get = lambda key: (re.search(rf"{key}: '([^']*)'", body) or [None, ""])[1]
        num = lambda key: int((re.search(rf"{key}: (\d+)", body) or [0, 0])[1])
        players.append(dict(id=pid, name=get("name"), club=get("club"), nation=get("nation"),
                            position=get("position"), rarity=get("rarity"), ovr=num("ovr")))
    return players


def club_hue(club):
    h = 0
    for ch in club:
        h = (h * 31 + ord(ch)) % 360
    return h


def hsl(h, s, l):
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h / 60) % 6]
    return tuple(int((v + m) * 255) for v in (r, g, b))


def card(player):
    size = 256
    light, mid, dark = RARITY[player["rarity"]]
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # กรอบไล่สีตามระดับความหายาก
    for y in range(size):
        t = y / size
        top, bottom = (light, mid) if t < 0.5 else (mid, dark)
        k = (t if t < 0.5 else t - 0.5) * 2
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))

    # แผงด้านในและแสงสีประจำสโมสร
    hue = club_hue(player["club"])
    inner = Image.new("RGB", (size - 16, size - 16), (18, 24, 29))
    di = ImageDraw.Draw(inner)
    cx, cy = inner.width // 2, int(inner.height * 0.72)
    for r in range(150, 0, -3):
        a = (1 - r / 150) * 0.5
        col = hsl(hue, 0.6, 0.5)
        di.ellipse([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8],
                   fill=tuple(int(18 + (col[i] - 18) * a) for i in range(3)))
    # เงาครึ่งตัวนักเตะแบบเรียบง่าย
    di.ellipse([cx - 34, cy - 96, cx + 34, cy - 28], fill=(9, 13, 16))
    di.polygon([(cx - 74, inner.height), (cx - 44, cy - 34), (cx + 44, cy - 34), (cx + 74, inner.height)],
               fill=(9, 13, 16))
    img.paste(inner, (8, 8))

    d = ImageDraw.Draw(img)
    big = ImageFont.truetype(F % "-Bold", 44)
    small = ImageFont.truetype(F % "-Bold", 18)
    tiny = ImageFont.truetype(F % "", 15)

    d.text((24, 18), str(player["ovr"]), font=big, fill=(240, 245, 242))
    d.text((28, 66), player["position"], font=small, fill=(210, 220, 215))

    # ตราสโมสรแบบ monogram
    mono = "".join(w[0] for w in player["club"].split()[:2]).upper()
    d.ellipse([196, 20, 236, 60], fill=hsl(hue, 0.55, 0.3), outline=(255, 255, 255, 120))
    d.text((216, 40), mono, font=small, fill=(255, 255, 255), anchor="mm")

    # แถบชื่อด้านล่าง
    d.rectangle([8, 186, size - 8, size - 8], fill=(0, 0, 0))
    name = player["name"].split()[-1].upper()
    d.text((size // 2, 206), name, font=ImageFont.truetype(F % "-Bold", 22), fill=(245, 248, 246), anchor="mm")
    d.text((size // 2, 232), f"{NATION.get(player['nation'], player['nation'][:3].upper())}  ·  {player['club']}",
           font=tiny, fill=(150, 165, 158), anchor="mm")
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    players = read_players()
    for player in players:
        card(player).save(OUT / f"{player['id']}.png")
    print(f"created {len(players)} cards in {OUT}")


if __name__ == "__main__":
    main()
