"""Photo-prototype asset preparation: white-background matting + resize.

Not part of the game runtime. Run manually when new source art arrives:
    python tools/prepare_photo_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "src" / "photo-prototype" / "assets"
KEY = (255, 0, 255, 255)


def matte(src: Path, dst: Path, target_h: int, thresh: int = 28) -> tuple[int, int]:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        try:
            ImageDraw.floodfill(im, corner, KEY, thresh=thresh)
        except ValueError:
            pass
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 250 and g < 10 and b > 250:
                px[x, y] = (0, 0, 0, 0)
    tw = round(w * target_h / h)
    out = im.resize((tw, target_h), Image.LANCZOS)
    out.save(dst)
    return out.size


def resize_bg(src: Path, dst: Path, size=(2200, 1300), quality=88) -> tuple[int, int]:
    im = Image.open(src).convert("RGB").resize(size, Image.LANCZOS)
    im.save(dst, quality=quality, optimize=True)
    return im.size


if __name__ == "__main__":
    for name, out, h in (
        ("char_m_raw.png", "char_male.png", 520),
        ("char_f_raw.png", "char_female.png", 520),
    ):
        s = matte(ASSETS / name, ASSETS / out, h)
        print(f"{out}  {s[0]}x{s[1]}  {(ASSETS / out).stat().st_size // 1024}KB")
    s = resize_bg(ASSETS / "bg_street.jpg", ASSETS / "bg_city.jpg")
    print(f"bg_city.jpg  {s[0]}x{s[1]}  {(ASSETS / 'bg_city.jpg').stat().st_size // 1024}KB")
