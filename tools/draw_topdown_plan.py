from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results" / "topdown"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "C:/Windows/Fonts/msyh.ttc"
def f(size): return ImageFont.truetype(FONT, size)

def tag(d, x, y, text, color, size=18):
    d.text((x, y), text, font=f(size), fill=color)

# 1. annotate the current plaza frame
im = Image.open(OUT / "now-plaza.png").convert("RGB")
d = ImageDraw.Draw(im, "RGBA")
boxes = [
    (96, 146, 332, 378, (220, 80, 80), "书店：正立面+窗，右侧挤出侧面"),
    (342, 350, 826, 636, (70, 170, 120), "地面：透视圆台，砖缝朝远处收缩"),
    (556, 208, 626, 497, (80, 140, 220), "纪念碑：正面柱，没有俯视占地"),
    (352, 325, 390, 377, (230, 190, 60), "人物：侧身，只做左右翻转"),
]
for x1, y1, x2, y2, c, label in boxes:
    d.rectangle((x1, y1, x2, y2), outline=c, width=3)
tag(d, 16, 690, "现状：地面圆台有透视，楼是正立面加侧面挤出，人是侧身贴图", (255, 240, 210), 20)
tag(d, 16, 718, "同一格地面上，视觉边界和碰撞矩形不是同一条线", (255, 240, 210), 18)
im.save(OUT / "now-plaza-annotated.png")

# 2. target top-down schematic, same street segment
W, H = 1200, 720
im2 = Image.new("RGB", (W, H), (28, 42, 46))
d2 = ImageDraw.Draw(im2, "RGBA")

GROUND = (58, 92, 92)
WALL = (86, 66, 50)
WALL_TOP = (150, 120, 84)
ROAD = (52, 58, 62)
STONE = (78, 108, 104)
DOOR = (196, 214, 196)

# ground plane (walkable)
d2.rectangle((40, 60, 1160, 660), fill=GROUND)
# road band
d2.rectangle((40, 330, 1160, 440), fill=ROAD)
for x in range(70, 1140, 90):
    d2.rectangle((x, 382, x + 44, 388), fill=(180, 180, 170))
# side walk
d2.rectangle((40, 440, 1160, 660), fill=STONE)

# three building footprints on the upper side
for i, x in enumerate((90, 430, 770)):
    d2.rectangle((x, 70, x + 300, 300), fill=WALL)
    d2.rectangle((x, 70, x + 300, 84), fill=WALL_TOP)   # wall top, seen from above
    d2.rectangle((x, 300, x + 300, 316), fill=WALL_TOP)
    # door opening cut into the footprint
    dx = x + 120
    d2.rectangle((dx, 300, dx + 70, 330), fill=DOOR)
    tag(d2, x + 8, 96, f"{['茶馆','木作铺','杂货铺'][i]} 占地", (235, 220, 190), 17)
# archway footprint
d2.rectangle((1080, 70, 1130, 300), fill=WALL)

# props with footprints
for x, y, r in ((150, 500, 16), (300, 520, 12), (520, 505, 14), (900, 510, 16)):
    d2.ellipse((x - r, y - r, x + r, y + r), fill=(120, 92, 64))
tag(d2, 120, 530, "家具占地即阻挡", (210, 200, 180), 14)

# character, four facings
def person(cx, cy, facing):
    body = (232, 226, 208)
    hair = (40, 34, 32)
    d2.ellipse((cx - 12, cy - 2, cx + 12, cy + 8), fill=(20, 30, 30, 120))
    d2.ellipse((cx - 10, cy - 30, cx + 10, cy - 2), fill=body)
    d2.ellipse((cx - 11, cy - 34, cx + 11, cy - 14), fill=hair)
    if facing == "up":
        d2.ellipse((cx - 9, cy - 32, cx + 9, cy - 16), fill=hair)
    elif facing == "down":
        d2.ellipse((cx - 6, cy - 30, cx + 6, cy - 20), fill=(226, 190, 160))
    else:
        dx = -4 if facing == "left" else 4
        d2.ellipse((cx + dx - 4, cy - 29, cx + dx + 4, cy - 21), fill=(226, 190, 160))

person(430, 520, "up")
person(600, 520, "down")
person(770, 520, "left")
person(940, 520, "right")
tag(d2, 416, 470, "朝上", (235, 220, 190), 15)
tag(d2, 586, 470, "朝下", (235, 220, 190), 15)
tag(d2, 756, 470, "朝左", (235, 220, 190), 15)
tag(d2, 926, 470, "朝右", (235, 220, 190), 15)
tag(d2, 400, 570, "四向造型必须不同：朝上只看见后脑与肩，朝下看得见脸", (235, 220, 190), 16)

tag(d2, 44, 20, "目标画面：真正的俯视（同一街段示意，非最终美术）", (255, 244, 220), 22)
tag(d2, 90, 636, "可走地面", (200, 235, 200), 14)
tag(d2, 700, 636, "墙顶可见一条厚度，下面矩形是它在地面的占地", (235, 220, 190), 14)
im2.save(OUT / "plan-topdown-map.png")

# 3. collision overlay on the same schematic
im3 = im2.copy()
d3 = ImageDraw.Draw(im3, "RGBA")
d3.rectangle((0, 0, W, 52), fill=(28, 42, 46))
d3.rectangle((0, 664, W, H), fill=(28, 42, 46))
d3.rectangle((40, 60, 1160, 660), fill=(80, 200, 120, 60))
for x in (90, 430, 770):
    d3.rectangle((x, 70, x + 300, 300), fill=(220, 70, 70, 90))
    dx = x + 120
    d3.rectangle((dx, 300, dx + 70, 330), fill=(80, 180, 230, 110))
d3.rectangle((1080, 70, 1130, 300), fill=(220, 70, 70, 90))
for x, y, r in ((150, 500, 16), (300, 520, 12), (520, 505, 14), (900, 510, 16)):
    d3.rectangle((x - r, y - r, x + r, y + r), fill=(220, 70, 70, 90))
tag(d3, 44, 20, "碰撞叠图：绿=可走，红=墙与家具占地，蓝=门洞可通行", (255, 244, 220), 22)
tag(d3, 44, 676, "目标是让红框边界与画出来的墙边同一条线；门洞开时蓝块可通行", (235, 220, 190), 16)
im3.save(OUT / "plan-collision-overlay.png")
print("ok")
