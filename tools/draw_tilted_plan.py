from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results" / "topdown"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "C:/Windows/Fonts/msyh.ttc"
def f(s): return ImageFont.truetype(FONT, s)
def tag(d, x, y, t, c, s=17): d.text((x, y), t, font=f(s), fill=c)

W, H = 1280, 760
GROUND = (150, 160, 148)
GROUND_LINE = (126, 138, 126)
ROAD = (120, 128, 116)
WALL = (96, 88, 76)
FACADE = (156, 148, 128)
FACADE_DARK = (128, 120, 102)
ROOF = (84, 96, 92)
ROOF_LINE = (58, 70, 66)
EAVE = (196, 178, 142)
DOOR = (232, 200, 138)
SIDE = (118, 110, 94)

im = Image.new("RGB", (W, H), (34, 44, 46))
d = ImageDraw.Draw(im)

# ground plane: orthographic grid, no perspective convergence
d.rectangle((40, 40, 1240, 680), fill=GROUND)
for y in range(40, 681, 34):
    d.line((40, y, 1240, y), fill=GROUND_LINE)
for x in range(40, 1241, 44):
    d.line((x, 40, x, 680), fill=GROUND_LINE)

# road band
d.rectangle((40, 330, 1240, 400), fill=ROAD)
for x in range(60, 1220, 70):
    d.rectangle((x, 362, x + 34, 367), fill=(196, 194, 176))

def house(bx, by, bw, bd, fh, rd, name, side=0, roof_text=True):
    foot_bottom = by + bd
    # footprint edge
    d.rectangle((bx, by, bx + bw, foot_bottom), fill=WALL)
    # facade (front wall) sits on the lower part of the footprint
    d.rectangle((bx, foot_bottom - fh, bx + bw, foot_bottom), fill=FACADE)
    d.line((bx, foot_bottom - fh, bx + bw, foot_bottom - fh), fill=FACADE_DARK)
    for y in range(foot_bottom - fh + 16, foot_bottom - 14, 26):
        d.line((bx + 8, y, bx + bw - 8, y), fill=(142, 134, 116), width=1)
    # roof plane above the facade, same width, only shifted up
    d.rectangle((bx + side, foot_bottom - fh - rd, bx + bw + side, foot_bottom - fh), fill=ROOF)
    for y in range(foot_bottom - fh - rd + 8, foot_bottom - fh - 2, 11):
        d.line((bx + 4 + side, y, bx + bw - 4 + side, y), fill=ROOF_LINE, width=1)
    d.line((bx + bw / 2 + side, foot_bottom - fh - rd + 4, bx + bw / 2 + side, foot_bottom - fh - 4), fill=ROOF_LINE, width=2)
    if roof_text:
        tag(d, bx + bw / 2 + side - 26, foot_bottom - fh - rd / 2 - 8, name, (226, 220, 196), 15)
    # eave band between roof and facade
    d.rectangle((bx - 6 + side, foot_bottom - fh - 8, bx + bw + 6 + side, foot_bottom - fh + 2), fill=EAVE)
    if side:
        # right thickness only: a short oblique face, not a whole extruded wall
        d.polygon([(bx + bw, foot_bottom - fh), (bx + bw + side, foot_bottom - fh - side * 0.55),
                   (bx + bw + side, foot_bottom), (bx + bw, foot_bottom)], fill=SIDE)
    # doorway on the facade, bottom flush with the ground line
    dx = bx + bw / 2 - 27
    d.rectangle((dx, foot_bottom - 66, dx + 54, foot_bottom), fill=(58, 52, 46))
    d.rectangle((dx + 4, foot_bottom - 61, dx + 50, foot_bottom - 2), fill=DOOR)
    d.line((dx, foot_bottom, dx + 54, foot_bottom), fill=EAVE, width=2)

house(110, 190, 300, 170, 104, 96, "茶馆", side=0)
house(470, 170, 260, 150, 96, 88, "木作铺", side=22)
house(830, 200, 330, 160, 100, 92, "杂货铺", side=0)

# props with top face plus a small front face
def prop(x, y, w, h, top=116, face=88, front=9):
    d.rectangle((x, y, x + w, y + h), fill=(face, face - 6, face - 12))
    d.rectangle((x, y, x + w, y + front), fill=(top, top - 6, top - 14))
for (x, y, w, h) in ((140, 470, 54, 34), (330, 486, 44, 28), (900, 470, 50, 32)):
    prop(x, y, w, h)

# characters, four facings, 2.5 heads, slightly tilted
def person(cx, cy, facing, coat=(214, 206, 186), skin=(232, 198, 166), hair=(46, 40, 38)):
    d.ellipse((cx - 13, cy - 5, cx + 13, cy + 5), fill=(30, 40, 40))
    # legs, short, both feet on the ground line
    d.rectangle((cx - 9, cy - 14, cx - 2, cy), fill=(58, 66, 72))
    d.rectangle((cx + 2, cy - 14, cx + 9, cy), fill=(58, 66, 72))
    # torso as a slightly tapered block
    d.polygon([(cx - 11, cy - 14), (cx + 11, cy - 14), (cx + 14, cy - 36), (cx - 14, cy - 36)], fill=coat)
    # head, large enough to read the facing
    d.ellipse((cx - 13, cy - 60, cx + 13, cy - 32), fill=skin)
    if facing == "up":
        d.ellipse((cx - 13, cy - 61, cx + 13, cy - 37), fill=hair)
        d.rectangle((cx - 8, cy - 36, cx + 8, cy - 28), fill=(104, 92, 70))
    elif facing == "down":
        d.ellipse((cx - 13, cy - 61, cx + 13, cy - 50), fill=hair)
        d.ellipse((cx - 6, cy - 47, cx - 3, cy - 43), fill=(36, 36, 36))
        d.ellipse((cx + 2, cy - 47, cx + 5, cy - 43), fill=(36, 36, 36))
        d.arc((cx - 4, cy - 44, cx + 4, cy - 38), 20, 160, fill=(150, 96, 86))
        d.line((cx, cy - 32, cx, cy - 16), fill=(148, 138, 120))
    elif facing == "left":
        d.ellipse((cx - 14, cy - 61, cx + 11, cy - 34), fill=hair)
        d.ellipse((cx - 13, cy - 50, cx + 2, cy - 34), fill=skin)
        d.ellipse((cx - 8, cy - 46, cx - 5, cy - 42), fill=(36, 36, 36))
        d.polygon([(cx - 12, cy - 14), (cx + 9, cy - 14), (cx + 7, cy - 36), (cx - 14, cy - 36)], fill=coat)
    else:
        d.ellipse((cx - 11, cy - 61, cx + 14, cy - 34), fill=hair)
        d.ellipse((cx - 2, cy - 50, cx + 13, cy - 34), fill=skin)
        d.ellipse((cx + 5, cy - 46, cx + 8, cy - 42), fill=(36, 36, 36))
        d.polygon([(cx - 9, cy - 14), (cx + 12, cy - 14), (cx + 14, cy - 36), (cx - 7, cy - 36)], fill=coat)

person(470, 560, "up")
person(640, 560, "down")
person(810, 560, "left")
person(980, 560, "right")
tag(d, 436, 588, "朝上：后脑与背包", (232, 224, 200), 14)
tag(d, 604, 588, "朝下：看得见脸", (232, 224, 200), 14)
tag(d, 776, 588, "朝左：侧脸", (232, 224, 200), 14)
tag(d, 946, 588, "朝右：侧脸", (232, 224, 200), 14)

# callouts
tag(d, 44, 12, "目标构图：正面墙 + 屋顶 + 屋檐，地面仍是平面网格（示意，非最终美术）", (255, 244, 220), 21)
d.line((300, 152, 300, 96), fill=(240, 200, 120), width=2)
tag(d, 214, 76, "屋顶（顶面，向上压缩）", (240, 210, 150), 15)
d.line((742, 132, 726, 214), fill=(240, 200, 120), width=2)
tag(d, 600, 120, "屋檐：墙顶一条亮线", (240, 210, 150), 15)
d.line((256, 340, 196, 392), fill=(240, 200, 120), width=2)
tag(d, 96, 396, "正面墙：门开在这一面，底部贴地面", (240, 210, 150), 15)
d.line((790, 300, 846, 326), fill=(240, 200, 120), width=2)
tag(d, 792, 330, "右侧厚度，只有一侧", (240, 210, 150), 15)

tag(d, 56, 648, "人物脚落在地面网格上，不在台阶或门框上", (240, 210, 150), 15)
tag(d, 44, 700, "碰撞矩形仍等于占地矩形：底边就是人卡住的位置，屋顶向上溢出的部分只是视觉高度", (206, 226, 206), 16)
tag(d, 44, 726, "人走到楼北侧时被屋顶遮住、走到南侧时画在楼前，排序点仍是脚底", (206, 226, 206), 16)
im.save(OUT / "plan-tilted-map.png")

# collision overlay
im2 = im.copy()
d2 = ImageDraw.Draw(im2, "RGBA")
for (bx, by, bw, bd) in ((110, 190, 300, 170), (470, 170, 260, 150), (830, 200, 330, 160)):
    d2.rectangle((bx, by, bx + bw, by + bd), fill=(214, 72, 72, 96))
for (x, y, w, h) in ((140, 470, 54, 34), (330, 486, 44, 28), (900, 470, 50, 32)):
    d2.rectangle((x, y, x + w, y + h), fill=(214, 72, 72, 96))
d2.rectangle((40, 40, 1240, 680), fill=(80, 190, 116, 44))
for (bx, by, bw, bd) in ((110, 190, 300, 170), (470, 170, 260, 150), (830, 200, 330, 160)):
    d2.rectangle((bx + bw / 2 - 30, by + bd - 76, bx + bw / 2 + 30, by + bd), fill=(86, 178, 224, 120))
d2.rectangle((0, 0, W, 48), fill=(34, 44, 46))
d2.rectangle((0, 690, W, H), fill=(34, 44, 46))
tag(d2, 44, 12, "碰撞叠图：绿=可走，红=建筑与家具占地，蓝=门洞可通行", (255, 244, 220), 21)
tag(d2, 44, 700, "红框就是画出来的正面墙底边；屋顶在红框上方，不额外挡路，只按脚底深度遮住北侧的人", (206, 226, 206), 16)
im2.save(OUT / "plan-tilted-collision.png")
print("ok")
