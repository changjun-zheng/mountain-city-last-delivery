import { characterSheet, heroFigure } from './character-sheet.js';

const NS = 'http://www.w3.org/2000/svg';
const query = new URLSearchParams(location.search);
const view = query.get('view') || 'play';
const size = query.get('size') || 'desktop';
const loadingView = view === 'loading';
document.body.dataset.view = loadingView ? 'title' : view;
document.body.dataset.size = size;

const INK = '#122224';
const CREAM = '#f2e8d5';
const YELLOW = '#e8c35a';
const RED = '#d4553d';
const TEAL = '#4f8a7e';

function h(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const R = (x, y, w, hh, fill, extra = {}) =>
  h('rect', { x, y, width: w, height: hh, fill, ...extra });
const C = (cx, cy, r, fill, extra = {}) =>
  h('circle', { cx, cy, r, fill, ...extra });
const E = (cx, cy, rx, ry, fill, extra = {}) =>
  h('ellipse', { cx, cy, rx, ry, fill, ...extra });
const P = (d, fill, extra = {}) => h('path', { d, fill, ...extra });
const T = (x, y, text, size, fill, extra = {}) =>
  h('text', {
    x, y, fill,
    'font-family': '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif',
    'font-size': size,
    ...extra,
  }, text);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261125);

function defs() {
  const stops = (...items) => items.map(([offset, color, opacity]) =>
    h('stop', { offset, 'stop-color': color, 'stop-opacity': opacity ?? 1 }));

  return h('defs', {},
    h('linearGradient', { id: 'sky', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#152a33'], ['.38', '#3d4c57'], ['.62', '#826b73'], ['.79', '#cd8d6b'], ['1', '#efbb87'])),
    h('radialGradient', { id: 'sunGlow', cx: '.5', cy: '.5', r: '.5' },
      ...stops(['0', '#ffe6b5', .9], ['.36', '#f5b66e', .38], ['1', '#f5b66e', 0])),
    h('linearGradient', { id: 'horizonHaze', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#e7b08a', 0], ['.55', '#e7b08a', .2], ['1', '#e7b08a', 0])),
    h('linearGradient', { id: 'fog', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#e7c1a4', 0], ['.5', '#e7c1a4', .22], ['1', '#e7c1a4', 0])),
    h('linearGradient', { id: 'river', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#3b7173'], ['.55', '#275459'], ['1', '#17383f'])),
    h('linearGradient', { id: 'shopWarm', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#f8d596'], ['.55', '#e9a65d'], ['1', '#9d5739'])),
    h('linearGradient', { id: 'shopCool', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#e7eedb'], ['.55', '#b9cfbf'], ['1', '#66877d'])),
    h('radialGradient', { id: 'warmPool', cx: '.5', cy: '.5', r: '.5' },
      ...stops(['0', '#ffd28a', .55], ['1', '#ffd28a', 0])),
    h('radialGradient', { id: 'coolPool', cx: '.5', cy: '.5', r: '.5' },
      ...stops(['0', '#9ed4c8', .25], ['1', '#9ed4c8', 0])),
    h('linearGradient', { id: 'streetShadow', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#102023', .58], ['.6', '#102023', .26], ['1', '#102023', 0])),
    h('linearGradient', { id: 'puddle', x1: '0', y1: '0', x2: '1', y2: '1' },
      ...stops(['0', '#a8cfc8', .3], ['.45', '#5a8a86', .22], ['1', '#1c3e44', .08])),
    h('linearGradient', { id: 'facadeShade', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#0b1819', 0], ['.62', '#0b1819', .06], ['1', '#0b1819', .3])),
    h('linearGradient', { id: 'facadeWarm', x1: '0', y1: '0', x2: '1', y2: '0' },
      ...stops(['0', '#ffc27a', .16], ['.45', '#ffc27a', .02], ['1', '#173b42', .2])),
    h('linearGradient', { id: 'duskGrade', x1: '0', y1: '0', x2: '1', y2: '1' },
      ...stops(['0', '#ffb878', .2], ['.45', '#7a5a6a', .08], ['1', '#16444d', .22])),
    h('linearGradient', { id: 'riverFog', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#b9d8cf', 0], ['.45', '#b9d8cf', .16], ['1', '#b9d8cf', 0])),
    h('linearGradient', { id: 'alleyShade', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#2b3b39', 1], ['.6', '#1e2e2d', 1], ['1', '#132324', 1])),
    h('linearGradient', { id: 'reflectWarm', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#ffc37c', .3], ['.45', '#e79a5a', .12], ['1', '#e79a5a', 0])),
    h('linearGradient', { id: 'reflectCool', x1: '0', y1: '0', x2: '0', y2: '1' },
      ...stops(['0', '#a9d6c9', .2], ['.5', '#6fa79f', .08], ['1', '#6fa79f', 0])),
    h('linearGradient', { id: 'awningRed', x1: '0', y1: '0', x2: '1', y2: '0' },
      ...stops(['0', '#a94334'], ['.5', '#cf6b4d'], ['1', '#a94334'])),
    h('linearGradient', { id: 'awningGreen', x1: '0', y1: '0', x2: '1', y2: '0' },
      ...stops(['0', '#345c52'], ['.5', '#527f6d'], ['1', '#345c52'])),
    h('filter', { id: 'blur4' }, h('feGaussianBlur', { stdDeviation: 4 })),
    h('filter', { id: 'blur8' }, h('feGaussianBlur', { stdDeviation: 8 })),
    h('filter', { id: 'blur16' }, h('feGaussianBlur', { stdDeviation: 16 })),
    h('filter', { id: 'blur24' }, h('feGaussianBlur', { stdDeviation: 24 })),
    h('filter', { id: 'grain' },
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '.82', numOctaves: 2, stitchTiles: 'stitch' }),
      h('feColorMatrix', { type: 'saturate', values: 0 }),
      h('feComponentTransfer', {},
        h('feFuncA', { type: 'table', tableValues: '0 0.09' }))),
    h('filter', { id: 'softShadow' },
      h('feGaussianBlur', { stdDeviation: 6 })),
  );
}

/* ------------------------------------------------------------------ sky */
function sky() {
  const g = h('g', { id: 'sky' });
  g.append(R(0, 0, 1280, 390, 'url(#sky)'));
  g.append(C(1030, 178, 196, 'url(#sunGlow)', { opacity: .95 }));
  for (const [cx, cy, rx, ry, op] of [
    [180, 126, 170, 24, .1], [390, 98, 120, 16, .08], [740, 132, 190, 20, .09],
    [1040, 104, 150, 18, .1], [600, 76, 220, 15, .06],
  ]) {
    g.append(E(cx, cy, rx, ry, '#f0b58e', { opacity: op, filter: 'url(#blur16)' }));
  }
  g.append(R(0, 276, 1280, 120, 'url(#horizonHaze)'));
  g.append(h('path', {
    d: 'M94 116q12-9 24 0M126 106q10-8 20 0M1040 82q10-8 20 0M1080 96q8-7 16 0',
    fill: 'none', stroke: '#2c3f46', 'stroke-width': 1.4, opacity: .6,
    'stroke-linecap': 'round',
  }));
  return g;
}

/* --------------------------------------------------------- distant city */
function distantCity() {
  const g = h('g', { opacity: .82 });
  const colors = ['#3b4b52', '#45575d', '#506269', '#3e5057', '#5b6b70'];
  const towers = [
    [0, 238, 74, 112], [72, 208, 56, 142], [126, 252, 48, 98], [170, 226, 82, 124],
    [246, 200, 56, 150], [300, 244, 66, 106], [354, 224, 48, 126], [398, 258, 58, 92],
    [452, 210, 70, 140], [516, 236, 44, 114], [558, 196, 76, 154], [630, 246, 52, 104],
    [678, 218, 64, 132], [738, 250, 48, 100], [782, 206, 74, 144], [852, 238, 58, 112],
    [906, 216, 62, 134], [964, 244, 70, 106], [1030, 198, 54, 152], [1080, 232, 62, 118],
    [1138, 210, 72, 140], [1206, 244, 74, 106],
  ];
  for (const [x, y, w, hh] of towers) {
    g.append(R(x, y, w, hh, colors[Math.floor(rand() * colors.length)]));
    g.append(R(x, y, w, 4, 'rgba(235,190,150,.18)'));
    for (let wy = y + 12; wy < y + hh - 8; wy += 14) {
      for (let wx = x + 7; wx < x + w - 5; wx += 12) {
        if (rand() > .72) g.append(R(wx, wy, 3, 5, '#f1c27d', { opacity: .35 + rand() * .25 }));
      }
    }
  }
  // A slim tower above the ridge.
  g.append(R(1112, 118, 18, 150, '#3b4b52'));
  g.append(R(1116, 96, 10, 24, '#3b4b52'));
  g.append(h('path', { d: 'M1121 96V62', stroke: '#3b4b52', 'stroke-width': 3 }));
  g.append(C(1121, 60, 3, '#d4553d', { opacity: .7 }));
  // Bridge silhouette at the left edge.
  g.append(P('M0 328h292v7H0zM24 328v-26h9v26zm70 0v-30h9v30zm72 0v-24h9v24zm70 0v-28h9v28z', '#34474e'));
  g.append(P('M18 302q38-34 82 0M160 298q40-28 82 4', 'none', { stroke: '#34474e', 'stroke-width': 4 }));
  g.append(R(0, 286, 1280, 86, 'url(#fog)'));
  return g;
}

/* --------------------------------------------------------------- rail */
function viaduct() {
  const g = h('g', { id: 'viaduct' });
  g.append(R(0, 286, 1280, 18, '#34464a', { opacity: .55 }));
  g.append(R(0, 252, 1280, 22, '#5d6a6c'));
  g.append(R(0, 252, 1280, 4, '#7a8584', { opacity: .6 }));
  g.append(R(0, 274, 1280, 7, '#3f4d50'));
  for (const x of [48, 224, 400, 576, 752, 928, 1104, 1240]) {
    g.append(R(x, 280, 17, 76, '#49585b'));
    g.append(R(x + 3, 280, 4, 76, 'rgba(230,210,180,.12)'));
  }
  // Train, deliberately behind the roof line.
  const train = h('g', { id: 'train' });
  train.append(R(714, 214, 352, 40, '#e9e2d2', { rx: 8 }));
  train.append(R(714, 214, 352, 9, '#c9c1b1', { rx: 5 }));
  train.append(R(714, 244, 352, 5, '#3f6f70'));
  train.append(R(714, 249, 352, 3, '#d4553d'));
  for (let i = 0; i < 11; i++) {
    train.append(R(732 + i * 28, 226, 19, 14, '#f4c87f', { rx: 2 }));
    train.append(R(732 + i * 28, 226, 19, 14, 'none', { stroke: 'rgba(40,50,50,.35)', 'stroke-width': 1 }));
  }
  train.append(R(1018, 220, 36, 30, '#3f6f70', { rx: 6 }));
  train.append(R(1028, 226, 14, 11, '#a9d1c9', { rx: 2 }));
  train.append(R(1040, 226, 8, 11, '#f4c87f', { rx: 2 }));
  train.append(R(730, 208, 320, 3, '#4c5a5c'));
  train.append(P('M760 208v-14h32v14M760 194l-12-16m44 16 12-16', 'none', {
    stroke: '#465659', 'stroke-width': 2,
  }));
  g.append(train);
  g.append(P('M0 206Q640 184 1280 210', 'none', {
    stroke: '#2f4247', 'stroke-width': 1.2, opacity: .55,
  }));
  return g;
}

/* ------------------------------------------------------------ buildings */
function windowWarm(x, y, w, hh, lit = true) {
  const g = h('g');
  g.append(R(x - 2, y - 2, w + 4, hh + 4, 'rgba(18,28,29,.58)', { rx: 1 }));
  g.append(R(x, y, w, hh, lit ? 'url(#shopWarm)' : '#2d4650', { rx: 1 }));
  if (lit) {
    g.append(R(x + 2, y + 2, w - 4, 4, '#ffe0a1', { opacity: .35, rx: 1 }));
    g.append(R(x + w - 6, y + 2, 3, hh - 4, 'rgba(80,44,30,.25)'));
  } else {
    g.append(R(x + 2, y + 2, w - 4, hh * .42, 'rgba(120,160,165,.1)'));
  }
  g.append(R(x + w / 2, y, 1, hh, 'rgba(18,28,29,.35)'));
  g.append(R(x - 2, y + hh + 2, w + 4, 3, 'rgba(28,38,36,.35)'));
  return g;
}

function acUnit(x, y) {
  const g = h('g');
  g.append(R(x + 2, y + 3, 27, 16, 'rgba(20,30,30,.22)', { rx: 2, filter: 'url(#blur4)' }));
  g.append(R(x, y, 27, 16, '#c4c3b6', { rx: 2 }));
  g.append(R(x + 2, y + 2, 23, 2, 'rgba(70,78,70,.35)'));
  for (let i = 0; i < 3; i++) g.append(R(x + 4, y + 5 + i * 3, 15, 1, 'rgba(70,78,70,.32)'));
  g.append(C(x + 21, y + 10, 3.5, 'none', { stroke: 'rgba(70,78,70,.4)', 'stroke-width': 1 }));
  return g;
}

function balcony(x, y, w, tone = '#5d6864') {
  const g = h('g');
  g.append(R(x, y, w, 5, tone));
  g.append(R(x, y + 5, w, 3, 'rgba(18,28,28,.35)'));
  for (let i = 4; i < w - 4; i += 11) g.append(R(x + i, y - 12, 2, 12, 'rgba(60,72,70,.75)'));
  g.append(R(x, y - 13, w, 2, 'rgba(60,72,70,.75)'));
  // One planter, not a laundry line: small silhouettes read more clearly.
  g.append(C(x + 14, y - 15, 7, '#4d6b50'));
  g.append(C(x + 22, y - 17, 5, '#6f8a5e'));
  g.append(C(x + 10, y - 17, 4, '#5f7d55'));
  return g;
}

function roofKit(x, y, variant = 0) {
  const g = h('g');
  if (variant % 3 === 0) {
    g.append(R(x, y, 34, 22, '#b9b9ae', { rx: 3 }));
    g.append(E(x + 17, y, 17, 5, '#d7d6c9'));
    g.append(R(x + 5, y + 22, 4, 9, '#747b76'));
    g.append(R(x + 25, y + 22, 4, 9, '#747b76'));
  } else if (variant % 3 === 1) {
    g.append(R(x, y + 6, 45, 14, '#6b716c', { rx: 1 }));
    g.append(R(x + 4, y, 37, 7, '#8a4f45', { rx: 1 }));
    g.append(P(`M${x + 2} ${y + 6}h41`, 'none', { stroke: 'rgba(240,210,170,.25)', 'stroke-width': 1 }));
  } else {
    g.append(P(`M${x + 4} ${y + 24}V${y + 4}h4v20M${x + 22} ${y + 24}V${y + 9}h3v15`, 'none', {
      stroke: '#5b6662', 'stroke-width': 2,
    }));
    g.append(C(x + 7, y + 5, 4, '#65756f'));
    g.append(C(x + 24, y + 10, 3, '#7e8b83'));
  }
  return g;
}

function buildingBase(x, y, w, hh, body, side, roof) {
  const g = h('g');
  g.append(R(x + w - 18, y, 18, hh, side));
  g.append(R(x, y, w, hh, body));
  for (let i = 1; i < 5; i++) g.append(R(x + (w * i) / 5, y, 1, hh, 'rgba(20,30,30,.08)'));
  g.append(R(x, y, w, 12, roof));
  g.append(R(x, y + 12, w, 3, 'rgba(10,20,20,.22)'));
  return g;
}

function gradeFacade(x, y, w, hh) {
  return h('g', { 'pointer-events': 'none' },
    R(x, y, w, hh, 'url(#facadeShade)'),
    R(x, y, w, hh, 'url(#facadeWarm)', { style: 'mix-blend-mode:soft-light' }),
  );
}

function buildingA() {
  const x = 20, y = 140, w = 350, hh = 310;
  const g = buildingBase(x, y, w, hh, '#8b8f86', '#6a706b', '#4e5753');
  const floorH = 52;
  for (let f = 0; f < 4; f++) {
    const fy = y + 22 + f * floorH;
    for (let c = 0; c < 3; c++) {
      const wx = x + 24 + c * 106;
      g.append(windowWarm(wx, fy, 72, 27, rand() > .28));
      if (f === 1 || f === 3) g.append(balcony(wx - 7, fy + 34, 86));
      if (rand() > .52) g.append(acUnit(wx + 44, fy + 30));
    }
  }
  // Roof life: keep the skyline quiet. No tanks or poles floating above the
  // parapet; the street is the subject.
  // Drainpipe and cables.
  g.append(R(x + w - 36, y + 18, 4, 270, '#626b64'));
  g.append(R(x + 82, y + 16, 3, 204, '#59615b'));
  g.append(P(`M${x + 6} ${y + 148}q120 18 260-14`, 'none', {
    stroke: '#3f4c4a', 'stroke-width': 1.2, opacity: .55,
  }));
  g.append(gradeFacade(x, y, w, hh));
  // Ground floor noodle shop.
  g.append(shopA(x + 8, 360, w - 16, 90));
  return g;
}

function shopA(x, y, w, hh) {
  const g = h('g');
  g.append(R(x, y, w, hh, '#1b292a'));
  const pw = (w - 52) / 3;
  for (let i = 0; i < 3; i++) {
    const px = x + 10 + i * (pw + 6);
    g.append(R(px, y + 24, pw, hh - 30, 'url(#shopWarm)', { rx: 1 }));
    g.append(R(px + 4, y + 32, pw - 8, 3, 'rgba(255,240,200,.25)'));
    g.append(R(px + 4, y + 44, pw - 14, 2, 'rgba(80,45,30,.28)'));
    g.append(R(px + 4, y + 58, pw - 20, 2, 'rgba(80,45,30,.22)'));
  }
  // Counter, stools and steam.
  g.append(R(x + 22, y + hh - 24, w - 112, 10, '#5d3d2c', { rx: 2 }));
  g.append(E(x + 66, y + 50, 15, 8, '#f2d9a3', { opacity: .45, filter: 'url(#blur4)' }));
  g.append(E(x + 98, y + 43, 10, 13, '#f2d9a3', { opacity: .28, filter: 'url(#blur4)' }));
  for (let i = 0; i < 3; i++) {
    g.append(C(x + 44 + i * 32, y + hh - 10, 7, '#b58a5c'));
    g.append(R(x + 42 + i * 32, y + hh - 10, 4, 12, '#6b4a36'));
  }
  // Door.
  g.append(R(x + w - 66, y + 24, 48, hh - 30, '#2b3838'));
  g.append(R(x + w - 62, y + 28, 40, hh - 40, 'url(#shopWarm)', { opacity: .75, rx: 1 }));
  g.append(R(x + w - 42, y + 45, 3, 18, '#4b372c', { rx: 2 }));
  // Sign.
  g.append(R(x, y, w, 25, '#b84a38'));
  g.append(R(x, y, w, 3, 'rgba(255,220,180,.18)'));
  g.append(T(x + w / 2, y + 18, '老街小面', 16, '#f7ead2', {
    'text-anchor': 'middle', 'font-weight': 700, 'letter-spacing': 3,
  }));
  // Awning.
  g.append(awning(x + 5, y + 26, w - 10, 18, '#a94334', '#efd9bc'));
  // Light spilling onto the street.
  g.append(E(x + w / 2, y + hh + 26, w * .57, 26, 'url(#warmPool)', { opacity: .6 }));
  return g;
}

function buildingB() {
  const x = 390, y = 230, w = 300, hh = 220;
  const g = buildingBase(x, y, w, hh, '#a99a84', '#817667', '#5a554e');
  for (let f = 0; f < 3; f++) {
    const fy = y + 24 + f * 42;
    g.append(windowWarm(x + 26, fy, 92, 25, rand() > .35));
    g.append(windowWarm(x + 154, fy, 92, 25, rand() > .35));
    if (f === 1) g.append(balcony(x + 24, fy + 38, 108, '#6e675b'));
    if (f === 0) g.append(acUnit(x + 220, fy + 30));
  }
  // A mat at the threshold.
  g.append(R(584, 444, 58, 8, '#7a5a40', { rx: 1 }));
  g.append(R(590, 446, 46, 2, 'rgba(240,220,180,.28)'));
  g.append(gradeFacade(x, y, w, hh));
  // Ground floor photo studio.
  g.append(shopB(x + 8, 352, w - 16, 98));
  return g;
}

function shopB(x, y, w, hh) {
  const g = h('g');
  g.append(R(x, y, w, hh, '#1b292a'));
  const pw = (w - 44) / 2;
  for (let i = 0; i < 2; i++) {
    const px = x + 10 + i * (pw + 6);
    g.append(R(px, y + 24, pw, hh - 30, 'url(#shopWarm)', { rx: 1 }));
    g.append(R(px + 4, y + 32, pw - 8, 3, 'rgba(255,240,200,.28)'));
  }
  // Photo frames and a tripod silhouette.
  g.append(R(x + 24, y + 40, 28, 20, '#4b362b', { rx: 1 }));
  g.append(R(x + 28, y + 44, 20, 12, '#9cc6bd', { opacity: .55, rx: 1 }));
  g.append(R(x + 58, y + 36, 20, 26, '#4b362b', { rx: 1 }));
  g.append(R(x + 62, y + 40, 12, 18, '#d7a86b', { opacity: .5, rx: 1 }));
  g.append(P(`M${x + 142} ${y + 82}l14-38 14 38M${x + 156} ${y + 44}v38M${x + 146} ${y + 60}h20`, 'none', {
    stroke: '#3c3028', 'stroke-width': 2,
  }));
  g.append(C(x + 156, y + 38, 7, '#3c3028'));
  g.append(C(x + 156, y + 38, 3.5, '#d7a86b', { opacity: .65 }));
  // Door.
  g.append(R(x + w - 66, y + 24, 48, hh - 30, '#2b3838'));
  g.append(R(x + w - 62, y + 28, 40, hh - 40, 'url(#shopWarm)', { opacity: .8, rx: 1 }));
  g.append(R(x + w - 42, y + 45, 3, 18, '#4b372c', { rx: 2 }));
  // Sign with a small camera mark.
  g.append(R(x, y, w, 25, '#2d5754'));
  g.append(R(x, y, w, 3, 'rgba(220,240,230,.16)'));
  g.append(R(x + 13, y + 7, 15, 10, 'none', { stroke: '#f2e8d5', 'stroke-width': 1.4, rx: 2 }));
  g.append(C(x + 20.5, y + 12, 2.8, 'none', { stroke: '#f2e8d5', 'stroke-width': 1.2 }));
  g.append(T(x + w / 2 + 8, y + 18, '临江照相馆', 15, '#f2e8d5', {
    'text-anchor': 'middle', 'font-weight': 700, 'letter-spacing': 2,
  }));
  g.append(awning(x + 5, y + 26, w - 10, 18, '#345c52', '#e9ddc4'));
  g.append(E(x + w / 2, y + hh + 26, w * .54, 26, 'url(#warmPool)', { opacity: .58 }));
  return g;
}

function buildingC() {
  const x = 880, y = 110, w = 370, hh = 340;
  const g = buildingBase(x, y, w, hh, '#7f8a86', '#5c6865', '#3f4a47');
  for (let f = 0; f < 6; f++) {
    const fy = y + 22 + f * 42;
    for (let c = 0; c < 4; c++) {
      const wx = x + 22 + c * 86;
      g.append(windowWarm(wx, fy, 62, 24, rand() > .3));
      if (f === 1 || f === 4) g.append(balcony(wx - 6, fy + 32, 74, '#52605c'));
      if (rand() > .58) g.append(acUnit(wx + 38, fy + 28));
    }
  }
  // Fire escape, a small modern detail.
  for (let i = 0; i < 4; i++) {
    const fy = y + 70 + i * 54;
    g.append(R(x + w - 34, fy, 28, 4, '#4c5b58'));
    g.append(P(`M${x + w - 34} ${fy + 4}l28 50`, 'none', { stroke: '#4c5b58', 'stroke-width': 2 }));
    for (let j = 0; j < 3; j++) g.append(R(x + w - 32 + j * 9, fy - 12, 2, 12, '#4c5b58'));
  }
  g.append(gradeFacade(x, y, w, hh));
  // Ground floor convenience store.
  g.append(shopC(x + 8, 350, w - 16, 100));
  return g;
}

function shopC(x, y, w, hh) {
  const g = h('g');
  g.append(R(x, y, w, hh, '#1b292a'));
  const pw = (w - 52) / 3;
  for (let i = 0; i < 3; i++) {
    const px = x + 10 + i * (pw + 6);
    g.append(R(px, y + 24, pw, hh - 30, 'url(#shopCool)', { rx: 1 }));
    // Shelves and goods.
    for (let r = 0; r < 2; r++) {
      g.append(R(px + 6, y + 42 + r * 20, pw - 12, 3, 'rgba(50,70,65,.35)'));
      for (let k = 0; k < 4; k++) {
        g.append(R(px + 8 + k * 11, y + 35 + r * 20, 6, 7,
          ['#d4553d', '#e8c35a', '#4f8a7e', '#d9b45a'][k], { opacity: .75, rx: 1 }));
      }
    }
  }
  g.append(R(x + w - 66, y + 24, 48, hh - 30, '#2b3838'));
  g.append(R(x + w - 62, y + 28, 40, hh - 40, 'url(#shopCool)', { opacity: .8, rx: 1 }));
  g.append(R(x + w - 42, y + 45, 3, 18, '#4b372c', { rx: 2 }));
  // Yellow convenience sign.
  g.append(R(x, y, w, 25, YELLOW));
  g.append(R(x, y + 21, w, 4, '#3f6f5e'));
  g.append(T(x + w / 2, y + 18, '坎坡便利店', 15, INK, {
    'text-anchor': 'middle', 'font-weight': 800, 'letter-spacing': 3,
  }));
  g.append(awning(x + 5, y + 26, w - 10, 18, '#345c52', '#d9d2b8'));
  g.append(E(x + w / 2, y + hh + 26, w * .52, 26, 'url(#coolPool)', { opacity: .85 }));
  return g;
}

function awning(x, y, w, hh, c1, c2) {
  const g = h('g');
  g.append(R(x, y, w, hh, c1));
  for (let i = 0; i < w; i += 20) g.append(R(x + i, y, 10, hh, c2, { opacity: .55 }));
  const teeth = [];
  for (let i = 0; i < w; i += 20) teeth.push(`q10 8 20 0`);
  g.append(P(`M${x} ${y + hh}${teeth.join('')}v-4H${x}z`, c1));
  g.append(R(x, y + hh - 2, w, 2, 'rgba(20,30,30,.28)'));
  return g;
}

/* --------------------------------------------------------------- stairs */
function stoneFace(x0Top, x1Top, yTop, x0Bottom, x1Bottom, yBottom, colors) {
  const g = h('g');
  const lerp = (a, b, t) => a + (b - a) * t;
  const rowH = 17;
  const rows = Math.ceil((yBottom - yTop) / rowH);
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows, t1 = (r + 1) / rows;
    const ya = yTop + (yBottom - yTop) * t0;
    const yb = yTop + (yBottom - yTop) * t1;
    const a0 = lerp(x0Top, x0Bottom, t0), a1 = lerp(x1Top, x1Bottom, t0);
    const b0 = lerp(x0Top, x0Bottom, t1), b1 = lerp(x1Top, x1Bottom, t1);
    const m0 = 0.42 + (r % 2 ? .13 : 0), m1 = m0;
    const ma = a0 + (a1 - a0) * m0, mb = b0 + (b1 - b0) * m1;
    const cA = colors[(r * 2 + 1) % colors.length];
    const cB = colors[(r * 2 + 2) % colors.length];
    g.append(P(`M${a0} ${ya}H${ma}L${mb} ${yb}H${b0}Z`, cA));
    g.append(P(`M${ma} ${ya}H${a1}L${b1} ${yb}H${mb}Z`, cB));
    g.append(P(`M${a0} ${ya}H${a1}M${b0} ${yb}H${b1}`, 'none', {
      stroke: 'rgba(30,34,31,.24)', 'stroke-width': 1,
    }));
    g.append(P(`M${ma} ${ya}L${mb} ${yb}`, 'none', {
      stroke: 'rgba(30,34,31,.3)', 'stroke-width': 1,
    }));
    if (rand() > .55) {
      g.append(P(`M${a0 + (a1 - a0) * .2} ${ya + 4}l${(a1 - a0) * .3} -1`, 'none', {
        stroke: 'rgba(235,225,205,.1)', 'stroke-width': 1,
      }));
    }
  }
  return g;
}

function stairAlley() {
  const g = h('g', { id: 'stair-alley' });
  const left = { topOuter: 700, topInner: 724, bottomOuter: 680, bottomInner: 708 };
  const right = { topInner: 852, topOuter: 880, bottomInner: 872, bottomOuter: 900 };
  // Back building at the top of the stairs.
  g.append(R(700, 292, 180, 146, '#334743'));
  g.append(R(700, 292, 180, 146, 'url(#facadeShade)'));
  g.append(R(700, 292, 180, 5, '#65736a'));
  g.append(R(700, 297, 180, 2, 'rgba(18,28,27,.25)'));
  for (const y of [330, 370, 408]) {
    g.append(R(702, y, 176, 1, 'rgba(20,32,30,.25)'));
  }
  // Lit upper window, AC unit and cables above the passage.
  g.append(R(752, 310, 46, 34, '#1e2f2d', { rx: 1 }));
  g.append(R(755, 313, 40, 28, 'url(#shopWarm)', { opacity: .55, rx: 1 }));
  g.append(R(772, 313, 2, 28, 'rgba(50,32,24,.3)'));
  g.append(R(810, 318, 26, 18, '#5d6a64', { rx: 2 }));
  g.append(R(813, 321, 20, 4, '#46534f'));
  g.append(P('M810 326h26M823 318v18', 'none', { stroke: '#4a5752', 'stroke-width': 1.2 }));
  // A narrow balcony above the passage.
  g.append(R(722, 344, 58, 4, '#4e5a53'));
  for (let i = 0; i < 6; i++) g.append(R(724 + i * 10, 332, 2, 12, '#46534f'));
  g.append(R(722, 331, 58, 2, '#5b6860'));
  // A wall lamp above the door and a step at the threshold.
  g.append(P('M824 350v-8h-8', 'none', { stroke: '#3f4d49', 'stroke-width': 2 }));
  g.append(C(816, 352, 3, YELLOW));
  g.append(E(816, 352, 22, 20, 'url(#warmPool)', { opacity: .45 }));
  g.append(R(738, 438, 104, 4, '#6b6458'));
  g.append(R(738, 442, 104, 2, 'rgba(20,28,27,.35)'));
  g.append(P('M696 306q60 12 108-2 46-12 84 4', 'none', { stroke: '#3a4a47', 'stroke-width': 1.2, opacity: .6 }));
  g.append(P('M706 318q50 10 92 0', 'none', { stroke: '#3a4a47', 'stroke-width': .9, opacity: .4 }));
  // Warm door at the top landing.
  g.append(R(742, 350, 96, 88, '#233633'));
  g.append(R(754, 366, 40, 72, 'url(#shopWarm)', { opacity: .66, rx: 1 }));
  g.append(R(754, 366, 40, 72, 'none', { stroke: 'rgba(240,220,180,.24)', 'stroke-width': 1 }));
  g.append(R(772, 394, 2, 36, 'rgba(50,32,24,.32)'));
  g.append(R(806, 362, 22, 26, '#2b4444'));
  g.append(R(809, 365, 16, 20, '#e9b86d', { opacity: .42, rx: 1 }));
  // Hanging route sign with a small lamp.
  g.append(R(734, 420, 112, 22, '#243c3a', { rx: 1 }));
  g.append(T(790, 436, '临江巷  ↓', 12, '#e9dfc9', {
    'text-anchor': 'middle', 'font-weight': 700, 'letter-spacing': 2,
  }));

  // Left retaining wall, in perspective and dressed stone.
  g.append(P('M700 438H724L708 690H680Z', '#6b6559'));
  g.append(stoneFace(left.topOuter, left.topInner, 438, left.bottomOuter, left.bottomInner, 690,
    ['#6a6458', '#736c5f', '#625c51', '#777063']));
  g.append(P('M724 438L708 690', 'none', { stroke: '#8a8172', 'stroke-width': 2 }));
  g.append(P('M700 438L680 690', 'none', { stroke: '#4d4942', 'stroke-width': 2 }));
  // Damp stains, moss and a drainpipe.
  g.append(P('M700 438H724L708 690H680Z', 'url(#alleyShade)', { opacity: .42 }));
  g.append(blob(690, 610, 12, 22, 2, '#3b5845', { opacity: .55 }));
  g.append(blob(684, 650, 14, 20, -2, '#4d6b50', { opacity: .4 }));
  g.append(P('M708 470q-6 24 2 40t-2 46 2 52', 'none', { stroke: '#4a5753', 'stroke-width': 3 }));
  g.append(R(704, 470, 4, 200, '#4a5753', { transform: 'rotate(2 706 570)' }));
  // A wall-mounted handrail.
  g.append(P('M716 486L700 646', 'none', { stroke: '#394946', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    g.append(P(`M${716 - 16 * t} ${486 + 160 * t}h-10`, 'none', { stroke: '#4b5955', 'stroke-width': 2 }));
  }

  // Right retaining wall, with a notice board and pipes.
  g.append(P('M852 438H880L900 690H872Z', '#5a564b'));
  g.append(stoneFace(right.topInner, right.topOuter, 438, right.bottomInner, right.bottomOuter, 690,
    ['#5b564b', '#635d51', '#544f45', '#686154']));
  g.append(P('M852 438L872 690', 'none', { stroke: '#6d6659', 'stroke-width': 2 }));
  g.append(P('M880 438L900 690', 'none', { stroke: '#47433b', 'stroke-width': 2 }));
  g.append(P('M852 438H880L900 690H872Z', 'url(#alleyShade)', { opacity: .5 }));
  g.append(R(876, 500, 3, 180, '#475451', { transform: 'rotate(-2 878 590)' }));
  g.append(blob(886, 630, 12, 18, 0, '#3b5845', { opacity: .6 }));

  // Steps with a mid-landing, so the lane reads as a stair, not an escalator.
  const center = 790;
  const stepH = 18;
  const drawStep = (y, wTop, wBottom, alt, warm, i) => {
    const c1 = alt ? '#625c51' : '#6b6458';
    g.append(P(`M${center - wTop / 2} ${y}H${center + wTop / 2}L${center + wBottom / 2} ${y + stepH}H${center - wBottom / 2}Z`, c1));
    g.append(P(`M${center - wTop / 2} ${y}H${center + wTop / 2}L${center + wBottom / 2} ${y + stepH}H${center - wBottom / 2}Z`,
      '#ffbe6e', { opacity: .08 * warm, style: 'mix-blend-mode:soft-light' }));
    g.append(P(`M${center - 22 - i * 2} ${y}H${center + 22 + i * 2}L${center + 25 + i * 2} ${y + stepH - 3}H${center - 25 - i * 2}Z`,
      'rgba(235,220,190,.055)'));
    g.append(P(`M${center - wBottom / 2} ${y + stepH - 2}H${center + wBottom / 2}L${center + wTop / 2} ${y + stepH}H${center - wTop / 2}Z`,
      'rgba(24,27,23,.55)'));
    g.append(P(`M${center - wTop / 2 + 5} ${y + 2}H${center + wTop / 2 - 5}`,
      'none', { stroke: 'rgba(240,225,195,.1)', 'stroke-width': 1 }));
  };
  for (let i = 0; i < 5; i++) drawStep(470 + i * stepH, 112 + i * 2, 116 + i * 2, i % 2, 1 - i * .14, i);
  // Mid-landing.
  g.append(P(`M${center - 62} 560H${center + 62}L${center + 66} 590H${center - 66}Z`, '#6d6659'));
  g.append(P(`M${center - 62} 560H${center + 62}L${center + 66} 590H${center - 66}Z`, 'rgba(235,220,190,.06)'));
  g.append(P(`M${center - 66} 586H${center + 66}L${center + 66} 590H${center - 66}Z`, 'rgba(24,27,23,.5)'));
  g.append(P(`M${center - 56} 568H${center + 56}M${center - 58} 578H${center + 58}`, 'none', {
    stroke: 'rgba(40,42,36,.22)', 'stroke-width': 1,
  }));
  // A puddle and a drain on the landing.
  g.append(P(`M${center - 42} 574q26-7 52 0 12 4-2 9-28 8-52 0-10-4 2-9z`, 'url(#puddle)', { opacity: .5 }));
  g.append(R(center + 38, 564, 20, 4, '#3d4542', { rx: 1 }));
  for (let i = 0; i < 3; i++) g.append(R(center + 41 + i * 5, 565, 2, 2, '#1f2827'));
  for (let i = 0; i < 3; i++) drawStep(590 + i * stepH, 128 + i * 4, 132 + i * 4, i % 2, .12 - i * .04, i + 5);
  // The left wall casts a long shadow across the steps; the right edge catches cool light.
  g.append(P('M708 478L790 486L790 646L700 646Z', 'rgba(20,28,27,.28)', { filter: 'url(#blur8)' }));
  g.append(P('M860 480L864 640', 'none', { stroke: 'rgba(160,205,195,.14)', 'stroke-width': 12, filter: 'url(#blur4)' }));
  // A right-hand rail only; the left side uses the wall rail above.
  {
    const xTop = center + 56;
    const xBottom = center + 70;
    g.append(P(`M${xTop} 470L${xBottom} 644`, 'none', {
      stroke: '#354442', 'stroke-width': 4, 'stroke-linecap': 'round',
    }));
    g.append(P(`M${xTop} 470L${xBottom} 644`, 'none', {
      stroke: '#58655f', 'stroke-width': 1.4, 'stroke-linecap': 'round',
    }));
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = xTop + (xBottom - xTop) * t;
      const y = 470 + 174 * t;
      g.append(P(`M${x} ${y}v${i % 2 ? 12 : 16}`, 'none', { stroke: '#3f4d49', 'stroke-width': 2 }));
    }
  }
  // The landing stays clear; the route sign above carries the location.
  g.append(E(790, 492, 64, 22, 'url(#warmPool)', { opacity: .3 }));
  g.append(E(790, 640, 58, 20, 'url(#coolPool)', { opacity: .3 }));
  // The lower landing and a glimpse of the river.
  g.append(R(694, 644, 196, 22, '#4a4a42'));
  g.append(R(694, 644, 196, 3, '#6a6458'));
  g.append(R(702, 666, 180, 8, '#263b3d'));
  return g;
}

/* --------------------------------------------------------------- street */
function streetBase() {
  const g = h('g', { id: 'street' });
  // One continuous pedestrian plane from the shop thresholds to the river walk.
  g.append(R(0, 440, 1280, 240, '#55564f'));
  // A dark threshold strip where the shopfronts meet the paving.
  g.append(R(0, 440, 1280, 9, '#494a44'));
  g.append(R(0, 440, 1280, 1, 'rgba(240,225,195,.14)'));
  g.append(R(0, 449, 1280, 2, 'rgba(20,28,27,.3)'));
  // Shop-side paving: long, worn stone tiles, lower contrast than the wall blocks.
  const nearShop = ['#686156', '#6f675b', '#615b51', '#746c5f', '#5d584e', '#6b6458'];
  for (let row = 0; row < 10; row++) {
    const y = 451 + row * 14.5;
    const depth = (y - 451) / 174;
    const sc = .9 + .1 * depth;
    const offset = row % 2 ? 33 : 0;
    for (let x = -80 + offset; x < 1360; x += 66) {
      const xx = 640 + (x - 640) * sc;
      const ww = 64.5 * sc;
      g.append(R(xx, y, ww, 13.3, nearShop[Math.floor(rand() * nearShop.length)], { rx: .5 }));
      g.append(R(xx, y + 12.7, ww, .7, 'rgba(22,26,24,.2)'));
    }
  }
  // A shallow, flush seam where the walk meets the street.
  g.append(R(0, 596, 1280, 2, 'rgba(28,34,31,.35)'));
  g.append(R(0, 597, 1280, 1, 'rgba(235,220,190,.08)'));
  // Street paving, cooler and darker.
  const palette = ['#57544c', '#5f5b52', '#514e47', '#666056', '#59554d', '#4c4a44', '#615c52'];
  for (let row = 0; row < 6; row++) {
    const y = 599 + row * 14;
    const depth = (y - 599) / 70;
    const sc = .94 + .06 * depth;
    const offset = row % 2 ? 21 : 0;
    for (let x = -60 + offset; x < 1360; x += 42) {
      const xx = 640 + (x - 640) * sc;
      const ww = 40.5 * sc;
      g.append(R(xx, y, ww, 12.8, palette[Math.floor(rand() * palette.length)], { rx: .5 }));
      g.append(R(xx, y + 12.2, ww, .8, 'rgba(18,22,21,.28)'));
    }
  }
  // Threshold steps at the shop doors.
  for (const [sx, sw] of [[616, 48], [296, 48], [1176, 48]]) {
    g.append(R(sx - 4, 448, sw + 8, 4, '#6f675a', { rx: 1 }));
    g.append(R(sx - 4, 452, sw + 8, 2, 'rgba(24,30,28,.4)'));
  }
  // A central drainage channel, with grates.
  g.append(R(636, 452, 9, 228, '#343b38'));
  g.append(R(637, 452, 2, 228, 'rgba(200,190,165,.12)'));
  for (let y = 464; y < 672; y += 42) {
    g.append(R(637, y, 7, 12, '#222d2c', { rx: 1 }));
    for (let i = 0; i < 3; i++) g.append(R(638, y + 3 + i * 3, 5, 1, '#46514d'));
  }
  // Extra drains along the seam.
  for (const [x, y] of [[214, 592], [742, 592], [1108, 592]]) {
    g.append(R(x, y, 26, 6, '#3a413e', { rx: 1 }));
    for (let i = 0; i < 4; i++) g.append(R(x + 3 + i * 6, y + 1, 2, 4, '#1f2827'));
  }
  // Long reflections from the shop windows on the damp paving.
  g.append(R(42, 452, 300, 190, 'url(#reflectWarm)', { opacity: .5, filter: 'url(#blur4)' }));
  g.append(R(426, 452, 240, 206, 'url(#reflectWarm)', { opacity: .42, filter: 'url(#blur4)' }));
  g.append(R(900, 452, 330, 185, 'url(#reflectCool)', { opacity: .6, filter: 'url(#blur4)' }));
  for (const [x, y, w, c] of [
    [86, 456, 4, '#ffc98a'], [128, 456, 3, '#ffc98a'], [196, 456, 5, '#ffc98a'],
    [452, 456, 4, '#ffc98a'], [506, 456, 5, '#ffc98a'], [590, 456, 4, '#ffc98a'],
    [934, 456, 4, '#b9ded4'], [1010, 456, 5, '#b9ded4'], [1110, 456, 4, '#b9ded4'],
  ]) {
    g.append(R(x, y, w, 64, c, { opacity: .16, filter: 'url(#blur4)' }));
  }
  // Wet patches and reflected shop light.
  g.append(P('M0 520q210-18 410 4 180 19 340-2 260-30 530-4v38q-260-18-520 10-210 22-410 2-190-20-350-2z',
    'rgba(40,52,52,.2)'));
  g.append(P('M0 606q240-22 460 0 200 18 390-4 220-26 430-2v20q-230-16-430 8-210 22-400 2-210-22-450-2z',
    'rgba(35,48,48,.18)'));
  // Tactile strip.
  g.append(R(0, 598, 1280, 12, '#b8954e', { opacity: .22 }));
  for (let x = 4; x < 1280; x += 18) g.append(C(x, 604, 2.1, '#d9b45a', { opacity: .58 }));
  // Curb and lower walk.
  g.append(R(0, 680, 1280, 9, '#454b48'));
  g.append(R(0, 689, 1280, 5, '#303a38'));
  g.append(R(0, 694, 1280, 28, '#444842'));
  // Railing base.
  g.append(R(0, 718, 1280, 4, '#2e3a39'));
  // River and the far bank.
  g.append(R(0, 722, 1280, 38, 'url(#river)'));
  for (let i = 0; i < 26; i++) {
    g.append(R(rand() * 1280, 726 + rand() * 30, 24 + rand() * 80, 1, 'rgba(190,225,215,.16)'));
  }
  // Warm and cool reflections.
  for (const [x, color] of [[210, '#e8b36e'], [540, '#d9a05e'], [1030, '#8fc2b4']]) {
    g.append(R(x, 724, 14, 34, color, { opacity: .22, filter: 'url(#blur4)' }));
    g.append(R(x + 7, 724, 4, 34, color, { opacity: .28, filter: 'url(#blur4)' }));
  }
  // A tiny boat.
  g.append(P('M120 742q30 9 62 0l-8 10h-46z', '#1c2e31'));
  g.append(P('M148 742v-17l16 17z', '#3c4a48'));
  g.append(C(178, 744, 2.5, '#e8c35a', { opacity: .8 }));
  return g;
}

function streetShadows() {
  const g = h('g', { id: 'street-shadows' });
  // Contact shadow where the shopfronts meet the sidewalk.
  g.append(R(0, 438, 1280, 18, 'url(#streetShadow)', { opacity: .62 }));
  g.append(R(0, 438, 1280, 2, 'rgba(12,20,20,.35)'));
  // Awning shadows falling across the sidewalk and street.
  g.append(P('M24 402h342l56 118H82z', 'rgba(16,28,28,.2)', { filter: 'url(#blur8)' }));
  g.append(P('M396 394h290l52 124H450z', 'rgba(16,28,28,.22)', { filter: 'url(#blur8)' }));
  g.append(P('M886 392h386v128H940z', 'rgba(16,28,28,.24)', { filter: 'url(#blur8)' }));
  // Long shopfront shadows.
  g.append(P('M20 450h350l54 120H78z', 'url(#streetShadow)', { opacity: .45, filter: 'url(#blur8)' }));
  g.append(P('M390 450h300l58 138H442z', 'url(#streetShadow)', { opacity: .4, filter: 'url(#blur8)' }));
  g.append(P('M880 450h370l30 170H930z', 'url(#streetShadow)', { opacity: .45, filter: 'url(#blur8)' }));
  // Tree shadows.
  for (const [x, y, rx, ry] of [[336, 655, 78, 20], [1056, 676, 82, 21]]) {
    g.append(E(x, y, rx, ry, 'rgba(20,38,36,.22)', { filter: 'url(#blur8)' }));
  }
  return g;
}

function streetDetails() {
  const g = h('g', { id: 'street-details' });
  // Manhole and drain.
  g.append(C(432, 620, 19, '#6b6254'));
  g.append(C(432, 620, 15, '#7d7364'));
  g.append(C(432, 620, 15, 'none', { stroke: 'rgba(45,40,32,.45)', 'stroke-width': 2 }));
  for (let i = -10; i <= 10; i += 5) g.append(R(432 + i, 610, 1, 20, 'rgba(45,40,32,.4)'));
  g.append(R(612, 670, 52, 8, '#3f4643', { rx: 1 }));
  for (let i = 0; i < 7; i++) g.append(R(616 + i * 7, 672, 3, 4, '#222d2d'));
  // Puddles with reflected shop light.
  g.append(P('M286 650q34-18 82-4 22 8-8 18-52 15-88 2-18-7 14-16z', 'url(#puddle)', { opacity: .55 }));
  // A few leaves.
  for (let i = 0; i < 16; i++) {
    const x = 80 + rand() * 1120, y = 500 + rand() * 160;
    g.append(E(x, y, 3 + rand() * 3, 1.4 + rand(), ['#6f7a4e', '#8b7442', '#4f6a4b'][i % 3], {
      opacity: .55, transform: `rotate(${rand() * 180} ${x} ${y})`,
    }));
  }
  // Planters and trees.
  g.append(planter(300, 586, 1.05));
  g.append(tree(336, 520, .95));
  g.append(planter(1020, 586, 1.05));
  g.append(tree(1056, 534, 1));
  // Tree pits with cast-iron grates.
  for (const [tx, ty, r] of [[336, 655, 27], [1056, 676, 29]]) {
    g.append(E(tx, ty, r, r * .36, '#3c4442'));
    g.append(E(tx, ty, r - 3, r * .36 - 1, '#4b544f'));
    for (let i = -2; i <= 2; i++) {
      g.append(P(`M${tx - r + 4} ${ty + i * 3}q${r - 2} ${i * 1.2} ${2 * r - 8} 0`, 'none', {
        stroke: 'rgba(20,28,27,.45)', 'stroke-width': 1,
      }));
    }
  }
  // Bench.
  g.append(bench(390, 660));
  // Warm light pools from the shopfronts.
  g.append(E(224, 498, 170, 28, 'url(#warmPool)', { opacity: .5 }));
  g.append(E(540, 506, 150, 26, 'url(#warmPool)', { opacity: .48 }));
  g.append(E(1058, 510, 170, 30, 'url(#coolPool)', { opacity: .65 }));
  return g;
}

function ring(x, y, r) {
  const g = h('g', { opacity: .9 });
  g.append(C(x, y, r, 'none', { stroke: YELLOW, 'stroke-width': 1.5, opacity: .75 }));
  g.append(C(x, y, r + 6, 'none', { stroke: YELLOW, 'stroke-width': 1, opacity: .25 }));
  g.append(C(x, y, 3, YELLOW));
  return g;
}

function planter(x, y, s = 1) {
  const g = h('g', { transform: `translate(${x} ${y}) scale(${s})` });
  g.append(E(0, 24, 34, 8, 'rgba(18,28,28,.28)', { filter: 'url(#blur4)' }));
  g.append(R(-34, 0, 68, 26, '#8d7a63', { rx: 3 }));
  g.append(R(-34, 0, 68, 4, '#a8957c'));
  g.append(R(-30, 4, 60, 19, '#5d4e3f', { rx: 2 }));
  g.append(C(-18, -2, 12, '#4d6b50'));
  g.append(C(2, -6, 16, '#5f7d55'));
  g.append(C(22, 0, 11, '#6f8a5e'));
  return g;
}

function blob(cx, cy, rx, ry, rot, fill, extra = {}) {
  const d = `M${cx - rx} ${cy}
    C${cx - rx} ${cy - ry * .9} ${cx - rx * .4} ${cy - ry * 1.22} ${cx} ${cy - ry}
    C${cx + rx * .62} ${cy - ry * .95} ${cx + rx} ${cy - ry * .22} ${cx + rx} ${cy}
    C${cx + rx * .82} ${cy + ry * .82} ${cx + rx * .18} ${cy + ry} ${cx} ${cy + ry}
    C${cx - rx * .72} ${cy + ry * .9} ${cx - rx} ${cy + ry * .3} ${cx - rx} ${cy}z`;
  return P(d, fill, { transform: `rotate(${rot} ${cx} ${cy})`, ...extra });
}

function tree(x, y, s = 1) {
  const g = h('g', { transform: `translate(${x} ${y}) scale(${s})` });
  g.append(E(0, 142, 78, 18, 'rgba(12,24,24,.3)', { filter: 'url(#blur8)' }));
  g.append(P('M-7 142q-3-54 3-94h6q6 42 2 94z', '#4d3b30'));
  g.append(P('M0 92q-8-30 3-48M2 84q14-22 25-28', 'none', {
    stroke: '#624938', 'stroke-width': 4, 'stroke-linecap': 'round',
  }));
  const leaves = [
    [-54, 56, 34, 27, -12, '#304b3d'], [-18, 24, 42, 34, 8, '#42604a'],
    [26, 32, 38, 31, -8, '#4d6b50'], [58, 60, 30, 25, 12, '#56744f'],
    [-38, 12, 31, 26, -18, '#3b5845'], [8, 4, 36, 27, 4, '#4a684e'],
    [-72, 80, 24, 20, 8, '#3b5745'], [74, 88, 25, 19, -8, '#4f6d4c'],
    [-14, 70, 38, 28, 2, '#3f5c48'], [42, 84, 28, 22, 6, '#3b5745'],
  ];
  for (const [cx, cy, rx, ry, rot, color] of leaves) {
    g.append(blob(cx, cy, rx, ry, rot, color));
  }
  // Sunlit top edge.
  g.append(blob(-10, 4, 28, 16, -5, '#6e8a5e', { opacity: .55 }));
  g.append(blob(30, 22, 22, 13, 6, '#77945f', { opacity: .42 }));
  // A few crisp leaf accents.
  for (const [cx, cy, r] of [[-28, 34, 4], [16, 26, 5], [46, 48, 4], [-46, 70, 3], [28, 74, 4]]) {
    g.append(C(cx, cy, r, '#7f9a66', { opacity: .5 }));
  }
  return g;
}

function crate(x, y, s = 1) {
  const g = h('g', { transform: `translate(${x} ${y}) scale(${s})` });
  g.append(E(18, 25, 20, 4, 'rgba(18,28,28,.24)', { filter: 'url(#blur4)' }));
  g.append(R(0, 0, 36, 24, '#6d543c', { rx: 1 }));
  g.append(R(2, 2, 32, 3, '#8a6a4d'));
  g.append(R(2, 9, 32, 2, 'rgba(40,28,20,.3)'));
  g.append(R(2, 17, 32, 2, 'rgba(40,28,20,.3)'));
  g.append(P('M2 2l32 20M34 2L2 22', 'none', { stroke: 'rgba(40,28,20,.25)', 'stroke-width': 1.5 }));
  g.append(R(14, 5, 8, 3, '#d9c9a8', { opacity: .5, rx: 1 }));
  return g;
}

function aBoard(x, y) {
  const g = h('g');
  g.append(E(x + 18, y + 38, 22, 5, 'rgba(18,28,28,.24)', { filter: 'url(#blur4)' }));
  g.append(P(`M${x + 4} ${y + 36}l10-34h20l8 34z`, '#5c4a3a'));
  g.append(P(`M${x + 9} ${y + 31}l8-26h15l6 26z`, '#2e4441'));
  g.append(T(x + 18, y + 17, '取景', 7, '#f2e8d5', { 'text-anchor': 'middle', 'font-weight': 700, 'letter-spacing': .5 }));
  g.append(T(x + 18, y + 25, '¥ 20', 5.5, '#e8c35a', { 'text-anchor': 'middle' }));
  g.append(P(`M${x + 14} ${y + 2}l-2-8M${x + 24} ${y + 2}l2-8`, 'none', { stroke: '#4a3a2e', 'stroke-width': 2 }));
  return g;
}

function potted(x, y, s = 1) {
  const g = h('g', { transform: `translate(${x} ${y}) scale(${s})` });
  g.append(E(0, 18, 15, 4, 'rgba(18,28,28,.24)', { filter: 'url(#blur4)' }));
  g.append(P('M-10 0h20l-3 18h-14z', '#9a5f43'));
  g.append(R(-10, 0, 20, 4, '#b57450'));
  for (const [cx, cy, r, c] of [[-6, -8, 8, '#4d6b50'], [4, -12, 10, '#5f7d55'], [9, -4, 7, '#6f8a5e']]) {
    g.append(blob(cx, cy, r, r * .8, 0, c));
  }
  return g;
}

function bench(x, y) {
  const g = h('g');
  g.append(E(x + 40, y + 22, 52, 8, 'rgba(18,28,28,.24)', { filter: 'url(#blur4)' }));
  g.append(R(x, y, 82, 7, '#7b5b40', { rx: 1 }));
  for (let i = 0; i < 3; i++) g.append(R(x + 2, y + 2 + i * 3, 78, 2, 'rgba(40,28,20,.25)'));
  g.append(R(x + 6, y + 7, 4, 20, '#3f4a47'));
  g.append(R(x + 72, y + 7, 4, 20, '#3f4a47'));
  g.append(P(`M${x + 8} ${y + 7}l6-14h64l5 14`, 'none', { stroke: '#6a4d37', 'stroke-width': 3 }));
  return g;
}

function scooter(x, y) {
  const g = h('g');
  g.append(E(x + 20, y + 18, 34, 6, 'rgba(18,28,28,.26)', { filter: 'url(#blur4)' }));
  g.append(C(x - 3, y + 10, 8, '#263335'));
  g.append(C(x + 43, y + 10, 8, '#263335'));
  g.append(C(x - 3, y + 10, 3, '#8d9890'));
  g.append(C(x + 43, y + 10, 3, '#8d9890'));
  g.append(P(`M${x - 3} ${y + 10}l8-18h28l10 18`, 'none', { stroke: '#d9d2c0', 'stroke-width': 4 }));
  g.append(P(`M${x + 6} ${y - 8}h24`, 'none', { stroke: '#3f6f70', 'stroke-width': 6 }));
  g.append(R(x + 4, y - 24, 25, 14, '#3f6f70', { rx: 3 }));
  g.append(R(x + 30, y - 34, 12, 20, '#d4553d', { rx: 2 }));
  g.append(C(x + 36, y - 16, 2, '#f2e8d5'));
  g.append(P(`M${x + 34} ${y - 32}v-8h12`, 'none', { stroke: '#3f4a48', 'stroke-width': 2 }));
  return g;
}

function bicycle(x, y) {
  const g = h('g');
  g.append(E(x + 30, y + 20, 38, 6, 'rgba(18,28,28,.24)', { filter: 'url(#blur4)' }));
  for (const cx of [x, x + 56]) {
    g.append(C(cx, y + 8, 13, 'none', { stroke: '#2d383a', 'stroke-width': 2.4 }));
    g.append(C(cx, y + 8, 4, '#6d7a76'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.append(P(`M${cx} ${y + 8}L${cx + Math.cos(a) * 12} ${y + 8 + Math.sin(a) * 12}`,
        'none', { stroke: '#78837e', 'stroke-width': .7, opacity: .75 }));
    }
  }
  g.append(P(`M${x} ${y + 8}l15-22 18 22 12-16M${x + 15} ${y - 14}h16l19 14`,
    'none', { stroke: '#c0573f', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  g.append(P(`M${x + 44} ${y - 8}l9-11`, 'none', { stroke: '#2d383a', 'stroke-width': 2.4 }));
  g.append(R(x + 42, y - 24, 18, 4, '#3b3933', { rx: 2 }));
  g.append(P(`M${x + 8} ${y - 18}h14`, 'none', { stroke: '#3b3933', 'stroke-width': 3 }));
  g.append(P(`M${x + 3} ${y - 20}l4 4M${x + 17} ${y - 20}l-4 4`, 'none', {
    stroke: '#3b3933', 'stroke-width': 2,
  }));
  g.append(R(x + 37, y - 36, 20, 13, 'none', {
    stroke: '#4b5a56', 'stroke-width': 1.5, rx: 2,
  }));
  return g;
}

function foodCart(x, y) {
  const g = h('g');
  g.append(E(x + 50, y + 34, 52, 8, 'rgba(18,28,28,.28)', { filter: 'url(#blur4)' }));
  g.append(R(x, y, 96, 30, '#7a4a39', { rx: 2 }));
  g.append(R(x + 6, y + 5, 84, 4, '#a86a4f'));
  g.append(R(x + 8, y + 10, 70, 2, 'rgba(240,220,180,.2)'));
  g.append(R(x + 82, y + 8, 8, 22, '#4b342a'));
  g.append(R(x + 6, y + 30, 8, 10, '#3d4642'));
  g.append(R(x + 82, y + 30, 8, 10, '#3d4642'));
  // Umbrella.
  g.append(P(`M${x + 48} ${y - 4}v-54`, 'none', { stroke: '#4a3a2e', 'stroke-width': 3 }));
  g.append(P(`M${x - 6} ${y - 56}q54-42 108 0z`, '#b84a38'));
  g.append(P(`M${x + 42} ${y - 56}q6 8 12 0M${x + 20} ${y - 56}q6 8 12 0M${x + 64} ${y - 56}q6 8 12 0`, 'none', {
    stroke: '#efd9bc', 'stroke-width': 1.2, opacity: .6,
  }));
  // Steam and a lamp.
  g.append(E(x + 50, y - 2, 13, 24, 'rgba(245,225,190,.2)', { filter: 'url(#blur8)' }));
  g.append(C(x + 88, y - 2, 4, YELLOW));
  g.append(C(x + 88, y - 2, 18, 'url(#warmPool)', { opacity: .55 }));
  return g;
}

function cat(x, y) {
  const g = h('g', { transform: `translate(${x} ${y})` });
  g.append(E(0, 4, 12, 3, 'rgba(18,28,28,.28)'));
  g.append(E(0, -3, 11, 7, '#d9b45a'));
  g.append(C(7, -10, 5, '#d9b45a'));
  g.append(P('M4 -14l2-6 4 5M11 -14l4-5 1 6', '#d9b45a'));
  g.append(C(9, -11, .8, INK));
  g.append(P('M-10 -4q-8-1-9-7', 'none', { stroke: '#d9b45a', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  return g;
}

/* ---------------------------------------------------------------- people */
function person({
  x, y, s = 1, skin = '#e7b18c', hair = '#2a2320', top = TEAL,
  bottom = '#2d3a40', shoe = '#e8e0d1', accent = '#d9b45a',
  facing = 'right', backpack = true, camera = true, pose = 'idle',
  hairStyle = 'short', glasses = false, apron = false, basket = false,
  deliveryBox = false, scarf = false, bag = false,
}) {
  const g = h('g', { transform: `translate(${x} ${y}) scale(${s})` });
  // 3/4 front view: a slight turn is enough. Never draw a strict profile with
  // one eye on these small figures; both eyes stay readable.
  const profile = false;
  const turn = facing === 'left' ? -2.2 : facing === 'right' ? 2.2 : 0;
  const dir = facing === 'left' ? -1 : 1;
  const walking = pose === 'walk';
  g.append(E(2, 1, 23, 6, 'rgba(8,18,20,.3)'));
  g.append(E(11, 3, 32, 8, 'rgba(8,18,20,.13)', { filter: 'url(#blur4)' }));

  // Backpack sits behind the body.
  if (deliveryBox) {
    const bx = profile ? -dir * 10 - 20 : -24;
    g.append(R(bx, -58, 24, 34, '#c9553f', { rx: 4 }));
    g.append(R(bx + 3, -54, 18, 4, 'rgba(255,240,220,.3)', { rx: 2 }));
    g.append(R(bx + 6, -45, 12, 10, '#e8d8b8', { rx: 2 }));
    g.append(P(`M${bx + 8} -42h8M${bx + 8} -38h5`, 'none', { stroke: '#8f3f32', 'stroke-width': 1.4 }));
    g.append(R(bx - 2, -62, 6, 8, '#3f3a32', { rx: 2 }));
  } else if (backpack && facing !== 'back') {
    const bx = profile ? -dir * 7 - 11 : -23;
    g.append(R(bx, -59, 13, 30, accent, { rx: 5 }));
    g.append(R(bx + 2, -55, 9, 3, 'rgba(255,245,220,.3)', { rx: 1 }));
    g.append(R(bx + 4, -45, 5, 7, '#b98f3e', { rx: 2 }));
  }
  if (backpack && facing === 'back') {
    g.append(R(-17, -59, 34, 32, accent, { rx: 7 }));
    g.append(R(-13, -55, 26, 4, 'rgba(255,245,220,.32)', { rx: 2 }));
    g.append(R(-7, -44, 14, 12, '#b98f3e', { rx: 3 }));
    g.append(R(-2, -30, 5, 10, '#d4553d', { rx: 2 }));
    g.append(P('M-20 -57L-8 -48M20 -57L8 -48', 'none', {
      stroke: '#5d4d32', 'stroke-width': 2,
    }));
  }

  // Legs.
  const lx = walking ? -12 : -9;
  const rx = walking ? 3 : 1;
  const lh = walking ? 26 : 28;
  const rh = walking ? 30 : 28;
  g.append(R(lx, -lh - 4, 8, lh, bottom, { rx: 3 }));
  g.append(R(rx, -rh - 4, 8, rh, bottom, { rx: 3 }));
  g.append(R(lx - 2, -4 - (walking ? 2 : 0), 12, 5, shoe, { rx: 2 }));
  g.append(R(rx - 1, -4, 12, 5, shoe, { rx: 2 }));
  g.append(R(lx - 2, -1, 12, 2, 'rgba(20,30,30,.35)', { rx: 1 }));
  g.append(R(rx - 1, -1, 12, 2, 'rgba(20,30,30,.35)', { rx: 1 }));

  // Jacket.
  if (profile) {
    g.append(P('M-12 -61Q0 -65 12 -60L10 -33Q0 -29 -9 -33Z', top));
  } else {
    g.append(P('M-16 -61Q0 -66 16 -61L13 -33Q0 -28 -13 -33Z', top));
  }
  g.append(P('M0 -63V-31', 'none', { stroke: 'rgba(20,35,35,.22)', 'stroke-width': 1.2 }));
  g.append(P('M-12 -33Q0 -30 12 -33', 'none', { stroke: 'rgba(20,35,35,.25)', 'stroke-width': 1.4 }));
  // Collar and optional scarf.
  if (scarf) {
    g.append(P('M-8 -61Q0 -57 8 -61', 'none', { stroke: '#e8ddc5', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    g.append(P(`M${profile ? -dir * 2 : 2} -58q${dir * 4} 6 ${dir * 2} 12`, 'none', {
      stroke: '#e8ddc5', 'stroke-width': 2.2, 'stroke-linecap': 'round',
    }));
  } else {
    g.append(P('M-7 -61L0 -56l7-5', 'none', { stroke: '#efe3ca', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
  }

  // Arms.
  if (profile) {
    g.append(P(`M${dir * 5} -59Q${dir * 12} -50 ${dir * 10} -35`, 'none', {
      stroke: top, 'stroke-width': 6, 'stroke-linecap': 'round',
    }));
    g.append(C(dir * 10, -34, 3, skin));
  } else {
    g.append(P(`M-16 -59Q-22 -50 -20 -35`, 'none', {
      stroke: top, 'stroke-width': 6, 'stroke-linecap': 'round',
    }));
    g.append(P(`M16 -59Q22 -50 20 -35`, 'none', {
      stroke: top, 'stroke-width': 6, 'stroke-linecap': 'round',
    }));
    g.append(C(-20, -34, 3, skin));
    g.append(C(20, -34, 3, skin));
  }

  // Neck and head.
  g.append(R(-3, -69, 6, 8, skin));
  g.append(C(0, -82, 14.5, skin));
  if (facing === 'back') {
    if (hairStyle === 'helmet') {
      g.append(P('M-17 -82Q-18 -103 0 -104Q18 -103 17 -82Z', accent));
      g.append(P('M-13 -98Q0 -108 13 -98', 'none', { stroke: 'rgba(255,245,220,.45)', 'stroke-width': 3 }));
      g.append(P('M-15 -88Q0 -82 15 -88', 'none', { stroke: 'rgba(30,40,40,.3)', 'stroke-width': 2 }));
      g.append(P('M-8 -68Q0 -64 8 -68', 'none', { stroke: '#3f3a32', 'stroke-width': 2 }));
    } else if (hairStyle === 'bun') {
      g.append(C(0, -101, 6, hair));
      g.append(R(-3, -104, 6, 2, accent, { rx: 1 }));
      g.append(P('M-16 -81Q-17 -99 0 -100Q17 -99 16 -81L13 -66Q6 -71 0 -71Q-6 -71 -13 -66Z', hair));
    } else if (hairStyle === 'bob') {
      g.append(P('M-16 -81Q-18 -101 0 -102Q18 -101 16 -81L17 -66Q10 -62 7 -68L6 -78Q3 -84 0 -84Q-3 -84 -6 -78L-7 -68Q-10 -62 -17 -66Z', hair));
      g.append(P('M-9 -72q9 4 18 0', 'none', { stroke: 'rgba(20,30,30,.22)', 'stroke-width': 1.4 }));
    } else {
      g.append(P('M-16 -81Q-17 -99 0 -100Q17 -99 16 -81L13 -64Q6 -70 0 -70Q-6 -70 -13 -64Z', hair));
      g.append(P('M-9 -72q9 4 18 0', 'none', { stroke: 'rgba(20,30,30,.22)', 'stroke-width': 1.4 }));
    }
  } else {
    if (hairStyle === 'helmet') {
      g.append(P('M-17 -82Q-19 -104 0 -105Q19 -104 17 -82Z', accent));
      g.append(P('M-13 -98Q0 -108 13 -98', 'none', { stroke: 'rgba(255,245,220,.5)', 'stroke-width': 3 }));
      g.append(P(`M${-dir * 4} -86h${dir * 20}`, 'none', { stroke: 'rgba(30,40,40,.35)', 'stroke-width': 2 }));
      g.append(P(`M${-dir * 2} -81l${dir * 17} 2`, 'none', { stroke: '#3f3a32', 'stroke-width': 1.6 }));
    } else if (hairStyle === 'bun') {
      g.append(C(profile ? -dir * 10 : 0, -99, 6, hair));
      g.append(R(profile ? -dir * 12 : -3, -103, 6, 2, accent, { rx: 1 }));
      g.append(P('M-16 -82Q-17 -99 0 -100Q17 -99 16 -82Q8 -88 0 -88Q-8 -88 -16 -82Z', hair));
    } else if (hairStyle === 'bob') {
      g.append(P('M-17 -82Q-18 -101 0 -102Q18 -101 17 -82L16 -68Q13 -65 10 -69L9 -82Q6 -88 0 -88Q-6 -88 -9 -82L-10 -69Q-13 -65 -16 -68Z', hair));
    } else if (hairStyle === 'wavy') {
      g.append(P('M-16 -82Q-17 -99 0 -100Q17 -99 16 -82Q8 -88 0 -88Q-8 -88 -16 -82Z', hair));
      g.append(P('M-16 -84q-4 8 0 14M16 -84q4 8 0 14', 'none', {
        stroke: hair, 'stroke-width': 4, 'stroke-linecap': 'round',
      }));
    } else {
      g.append(P('M-16 -82Q-17 -99 0 -100Q17 -99 16 -82Q8 -88 0 -88Q-8 -88 -16 -82Z', hair));
    }
    if (profile) {
      if (hairStyle !== 'helmet') {
        g.append(P(`M${-dir * 14} -84Q${-dir * 20} -78 ${-dir * 14} -68`, hair, { opacity: .9 }));
      }
      g.append(C(dir * 5, -82, 1.4, INK));
      g.append(P(`M${dir * 8} -78q${dir * 3} 1 ${dir * 1} 2`, 'none', {
        stroke: '#b7775f', 'stroke-width': 1.3, 'stroke-linecap': 'round',
      }));
      g.append(P(`M${dir * 2} -73q${dir * 3} 1.4 ${dir * 5} 0`, 'none', {
        stroke: '#9c5b4b', 'stroke-width': 1.2, 'stroke-linecap': 'round',
      }));
      g.append(C(-dir * 13, -79, 2.5, skin));
      if (glasses) {
        g.append(C(dir * 5, -82, 3.4, 'none', { stroke: '#2a2320', 'stroke-width': 1 }));
        g.append(P(`M${dir * 8} -82h${dir * 5}`, 'none', { stroke: '#2a2320', 'stroke-width': 1 }));
      }
    } else {
      const near = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
      g.append(C(-5 + turn, -81, near < 0 ? 1.55 : 1.3, INK));
      g.append(C(5 + turn, -81, near > 0 ? 1.55 : 1.3, INK));
      g.append(P(`M${-1 + turn} -76q2 1.2 4 0`, 'none', { stroke: '#b7775f', 'stroke-width': 1.2 }));
      g.append(P(`M${-4 + turn} -73q4 1.6 8 0`, 'none', { stroke: '#9c5b4b', 'stroke-width': 1.2 }));
      if (glasses) {
        for (const s of [-1, 1]) {
          g.append(C(s * 5 + turn, -81, 3.4, 'none', { stroke: '#2a2320', 'stroke-width': 1 }));
        }
        g.append(P(`M${-1.6 + turn} -81h3.2`, 'none', { stroke: '#2a2320', 'stroke-width': 1 }));
      }
    }
  }

  // Apron and carried things.
  if (apron) {
    g.append(P('M-10 -58h20l5 28H-15Z', '#e8ddc5'));
    g.append(P('M-10 -58l-4-4M10 -58l4-4', 'none', { stroke: '#cfc2a8', 'stroke-width': 2 }));
    g.append(R(-9, -48, 18, 1.6, 'rgba(60,50,40,.25)'));
  }
  if (basket) {
    const hx = profile ? dir * 14 : 20;
    g.append(P(`M${hx - 8} -38h16l-2 11h-12z`, '#b98a55'));
    g.append(P(`M${hx - 8} -38h16M${hx - 7} -34h14`, 'none', { stroke: '#8c6538', 'stroke-width': 1 }));
    g.append(P(`M${hx - 6} -38q6-9 12 0`, 'none', { stroke: '#8c6538', 'stroke-width': 1.4 }));
    g.append(C(hx - 2, -39, 2, '#5f7d55'));
    g.append(C(hx + 3, -40, 2.4, '#6f8a5e'));
  }
  if (bag) {
    const hx = profile ? dir * 13 : 21;
    g.append(P(`M${hx - 6} -38h13l-2 14h-9z`, '#c9b48a'));
    g.append(P(`M${hx - 5} -38q5-10 11 0`, 'none', { stroke: '#8c6538', 'stroke-width': 1.2 }));
  }

  // Camera and strap.
  if (camera && facing !== 'back') {
    const cx = profile ? dir * 9 : 5;
    g.append(P(`M${-dir * 4} -60L${cx - 2} -49`, 'none', {
      stroke: '#3a2f2a', 'stroke-width': 1.6,
    }));
    g.append(R(cx, -54, 10, 7, '#263235', { rx: 2 }));
    g.append(C(cx + 5, -50.5, 2.2, '#8ab5ad'));
    g.append(R(cx + 1, -52.5, 2, 1.5, YELLOW, { rx: .5 }));
  }

  // Rim light from the cool sky on the left, warm shop light on the right.
  g.append(P(profile ? `M${-dir * 12} -60Q${-dir * 16} -45 ${-dir * 11} -34` : 'M-16 -59Q-22 -50 -20 -35', 'none', {
    stroke: 'rgba(230,240,225,.22)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
  }));
  g.append(P(profile ? `M${dir * 10} -58Q${dir * 13} -46 ${dir * 9} -36` : 'M16 -59Q22 -50 20 -35', 'none', {
    stroke: 'rgba(255,185,105,.18)', 'stroke-width': 1.4, 'stroke-linecap': 'round',
  }));
  return g;
}

function people(mode) {
  const g = h('g', { id: 'people' });
  if (mode === 'title') {
    g.append(h('g', { transform: 'translate(780 612) scale(.5)' }, heroFigure('threeQuarter', 'male')));
    g.append(person({
      x: 478, y: 464, s: .8, facing: 'right', top: '#d8cbb2',
      bottom: '#4b3f35', accent: '#6c8f84', camera: false, backpack: false,
      hair: '#4a4038', apron: true, glasses: true,
    }));
  } else {
    g.append(h('g', { transform: 'translate(590 620) scale(.42)' }, heroFigure('threeQuarter', 'male')));
    g.append(person({
      x: 478, y: 486, s: .82, facing: 'right', top: '#d8cbb2',
      bottom: '#4b3f35', accent: '#6c8f84', camera: false, backpack: false,
      hair: '#4a4038', apron: true, glasses: true,
    }));
    g.append(person({
      x: 946, y: 666, s: 1.06, facing: 'left', top: '#3f5f6a',
      bottom: '#2b3337', accent: '#d4553d', camera: false,
      backpack: false, deliveryBox: true, hairStyle: 'helmet',
    }));
    g.append(person({
      x: 812, y: 552, s: .87, facing: 'left', top: '#d9b45a',
      bottom: '#39464a', accent: '#4f8a7e', camera: false,
      backpack: false, bag: true, hairStyle: 'bob',
    }));
  }
  return g;
}

/* ------------------------------------------------------------ foreground */
function foreground() {
  const g = h('g', { id: 'foreground' });
  // Stone parapet and river railing.
  g.append(R(0, 696, 1280, 6, '#7b7565'));
  g.append(R(0, 702, 1280, 12, '#55544b'));
  g.append(R(0, 714, 1280, 4, 'rgba(20,30,30,.4)'));
  for (let x = 0; x < 1280; x += 26) {
    g.append(R(x, 700, 3, 16, '#3f4b4a'));
    g.append(C(x + 1.5, 700, 2.5, '#59645f'));
  }
  g.append(R(0, 694, 1280, 3, '#938c78'));
  // A blurred foreground branch at the lower left.
  g.append(P('M-30 760q48-70 132-92 50-14 98 8', 'none', {
    stroke: '#1d3333', 'stroke-width': 9, opacity: .8, filter: 'url(#blur4)',
  }));
  for (const [cx, cy, r] of [[36, 700, 24], [66, 676, 18], [104, 660, 22], [146, 656, 15]]) {
    g.append(C(cx, cy, r, '#1b3431', { opacity: .72, filter: 'url(#blur4)' }));
  }
  // A few blurred leaves at the lower right.
  for (const [cx, cy, r] of [[1230, 730, 34], [1198, 746, 24], [1260, 700, 20]]) {
    g.append(C(cx, cy, r, '#1b3431', { opacity: .6, filter: 'url(#blur8)' }));
  }
  return g;
}

function shopGlow() {
  const g = h('g', { 'pointer-events': 'none', style: 'mix-blend-mode:screen' });
  g.append(E(195, 386, 172, 32, 'url(#warmPool)', { opacity: .3, filter: 'url(#blur16)' }));
  g.append(E(540, 378, 152, 30, 'url(#warmPool)', { opacity: .28, filter: 'url(#blur16)' }));
  g.append(E(1050, 376, 174, 32, 'url(#coolPool)', { opacity: .3, filter: 'url(#blur16)' }));
  return g;
}

function overhead() {
  const g = h('g', { id: 'overhead' });
  // Sagging cables across the street.
  g.append(P('M-20 462Q300 510 640 496T1300 474', 'none', {
    stroke: '#1d2a2b', 'stroke-width': 1.3, opacity: .55,
  }));
  g.append(P('M-20 480Q360 536 700 516T1300 500', 'none', {
    stroke: '#1d2a2b', 'stroke-width': 1, opacity: .4,
  }));
  // A street lamp near the photo studio.
  g.append(E(472, 672, 17, 5, 'rgba(18,28,28,.3)', { filter: 'url(#blur4)' }));
  g.append(R(465, 668, 15, 5, '#3b4a47', { rx: 1 }));
  g.append(R(470, 512, 5, 160, '#33413f'));
  g.append(P('M473 513q22-24 50-18', 'none', { stroke: '#33413f', 'stroke-width': 4 }));
  g.append(R(514, 490, 24, 7, '#253230', { rx: 2 }));
  g.append(C(526, 498, 3, YELLOW));
  g.append(C(526, 498, 30, 'url(#warmPool)', { opacity: .45 }));
  return g;
}

function atmosphere() {
  return h('g', { 'pointer-events': 'none' },
    R(0, 0, 1280, 760, 'url(#duskGrade)', { style: 'mix-blend-mode:soft-light', opacity: .85 }),
    R(0, 610, 1280, 150, 'url(#riverFog)', { opacity: .45 }),
    E(640, 430, 430, 70, 'url(#warmPool)', { opacity: .08, filter: 'url(#blur24)' }),
    E(980, 600, 300, 80, 'url(#coolPool)', { opacity: .12, filter: 'url(#blur24)' }),
  );
}

function grain() {
  return h('g', { 'pointer-events': 'none' },
    h('rect', {
      x: 0, y: 0, width: 1280, height: 760,
      filter: 'url(#grain)', opacity: .55, style: 'mix-blend-mode:overlay',
    }),
    h('rect', {
      x: 0, y: 0, width: 1280, height: 760,
      fill: 'url(#coolPool)', opacity: .04, style: 'mix-blend-mode:soft-light',
    }),
  );
}

function buildScene(mode = 'play') {
  const desktop = size !== 'mobile';
  let box;
  if (mode === 'title') box = desktop ? '80 40 1160 688' : '0 80 1280 592';
  else box = desktop ? '180 170 920 546' : '140 230 1000 463';
  const svg = h('svg', {
    viewBox: box,
    preserveAspectRatio: 'xMidYMid slice',
    role: 'img',
    'aria-label': '现代山城街区样图',
    xmlns: NS,
  });
  svg.append(defs());
  svg.append(sky());
  svg.append(distantCity());
  svg.append(viaduct());
  svg.append(buildingA());
  svg.append(buildingB());
  svg.append(buildingC());
  svg.append(streetBase());
  svg.append(stairAlley());
  svg.append(streetShadows());
  svg.append(streetDetails());
  svg.append(shopGlow());
  svg.append(overhead());
  svg.append(people(mode));
  svg.append(foreground());
  svg.append(atmosphere());
  svg.append(grain());
  return svg;
}

/* ---------------------------------------------------------------- boot */
const scene = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function showLoading(isStatic = false) {
  if (!loadingEl) return;
  loadingEl.hidden = false;
  loadingEl.classList.remove('is-done');
  loadingEl.classList.toggle('is-static', isStatic);
}

function hideLoading() {
  if (!loadingEl) return;
  loadingEl.classList.add('is-done');
  window.setTimeout(() => {
    loadingEl.hidden = true;
    loadingEl.classList.remove('is-done');
  }, 360);
}

if (view === 'character') {
  scene.append(characterSheet());
} else if (loadingView) {
  scene.append(buildScene('title'));
  showLoading(true);
} else {
  scene.append(buildScene(view));
}

if (view === 'title') {
  const start = document.querySelector('#title .primary');
  start?.addEventListener('click', () => {
    showLoading(false);
    window.setTimeout(() => {
      scene.replaceChildren(buildScene('play'));
      document.body.dataset.view = 'play';
      hideLoading();
    }, 1900);
  });
}

document.fonts.ready.then(() => {
  document.body.dataset.ready = 'true';
});
