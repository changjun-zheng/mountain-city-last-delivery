"""Bake the Qing-era stilt houses onto the new Chongqing street plate.

The baked rectangles are the single source of truth for the photography
subject boxes: content.ts must match these numbers. Re-run after editing any
placement here:
    python tools/bake_scene.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parent.parent / "src" / "photo-prototype" / "assets"

# (sprite file, x, y, w, h) in world pixels on the 2200x1300 plate.
PLACEMENTS = [
    ("bld_house_a.png", 30, 655, 430, 500),
    ("bld_house_b.png", 1745, 625, 410, 480),
    ("bld_corridor.png", 610, 300, 260, 225),
]

SHADOW_ALPHA = 95


def bake() -> None:
    bg = Image.open(ASSETS / "bg_city.jpg").convert("RGBA")
    for name, x, y, w, h in PLACEMENTS:
        sprite = Image.open(ASSETS / name).convert("RGBA").resize((w, h), Image.LANCZOS)
        shadow = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse(
            (x - 24, y + h - 26, x + w + 24, y + h + 30), fill=(18, 14, 10, SHADOW_ALPHA)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))
        bg.alpha_composite(shadow)
        bg.alpha_composite(sprite, (x, y))
        print(f"baked {name} at ({x},{y},{w},{h}) foot={y + h}")

    bg.convert("RGB").save(ASSETS / "bg_world2.jpg", quality=88, optimize=True)
    print("bg_world2.jpg", (ASSETS / "bg_world2.jpg").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    bake()
