import type {ExplorationSnapshot} from '../../core/exploration.ts';

// A read-only view of information already committed by the shared runtime.
// Directions repeat known NPC/guide information, not undiscovered photo answers.
export function explorationDialogueAction(s:Pick<ExplorationSnapshot,'inspectingMemento'|'pending'|'accepted'|'clue'|'item'|'unlocked'>):string {
  if(s.inspectingMemento&&s.pending)return '收进纪念册 · E';
  if(s.pending==='accepted'&&!s.accepted)return '接受委托 · E';
  if(s.pending==='clue'&&!s.clue)return '记下导览 · E';
  if(s.pending==='item'&&!s.item)return '带上导扣 · E';
  if(s.pending==='unlocked'&&!s.unlocked)return '转动导扣，开门 · E';
  if(s.pending==='ferry-out'||s.pending==='ferry-back')return '上船 · E';
  return '收起 · E';
}
export function projectExplorationJournal(s:ExplorationSnapshot) {
  const discoveries:{title:string;text:string}[]=[];
  if(s.clue)discoveries.push({title:'楼层与纹样',text:'导览记着：江纹向下，山纹留在上层。木作楼3F的导扣刻着两道水波，与中街东侧江纹栈门相合。导览2F接上街，1F出中街。'});
  if(s.item)discoveries.push({title:'随身物件 · 江纹导扣',text:'已取得可借的木制导扣，刻着两道水波。错误的用途不会让它消失。'});
  if(s.unlocked)discoveries.push({title:'已开放的路',text:'江纹栈门已经打开，中街两端外阶与木作1F门都能通往下街，原路可以返回。'});
  return {
    quest:s.accepted?{title:'把山城夜景寄给远方',text:s.photographed?'已经拍下夜景，委托完成；无需返回找游客，纪念卡可在这里重看。':'游客希望把桥、江水与木楼留在同一幅画面里。游客提到：上街导览楼2F有楼层示意，木作楼3F保管旧门扣。',status:s.photographed?'已完成':'进行中'}:
      {title:'尚未接到委托',text:'沿步行街向东前往沧白路，在入口与游客交谈。',status:'待发现'},
    direction:s.objective,
    discoveries,
    observations:s.observations.map(o=>({id:o.id,title:o.name,text:o.observation})),
    canReviewCard:s.photographed,
    mementos:(s.mementos??[]).map(m=>({id:m.id,title:m.name,text:m.text})),
    mementoTitle:s.mementoTitle,
  };
}
