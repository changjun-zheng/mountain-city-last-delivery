import Phaser from 'phaser';
import type {ExplorationSnapshot} from '../../core/exploration';
import {EXP_TARGETS} from '../../core/exploration-content';
import {C_BARRIERS,WEST_STREET_JOIN} from '../../core/exploration-c-routes';
import {gateOpeningFraction,routeCues} from '../exploration-feedback';

const ink=0x302631,paper=0xfae9d5,gold=0xf0ba82,wood=0x805347;
// The plates name existing landing connections; they never imply a new doorway.
export function drawRouteCues(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void{
  const ink=0x122224,paper=0xf2e8d5,gold=0xe8c35a;
  for(const t of routeCues(s)){
    if(t.id===WEST_STREET_JOIN.down||t.id===WEST_STREET_JOIN.up)continue;
    if(s.map==='middle'&&(t.id==='guide-middle-door'||t.id==='workshop-middle-door'))continue;
    if(s.map==='upper'||s.map==='guide2'){
      // Flat wayfinding sits beneath the traveller, not a sign across the lane.
      const floor=scene.add.graphics().setDepth(-4);layer.add(floor);
      floor.lineStyle(2,gold,.65);floor.strokeRoundedRect(t.x-36,t.y-13,72,26,9);
      const label=scene.add.text(t.x,t.y+34,t.label,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'16px',color:'#f2e8d5',backgroundColor:'#122224',padding:{x:8,y:4}}).setOrigin(.5).setDepth(-3);layer.add(label);
      continue;
    }

    const outsideGate=t.id==='middle-east-lower'||t.id==='middle-west-lower';
    const woodExit=t.id==='workshop-exit';
    // Offset edge signs from the bottom HUD and the moving barrier itself.
    const woodDown=t.id==='workshop-down-2',woodStreet=t.id==='workshop-middle-exit';
    const localWood=woodDown||woodStreet;
    const plateX=t.x+(woodDown?200:woodStreet?-40:outsideGate?(t.x<1000?260:-260):woodExit?200:0);
    const y=woodDown?t.y-80:woodStreet?t.y+90:outsideGate?t.y-20:woodExit?t.y-55:Math.min(t.y+52,s.worldHeight-26);
    const depth=localWood?1000:y+1;
    const g=scene.add.graphics().setDepth(depth);layer.add(g);
    if(outsideGate||woodExit||localWood){g.lineStyle(2,paper,.7);g.lineBetween(t.x,t.y+12,plateX,y);}
    g.fillStyle(ink,.96);g.fillRoundedRect(plateX-118,y-21,236,t.closed?66:42,4);
    g.lineStyle(2,gold);g.lineBetween(plateX-116,y-20,plateX+116,y-20);
    const x=plateX-98;
    g.lineStyle(3,paper);
    if(t.closed){g.strokeRoundedRect(x-9,y-3,18,15,2);g.beginPath();g.arc(x,y-3,7,Math.PI,0);g.strokePath();}
    else if(t.kind==='door'){g.strokeRect(x-8,y-12,16,26);g.lineBetween(x-8,y+14,x+12,y+14);g.fillStyle(gold);g.fillCircle(x+3,y+1,2);}
    else {const d=t.kind==='up'?-1:1;g.lineBetween(x,y-12,x,y+12);g.lineBetween(x,y+d*12,x-7,y+d*4);g.lineBetween(x,y+d*12,x+7,y+d*4);}
    const label=scene.add.text(plateX+12,y,t.label,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:localWood?'20px':'18px',color:'#f2e8d5'}).setOrigin(.5).setDepth(depth+1);layer.add(label);
    if(localWood)label.setName(woodDown?'viewport-wood-down-sign':'viewport-wood-street-sign').setData('viewportBounds',{x:plateX-118,y:y-21,width:236,height:42});
    if(t.closed){const detail=scene.add.text(plateX,y+30,t.detail,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'15px',color:'#e8c35a'}).setOrigin(.5).setDepth(y+2);layer.add(detail);}
    // A narrow lit threshold draws attention without filling the walking surface.
    g.lineStyle(3,t.closed?gold:paper,.8);g.lineBetween(t.x-28,t.y+12,t.x+28,t.y+12);
  }
}

// Only two actual middle-street barrier rectangles participate in this display.
// Core opens immediately; the moving rail is cosmetic and never delays travel.
export function drawGateFeedback(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot,startTick?:number){
  if(s.map!=='middle')return;
  const t=EXP_TARGETS.find(t=>t.id==='gate')!;
  const panel=scene.add.graphics().setDepth(t.y+20),rails=scene.add.graphics().setDepth(1120);layer.add([panel,rails]);
  const title=scene.add.text(t.x-70,t.y-74,s.unlocked?'江纹栈门 · 已开路':'江纹栈门 · 门扣比对',{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'19px',color:'#f2e8d5',backgroundColor:'#122224',padding:{x:12,y:7}}).setOrigin(.5).setDepth(t.y+21);layer.add(title);
  const titleBounds=title.getBounds(),titleRule=scene.add.graphics().setDepth(t.y+22);layer.add(titleRule);
  titleRule.lineStyle(2,0xe8c35a).lineBetween(titleBounds.x+6,titleBounds.bottom-1,titleBounds.right-6,titleBounds.bottom-1);
  let previous=-1;
  return {update(tick:number,reducedMotion:boolean){
    const p=s.unlocked?gateOpeningFraction(startTick,tick,reducedMotion):0;
    if(p===previous)return p;
    previous=p;panel.clear();rails.clear();
    panel.fillStyle(wood);panel.fillRoundedRect(t.x-37,t.y-47,74,38,5);
    panel.lineStyle(3,gold);
    for(const y of [t.y-35,t.y-24])for(let n=0;n<4;n++)panel.lineBetween(t.x-25+n*12,y+(n%2?0:-4),t.x-13+n*12,y+(n%2?-4:0));
    // Handle rotates and retracts from the original investigation point.
    panel.lineStyle(6,0x352f2a);panel.lineBetween(t.x-22,t.y-3,t.x+22*(1-p),t.y-3-24*p);
    panel.fillStyle(gold);panel.fillCircle(t.x-22,t.y-3,5);
    for(const r of C_BARRIERS.middle!){
      if(p<1){rails.fillStyle(ink,.13*(1-p));rails.fillRect(r.x,r.y,r.w,r.h);}
      // Actual blocking line at the north edge of the collision footprint.
      for(const side of [-1,1]){
        const x=side<0?r.x:r.x+r.w,dx=-side*r.w*.5*(1-p),dy=48*p;
        rails.lineStyle(10,wood);rails.lineBetween(x,r.y+3,x+dx,r.y+3+dy);
        rails.lineStyle(3,gold);rails.lineBetween(x,r.y,x+dx,r.y+dy);
        rails.fillStyle(ink);rails.fillRect(x-5,r.y-10,10,26);
        rails.fillStyle(gold);rails.fillCircle(x,r.y-6,4);
      }
      if(p>0){rails.lineStyle(3,0xcfe0c7,p);const x=r.x+r.w/2,y=r.y+27;rails.lineBetween(x,y-9,x,y+13);rails.lineBetween(x,y+13,x-9,y+4);rails.lineBetween(x,y+13,x+9,y+4);}
    }
    return p;
  }};
}
