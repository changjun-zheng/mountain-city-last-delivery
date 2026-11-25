import {WEST_STREET_JOIN} from './exploration-c-routes.ts';
import {EXP_MAPS, EXP_SAFE, EXP_TARGETS, segmentHitsRect, type ExplorationMap, type ExplorationTarget, type Point, type Rect, type TargetId} from './exploration-content.ts';

export const WALKER_RADIUS = 12;
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function interactionAt(map: ExplorationMap, position: Point, walls: readonly Rect[]): ExplorationTarget | undefined {
  let closest: ExplorationTarget | undefined;
  let range = 64;
  for (const target of EXP_TARGETS) {
    if (target.map !== map) continue;
    const proximity = distance(position, target);
    if (proximity > range || (closest && proximity === range) || walls.some(wall => segmentHitsRect(position, target, wall))) continue;
    closest = target;
    range = proximity;
  }
  return closest;
}

// The destination stays at the next usable interaction. Each door, stair and
// quest action is still chosen by the player through the normal controls.
export function planExplorationRoute(map: ExplorationMap, from: Point, walls: readonly Rect[], goal: TargetId, unlocked: boolean) {
  const destination = EXP_TARGETS.find(target => target.id === goal);
  if (!destination) return;
  const links = EXP_TARGETS.filter(target => target.destination && (!target.locked || unlocked));
  const hops = new Map<ExplorationMap, number>([[destination.map, 0]]);
  const pending = [destination.map];
  for (const toward of pending) {
    for (const link of links) {
      if (EXP_SAFE[link.destination!].map !== toward || hops.has(link.map)) continue;
      hops.set(link.map, hops.get(toward)! + 1);
      pending.push(link.map);
    }
  }
  const remaining = hops.get(map);
  if (remaining === undefined) return;
  const targets = map === destination.map ? [destination] : links.filter(link => link.map === map && hops.get(EXP_SAFE[link.destination!].map) === remaining - 1);
  const ids = new Set(targets.map(target => target.id));
  const matchingTarget = (point: Point) => {
    if (!targets.some(target => distance(point, target) <= 49)) return;
    const target = interactionAt(map, point, walls);
    return target && ids.has(target.id) ? target : undefined;
  };
  const atStart = matchingTarget(from);
  if (atStart) return {target: atStart, points: [] as Point[]};

  const radius = WALKER_RADIUS;
  const inflated = walls.map(({x,y,w,h}) => ({x:x-radius,y:y-radius,w:w+radius*2,h:h+radius*2}));
  const join = WEST_STREET_JOIN;
  const seam = map === 'upper' ? join.upperY : map === 'middle' ? join.middleY : undefined;
  const clear = (a: Point, b: Point) => {
    if (seam !== undefined && a.y !== b.y && Math.min(a.y,b.y) <= seam && Math.max(a.y,b.y) >= seam) {
      const x = a.x+(b.x-a.x)*(seam-a.y)/(b.y-a.y);
      if (Math.abs(x-join.x) <= join.halfWidth+2) return false;
    }
    return !inflated.some(wall => segmentHitsRect(a,b,wall));
  };
  const bounds = EXP_MAPS[map].bounds;
  const spacing = 16;
  const left = bounds.x + radius;
  const top = bounds.y + radius;
  const cols = Math.floor((bounds.w - radius * 2) / spacing) + 1;
  const rows = Math.floor((bounds.h - radius * 2) / spacing) + 1;
  const visited = new Int32Array(cols * rows).fill(-2);
  const queue: number[] = [];
  const pointAt = (index: number) => ({x: left + index % cols * spacing, y: top + Math.floor(index / cols) * spacing});
  const enqueue = (col: number, row: number, parent: number, origin: Point) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const index = row * cols + col;
    if (visited[index] !== -2) return;
    const point = pointAt(index);
    if (inflated.some(wall => point.x > wall.x && point.x < wall.x+wall.w && point.y > wall.y && point.y < wall.y+wall.h) || !clear(origin, point)) return;
    visited[index] = parent;
    queue.push(index);
  };
  const col = Math.floor((from.x-left)/spacing), row = Math.floor((from.y-top)/spacing);
  for (const y of [row,row+1]) for (const x of [col,col+1]) enqueue(x,y,-1,from);
  for (const index of queue) {
    const point = pointAt(index);
    const target = matchingTarget(point);
    if (target) {
      const raw: Point[] = [];
      for (let node = index; node !== -1; node = visited[node]) raw.push(pointAt(node));
      raw.reverse();
      const points: Point[] = [];
      let origin = from;
      for (let next = 0; next < raw.length;) {
        let farthest = raw.length - 1;
        while (farthest > next && !clear(origin, raw[farthest])) farthest--;
        origin = raw[farthest];
        points.push(origin);
        next = farthest + 1;
      }
      return {target, points};
    }
    const x = index % cols, y = Math.floor(index / cols);
    enqueue(x-1,y,index,point);
    enqueue(x+1,y,index,point);
    enqueue(x,y-1,index,point);
    enqueue(x,y+1,index,point);
  }
}
