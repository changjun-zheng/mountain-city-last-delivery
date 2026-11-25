import Phaser from 'phaser';

export const CEL_STONE_WIDTH = 38;
const STONE_HEIGHT = 21;
export type CelMaterial = 'stone' | 'street' | 'floor' | 'plaster' | 'wood';
export const celMaterialKey = (name: CelMaterial) => `cel-material-${name}`;

type Palette = readonly [joint: string, edge: string, highlight: string, ...field: string[]];
const shade: Palette = ['#565060','#655a6b','#857986','#716676','#736975','#7b6c78','#796c78','#80717b'];

function paintStone(c: CanvasRenderingContext2D, palette: Palette, cols: number, rows: number): void {
  const [joint, edge, highlight, ...fields] = palette;
  c.fillStyle = joint;
  c.fillRect(0,0,cols*CEL_STONE_WIDTH,rows*STONE_HEIGHT);
  for (let row=0;row<rows;row++) {
    for (let col=-1;col<cols;col++) {
      const width = CEL_STONE_WIDTH;
      const x = col*width+(row%2)*19;
      const y = row*STONE_HEIGHT;
      const n = ((col+cols)%cols*17 + row*13 + ((col+cols)%cols*row)%7);
      const cut = 1+n%4;
      const lean = n%3;
      c.beginPath();
      c.moveTo(x+cut,y+1);c.lineTo(x+width-3,y+1+lean);
      c.lineTo(x+width-1,y+5);c.lineTo(x+width-2,y+STONE_HEIGHT-4);
      c.lineTo(x+width-6,y+STONE_HEIGHT-1);c.lineTo(x+3,y+STONE_HEIGHT-1);
      c.lineTo(x+1,y+STONE_HEIGHT-4);c.lineTo(x+1,y+5);c.closePath();
      c.fillStyle = fields[n%fields.length];c.fill();
      c.fillStyle = edge;
      c.fillRect(x+6,y+STONE_HEIGHT-3,width-13,2);
      c.fillStyle = highlight;
      c.fillRect(x+width-4,y+6,1,STONE_HEIGHT-13);
    }
  }
}

export function prepareCelMaterials(scene: Phaser.Scene): void {
  const create = (name: CelMaterial, width: number, height: number, paint: (c: CanvasRenderingContext2D)=>void) => {
    const nameKey = celMaterialKey(name);
    if (scene.textures.exists(nameKey)) return;
    const texture = scene.textures.createCanvas(nameKey,width,height);
    if (!texture) throw new Error(`Cannot prepare painted material ${name}`);
    paint(texture.context);
    texture.refresh();
  };
  create('stone',CEL_STONE_WIDTH*14,STONE_HEIGHT*12,c=>paintStone(c,shade,14,12));
  create('street',504,330,c=>{
    const fields=['#86776f','#84756e','#897970','#827473','#897a73','#8c7a6f','#80736f'];
    c.fillStyle='#685b5b';c.fillRect(0,0,504,330);
    for(let row=0;row<15;row++){
      let x=-(row*23)%63;
      for(let col=0;x<504;col++){
        const y=row*22,z=(row*17+col*21+row*col*3)%29,width=26+z;
        c.fillStyle=fields[(row*13+col*11+z)%fields.length];
        c.beginPath();c.moveTo(x+3,y+1);c.lineTo(x+width-5,y+2);c.lineTo(x+width-1,y+7);
        c.lineTo(x+width-3,y+20);c.lineTo(x+3,y+21);c.lineTo(x+1,y+16);c.lineTo(x+1,y+5);c.fill();
        c.fillStyle='rgba(222,172,127,.12)';c.fillRect(x+5,y+2,width-11,2);
        if(z%4===0){c.fillStyle='rgba(59,56,53,.21)';c.fillRect(x+12,y+11,z/2+3,1);}
        x+=width;
      }
    }
  });
  for (const [name,fields,joint,light] of [
    ['floor',['#795043','#845a48','#8b5d48','#986952'],'#503747','#a87958'],
    ['wood',['#593e42','#634342','#684944','#704a42'],'#442f38','#92624b'],
  ] as const) {
    create(name,280,180,c=>{
      for (let y=0;y<180;y+=18) {
        const row=y/18;
        c.fillStyle=fields[(row*3+(row>4?1:0))%fields.length];c.fillRect(0,y,280,18);
        c.fillStyle=joint;c.fillRect(0,y+16,280,2);
        c.fillRect(row%2===0?96:174,y,1,16);
        c.fillStyle=light;c.fillRect(0,y+1,280,1);
        if(row%3===0)c.fillRect(27+row*11,y+8,46,1);
      }
    });
  }
  create('plaster',12,12,c=>{c.fillStyle='#c59a7a';c.fillRect(0,0,12,12);});
}

export function celMaterial(
  scene: Phaser.Scene, name: CelMaterial, x: number, y: number, width: number, height: number, depth: number,
) {
  return scene.add.tileSprite(x,y,width,height,celMaterialKey(name)).setOrigin(0).setDepth(depth);
}
