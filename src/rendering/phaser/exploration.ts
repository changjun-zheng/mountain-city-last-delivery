import {drawDistrict} from './exploration-district-art';
import Phaser from 'phaser';
import type { ExplorationRuntime, ExplorationSnapshot } from '../../core/exploration';
import { EXP_MAPS, EXP_GATE, EXP_RIVER, EXP_TARGETS } from '../../core/exploration-content';
import {PHOTO_SITES} from '../../core/exploration-photo';
import {drawPrologueCity} from './exploration-city-art';
import {MEMENTOS} from '../../core/exploration-mementos';
import {drawMemento} from './exploration-memento-art';

// Original procedural artwork for EXP-01. Coordinates are shared with the
// limited content definition; no old side-view assets are used.
const C = { ink: 0x243d48, river: 0x356b78, stone: 0x718e8b, wood: 0x724838, light: 0xffd487, roof: 0x344d55 };
export async function mountExplorationScene(parent: HTMLElement, runtime: ExplorationRuntime, sampled: () => void) {
  if (!document.createElement('canvas').getContext('2d')) throw new Error('Canvas 2D is unavailable.');
  let game: Phaser.Game | undefined;
  let disposed = false;
  let mapObjects = 0;
  let resizeObserver: ResizeObserver | undefined;
  await new Promise<void>((resolve, reject) => {
    game = new Phaser.Game({
      parent, type: Phaser.CANVAS, width: 1100, height: 650, backgroundColor: '#244a59', banner: false,
      autoFocus: false, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: {
        create(this: Phaser.Scene) {
          try {
            const scene = this;
            let map = scene.add.layer();
            let lastMap = '';
            let lastOpen = false;
            let lastItem = false;
            let lastMementos='';
            let previous = { x: 0, y: 0 };
            const poly = (g: Phaser.GameObjects.Graphics, points: number[], color: number, alpha = 1) => {
              g.fillStyle(color, alpha); g.fillPoints(points.reduce<Phaser.Math.Vector2[]>((p, _, i) => {
                if (!(i % 2)) p.push(new Phaser.Math.Vector2(points[i], points[i + 1])); return p;
              }, []), true);
            };
            const rect = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) => { g.fillStyle(color); g.fillRect(x, y, w, h); };
            const text = (x: number, y: number, content: string, size = 18, color = '#ffe4ad') => {
              const t = scene.add.text(x, y, content, { fontFamily: 'KaiTi, STKaiti, Microsoft YaHei, serif', fontSize: `${size}px`, color, align: 'center' }).setOrigin(.5);
              map.add(t); return t;
            };
            const lantern = (g: Phaser.GameObjects.Graphics, x: number, y: number) => {
              g.lineStyle(2, C.wood); g.lineBetween(x, y - 22, x, y);
              g.fillStyle(C.light, .12); g.fillCircle(x, y + 7, 30);
              g.fillStyle(0xe89f59); g.fillRoundedRect(x - 10, y - 4, 20, 24, 7);
              rect(g, x - 7, y - 2, 14, 17, C.light); rect(g, x - 7, y + 21, 14, 3, C.wood);
              g.lineStyle(2, 0xc16b41); g.lineBetween(x, y + 24, x, y + 35);
            };
            const building = (x: number, y: number, w: number, h: number, name: string) => {
              const g = scene.add.graphics().setDepth(y + h);
              map.add(g);
              poly(g, [x + 8,y+h,x+w+35,y+h,x+w+60,y+h+22,x+30,y+h+22], C.ink, .25);
              rect(g, x, y, w, h, 0xaf7853);
              poly(g, [x+w,y,x+w+38,y-26,x+w+38,y+h-22,x+w,y+h], 0x583e35);
              for (let p = x + 8; p < x+w; p += 21) rect(g,p,y,2,h,0x986347);
              for (let p = x + 24; p < x+w-20; p += 65) {
                rect(g,p,y+22,39,48,0x493b32); rect(g,p+4,y+26,31,39,C.light);
                rect(g,p+18,y+24,3,44,C.wood); rect(g,p+1,y+43,38,3,C.wood);
              }
              [x+5,x+w-13].forEach(p=>rect(g,p,y,10,h+6,0x4b3832));
              rect(g,x,y+h-10,w,10,0x4b3832);
              poly(g,[x-25,y+3,x+w+12,y+3,x+w+55,y-28,x+w+10,y-60,x+28,y-60],C.roof);
              poly(g,[x-25,y+3,x+w+12,y+3,x+w+9,y+12,x-27,y+12],0x233f48);
              for(let p=x-3;p<x+w;p+=17) { g.lineStyle(2,0x567078);g.lineBetween(p,y,p+42,y-52); }
              g.lineStyle(4,0x223d48);g.lineBetween(x+28,y-60,x+w+10,y-60);
              lantern(g,x+18,y+75);lantern(g,x+w-20,y+75);
              const sign=text(x+w/2,y+13,name,18);sign.setDepth(y+h+1);
              return g;
            };
            function draw(s: ExplorationSnapshot) {
              map.remove([player, ring, hint]);
              map.destroy(true); map = scene.add.layer();
              const definition=EXP_MAPS[s.map];
              const bg=scene.add.graphics().setDepth(-100);map.add(bg);
              rect(bg,0,0,definition.width,definition.height,0x356b78);
              const b=definition.bounds;
              if(s.map==='plaza'||s.map==='entry'||s.map==='service'){
                drawPrologueCity(scene,map,s.map,()=>actor(scene,0xc88c6a,0xdac5a5));
              }else if(s.map==='middle'||s.map==='riverfront'){
                drawDistrict(scene,map,s.map);
              }else if(definition.outdoor){
                for(let y=0;y<240;y+=6){const c=Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x244353),Phaser.Display.Color.ValueToColor(0x61908d),240,y);rect(bg,0,y,3300,6,Phaser.Display.Color.GetColor(c.r,c.g,c.b));}
                poly(bg,[0,190,220,100,400,150,650,70,900,170,1200,95,1500,145,1800,80,2100,180,2450,110,2800,145,3100,70,3300,170,3300,240,0,240],0x315361);
                rect(bg,b.x,b.y,b.w,b.h,0x82958a);
                for(let y=b.y;y<b.y+b.h;y+=38)for(let x=b.x;x<b.x+b.w;x+=72){bg.lineStyle(1,0x657e78,.65);bg.strokeRect(x+(y%3)*10,y,70,36);}
                // Both the front street and the rear cross streets have continuous decking.
                for(const [x,y,w,h] of [[450,540,2290,140],[350,1080,2400,150],[1010,250,150,980],[1850,250,140,980]]){
                  rect(bg,x,y,w,h,0x9a7652);for(let p=x;p<x+w;p+=22){bg.lineStyle(1,0x624e3c,.5);bg.lineBetween(p,y,p,y+h);}
                }
                const backRail=scene.add.graphics().setDepth(241);map.add(backRail);
                const frontRail=scene.add.graphics().setDepth(1250);map.add(frontRail);
                for(const y of [240,1240]){
                  const g=y===240?backRail:frontRail;rect(g,60,y-25,3180,5,0xc09b64);rect(g,60,y,3180,7,0x463d35);
                  for(let x=60;x<3240;x+=44)rect(g,x,y-24,6,31,0x62523f);
                }
                for(const house of definition.buildings){
                  const g=building(house.x,house.y-60,house.w,house.h+60,house.name);
                  // Two rows of windows and structural beams distinguish the larger street fronts.
                  for(let x=house.x+30;x<house.x+house.w-35;x+=65){rect(g,x,house.y+45,36,46,0x493b32);rect(g,x+4,house.y+49,28,37,0xf1c780);rect(g,x+16,house.y+47,3,41,C.wood);}
                  rect(g,house.x,house.y+101,house.w,8,0x4b3832);
                  if(house.kind==='guide'||house.kind==='workshop'||house.kind==='tea'){
                    const x=house.x+house.w/2,y=house.y+house.h;
                    rect(g,x-31,y-81,62,81,0x332f2e);rect(g,x-26,y-76,52,72,0x77563e);rect(g,x-20,y-69,40,32,0xecc480);g.fillStyle(C.light);g.fillCircle(x+16,y-22,3);rect(g,x-39,y,78,8,0xc1a783);
                  }
                }
                for(let x=500;x<2700;x+=360){const lamp=scene.add.graphics().setDepth(680);map.add(lamp);rect(lamp,x,650,7,34,0x614732);lantern(lamp,x+3,611);}
                if(s.map==='upper'){
                  const g=scene.add.graphics().setDepth(1250);map.add(g);
                  for(const wall of definition.walls.slice(definition.buildings.length)){rect(g,wall.x,wall.y,wall.w,wall.h,0x614732);for(let y=wall.y;y<wall.y+wall.h;y+=25)rect(g,wall.x-4,y,wall.w+8,5,0xc69b63);}
                  if(!s.unlocked){rect(g,EXP_GATE.x,EXP_GATE.y,EXP_GATE.w,EXP_GATE.h,0x836345);for(let y=EXP_GATE.y;y<EXP_GATE.y+EXP_GATE.h;y+=20)rect(g,EXP_GATE.x-4,y,EXP_GATE.w+8,5,0xc69b63);}
                  else rect(g,2750,690,8,120,0xc69b63);
                  // Water-wave gate mark is visible without reading the quest UI.
                  g.lineStyle(4,C.light);for(let y=730;y<=748;y+=18){g.beginPath();g.moveTo(2690,y);g.lineTo(2704,y-6);g.lineTo(2718,y);g.lineTo(2732,y-6);g.strokePath();}
                  text(2705,690,'江纹 · 东栈',19).setDepth(1260);
                  text(150,635,'西口回沧白路入口',17).setDepth(1260);
                  text(1110,603,'北檐／南檐岔口',18).setDepth(1260);
                  text(105,808,'山纹杂物廊',16).setDepth(1260);
                  g.lineStyle(4,C.light);g.strokeTriangle(92,838,110,818,128,838);
                }else{
                  rect(bg,EXP_RIVER.x,EXP_RIVER.y,EXP_RIVER.w,EXP_RIVER.h,0x356b78);
                  for(let i=0;i<80;i++)rect(bg,EXP_RIVER.x+(i*137)%1300,1002+(i*43)%230,30+(i%4)*17,2,i%3?0x548b92:0x87a69a);
                  bg.lineStyle(8,0x9faaa0);bg.lineBetween(1870,1150,3230,1080);
                  for(const x of [2150,2900]){rect(bg,x,1000,12,130,0x91a3a0);bg.lineStyle(3,0xb8c1aa);bg.lineBetween(x,1003,x-250,1138);bg.lineBetween(x,1003,x+240,1120);}
                  const rail=scene.add.graphics().setDepth(1251);map.add(rail);rect(rail,1820,990,10,250,0x69533c);for(let y=990;y<1240;y+=30)rect(rail,1805,y,25,7,0xc09b64);
                  text(1680,1055,'江岸阶道入口',20).setDepth(1260);text(900,615,'花窗长廊',18).setDepth(1260);
                  const views=scene.add.graphics().setDepth(1261);map.add(views);
                  for(const site of Object.values(PHOTO_SITES).filter(site=>site.map===s.map)){views.lineStyle(2,0xd8c392,.7);views.strokeEllipse(site.x,site.y,38,16);}
                  text(2180,632,'檐下回望',18).setDepth(1262);
                }
                // Stair landings are paired with explicit map connections, never screen-y teleports.
                for(const target of EXP_TARGETS.filter(t=>t.map===s.map&&['east-down','east-up','west-down','west-up'].includes(t.id))){
                  const stair=scene.add.graphics().setDepth(target.y-1);map.add(stair);
                  for(let i=0;i<7;i++){rect(stair,target.x-54,target.y-35+i*10,108,8, i%2?0x79684e:0xb29a6e);}
                  stair.lineStyle(5,0x4c4438);stair.lineBetween(target.x-62,target.y-47,target.x-62,target.y+34);stair.lineBetween(target.x+62,target.y-47,target.x+62,target.y+34);
                  text(target.x,target.y-62,target.id.startsWith('east')?'东侧木阶':'西回廊',18).setDepth(target.y+80);
                }
                text(420,1160,s.map==='upper'?'上层西口':'下层西口',17).setDepth(1260);
              }else{
                rect(bg,b.x-20,b.y-80,b.w+40,b.h+100,0x243d48);rect(bg,b.x,b.y,b.w,b.h,0xa17d54);
                for(let x=b.x;x<b.x+b.w;x+=26){bg.lineStyle(1,0x765c41);bg.lineBetween(x,b.y,x,b.y+b.h);}
                rect(bg,b.x,b.y-90,b.w,90,0x9e7352);rect(bg,b.x-18,b.y,18,b.h,0x634837);rect(bg,b.x+b.w,b.y,18,b.h,0x4c3c34);
                for(let x=b.x+20;x<b.x+b.w-60;x+=100){rect(bg,x,b.y-75,65,57,0x4e4b3e);rect(bg,x+5,b.y-70,55,47,0x8cafab);rect(bg,x+30,b.y-72,4,51,0x644933);}
                definition.walls.forEach((w,i)=>{const g=scene.add.graphics().setDepth(w.y+w.h);map.add(g);rect(g,w.x,w.y-26,w.w,w.h+26,0x684734);rect(g,w.x-5,w.y-30,w.w+10,30,0xc69d68);if(s.map==='tea'){g.fillStyle(0xe0c292);g.fillCircle(w.x+w.w/2,w.y-18,8);}else for(let x=w.x+10;x<w.x+w.w-15;x+=35)rect(g,x,w.y+6,24,Math.max(8,w.h-12),i%2?0x94714b:0x80614a);});
                if(s.map==='guide'){
                  const g=scene.add.graphics().setDepth(310);map.add(g);rect(g,309,257,62,31,0xf4dfac);g.lineStyle(3,0x5c7b77);g.strokeTriangle(317,280,329,264,341,280);g.lineBetween(345,268,364,264);g.lineBetween(345,277,364,273);text(340,230,'楼层／纹样导览',18).setDepth(320);
                  text(550,300,'北檐上层　东栈下行',17).setDepth(400);
                }else if(s.map==='workshop'){
                  const g=scene.add.graphics().setDepth(416);map.add(g);
                  if(!s.item){rect(g,739,366,42,10,0xf3ce80);g.lineStyle(2,0x5a735f);g.lineBetween(746,369,773,367);g.lineBetween(746,373,773,371);}
                  text(760,444,s.item?'导扣已带走':'可借 · 江纹导扣',16).setDepth(460);
                  text(522,304,'木纹与门扣',19).setDepth(430);
                }else{text(545,242,'窗边茶桌',19).setDepth(460);text(810,525,'可选驻足',17).setDepth(610);}
                const front=scene.add.graphics().setDepth(615);map.add(front);rect(front,b.x,600,315,14,0x644933);rect(front,585,600,b.x+b.w-585,14,0x644933);poly(front,[495,595,585,595,600,615,480,615],0xc7a675);
                text(540,590,'返回原门口',16).setDepth(620);text(550,96,definition.name,25).setDepth(630);lantern(bg,b.x+30,b.y-20);lantern(bg,b.x+b.w-30,b.y-20);
              }
              for(const m of MEMENTOS)if(m.map===s.map)drawMemento(scene,map,m.id,m.x,m.y,s.mementos.some(owned=>owned.id===m.id));
              map.add([player, ring, hint]);mapObjects=map.length;
              scene.cameras.main.setBounds(0,0,definition.width,definition.height);
            }
            const player = actor(scene,0x408b88,0xffe3b2);
            const ring = scene.add.ellipse(0,0,40,15).setStrokeStyle(2,0xffde92).setDepth(20000);
            const hint = scene.add.text(0,0,'◇',{fontSize:'22px',color:'#ffe3a0'}).setOrigin(.5).setDepth(20001);
            const update = () => {
              if(disposed)return;
              runtime.frame(performance.now());
              const s=runtime.snapshot;
              const mementoSignature=s.mementos.map(m=>m.id).join(',');
              if(lastMap!==s.map || lastOpen!==s.unlocked || lastItem!==s.item||lastMementos!==mementoSignature){draw(s);lastMap=s.map;lastOpen=s.unlocked;lastItem=s.item;lastMementos=mementoSignature;}
              const moving=s.position.x!==previous.x || s.position.y!==previous.y;
              player.setPosition(s.position.x,s.position.y).setDepth(s.position.y);
              player.setScale(s.facing.x<0?-.95:.95,.95);
              player.setAngle(moving?Math.sin(s.tick*.8)*2:0);
              previous=s.position;
              const camera=scene.cameras.main;
              camera.setScroll(Math.max(0,Math.min(s.worldWidth-1100,s.position.x-550)),Math.max(0,Math.min(s.worldHeight-650,s.position.y-325)));
              Object.assign(parent.dataset,{cameraX:String(camera.scrollX),cameraY:String(camera.scrollY),zoom:String(camera.zoom),worldWidth:String(s.worldWidth),worldHeight:String(s.worldHeight)});
              ring.setVisible(!!s.target);hint.setVisible(!!s.target);
              if(s.target){ring.setPosition(s.target.x,s.target.y);hint.setPosition(s.target.x,s.target.y-58);}
              parent.dataset.mapObjects=String(mapObjects);
              sampled();
            };
            this.events.on(Phaser.Scenes.Events.UPDATE,update);
            this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.events.off(Phaser.Scenes.Events.UPDATE,update));
            update();
            // Observe the laid-out parent, rather than using the preceding
            // orientation's bounds during a browser resize event.
            const fit = () => {
              if (disposed) return;
              const bounds = parent.getBoundingClientRect();
              scene.scale.setParentSize(bounds.width, bounds.height);
            };
            resizeObserver = new ResizeObserver(fit);
            resizeObserver.observe(parent);
            parent.dataset.resizeObservers = '1';
            fit();
            this.game.events.once(Phaser.Core.Events.POST_RENDER,resolve);
          }catch(error){reject(error);}
        },
      },
    });
  }).catch(error=>{ resizeObserver?.disconnect();game?.destroy(true);throw error; });
  return { destroy: async () => {
    if(disposed)return;
    disposed=true;
    resizeObserver?.disconnect();
    parent.dataset.resizeObservers='0';
    await new Promise<void>(done=>{if(!game){done();return;}game.events.once(Phaser.Core.Events.DESTROY,done);game.destroy(true);game.loop.wake();});
    parent.dataset.mapObjects='0';
  } };
}

function actor(scene: Phaser.Scene, coat: number, skin: number): Phaser.GameObjects.Container {
  const shadow=scene.add.ellipse(0,0,29,11,0x182f36,.35);
  const g=scene.add.graphics();
  g.fillStyle(0x273e49);g.fillRoundedRect(-10,-14,8,15,3);g.fillRoundedRect(3,-14,8,15,3);
  g.fillStyle(coat);g.fillRoundedRect(-14,-35,28,26,7);
  g.fillStyle(skin);g.fillCircle(0,-42,13);g.fillRoundedRect(12,-30,5,14,2);
  g.fillStyle(0x3c3e3c);g.fillEllipse(-2,-51,25,10);g.fillRect(-13,-50,6,13);
  g.fillStyle(0x263f43);g.fillCircle(7,-42,1.8);
  g.lineStyle(4,0xe8c078);g.lineBetween(-7,-33,9,-14);
  return scene.add.container(0,0,[shadow,g]);
}
