import type {ExplorationSnapshot} from '../../core/exploration.ts';

// A read-only view of information already committed by the shared runtime.
// Unknown discoveries have no named slots, locations or answer placeholders.
export function projectExplorationJournal(s:ExplorationSnapshot) {
  const discoveries:{title:string;text:string}[]=[];
  if(s.clue)discoveries.push({title:'楼层与纹样',text:'导览记着：江纹向下，山纹留在上层。两道水波与导扣上的纹样相合。'});
  if(s.item)discoveries.push({title:'随身物件 · 江纹导扣',text:'已取得可借的木制导扣，刻着两道水波。错误的用途不会让它消失。'});
  if(s.unlocked)discoveries.push({title:'已开放的路',text:'江纹栈门已经打开，东侧木阶与西回廊可以往返上下层。'});
  return {
    quest:s.accepted?{title:'把山城夜景寄给远方',text:s.photographed?'已经拍下夜景，纪念卡留在这段旅程里。':'游客希望把桥、江水与木楼留在同一幅画面里。',status:s.photographed?'已完成':'进行中'}:
      {title:'尚未接到委托',text:'先在街区走走，与遇见的人交谈。',status:'待发现'},
    discoveries,
    observations:s.observations.map(o=>({id:o.id,title:o.name,text:o.observation})),
    canReviewCard:s.photographed,
  };
}
