import type Phaser from 'phaser';

// Rebuilt scene assets. Old plates stay on disk for history but are no longer loaded.
export const ASSETS:Record<string,string>={
 farCity:new URL('./assets/scene2/far_city.jpg',import.meta.url).href,
 slab:new URL('./assets/scene2/slab.jpg',import.meta.url).href,
 tea:new URL('./assets/scene2/tea.png',import.meta.url).href,
 shop:new URL('./assets/scene2/shop.png',import.meta.url).href,
 gate:new URL('./assets/scene2/gate.png',import.meta.url).href,
 npcOld:new URL('./assets/scene2/npc.png',import.meta.url).href,
 charM:new URL('./assets/char_male.png',import.meta.url).href,
 charF:new URL('./assets/char_female.png',import.meta.url).href,
};
const warned=new Set<string>();
export function preloadPhotoAssets(scene:Phaser.Scene){
 scene.load.on('loaderror',(file:{key:string})=>{if(!warned.has(file.key)){warned.add(file.key);console.warn(`Photo prototype asset missing: ${file.key}; using aligned fallback.`);}});
 for(const[key,url]of Object.entries(ASSETS))scene.load.image(`photo-${key}`,url);
}
export function preparePhotoAssets(_scene:Phaser.Scene){
 // Generated plates already carry alpha; nothing to patch at runtime.
}
