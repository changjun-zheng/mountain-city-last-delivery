from pathlib import Path
from PIL import Image

# Trim transparent margins from generated character art so the sprite height
# equals the drawn figure height, then normalise to a common pixel height.
ROOT = Path(__file__).resolve().parents[1] / "src/photo-prototype/assets/scene2"
TARGET_H = 640
PAIRS = [("char_m_illu.png", "char_m.png"), ("char_f_illu.png", "char_f.png"), ("npc_old_illu.png", "npc_old.png")]

for src, dst in PAIRS:
    im = Image.open(ROOT / src).convert("RGBA")
    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit(f"{src}: empty alpha")
    crop = im.crop(bbox)
    w = round(crop.width * TARGET_H / crop.height)
    out = crop.resize((w, TARGET_H), Image.LANCZOS)
    out.save(ROOT / dst, optimize=True)
    print(f"{dst}: {out.width}x{out.height} bbox={bbox}")
