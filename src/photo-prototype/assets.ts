import type Phaser from 'phaser';

// One asset manifest, bundled by Vite; originals remain untouched.
export const ASSETS:Record<string,string>={
 world:new URL('./assets/bg_world2.jpg',import.meta.url).href,
 charM:new URL('./assets/char_male.png',import.meta.url).href,
 charF:new URL('./assets/char_female.png',import.meta.url).href,
 sky:new URL('./assets/bg_sky.jpg',import.meta.url).href,
 river:new URL('./assets/bg_river.jpg',import.meta.url).href,
 ground:new URL('./assets/ground_stone.jpg',import.meta.url).href,
 stair:new URL('./assets/ground_stair.png',import.meta.url).href,
 houseA:new URL('./assets/bld_house_a.png',import.meta.url).href,
 houseB:new URL('./assets/bld_house_b.png',import.meta.url).href,
 corridor:new URL('./assets/bld_corridor.png',import.meta.url).href,
 tree:new URL('./assets/prop_tree.png',import.meta.url).href,
 lantern:new URL('./assets/prop_lantern.png',import.meta.url).href,
};
const warned=new Set<string>();
export function preloadPhotoAssets(scene:Phaser.Scene){
 scene.load.on('loaderror',(file:{key:string})=>{if(!warned.has(file.key)){warned.add(file.key);console.warn(`Photo prototype asset missing: ${file.key}; using aligned fallback.`);}});
 for(const[key,url]of Object.entries(ASSETS))scene.load.image(`photo-${key}`,url);
 // Player sheets are explicitly absent this round: no failed HTTP requests.
}

export function preparePhotoAssets(scene:Phaser.Scene){
 if(scene.textures.exists('photo-corridor'))scene.textures.get('photo-corridor').add('visible',0,7,159,287,125);
 if(!scene.textures.exists('photo-river'))return;
 const original=scene.textures.get('photo-river').getSourceImage() as HTMLImageElement;
 const softened=scene.textures.createCanvas('photo-river-soft',original.width,original.height);
 if(!softened)return;
 const ctx=softened.context;ctx.drawImage(original,0,0);
 // Composite the supplied image, without painting replacements or editing it.
 const fade=ctx.createLinearGradient(0,0,0,original.height);fade.addColorStop(0,'rgba(255,255,255,0)');fade.addColorStop(.2,'white');fade.addColorStop(1,'white');
 ctx.globalCompositeOperation='destination-in';ctx.fillStyle=fade;ctx.fillRect(0,0,original.width,original.height);ctx.globalCompositeOperation='source-over';softened.refresh();
}

// Trial stair placement in the real gap between corridor and wood workshop.
// This is visual terrain metadata, never a collision or scoring rectangle.
export const PHOTO_STAIR={x:1250,y:480,w:160,h:150};
