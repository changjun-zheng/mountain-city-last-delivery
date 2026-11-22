from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results" / "topdown"
FONT = "C:/Windows/Fonts/msyh.ttc"
def f(s): return ImageFont.truetype(FONT, s)
def tag(d, x, y, t, c, s=15): d.text((x, y), t, font=f(s), fill=c)

W, H = 1100, 720
FLOOR = (176, 156, 128)
FLOOR_LINE = (150, 132, 108)
WALL_TOP = (198, 190, 172)
WALL_FACE = (128, 120, 104)
FACADE = (150, 142, 124)
DOOR = (232, 200, 138)
WOOD = (152, 118, 84)
WOOD_TOP = (186, 150, 110)

im = Image.new("RGB", (W, H), (34, 44, 46))
d = ImageDraw.Draw(im)

# floor
d.rectangle((198, 196, 902, 544), fill=FLOOR)
for y in range(196, 545, 26):
    d.line((198, y, 902, y), fill=FLOOR_LINE)
for x in range(198, 903, 34):
    d.line((x, 196, x, 544), fill=FLOOR_LINE)

# top wall band, drawn as a thick wall seen from above with a lit cap
d.rectangle((180, 170, 920, 200), fill=WALL_FACE)
d.rectangle((180, 170, 920, 178), fill=WALL_TOP)
# left and right wall bands
d.rectangle((180, 170, 198, 640), fill=WALL_FACE)
d.rectangle((902, 170, 920, 640), fill=WALL_FACE)
d.rectangle((180, 170, 188, 640), fill=WALL_TOP)
d.rectangle((912, 170, 920, 640), fill=WALL_TOP)

# front wall with an exit opening, bottom flush with the room edge
d.rectangle((180, 544, 920, 640), fill=FACADE)
d.line((180, 544, 920, 544), fill=WALL_TOP, width=3)
d.rectangle((498, 548, 602, 640), fill=(56, 50, 44))
d.rectangle((504, 554, 596, 640), fill=DOOR)
d.rectangle((498, 636, 602, 644), fill=(210, 196, 166))

# counter: top face plus a front face, occupying real floor
d.rectangle((250, 300, 450, 366), fill=WOOD)
d.rectangle((250, 386, 450, 402), fill=(120, 92, 62))
d.rectangle((250, 300, 450, 318), fill=WOOD_TOP)
d.rectangle((450, 318, 466, 386), fill=(120, 92, 62))
d.line((250, 386, 450, 386), fill=(96, 74, 50), width=2)

# stairs: each step = tread plus a riser sliver
sx, sy = 700, 470
for i in range(4):
    y = sy + i * 18
    d.rectangle((sx, y, sx + 150, y + 12), fill=(168, 158, 138))
    d.rectangle((sx, y + 12, sx + 150, y + 18), fill=(96, 90, 78))

# character
cx, cy = 380, 470
d.ellipse((cx - 13, cy - 5, cx + 13, cy + 5), fill=(30, 40, 40))
d.rectangle((cx - 9, cy - 14, cx - 2, cy), fill=(58, 66, 72))
d.rectangle((cx + 2, cy - 14, cx + 9, cy), fill=(58, 66, 72))
d.polygon([(cx - 11, cy - 14), (cx + 11, cy - 14), (cx + 14, cy - 36), (cx - 14, cy - 36)], fill=(214, 206, 186))
d.ellipse((cx - 13, cy - 60, cx + 13, cy - 32), fill=(232, 198, 166))
d.ellipse((cx - 13, cy - 60, cx + 13, cy - 49), fill=(46, 40, 38))
d.ellipse((cx - 6, cy - 46, cx - 3, cy - 42), fill=(36, 36, 36))
d.ellipse((cx + 2, cy - 46, cx + 5, cy - 42), fill=(36, 36, 36))

tag(d, 16, 16, "室内示意：地板 + 带高度的墙 + 正面墙上的出口 + 家具顶面/侧面", (255, 244, 220), 20)
d.line((560, 186, 560, 140), fill=(240, 200, 120), width=2)
tag(d, 470, 118, "上墙有厚度与墙顶亮线", (240, 210, 150), 15)
d.line((240, 420, 196, 450), fill=(240, 200, 120), width=2)
tag(d, 60, 456, "柜台：顶面 + 正面 + 右侧", (240, 210, 150), 15)
d.line((640, 660, 640, 646), fill=(240, 200, 120), width=2)
tag(d, 620, 664, "出口开在正面墙，底边贴地面", (240, 210, 150), 15)
d.line((790, 470, 806, 442), fill=(240, 200, 120), width=2)
tag(d, 812, 420, "台阶：踏步顶面 + 一级立面", (240, 210, 150), 15)
d.line((360, 620, 360, 600), fill=(240, 200, 120), width=2)
tag(d, 240, 602, "地板网格仍是平面，不收缩", (206, 226, 206), 15)
tag(d, 16, 690, "室内仍是独立小地图，屋顶不实时掀开；出门回到进来时的那扇门", (206, 226, 206), 15)
im.save(OUT / "plan-tilted-room.png")
print("ok")
