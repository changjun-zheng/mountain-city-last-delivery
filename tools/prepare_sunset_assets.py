"""Offline asset adaptation for SUNSET-SAMPLE-01. No downloads or model calls.
Original reference/generated files are read-only. Production images are separated
materials/sprites, not whole-scene background plates. Pillow is already installed.
"""
import hashlib
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'reference/generated'
OUT = ROOT / 'src/rendering/phaser/assets/sunset-sample-v1'
OUT.mkdir(parents=True, exist_ok=True)
R = Image.Resampling.LANCZOS
sources = {}
outputs = {}

def source(name):
    path = RAW / name
    sources[str(path.relative_to(ROOT)).replace('\\', '/')] = hashlib.sha256(path.read_bytes()).hexdigest()
    return Image.open(path).convert('RGBA')

def save(image, name):
    path = OUT / name
    image.save(path, quality=88, method=6)
    outputs[name] = {'width':image.width,'height':image.height,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    return image

def quad(image, points, size):
    # Pillow QUAD order: top-left, bottom-left, bottom-right, top-right.
    tl, tr, br, bl = points
    return image.transform(size, Image.Transform.QUAD, (*tl,*bl,*br,*tr), Image.Resampling.BICUBIC)

def color(image, tint, opacity):
    layer = Image.new('RGBA', image.size, (*tint, round(255*opacity)))
    alpha = image.getchannel('A')
    image = Image.alpha_composite(image.convert('RGBA'), layer)
    image.putalpha(alpha)
    return image

def patch(canvas, texture, box):
    x,y,w,h = map(round,box)
    canvas.alpha_composite(texture.resize((w,h), R), (x,y))

shop = source('shop.png')
tea = source('tea.png')
slab = source('slab.png')
room = source('scene2_plates/room_shop.jpg')
city = source('far_city.png')

# Straighten the existing roof slope and facade/window components, discarding
# their large oblique side faces so the playable projection remains orthographic.
roof = quad(tea, [(323,139),(747,79),(1104,351),(589,438)], (840,260))
roof = color(ImageEnhance.Color(roof).enhance(.6), (100,105,105), .08)
window = quad(shop, [(558,706),(700,674),(700,845),(553,883)], (160,200))
plaster = quad(tea, [(217,379),(306,416),(306,501),(217,468)], (160,140))
# Sample only material: exclude the source's beams, sign frame and metal hooks.
# Repeating the whole signboard makes floors look like rows of doors.
plaster = plaster.crop((25,68,86,119)).resize((160,140),R)
wood = quad(shop, [(741,617),(1036,552),(1032,624),(743,684)], (420,100))
wood = wood.crop((65,62,350,94)).resize((420,100),R)
wood = ImageEnhance.Brightness(ImageEnhance.Color(wood).enhance(.65)).enhance(.88)
wood = color(wood,(110,103,83),.08)
wood_floor = Image.new('RGBA',(512,512),(95,69,46,255))
for i in range(8):
    board=wood.rotate(90,expand=True).resize((64,512),R)
    if i%2: board=ImageOps.mirror(board)
    if i%3: board=ImageOps.flip(board)
    board=ImageEnhance.Brightness(board).enhance(.86+(i%3)*.065)
    wood_floor.alpha_composite(board,(i*64,0))
d=ImageDraw.Draw(wood_floor)
for i in range(9):
    d.line((i*64,0,i*64,512),fill=(38,31,26,210),width=2)
for i in range(8):
    y=(i*139)%400+70
    d.line((i*64,y,(i+1)*64,y),fill=(41,31,22,190),width=2)
save(wood_floor,'timber-floor.webp')
save(wood,'timber-grain.webp')
save(plaster,'lime-plaster.webp')
save(window,'lattice-window.webp')
save(roof,'roof-tiles.webp')

# Rotate the diamond paving back to orthographic rows, then mirror small edges
# across a 2x2 tile. Nothing in this image defines a new walking route.
paving=slab.rotate(45, resample=Image.Resampling.BICUBIC,expand=True)
cx,cy=paving.width//2,paving.height//2
paving=paving.crop((cx-480,cy-360,cx+480,cy+360)).resize((384,288),R)
paving=ImageEnhance.Color(paving).enhance(.62)
paving=color(paving,(190,172,140),.13)
seamless=Image.new('RGBA',(768,576))
seamless.alpha_composite(paving,(0,0));seamless.alpha_composite(ImageOps.mirror(paving),(384,0))
seamless.alpha_composite(ImageOps.flip(paving),(0,288));seamless.alpha_composite(ImageOps.flip(ImageOps.mirror(paving)),(384,288))
save(seamless,'stone-paving.webp')
# Isolated skyline, excluding the bridge and water which would undermine the
# existing photography puzzle. It is only outside the upper map's walk bounds.
sky=city.crop((0,0,1190,343)).resize((1190,343),R)
sky=color(sky,(170,171,155),.22)
save(sky,'city-haze.webp')

# Front-ground anchor is (450, 548); physical facade occupies x30..870. The
# textured roof is compressed directly above the wall, never an isometric box.
for variant in ['guide','workshop','gallery']:
    im=Image.new('RGBA',(900,560))
    facade=Image.new('RGBA',(840,284),(126,103,76,255))
    for x in range(0,840,160):
        for y in range(0,284,140):
            facade.alpha_composite(plaster,(x,y))
    facade=color(facade, (103,77,53) if variant=='workshop' else (151,129,93), .24)
    im.alpha_composite(facade,(30,264))
    d=ImageDraw.Draw(im)
    # Subtle thin side face stays within the footprint's visual allowance.
    d.polygon([(870,264),(889,250),(889,541),(870,548)],fill=(57,47,36,255))
    for x in [30,205,377,506,681,852]:
        patch(im,wood.rotate(90,expand=True),(x,264,18,280))
        d.line((x,264,x,542),fill=(177,136,83,255),width=2)
    for y in [273,448,525]:
        patch(im,wood,(30,y,840,15 if y!=525 else 23))
    for x in [71,245,546,720]:
        patch(im,window,(x,311,100,115))
        d.line((x,430,x+100,430),fill=(183,139,82,255),width=3)
    # Open playable doorway, not copied from a perspective painting. Gallery
    # has a real solid shutter instead, since there is no entrance target there.
    if variant!='gallery':
        d.rectangle((391,366,510,548),fill=(27,27,24,255))
        d.polygon([(399,540),(495,540),(473,499),(411,499)],fill=(103,79,48,255))
        for x in [384,510]:
            patch(im,wood.rotate(90,expand=True),(x,350,12,198))
        patch(im,wood,(384,351,138,14))
        d.rectangle((399,369,404,536),fill=(131,94,49,255))
        d.rectangle((394,542,511,548),fill=(204,176,119,255))
        # blank sign receives the existing building name as real game text.
        patch(im,wood,(345,288,210,49))
        d.rectangle((349,292,552,330),outline=(200,165,107,255),width=2)
    else:
        patch(im,window,(390,313,126,183))
    # Preserve cross-floor identity marker of the guide building.
    if variant=='guide':
        d.rectangle((208,296,216,437),fill=(131,174,165,255))
        d.rectangle((210,296,213,437),fill=(214,217,190,255))
    if variant=='workshop':
        for y in [365,375]:
            d.line([(213,y),(222,y-5),(231,y),(240,y-5),(249,y)], fill=(198,175,118,255),width=3)
    # Roof plane with gently swept edges and a physical timber eave.
    roof_layer=roof.resize((900,270),R)
    mask=Image.new('L',roof_layer.size)
    ImageDraw.Draw(mask).polygon([(43,17),(851,17),(877,4),(877,33),(899,253),(894,269),(6,269),(0,251),(24,33),(22,5)],fill=255)
    roof_layer.putalpha(mask)
    im.alpha_composite(roof_layer,(0,0))
    d=ImageDraw.Draw(im)
    d.line([(24,16),(48,25),(850,25),(876,15)],fill=(156,149,122,255),width=7)
    d.line([(6,267),(894,267)],fill=(49,42,31,255),width=8)
    d.line([(6,270),(894,270)],fill=(146,112,70,255),width=3)
    # Roof shade on wall; no floating detached shadow sprites.
    shade=Image.new('RGBA',im.size)
    sd=ImageDraw.Draw(shade)
    for y in range(276,311):
        sd.line((30,y,870,y),fill=(20,27,28,round(80*(1-(y-276)/35))))
    im=Image.alpha_composite(im,shade)
    save(im,f'{variant}-building.webp')

# Rectified window from the existing room painting. No tools or new story props.
interior_window=quad(room,[(121,35),(541,98),(576,510),(211,551)],(256,280))
save(interior_window,'sunlit-window.webp')
# A reading desk exactly sized by the real collision footprint in the renderer.
desk=Image.new('RGBA',(460,230))
patch(desk,wood,(8,10,444,139))
d=ImageDraw.Draw(desk)
d.polygon([(8,149),(452,149),(452,168),(8,168)], fill=(80,51,30,255))
d.line((9,12,449,12),fill=(201,158,92,255),width=4)
for x in [22,421]:
    patch(desk,wood.rotate(90,expand=True),(x,158,19,64))
    d.line((x,159,x,222),fill=(169,123,70,255),width=2)
# Books are already part of the existing reading area, no new interaction.
for x,y,w,h,c in [(40,55,60,44,(57,75,70,255)),(310,37,70,49,(108,64,43,255)),(316,28,62,41,(168,146,105,255))]:
    d.rectangle((x,y,x+w,y+h),fill=(40,31,22,255))
    d.rectangle((x+1,y+1,x+w-2,y+h-5),fill=c)
    d.line((x+4,y+h-4,x+w-4,y+h-4),fill=(191,170,124,255),width=3)
d.polygon([(150,49),(205,45),(218,51),(274,47),(272,112),(218,118),(206,112),(149,116)],fill=(217,200,155,255))
d.line((215,51,215,114),fill=(142,115,72,255),width=2)
for y in range(61,104,9):
    d.line((160,y,199,y-1),fill=(148,130,92,255),width=1)
    d.line((230,y,262,y-2),fill=(148,130,92,255),width=1)
save(desk,'reading-desk.webp')

# Small hand-painted sprite sheet, preserving the current protagonist's dark
# hair, teal jacket, dark trousers and tan backpack. Not an image-model output.
S=4
atlas=Image.new('RGBA',(96*4*S,80*S))
for i,direction in enumerate(['down','up','left','right']):
    im=Image.new('RGBA',(96*S,80*S))
    d=ImageDraw.Draw(im)
    def ellipse(box,fill): d.ellipse(tuple(round(v*S) for v in box),fill=fill)
    def polygon(points,fill): d.polygon([(round(x*S),round(y*S)) for x,y in points],fill=fill)
    def line(points,fill,width=1): d.line([(round(x*S),round(y*S)) for x,y in points],fill=fill,width=max(1,round(width*S)))
    side=direction in ['left','right']
    # Both foot contacts stay on y=76, the runtime's unmodified foot position.
    polygon([(37,50),(47,49),(46,72),(39,74)],(43,47,48,255))
    polygon([(48,49),(58,50),(57,73),(49,74)],(36,42,45,255))
    ellipse((35,70,47,76),(39,35,29,255));ellipse((49,70,61,76),(34,34,29,255))
    line([(37,74),(45,74)],(118,107,84,255))
    line([(51,74),(59,74)],(105,99,82,255))
    polygon([(37,27),(56,27),(61,53),(35,54)],(46,86,83,255))
    polygon([(38,28),(44,27),(43,52),(36,52)],(88,123,110,255))
    polygon([(56,29),(60,34),(61,52),(56,52)],(31,62,63,255))
    polygon([(37,29),(32,32),(30,49),(36,50),(40,34)],(60,102,92,255))
    polygon([(56,30),(60,32),(64,48),(58,50),(54,35)],(39,76,75,255))
    ellipse((30,47,36,53),(186,151,111,255));ellipse((58,47,64,53),(178,138,102,255))
    ellipse((37,6,58,29),(43,40,34,255))
    if direction!='up':
        ellipse((38,10,57,30),(190,153,110,255))
        ellipse((39,11,51,25),(218,182,133,255))
        polygon([(37,16),(38,8),(44,4),(54,7),(59,13),(54,17),(50,12),(45,16),(40,17)],(44,41,34,255))
        line([(39,11),(44,7),(52,9)],(102,88,59,255),1.5)
        if direction=='down':
            line([(42,21),(44,21)],(43,41,34,255),1.1)
            line([(51,21),(53,21)],(43,41,34,255),1.1)
            line([(47,23),(46,25),(49,25)],(161,122,81,255),.7)
            line([(45,27),(50,27)],(135,93,69,255),.7)
            line([(45,30),(48,33),(51,30)],(160,174,144,255),1.2)
            line([(48,34),(48,50)],(27,58,59,255),1)
        else:
            # Draw the right profile then mirror for left to keep identity exact.
            polygon([(49,10),(55,14),(58,20),(61,22),(57,24),(55,29),(47,28)],(204,166,120,255))
            ellipse((39,10,52,28),(45,42,34,255))
            ellipse((48,19,52,24),(174,132,94,255))
            line([(55,20),(57,20)],(45,40,31,255),1)
            polygon([(34,32),(40,31),(42,47),(35,49)],(128,109,75,255))
            if direction=='left': im=ImageOps.mirror(im)
    else:
        ellipse((37,7,58,29),(42,41,35,255))
        line([(39,14),(40,10),(44,7),(53,9)],(101,90,61,255),1.1)
        polygon([(39,31),(56,31),(58,49),(38,49)],(126,108,76,255))
        polygon([(41,33),(55,33),(54,45),(40,45)],(155,133,90,255))
        line([(39,31),(39,49),(56,49)],(75,66,48,255),1)
    atlas.alpha_composite(im,(i*96*S,0))
save(atlas.resize((384,80),R),'traveller-directions.webp')

manifest={
    'task':'SUNSET-SAMPLE-01','date':'2026-11-23',
    'approval':'User chose existing-asset adaptation after ImageGen HTTP 403. upper + guide2 only; existing projection and logic retained.',
    'reference':{'file':'reference.png','sha256':hashlib.sha256((OUT/'reference.png').read_bytes()).hexdigest(),'usage':'User supplied style reference only; not a level background.'},
    'method':'Pillow crop, quadrilateral rectification, resampling and original local drawing. No new model-generated assets, downloads or scene-plate substitution.',
    'sourceHashes':sources,'outputs':outputs,
    'knownSourceLinks':{'shop.png':'https://aka.doubaocdn.com/s/XxX6Q7vigB','tea.png':'https://aka.doubaocdn.com/s/ulkfgMWiSI'},
    'rights':'Existing project candidates reused with user approval for this local sample. Third-party source rights and commercial-release clearance NOT independently verified. Source originals untouched.',
    'generationAttempts':{'status':'BLOCKED','httpStatus':403,'filesCreated':0},
}
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(outputs),'adaptedBytes':sum(v['bytes'] for v in outputs.values()),'runtimeBytes':sum(v['bytes'] for name,v in outputs.items() if name!='lattice-window.webp')},indent=2))
