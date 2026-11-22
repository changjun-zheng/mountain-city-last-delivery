import type Phaser from 'phaser';

// Whole-plate illustrations plus a small set of movable sprites.
export const ASSETS:Record<string,string>={
 plate0:new URL('./assets/scene2/plate_terrace.jpg',import.meta.url).href,
 plate1:new URL('./assets/scene2/plate_street.jpg',import.meta.url).href,
 npcOld:new URL('./assets/scene2/npc_old.png',import.meta.url).href,
 charM:new URL('./assets/scene2/char_m.png',import.meta.url).href,
 charF:new URL('./assets/scene2/char_f.png',import.meta.url).href,
};
const warned=new Set<string>();
export function preloadPhotoAssets(scene:Phaser.Scene){
 scene.load.on('loaderror',(file:{key:string})=>{if(!warned.has(file.key)){warned.add(file.key);console.warn(`Photo prototype asset missing: ${file.key}; using aligned fallback.`);}});
 for(const[key,url]of Object.entries(ASSETS))scene.load.image(`photo-${key}`,url);
}
export function preparePhotoAssets(_scene:Phaser.Scene){
 // Plates already carry unified lighting; nothing to patch at runtime.
}
