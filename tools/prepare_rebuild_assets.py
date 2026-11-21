"""Prepare rebuilt scene assets: strip white background, trim, scale to the shared ratio table.

Ratio table (1 world unit = 1 px on the 2200x1300 plate, 1 m = 66 units):
  adult visitor   1.70 m -> 112 u
  stone slab      0.40 x 0.60 m -> 26 x 40 u
  stair riser     0.15 m -> 10 u
  door            2.10 m -> 139 u
  one storey      3.20 m -> 211 u
"""
from collections import deque
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "reference" / "generated"
OUT = ROOT / "src" / "photo-prototype" / "assets" / "scene2"

SOURCES = {
    "tea": "https://aka.doubaocdn.com/s/ulkfgMWiSI",
    "shop": "https://aka.doubaocdn.com/s/XxX6Q7vigB",
    "gate": "https://aka.doubaocdn.com/s/9Npe5d88Fj",
    "npc": "https://aka.doubaocdn.com/s/S4wWekcWsR",
}

# key -> (texture height in px ~= 2x on-screen size for crispness, tolerance)
TARGETS = {
    "tea": (800, 34),
    "shop": (540, 34),
    "gate": (380, 34),
    "npc": (620, 28),
}


def strip_white(path: Path, out: Path, target_h: int, tol: int) -> tuple[int, int, int]:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    key = (255, 0, 255)
    queue = deque()
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        queue.append((sx, sy))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b, a = px[x, y]
        if a > 8 and (min(r, g, b) < 255 - tol or abs(r - g) > tol or abs(g - b) > tol):
            continue
        seen[i] = 1
        px[x, y] = (*key, 255)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    data = img.getdata()
    img.putdata([(0, 0, 0, 0) if p[:3] == key else p for p in data])
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    ratio = img.width / img.height
    new_w = max(1, round(target_h * ratio))
    img = img.resize((new_w, target_h), Image.LANCZOS)
    img.save(out, optimize=True)
    return img.width, img.height, out.stat().st_size


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for key, url in SOURCES.items():
        raw = RAW / f"{key}.png"
        if not raw.exists():
            with urlopen(url, timeout=60) as resp:
                raw.write_bytes(resp.read())
        w, h, size = strip_white(raw, OUT / f"{key}.png", TARGETS[key][0], TARGETS[key][1])
        print(f"{key:5s} {w:4d}x{h:<4d} {size // 1024:4d} KB")


if __name__ == "__main__":
    main()
