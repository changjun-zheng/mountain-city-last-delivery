// Explicit, shared walking steps only. No pathfinding, state writes or test APIs.
export const FLOOR_ROUTES=Object.freeze({
  guideUp:[[340,540],[820,540],'guide-up',[950,700],[950,350]],
  guideBack:[[950,700],[300,700],'guide-down',[820,540],[540,540]],
  workshopUp:[[760,540],[250,540],'workshop-up-2',[1080,700],'workshop-up-3',[760,700],[760,430]],
  workshopBack:[[760,700],[250,700],'workshop-down-2',[250,700],'workshop-down-1',[250,540],[540,540]],
});
export function runFloorRoute(driver,name){for(const step of FLOOR_ROUTES[name]){if(Array.isArray(step))driver.to(...step);else driver.interact(step);}}
export async function runBrowserFloorRoute(page,name,walk,interact){for(const step of FLOOR_ROUTES[name]){if(Array.isArray(step))await walk(page,...step);else await interact(page,step);}}
