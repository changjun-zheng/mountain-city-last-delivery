import Phaser from 'phaser';
import { EXP_MAPS, EXP_TARGETS, type Rect } from '../../core/exploration-content';
import type { ExplorationSnapshot } from '../../core/exploration';
import { UPPER_EAST_STAIR_X, UPPER_STAIR_END_Y, UPPER_STAIR_LANDING_Y, UPPER_STAIR_RAIL_HALF_WIDTH,
  UPPER_SHOP_DISPLAYS, UPPER_STREET_EDGE_Y, WEST_STREET_JOIN } from '../../core/exploration-c-routes';
import { celMaterial, prepareCelMaterials, type CelMaterial } from './exploration-cel-materials';
import { createPlaceholderActor, posePlaceholderActor, PLACEHOLDER_HEIGHT } from './exploration-placeholder-actor';
import propsUrl from './assets/cel-v1/props.webp';
import travellerUrl from './assets/cel-v1/traveller.webp';
import briskUrl from './assets/cel-v1/traveller-brisk.webp';
import residentsUrl from './assets/cel-v1/residents.webp';
import residentsAtRestUrl from './assets/cel-v1/residents-at-rest.webp';
import riverCityUrl from './assets/cel-v1/foothill-bank.webp';
import frames from './assets/cel-v1/frames.json';

// Frames were measured on the packaged alpha atlases, not an equal-cell grid.
const prefix = 'cel-v1-';
const key = (name: string) => prefix + name;
const assets = { props:propsUrl, traveller:travellerUrl, brisk:briskUrl, residents:residentsUrl,
  residentsAtRest:residentsAtRestUrl, riverCity:riverCityUrl };
const travellerHeight = PLACEHOLDER_HEIGHT;
export const isStorybookSample = (map: string): boolean => map === 'upper' || map === 'guide2';

export function preloadStorybook(scene: Phaser.Scene, failed: (error: Error) => void): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    if (file.key.startsWith(prefix)) failed(new Error(`Cel image unavailable: ${file.key}`));
  });
  for (const [name, url] of Object.entries(assets)) scene.load.image(key(name), url);
}

export function createStorybookActor(scene: Phaser.Scene): Phaser.GameObjects.Container {
  prepareCelMaterials(scene);
  for (const [name, entries] of Object.entries(frames)) {
    const texture = scene.textures.get(key(name));
    for (const [frame, [x,y,w,h]] of Object.entries(entries)) if (!texture.has(frame)) texture.add(frame, 0, x, y, w, h);
  }
  return createPlaceholderActor(scene);
}

export function faceStorybookActor(body: Phaser.GameObjects.Container, fx: number, fy: number, stride: number | undefined, gait:'slow'|'brisk'): void {
  posePlaceholderActor(body, fx, fy, stride, gait);
}

type Occluder = Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
function occludes(image: Occluder, footprint: Rect, baseline = footprint.y + footprint.h): void {
  image.setData('occluder', { x: image.x - image.displayWidth * image.originX, y: image.y - image.displayHeight * image.originY,
    w: image.displayWidth, h: image.displayHeight, baseline, footprint });
}
export function updateStorybookOcclusion(layer: Phaser.GameObjects.Layer, x: number, y: number): number {
  let faded = 0;
  for (const object of layer.list) {
    const image = object as Occluder;
    const box = image.getData?.('occluder') as (Rect & {baseline: number}) | undefined;
    if (!box) continue;
    const behind = y < box.baseline && x + 19 > box.x && x - 19 < box.x + box.w && y > box.y && y - travellerHeight < box.y + box.h;
    image.setAlpha(behind ? .28 : 1);
    if (behind) faded++;
  }
  return faded;
}

const residentsOnUpper = [
  { frame:'elder', x:625, y:755, height:80, anchor:.56 },
  { frame:'man', x:1758, y:565, height:89, anchor:.28 },
  { frame:'woman', x:854, y:644, height:87, anchor:.52 },
  { frame:'child', x:813, y:660, height:66, anchor:.57 },
] as const;
type Resident = { body: Phaser.GameObjects.Container; pose: Phaser.GameObjects.Image; resident: typeof residentsOnUpper[number] };

// The two shoppers stay together. They stop at the display, look over the
// railing, then take the wider street back to where they started.
const shoppingRoute = [
  { at:0, x:854, y:644, west:false },
  { at:7, x:1118, y:575, west:false },
  { at:18, x:1118, y:575, west:false },
  { at:27, x:1430, y:744, west:false },
  { at:40, x:1430, y:744, west:false },
  { at:43, x:1395, y:695, west:true },
  { at:56, x:854, y:644, west:true },
  { at:59, x:854, y:644, west:true },
  { at:65, x:854, y:644, west:false },
] as const;

function addUpperStreetResidents(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer): void {
  const residents: Resident[] = residentsOnUpper.map(resident => {
    const pose = scene.add.image(0,0,key('residentsAtRest'),resident.frame).setOrigin(resident.anchor,1);
    pose.setScale(resident.height / pose.height);
    const cast = scene.add.ellipse(-7,2,resident.height*.43,12,0x372b3d,.22).setRotation(-.13);
    const shadow = scene.add.ellipse(0,1,resident.height*.25,7,0x32262f,.44);
    const body = scene.add.container(resident.x,resident.y,[cast,shadow,pose]).setDepth(resident.y);
    layer.add(body);
    return {body,pose,resident};
  });
  layer.setData('streetResidents', residents);
}

export function updateStreetResidents(layer: Phaser.GameObjects.Layer, seconds: number, reducedMotion: boolean): number {
  const residents = layer.getData('streetResidents') as Resident[] | undefined;
  if (!residents) return 0;
  const time = reducedMotion ? 11 : seconds % shoppingRoute[shoppingRoute.length-1].at;
  const next = shoppingRoute.findIndex(point => point.at > time);
  const from = shoppingRoute[next-1], to = shoppingRoute[next];
  const fraction = (time-from.at)/(to.at-from.at);
  const pace = Math.hypot(to.x-from.x,to.y-from.y)*fraction;
  const x = Phaser.Math.Linear(from.x,to.x,fraction), y = Phaser.Math.Linear(from.y,to.y,fraction);
  for (const {body,pose,resident} of residents) {
    if (resident.frame === 'elder') continue;
    if (resident.frame === 'man') {
      // Two loads of timber at the counter, with a rest between them.
      const phase = seconds % 19;
      const work = phase<6 ? phase : phase-6;
      const reach = !reducedMotion && work<2.8 ? Math.sin(Math.PI*work/2.8)**2 : 0;
      pose.setPosition(reach*2,-reach).setRotation(reach*.045);
      continue;
    }
    const child = resident.frame==='child';
    const footX = x - (child ? 41 : 0);
    const footY = y + (child ? 16 : 0);
    const stride = pace + (child ? 7 : 0);
    const stepping = pace > 0 && Math.sin(stride/5) > .1;
    const texture = key(stepping ? 'residents' : 'residentsAtRest');
    if (pose.texture.key !== texture) {
      pose.setTexture(texture,resident.frame).setOrigin(stepping ? .5 : resident.anchor,1);
      pose.setScale(resident.height / pose.height);
    }
    body.setPosition(footX,footY).setDepth(footY);
    pose.setFlipX(to.west);
    pose.setY(stepping ? -1.2 : 0);
  }
  return residents.length;
}

function drawStreetStairs(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, upper: boolean, x: number): void {
  const {upperY, middleY} = WEST_STREET_JOIN;
  const seam = upper ? upperY : middleY;
  const top = seam - 166;
  const bottom = upper ? UPPER_STAIR_END_Y : seam + 160;
  const edge = UPPER_STAIR_RAIL_HALF_WIDTH;
  const steps = scene.add.graphics().setDepth(-66);
  layer.add(steps);
  steps.fillStyle(0x443b45); steps.fillRect(x-edge-9,top,2*edge+18,bottom-top+15);
  // Same rise/run measured from the seam in either view, with a full landing.
  const courses = [-166,-147,-128,-108,-88,-68,-48,-28,9,31,52,73,94,115,136,160];
  for (let i=0;i<courses.length-1;i++) {
    const y=seam+courses[i], lower=Math.min(seam+courses[i+1],bottom);
    if(y>=lower)break;
    const split=x+(i%3-1)*22;
    steps.fillStyle(i%2?0x958173:0xa68b7a);
    steps.fillRect(x-edge,y,edge*2,lower-y);
    steps.fillStyle(0x483b48,.72);steps.fillRect(x-edge,y,10,lower-y);
    steps.fillStyle(0xa99182,.75);steps.fillRect(x+edge-9,y,9,lower-y);
    steps.fillStyle(0x7d695f);steps.fillRect(split,y,2,lower-y);
    steps.fillStyle(0xc4a18a);steps.fillRect(x-edge+7,lower-8,edge*2-12,2);
    steps.fillStyle(0x59505a);steps.fillRect(x-edge+3,lower-6,edge*2-6,6);
  }
  for (const side of [-1,1]) {
    const railX = x+side*edge;
    steps.lineStyle(8,0x6a514b); steps.lineBetween(railX,top,railX,bottom);
    steps.lineStyle(2,0xd1b387); steps.lineBetween(railX-1,top,railX-1,bottom);
    for (let y=seam-130; y<=bottom; y+=43) {
      steps.fillStyle(0x483b45); steps.fillRect(railX-5,y-5,10,15);
      steps.fillStyle(0xae8c78); steps.fillRect(railX-6,y-7,12,5);
    }
    // The same turquoise tile marks the bend on both street views.
    steps.fillStyle(0xf0dbad); steps.fillRect(railX-7,seam-6,14,14);
    steps.fillStyle(0x506e69); steps.fillRect(railX-5,seam-4,10,10);
  }
  if (x===WEST_STREET_JOIN.x) {
    const sign = scene.add.text(x,upper?top-24:bottom+22,upper?'↓ 西外阶 · 沿坡下中街':'↑ 西外阶 · 沿坡回上街',{
      fontFamily:'Microsoft YaHei, sans-serif',fontSize:'16px',color:'#f7e5cc',backgroundColor:'#3e303a',padding:{x:8,y:4},
    }).setOrigin(.5).setDepth(-3).setName('viewport-west-sign');
    sign.setData('viewportHome',{x:sign.x,y:sign.y,text:sign.text});
    layer.add(sign);
  }
}

export function drawMiddleStreet(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer): void {
  const {width,height,bounds,buildings,walls} = EXP_MAPS.middle;
  const ground = scene.add.graphics().setDepth(-95);
  const light = scene.add.graphics().setDepth(-83);
  const masonry = scene.add.graphics().setDepth(-82);
  layer.add([ground,light,masonry]);
  ground.fillStyle(0x423542);ground.fillRect(0,-700,width,height+850);
  // Roofs on the upper terrace share the façade artwork at a lower contrast.
  const distantFrames = ['guide','gallery','workshop','gallery'] as const;
  for(let i=0,x=38;x<width+85;i++,x+=139){
    const y=147-Math.round(24*(1+Math.sin(x/151)));
    const roof=scene.add.image(x,y,key('props'),distantFrames[i%distantFrames.length]).setOrigin(.5,1);
    roof.setScale((164+16*(i%3))/roof.width).setAlpha(.43).setDepth(-93);
    layer.add(roof);
  }
  layer.add(celMaterial(scene,'stone',0,132,width,88,-91).setTint(0x776578));
  layer.add(celMaterial(scene,'street',bounds.x,bounds.y,bounds.w,860,-90));
  // Modest building shadows and broad lamp pools live on uninterrupted paving.
  light.fillStyle(0x34283a,.35);light.fillRect(bounds.x,220,bounds.w,64);
  light.fillStyle(0xa87760,.16);light.fillRect(bounds.x,548,bounds.w,76);
  light.lineStyle(2,0x9a756b,.58);
  light.lineBetween(bounds.x,548,bounds.x+bounds.w,548);
  light.lineBetween(bounds.x,624,bounds.x+bounds.w,624);
  for (const house of buildings) {
    const y=house.y+house.h,center=house.x+house.w/2;
    light.fillStyle(0x34283a,.4);
    light.fillEllipse(center+19,y+11,house.w,44);
    light.fillStyle(0xd99b65,.16);
    light.fillPoints([{x:center-43,y:y+7},{x:center+42,y:y+7},{x:center+140,y:y+111},{x:center-95,y:y+111}],true);
  }
  masonry.fillStyle(0xb69a88);masonry.fillRect(0,207,width,9);
  masonry.fillStyle(0x544452);masonry.fillRect(0,216,width,11);
  for (let x=72;x<width;x+=144) {
    masonry.fillStyle(0x584450);masonry.fillRect(x,137,15,72);
    masonry.fillStyle(0xa38175);masonry.fillRect(x-3,135,21,6);
  }
  for(const x of [166,451,973,1365,1879,2104]){
    const plant=scene.add.image(x,205,key('props'),'plant').setOrigin(.5,1).setDepth(-81);
    plant.setScale(35/plant.width).setAlpha(.74);
    layer.add(plant);
  }
  for (const wall of walls.slice(buildings.length)) {
    layer.add(celMaterial(scene,'stone',wall.x,wall.y,wall.w,wall.h,-88).setTint(0x8e7182));
    masonry.fillStyle(0x4f3f4e);masonry.fillRect(wall.x,wall.y-3,wall.w,13);
    masonry.fillStyle(0xbc9b7b);masonry.fillRect(wall.x,wall.y-3,wall.w,4);
    for (let x=wall.x+12;x<wall.x+wall.w-10;x+=67) {
      masonry.fillStyle(0x70534e);masonry.fillRect(x,wall.y-15,8,27);
      masonry.fillStyle(0xca9e76);masonry.fillRect(x-2,wall.y-17,12,5);
    }
  }
  drawStreetStairs(scene,layer,false,WEST_STREET_JOIN.x);
  drawStreetStairs(scene,layer,false,UPPER_EAST_STAIR_X);
  for (const x of [WEST_STREET_JOIN.x,UPPER_EAST_STAIR_X]) {
    layer.add(celMaterial(scene,'stone',x-60,1080,120,140,-88));
    for(let y=1095;y<1220;y+=16){
      masonry.fillStyle(0x916f70);masonry.fillRect(x-60,y,120,2);
      masonry.fillStyle(0x423342);masonry.fillRect(x-60,y+11,120,4);
    }
  }
  for (const house of buildings) {
    const market = house.kind==='market';
    const frame = market ? 'gallery' : house.kind==='guide' ? 'guide' : 'workshop';
    const x = house.x+house.w/2, foot = house.y+house.h;
    const sprite=scene.add.image(x,foot,key('props'),frame).setOrigin(.5,1).setDepth(foot);
    sprite.setScale((house.w+24)/sprite.width);
    layer.add(sprite);
    occludes(sprite,house);
    const title = market ? '木廊市集' : house.kind==='guide' ? '临江导览 · 临街 1F' : '木作楼 · 临街 2F';
    layer.add(scene.add.text(x,foot-(market?94:105),title,{
      fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:'17px',
      color:'#fae9d5',backgroundColor:'#302631',padding:{x:9,y:5},
    }).setOrigin(.5).setDepth(foot+1));
    if(!market){
      light.fillStyle(0x654c51);light.fillRect(x-32,foot+31,64,12);
      light.fillStyle(0xd1a889);light.fillRect(x-32,foot+31,64,3);
    }
    if (market) {
      // Low thresholds on the real side approaches, under the walking layer.
      const thresholds=scene.add.graphics().setDepth(-62);layer.add(thresholds);
      for (const side of [-1,1]) {
        const entryX=x+side*(house.w/2+23);
        thresholds.fillStyle(0x50414c);thresholds.fillRoundedRect(entryX-19,685,38,37,3);
        thresholds.fillStyle(0x8b675b);thresholds.fillRect(entryX-16,688,32,26);
        thresholds.lineStyle(2,0xc8a183);thresholds.lineBetween(entryX-14,711,entryX+14,711);
      }
      const cloth=scene.add.graphics().setDepth(foot+2);layer.add(cloth);
      for(const [offset,color] of [[-89,0x88534f],[-48,0xa16d50],[53,0x905749]]){
        cloth.fillStyle(0x493744);cloth.fillRoundedRect(x+offset,foot-76,32,33,2);
        cloth.fillStyle(color);cloth.fillRect(x+offset+1,foot-75,30,28);
        cloth.lineStyle(1,0xe0ac7a,.66);cloth.lineBetween(x+offset+3,foot-52,x+offset+27,foot-52);
      }
    }
  }
}

type BankTerrace = Pick<Rect,'x'|'w'>;

type StorybookWater = { graphics: Phaser.GameObjects.Graphics; left:number; right:number; top:number; bottom:number };
export function drawLowerStreet(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer):void {
  const m=EXP_MAPS.lower;
  const graphics=(depth:number)=>{const object=scene.add.graphics().setDepth(depth);layer.add(object);return object;};
  const sign=(x:number,y:number,text:string,depth=y+12,navigation=false)=>{
    const plate=scene.add.text(x,y,text,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:navigation?'18px':'16px',color:navigation?'#f2e8d5':'#fae9d5',
      backgroundColor:navigation?'#122224':'#302631',padding:{x:8,y:5}}).setOrigin(.5).setDepth(depth);
    layer.add(plate);
    if(navigation){const b=plate.getBounds();graphics(depth+1).lineStyle(2,0xe8c35a).lineBetween(b.x+6,b.bottom-1,b.right-6,b.bottom-1);}
  };
  const prop=(frame:string,x:number,y:number,width:number)=>{
    const sprite=scene.add.image(x,y,key('props'),frame).setOrigin(.5,1).setDepth(y);
    sprite.setScale(width/sprite.width);layer.add(sprite);return sprite;
  };
  const bank=graphics(-96);
  bank.fillStyle(0x514153).fillRect(0,0,m.width,m.height);
  layer.add(celMaterial(scene,'stone',0,145,m.width,91,-95).setTint(0xa28a8c));
  layer.add(celMaterial(scene,'street',0,231,m.width,940,-95));
  const paving=graphics(-94);
  paving.fillStyle(0x403449,.39).fillRect(0,230,m.width,260);
  paving.fillStyle(0xaea08e,.18).fillRect(0,548,m.width,107);
  paving.fillStyle(0xa77863,.2).fillRect(0,1006,m.width,144);
  paving.lineStyle(4,0x594852,.55).lineBetween(60,654,m.width-60,654);
  paving.lineStyle(2,0xc5997b,.68).lineBetween(60,652,m.width-60,652);
  paving.lineStyle(3,0x55424d,.36).lineBetween(60,995,m.width-60,995);
  for(let x=30;x<m.width;x+=94){
    paving.fillStyle(0x514253).fillRect(x,161,9,66);
    paving.fillStyle(0xa78273).fillRect(x-3,161,15,4);
  }
  const overhang=graphics(541);
  for(const x of [1020,1150]){
    paving.fillStyle(0x3f3344,.25).fillEllipse(x+17,518,125,65);
    overhang.fillStyle(0x44373b).fillRect(x+16,275,37,257);
    overhang.fillStyle(0x795047).fillRect(x+20,282,27,232);
    overhang.fillStyle(0xaa7859).fillRect(x+21,284,5,218);
    overhang.fillStyle(0x68505a).fillRect(x,522,70,18);
    overhang.fillStyle(0xb1927d).fillRect(x+4,520,62,5);
  }
  for(const house of m.buildings){
    const foot=house.y+house.h,x=house.x+house.w/2;
    paving.fillStyle(0x493744,.42).fillEllipse(x+12,foot+11,house.w+37,52);
    const frame=house.kind==='workshop'?'workshop':house.kind==='tea'?'guide':'gallery';
    const facade=prop(frame,x,foot,house.w+12);
    occludes(facade,house);
    if(house.kind==='market'){
      const doorway=graphics(foot+1);
      doorway.fillStyle(0x2a2630).fillRect(x-27,foot-69,54,67);
      doorway.fillStyle(0xbe9463).fillRect(x-31,foot-70,62,5);
      doorway.fillStyle(0x885c4f).fillRect(x-31,foot-67,5,65);
      doorway.fillRect(x+26,foot-67,5,65);
      for(const side of [-1,1])prop('lantern',x+side*46,foot-27,18);
    }
    sign(x,foot-84,house.name+(house.kind==='workshop'?' · 临街 1F':''),foot+2);
  }
  for(const [x,y,w] of [[431,552,30],[908,551,28],[1378,557,35],[1829,557,39],[919,978,31],[1330,985,38],[348,1134,43],[1670,1122,37]])prop('plant',x,y,w);
  for(const [x,offset] of [[250,-1],[2000,1]]){
    const steps=graphics(-66);
    for(let row=0;row<7;row++){
      const y=574+row*13,start=x-47+row*offset*1.6,width=94+row*2;
      steps.fillStyle(0x81717b).fillRect(start,y,width,9);
      steps.fillStyle(0x55454e).fillRect(start,y+9,width,4);
      steps.fillStyle(0xb19782).fillRect(start+3,y+1,width-6,1);
    }
    steps.lineStyle(4,0x67504c).lineBetween(x-52,572,x-67+offset*10,669);
    steps.lineBetween(x+49,572,x+69+offset*10,669);
    sign(x,676,offset<0?'↑ 西阶回中街':'↑ 东阶回中街',-1,true);
  }
  // The existing exit descends onto a dry landing that turns along this bank.
  // Every tread stays landward of y=1156; the continuous water blocker is unchanged.
  const exit=EXP_TARGETS.find(t=>t.id==='riverfront-down')!;
  const top=exit.y-78,left=exit.x-64,landingY=exit.y+6;
  const stairShadow=graphics(-69);
  stairShadow.fillStyle(0x493744,.35).fillRoundedRect(left-6,top-4,144,94,3);
  layer.add(celMaterial(scene,'street',left,landingY,236,52,-68).setTilePosition(left,landingY-231));
  graphics(-67).fillStyle(0xa77863,.2).fillRect(left,landingY,236,52);
  const riverSteps=graphics(-65);
  for(let row=0;row<7;row++){
    const x=exit.x-52-row*2,y=top+row*12,w=104+row*4;
    riverSteps.fillStyle(0x81717b).fillRect(x,y,w,8);
    riverSteps.fillStyle(0x55454e).fillRect(x,y+8,w,4);
    riverSteps.fillStyle(0xb19782).fillRect(x+3,y+1,w-6,1);
    riverSteps.lineStyle(1,0x67545d).lineBetween(x+w*.45,y+2,x+w*.45,y+7);
  }
  riverSteps.lineStyle(1,0xb19782,.6).lineBetween(left,landingY+2,left+232,landingY+2);
  // A small right turn on the landing leads along dry stone, never into water.
  for(const x of [exit.x+80,exit.x+112]){
    riverSteps.lineStyle(3,0xd2bd91).lineBetween(x,landingY+22,x+8,landingY+28);
    riverSteps.lineBetween(x+8,landingY+28,x,landingY+34);
  }
  const river=graphics(-92);
  river.fillStyle(0x345962).fillRect(0,1160,m.width,140);
  const glints=graphics(-90);
  layer.setData('storybookWater',{graphics:glints,left:20,right:m.width-20,top:1184,bottom:1290});
  const coping=graphics(1162);
  coping.fillStyle(0x51444f).fillRect(0,1158,m.width,24);
  coping.fillStyle(0xa59386).fillRect(0,1156,m.width,5);
  for(const x of [194,417,665,922,1172,1424,1680,1910,2054]){
    coping.fillStyle(0x6a4d46).fillRect(x,1139,9,23);
    coping.fillStyle(0xc2a182).fillRect(x-2,1137,13,4);
  }
  // Reface only the existing coping's vertical face below the landing.
  const landingWall=graphics(1163);
  landingWall.fillStyle(0x62565e).fillRect(left,1158,236,24);
  landingWall.fillStyle(0xa59386).fillRect(left,1156,236,5);
  for(let x=left+24;x<left+236;x+=42){landingWall.lineStyle(2,0x493d47).lineBetween(x,1163,x,1181);}
  sign(exit.x-150,exit.y+8,'↓ 沿江石阶到渡口',-1,true);
  sign(1350,1079,'檐下取景',-1);
}

export function updateStorybookWater(layer: Phaser.GameObjects.Layer,tick:number,reducedMotion:boolean):void {
  const water=layer.getData('storybookWater') as StorybookWater|undefined;
  if(!water)return;
  const phase=reducedMotion?0:Math.floor(tick/2);
  if(layer.getData('waterPhase')===phase)return;
  layer.setData('waterPhase',phase);
  const {graphics,left,right,top,bottom}=water;
  const width=right-left;
  graphics.clear();
  for(let n=0;n<33;n++){
    const x=left+(n*117+phase*(1+n%3))%width;
    const y=top+(n*37)%(bottom-top);
    const strength=.09+.15*(.5+.5*Math.sin(n+phase*.075));
    graphics.lineStyle(2,n%4===0?0xf7c48a:0x9fc8bd,strength);
    graphics.lineBetween(x,y,Math.min(right,x+16+n%7*4),y);
  }
}

function drawBankButtress(bank: Phaser.GameObjects.Graphics, stairEdge: number, outerEdge: number): void {
  const top = UPPER_STAIR_LANDING_Y;
  const height = UPPER_STAIR_END_Y-top;
  const side = Math.sign(outerEdge-stairEdge);
  const faceColors = [0x524455,0x5a485a,0x5f4c59,0x66505d,0x695563];
  for (let dy=0;dy<height;dy+=16) {
    // The lower courses step in toward the stair pier, exposing the scenery
    // around it. Depth is expressed by the front face and its cap.
    const reach = Math.abs(outerEdge-stairEdge)*(1-(dy/height)**1.8);
    const outside = stairEdge+side*reach;
    const left = Math.min(stairEdge,outside), right = Math.max(stairEdge,outside);
    const row = dy/16, y = top+dy;
    bank.fillStyle(0x403442);bank.fillRect(left,y,right-left,16);
    for (let x=left-row%2*17; x<right; x+=34) {
      const lo = Math.max(left,x)+1, hi = Math.min(right,x+34)-1;
      if (hi<=lo) continue;
      bank.fillStyle(faceColors[Math.abs(Math.floor(x/32)+row*3)%faceColors.length]);
      bank.fillRect(lo,y+1,hi-lo,13);
      bank.fillStyle(row<2 ? 0xa47f76 : 0x816873,.62);
      bank.fillRect(lo,y+1,hi-lo,2);
    }
    bank.fillStyle(0xa1837a,.6);bank.fillRect(left,y,Math.min(7,right-left),4);
  }
  bank.lineStyle(5,0xa5897e);bank.lineBetween(outerEdge,top,stairEdge,top);
  bank.lineStyle(4,0x8b6f6d);bank.lineBetween(stairEdge,top,stairEdge,UPPER_STAIR_END_Y);
}

function drawUpperRiverbank(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, width: number, west: BankTerrace, east: BankTerrace): void {
  const edge = UPPER_STREET_EDGE_Y, landing = UPPER_STAIR_LANDING_Y;
  const valley = scene.add.image(0,edge,key('riverCity')).setOrigin(0)
    .setDisplaySize(width,562).setDepth(-96);
  const bank = scene.add.graphics().setDepth(-72);
  const surface=scene.add.graphics().setDepth(-95);
  layer.add([valley,surface,bank]);
  // The painted inlet bends around the slopes. The inner band stays inside
  // open water at every row and excludes the foreground roofs and islets.
  layer.setData('storybookWater',{graphics:surface,left:width*.30,right:width*.78,top:edge+342,bottom:edge+426} satisfies StorybookWater);
  const terraces = [[west,WEST_STREET_JOIN.x],[east,UPPER_EAST_STAIR_X]] as const;
  for (const [wing,stair] of terraces) {
    layer.add(celMaterial(scene,'stone',wing.x,edge,wing.w,landing-edge,-89));
    for (const side of [-1,1]) {
      const x = stair + side*UPPER_STAIR_RAIL_HALF_WIDTH;
      const end = side<0 ? wing.x : wing.x+wing.w;
      drawBankButtress(bank,x,end);
    }
    const foot = UPPER_STAIR_END_Y-2;
    bank.fillStyle(0x483541,.82);
    bank.fillPoints([{x:stair-80,y:foot},{x:stair+83,y:foot},{x:stair+100,y:foot+18},
      {x:stair+76,y:foot+35},{x:stair-63,y:foot+38},{x:stair-88,y:foot+23}],true);
    layer.add(celMaterial(scene,'stone',stair-76,foot,157,23,-71));
  }
  // The rail follows the bank contour, leaving the two stair mouths open.
  const rail = scene.add.graphics().setDepth(edge+1);
  layer.add(rail);
  const railSection = (left: number, right: number, y: number) => {
    rail.lineStyle(9,0x59463a); rail.lineBetween(left,y-11,right,y-11);
    rail.lineStyle(3,0xc1a67b); rail.lineBetween(left,y-14,right,y-14);
    const posts = Math.ceil((right-left)/54);
    for (let n=0;n<=posts;n++) {
      const x = Phaser.Math.Linear(left,right,n/posts);
      rail.fillStyle(0x745b48); rail.fillRect(x-3,y-16,7,26);
      rail.fillStyle(0xcdad80); rail.fillRect(x-5,y-19,11,5);
    }
  };
  railSection(west.x+west.w,east.x,edge);
  for (const [wing,x] of terraces) {
    railSection(wing.x,x-UPPER_STAIR_RAIL_HALF_WIDTH,landing);
    railSection(x+UPPER_STAIR_RAIL_HALF_WIDTH,wing.x+wing.w,landing);
    drawStreetStairs(scene,layer,true,x);
  }
}

export function drawStorybookSample(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, s: ExplorationSnapshot): void {
  const m = EXP_MAPS[s.map], b = m.bounds;
  const g = (depth: number) => { const v = scene.add.graphics().setDepth(depth); layer.add(v); return v; };
  const tile = (frame: CelMaterial, r: Rect, depth: number) => {
    const v = celMaterial(scene,frame,r.x,r.y,r.w,r.h,depth);
    layer.add(v); return v;
  };
  const prop = (frame: string, x: number, bottom: number, width: number, depth = bottom) => {
    const v = scene.add.image(x,bottom,key('props'),frame).setOrigin(.5,1).setDepth(depth);
    v.setScale(width / v.width); layer.add(v); return v;
  };
  const label = (x: number, y: number, text: string, size = 18, depth = -5) => {
    const v = scene.add.text(x,y,text,{fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:`${size}px`,
      color:'#514336',backgroundColor:'#f7e8c9',padding:{x:10,y:5}}).setOrigin(.5).setDepth(depth);
    layer.add(v); return v;
  };
  const stairs = (x: number, y: number, w: number, h: number) => {
    tile('stone',{x,y,w,h},-65);
    const steps = g(-64);
    for (let n = 0; n < h; n += 20) {
      steps.fillStyle(0x4e4255,.44); steps.fillRect(x,y+n+16,w,4);
      steps.lineStyle(2,0xbea99e,.8); steps.lineBetween(x,y+n,x+w,y+n);
    }
    // These are painted stair edges, not solid rails across a walkable floor.
    steps.lineStyle(4,0x987958); steps.lineBetween(x,y,x,y+h); steps.lineBetween(x+w,y,x+w,y+h);
  };

  const backdrop = g(-100);
  backdrop.fillStyle(s.map === 'upper' ? 0x756b7c : 0x545365); backdrop.fillRect(0,0,m.width,m.height);
  if (s.map === 'upper') {
    backdrop.fillStyle(0x5c5860); backdrop.fillRect(0,m.height-100,m.width,280);
    // Soft hill silhouettes behind the façades are outside the walkable plane.
    const distant = g(-98);
    distant.fillStyle(0xb88f89);distant.fillRect(0,0,m.width,b.y);
    for (const [level, color] of [[0,0x9c8192],[1,0x7c7188]] as const) {
      const points = [{x:0,y:b.y}];
      for (let x=0;x<=m.width;x+=100) {
        points.push({x,y:104+level*36+Math.sin(x/211+level)*33+Math.cos(x/97)*10});
      }
      points.push({x:m.width,y:b.y});
      distant.fillStyle(color);distant.fillPoints(points,true);
    }
    for (let i = 0; i < 32; i++) {
      const x = i * 74 - 40, h = 38 + (i * 37 % 92);
      distant.fillStyle(i % 3 ? 0x776877 : 0x857180,.55); distant.fillRect(x,210-h,50,h);
      distant.fillStyle(0xe5ad70,.43);
      for (let y = 218-h; y < 200; y += 19) distant.fillRect(x+12,y,7,9);
    }
    tile('street',{...b,h:UPPER_STREET_EDGE_Y-b.y},-90);
    const light=g(-87);
    for(const [x,w,y] of [[454,440,562],[1308,510,571],[2021,330,560]]){
      light.fillStyle(0xf2bb7c,.08).fillEllipse(x,y+90,w,164);
      light.fillStyle(0xf2bb7c,.08).fillEllipse(x+13,y+85,w*.75,128);
    }
    tile('floor',{x:420,y:736,w:1520,h:64},-85);
    const streetShade=g(-82);
    streetShade.fillStyle(0x3a3048,.13).fillRect(60,220,2080,124);
    for(const house of m.buildings){
      const foot=house.y+house.h;
      streetShade.fillStyle(0x342535,.25).fillPoints([{x:house.x-22,y:foot-21},{x:house.x+house.w+28,y:foot-15},{x:house.x+house.w-18,y:foot+72},{x:house.x-72,y:foot+65}],true);
      streetShade.fillStyle(0x342535,.18).fillEllipse(house.x+house.w/2,foot+3,house.w+60,31);
    }
    const edges = g(-80);
    edges.fillStyle(0x8e7962); edges.fillRect(420,735,1520,3);
    const cliff = m.walls[m.buildings.length+1];
    drawUpperRiverbank(scene,layer,m.width,
      {x:b.x,w:cliff.x-b.x},
      {x:cliff.x+cliff.w,w:b.x+b.w-cliff.x-cliff.w});
    label(780,762,'栏边望江',15);
    for (const house of m.buildings) {
      const frame = house.kind === 'guide' ? 'guide' : house.kind === 'workshop' ? 'workshop' : 'gallery';
      const bottom = house.y + house.h;
      // A shallow footing expresses the exact collision footprint. Roofs keep
      // their original ratio and may project over the legal north back lane.
      const base = g(-70);
      base.fillStyle(0x53454b,.72).fillRoundedRect(house.x-7,bottom-25,house.w+21,35,5);
      base.fillStyle(0x9d8779,.69).fillRoundedRect(house.x-5,bottom-24,house.w+16,27,5);
      base.lineStyle(2,0xc09b77,.48).lineBetween(house.x+7,bottom+2,house.x+house.w-4,bottom+2);
      const sprite = scene.add.image(house.x+house.w/2,bottom,key('props'),frame).setOrigin(.5,1).setDepth(bottom);
      sprite.setScale((house.w+58)/sprite.width); layer.add(sprite); occludes(sprite,house);
      if (house.kind) {
        const board=label(house.x+house.w/2,bottom-112,house.kind==='guide'?'临江导览 · 临街 2F':'木作楼 · 临街 3F',16,bottom+1);
        if(house.kind==='guide')board.setName('viewport-guide-sign').setData('viewportHome',{x:board.x,y:board.y,text:board.text});
        const threshold=g(-60); threshold.fillStyle(0xf2ddb3); threshold.fillRoundedRect(house.x+house.w/2-40,bottom+2,80,12,3);
      }
    }
    const leaves=g(-55);
    for(const [x,y,w] of [[65,554,100],[430,554,105],[920,513,70],[1240,489,105],[1845,559,95],[1947,725,120],[284,790,128]]){
      for(let i=0;i<22;i++){
        const xx=x+(i*37)%w,yy=y+(i*17)%39;
        leaves.fillStyle([0x806347,0x7e7755,0xb78051,0x5c5d50][i%4],.6).fillEllipse(xx,yy,3+i%6,2+i%3);
      }
    }
    for (const [i,display] of UPPER_SHOP_DISPLAYS.entries()) {
      const x = display.x+display.w/2, foot = display.y+display.h;
      prop('desk',x,foot,display.w);
      const goods = g(foot+1);
      if (i===0) {
        for (const [offset, color] of [[-14,0xa55448],[-3,0x6b7975],[8,0xcfaf79]]) {
          goods.fillStyle(color); goods.fillRoundedRect(x+offset,foot-31,10,7,1);
        }
      } else {
        goods.fillStyle(0xb67c50); goods.fillRect(x-18,foot-31,36,5);
        goods.fillStyle(0xe2a677); goods.fillRect(x-12,foot-34,31,4);
      }
    }
    label(190,712,'← 沧白路入口',16);
    label(110,825,'山纹杂物门',14);
    addUpperStreetResidents(scene,layer);
  } else {
    tile('floor',b,-90);
    // Flat woven runners define reading areas without inventing furniture.
    const rug=g(-88);
    for(const r of [{x:215,y:270,w:280,h:340},{x:790,y:230,w:330,h:205}]){
      rug.fillStyle(0x758e83,.32);rug.fillRoundedRect(r.x,r.y,r.w,r.h,5);
      rug.lineStyle(3,0xf0d9b3,.8);rug.strokeRoundedRect(r.x+10,r.y+10,r.w-20,r.h-20,4);
      for(let x=r.x+12;x<r.x+r.w-8;x+=12){rug.lineStyle(1,0xf2ddbd,.4);rug.lineBetween(x,r.y-5,x,r.y+4);rug.lineBetween(x,r.y+r.h-4,x,r.y+r.h+5);}
    }
    tile('plaster',{x:b.x,y:75,w:b.w,h:105},-80);
    tile('wood',{x:b.x-14,y:68,w:b.w+28,h:12},-79);
    for (const x of [b.x-14,b.x+b.w]) tile('wood',{x,y:80,w:14,h:760},-70);
    for (const x of [330,930]) prop('window',x,173,112,-69);
    const skirting=g(-68); skirting.lineStyle(7,0x9a7450); skirting.lineBetween(b.x,180,b.x+b.w,180);
    for (const [i,wall] of m.walls.entries()) {
      if (i===0) {
        const screen=tile('wood',{x:wall.x,y:wall.y-40,w:wall.w,h:wall.h+40},wall.y+wall.h);
        occludes(screen,wall);
        const cap=g(-65);cap.fillStyle(0x684e3c,.4);cap.fillRect(wall.x+wall.w,wall.y,13,wall.h);
      } else {
        // Props fit the real footprint; art height can extend north, never
        // changing where the player stops or where the investigation occurs.
        const item=prop(i===2?'cabinet':'desk',wall.x+wall.w/2,wall.y+wall.h,wall.w);
        item.setDisplaySize(wall.w, i===2 ? 130 : 84);
        occludes(item,wall);
      }
    }
    const note=EXP_TARGETS.find(t=>t.id==='note')!;
    const paper=g(-10);paper.fillStyle(0xf7e8be);paper.fillRoundedRect(note.x-26,note.y-17,52,34,3);
    paper.lineStyle(2,0x6d8073);paper.strokeTriangle(note.x-19,note.y+9,note.x-11,note.y-9,note.x-3,note.y+9);
    for (const y of [-7,1,9]) paper.lineBetween(note.x+4,note.y+y,note.x+18,note.y+y-3);
    label(note.x+15,note.y-72,'纹样展柜',20,301).setName('route01-guide-cabinet');
    stairs(252,705,96,70);
    tile('stone',{x:1058,y:710,w:84,h:76},-65);
    label(360,235,'临窗阅览',17);
    // Window light is on the floor, with no screen-wide tint above the player.
    const sun=g(-66);sun.fillStyle(0xffedc1,.13);
    for(const x of [275,875])sun.fillPoints([{x,y:182},{x:x+76,y:182},{x:x+140,y:290},{x:x+42,y:290}],true);
  }
}
