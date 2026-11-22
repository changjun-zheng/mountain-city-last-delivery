from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results" / "topdown"
FONT = "C:/Windows/Fonts/msyh.ttc"
def f(s): return ImageFont.truetype(FONT, s)

src = Image.open(OUT / "td-plaza-fresh.png").convert("RGB")
w, h = src.size
im = src.copy()
d = ImageDraw.Draw(im, "RGBA")

def box(x1, y1, x2, y2, c, label, lx, ly, fs=17):
    d.rectangle((x1, y1, x2, y2), outline=c, width=3)
    d.rectangle((lx, ly, lx + len(label) * fs * 0.62 + 12, ly + fs + 10), fill=(20, 28, 30, 220))
    d.text((lx + 6, ly + 4), label, font=f(fs), fill=c)

box(160, 84, 494, 348, (236, 96, 84), "屋顶平面＝碰撞矩形：正面墙被删掉，看不见门窗和高度", 160, 52)
box(288, 318, 348, 352, (96, 178, 236), "门只剩一块缺口，和屋顶同色", 160, 380, 15)
box(160, 360, 1012, 700, (96, 190, 120), "地面：平面网格，可走", 700, 660, 15)
box(528, 316, 572, 360, (240, 200, 96), "人物只剩头顶", 584, 322, 15)

d.rectangle((0, 0, w, 26), fill=(20, 28, 30))
d.text((8, 4), "当前画面（工作区第一版实现，f600802 + 未提交改动）：几何正俯视，新任务书已作废这个方向", font=f(15), fill=(255, 236, 200))
im.save(OUT / "now-plaza-tilted-annotated.png")
print("ok")
