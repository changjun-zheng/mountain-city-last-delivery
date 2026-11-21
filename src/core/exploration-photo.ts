export type PhotoSiteId = 'eaves' | 'window' | 'river';
export type PhotoElement = 'bridge' | 'water' | 'timber';
export const PHOTO_CARD_ID = 'card.exp02b.night-for-faraway';
export const PHOTO_CONTENT_VERSION = 'exp02b-photo-quest-1';
export const PHOTO_SITES = Object.freeze({
  eaves: Object.freeze({
    id:'eaves', map:'lower',safe:'cLowerRiver', targetId:'photo-eaves', name:'檐下回望', x:1350,y:1050,
    elements:Object.freeze({bridge:'occluded',water:'visible',timber:'visible'}),
    observation:'江水与木楼在画内，前方低檐挡住了桥面。',
  }),
  window: Object.freeze({
    id:'window',map:'tea',safe:'cTeaRoom',targetId:'window',name:'花窗望江',x:800,y:330,
    elements:Object.freeze({bridge:'visible',water:'visible',timber:'outside'}),
    observation:'窗外能看清桥和江水，木楼留在窗框外，没有进入画面。',
  }),
  river: Object.freeze({
    id:'river',map:'riverfront',safe:'riverView',targetId:'view',name:'江边开阔面',x:1950,y:1050,
    elements:Object.freeze({bridge:'visible',water:'visible',timber:'visible'}),
    observation:'桥面、江水与层叠木楼都能清楚地留在同一幅画内。',
  }),
} as const);
export const PHOTO_SITE_IDS: readonly PhotoSiteId[] = Object.freeze(['eaves','window','river']);
export type PhotoMetadata = Readonly<{cardId:typeof PHOTO_CARD_ID;siteId:'river'}>;
export const PHOTO_METADATA:PhotoMetadata=Object.freeze({cardId:PHOTO_CARD_ID,siteId:'river'});
export function missingPhotoElements(site:PhotoSiteId): readonly PhotoElement[] {
  return (['bridge','water','timber'] as const).filter(key=>PHOTO_SITES[site].elements[key]!=='visible');
}
