import type {PhotoSiteId} from '../../core/exploration-photo.ts';

// Original, deterministic game illustration. The same river composition is
// rebuilt for the reward card; it is not a real photograph or saved bitmap.
export function explorationPhotoSvg(site:PhotoSiteId):string {
  const windows=Array.from({length:18},(_,i)=>{
    const x=70+(i%6)*32,y=195+Math.floor(i/6)*57;
    return `<rect x="${x}" y="${y}" width="21" height="33" fill="#ffd58b"/><path d="M${x+10} ${y}v33M${x} ${y+16}h21" stroke="#694432" stroke-width="3"/>`;
  }).join('');
  const tower=site==='window'?'':`<path d="M48 171L263 171L263 410L48 410Z" fill="#a56e49"/><path d="M263 171l47-30v239l-47 30" fill="#694c3c"/><path d="M27 174l42-55h194l56 43-56 15Z" fill="#38565c"/><path d="M49 247h214M49 304h214M49 361h214" stroke="#5c3d30" stroke-width="9"/>${windows}<path d="M64 410v67m59-67v67m60-67v67m60-67v67" stroke="#674b38" stroke-width="11"/>`;
  const foreground=site==='eaves'?`<path d="M0 38L900 58V295L0 253Z" fill="#2c4549"/><path d="M0 253L900 295" stroke="#815d3d" stroke-width="22"/><path d="M65 0v258m145-258v265m145-265v272m145-272v278m145-278v285m145-285v292" stroke="#3d3430" stroke-width="14"/><path d="M0 104l900 43M0 178l900 43" stroke="#55716d" stroke-width="5"/>`:site==='window'?`<path d="M0 0h900v500H0Z M80 48v379h740V48Z" fill="#694b37" fill-rule="evenodd"/><path d="M68 38h763v402H68Z" fill="none" stroke="#b98a55" stroke-width="15"/><path d="M0 441h900v59H0" fill="#9a7049"/>`:'';
  const ripples=Array.from({length:45},(_,i)=>`<path d="M${(i*137)%900} ${290+(i*41)%200}h${30+(i%4)*22}" stroke="${i%3?'#598b96':'#b9bd97'}" opacity=".55" stroke-width="3"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500"><rect width="900" height="500" fill="#1e3b4c"/><path d="M0 202L120 115 240 147 380 98 510 153 650 117 790 147 900 110V290H0Z" fill="#345967"/><rect y="280" width="900" height="220" fill="#356b7b"/>${ripples}<g stroke="#c4c6ad" fill="none"><path d="M300 264L895 233" stroke-width="10"/><path d="M427 83v174M743 93v157" stroke-width="10"/><path d="M427 85L295 263M427 85L590 249M743 95L591 249M743 95L898 234" stroke-width="3"/><path d="M325 256v-25m30 23v-62m30 60V150m208 96v-12m30 10v-56m30 54V155m150 83v-64m30 62v-23" stroke-width="2"/></g>${tower}${foreground}</svg>`;
}
