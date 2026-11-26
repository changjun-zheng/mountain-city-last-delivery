const NS = 'http://www.w3.org/2000/svg';
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

const SKIN = '#e7b18c';
const SKIN_SHADE = '#d59b76';
const HAIR = '#2a2320';
const TOP = '#4f8a7e';
const TOP_LIGHT = '#63998d';
const TOP_DARK = '#3f7268';
const ACCENT = '#d9b45a';
const BOTTOM = '#2d3a40';
const SHOE = '#e8e0d1';

function heroShadow(female) {
  return h('g', {},
    E(0, -1, female ? 53 : 57, 10, 'rgba(20,34,32,.16)'),
    E(0, -3, female ? 42 : 46, 7, 'rgba(20,34,32,.12)'),
  );
}

function heroLegs(female, pose) {
  const g = h('g');
  const hip = female ? 25 : 28;
  const w = female ? 21 : 23;
  if (pose === 'threeQuarter') {
    // Far leg, turned away and a little darker.
    g.append(P(`M${-hip - w / 2 - 3} -87 H${-hip + w / 2 - 1} L${-hip + w / 2 - 5} -14 H${-hip - w / 2 - 6} Z`, '#263237'));
    g.append(R(-hip - w / 2 - 12, -14, w + 9, 12, '#d4cbb8', { rx: 4 }));
    g.append(R(-hip - w / 2 - 12, -4, w + 9, 4, '#bfb6a4', { rx: 2 }));
    // Near leg, with a half step toward the viewer.
    g.append(P(`M${hip - w / 2 + 1} -88 H${hip + w / 2 + 3} L${hip + w / 2 + 6} -14 H${hip - w / 2 - 2} Z`, BOTTOM));
    g.append(R(hip - w / 2 - 4, -14, w + 13, 12, SHOE, { rx: 4 }));
    g.append(R(hip - w / 2 - 4, -4, w + 13, 4, '#c9c0ae', { rx: 2 }));
    g.append(P(`M${hip - w / 2 + 6} -10 h8`, 'none', {
      stroke: 'rgba(60,60,55,.22)', 'stroke-width': 1.4,
    }));
  } else {
    for (const s of [-1, 1]) {
      const cx = s * hip;
      g.append(P(`M${cx - w / 2} -88 H${cx + w / 2} L${cx + w / 2 + s * 1.5} -14 H${cx - w / 2 + s * 1.5} Z`,
        s < 0 ? '#2a353a' : BOTTOM));
      g.append(P(`M${cx - w / 2 + 4} -52 q${s * 5} 2 ${s * 10} 0`, 'none', {
        stroke: 'rgba(255,255,255,.08)', 'stroke-width': 1.4,
      }));
      const sx = s < 0 ? cx - w / 2 - 10 : cx - w / 2 + 2;
      g.append(R(sx, -14, w + 8, 12, s < 0 ? '#dcd3c0' : SHOE, { rx: 4 }));
      g.append(R(sx, -4, w + 8, 4, '#c9c0ae', { rx: 2 }));
      g.append(P(`M${cx - 3} -10 h6`, 'none', {
        stroke: 'rgba(60,60,55,.22)', 'stroke-width': 1.3,
      }));
    }
  }
  return g;
}

function heroTorso(female, pose) {
  const g = h('g');
  const sh = female ? 33 : 42;
  const wst = female ? 25 : 30;
  let body;
  if (pose === 'threeQuarter') {
    body = `M${-sh + 2} -155 Q4 -164 ${sh + 2} -153 L${wst + 2} -84 Q2 -76 ${-wst - 2} -85 Z`;
  } else {
    body = `M${-sh} -157 Q0 -166 ${sh} -157 L${wst + 4} -84 Q0 -76 ${-wst - 4} -84 Z`;
  }
  g.append(P(body, TOP));
  // Left-hand light plane, kept broad and quiet.
  const light = pose === 'threeQuarter'
    ? `M${-sh + 2} -155 Q-18 -160 -8 -159 L${-wst + 4} -85 Q-22 -80 ${-wst - 2} -85 Z`
    : `M${-sh} -157 Q-18 -162 -6 -160 L${-wst + 4} -84 Q-22 -79 ${-wst - 4} -84 Z`;
  g.append(P(light, TOP_LIGHT, { opacity: .34 }));
  // Hem band and a single centre seam; no pockets, tags or zip pulls.
  if (pose !== 'threeQuarter') {
    g.append(P(`M${-wst - 4} -89 H${wst + 4} V-84 Q0 -76 ${-wst - 4} -84 Z`, TOP_DARK, { opacity: .55 }));
    g.append(P('M0 -154 V-84', 'none', { stroke: 'rgba(20,40,38,.24)', 'stroke-width': 1.4 }));
  } else {
    g.append(P(`M${-wst - 2} -90 H${wst + 2} V-84 Q2 -76 ${-wst - 2} -85 Z`, TOP_DARK, { opacity: .55 }));
    g.append(P('M5 -154 V-84', 'none', { stroke: 'rgba(20,40,38,.24)', 'stroke-width': 1.4 }));
  }
  return g;
}

function heroCollar(female, pose = 'front') {
  const g = h('g');
  const sh = female ? 33 : 42;
  if (pose === 'back') {
    g.append(P('M-15 -157 Q0 -163 15 -157 Q8 -150 0 -150 Q-8 -150 -15 -157 Z', TOP_DARK));
    return g;
  }
  if (pose === 'threeQuarter') {
    g.append(P('M-12 -156 L2 -145 L17 -155 L13 -160 L2 -151 L-8 -159 Z', TOP_DARK));
    g.append(P('M-1 -155 L4 -149 L11 -155 L4 -159 Z', '#efe3ca'));
    g.append(P(`M${-sh + 2} -154 Q-12 -158 2 -155`, 'none', {
      stroke: 'rgba(20,40,38,.3)', 'stroke-width': 1.4,
    }));
  } else {
    g.append(P('M-14 -157 L0 -145 L14 -157 L10 -161 L0 -152 L-10 -161 Z', TOP_DARK));
    g.append(P('M-7 -156 L0 -148 L7 -156 L0 -159 Z', '#efe3ca'));
    g.append(P('M-14 -157 Q0 -163 14 -157', 'none', {
      stroke: 'rgba(20,40,38,.3)', 'stroke-width': 1.4,
    }));
  }
  return g;
}

function heroArms(female, pose = 'front') {
  const g = h('g');
  const sh = female ? 33 : 42;
  const aw = female ? 11 : 12;
  if (pose === 'threeQuarter') {
    // Far arm, mostly behind the torso.
    g.append(P(`M${-sh + 6} -151 Q${-sh - 6} -124 ${-sh + 2} -94`, 'none', {
      stroke: TOP_DARK, 'stroke-width': aw + 3, 'stroke-linecap': 'round',
    }));
    g.append(C(-sh + 3, -88, female ? 6.4 : 7.2, SKIN));
    // Near arm.
    g.append(P(`M${sh - 6} -150 Q${sh + 16} -122 ${sh + 10} -89`, 'none', {
      stroke: TOP_DARK, 'stroke-width': aw + 4, 'stroke-linecap': 'round',
    }));
    g.append(P(`M${sh - 6} -150 Q${sh + 13} -123 ${sh + 8} -93`, 'none', {
      stroke: TOP, 'stroke-width': aw, 'stroke-linecap': 'round',
    }));
    g.append(P(`M${sh + 3} -99 q${4} 2 7 0`, 'none', {
      stroke: TOP_DARK, 'stroke-width': 2, 'stroke-linecap': 'round',
    }));
    g.append(C(sh + 9, -86, female ? 6.6 : 7.5, SKIN));
    g.append(E(sh + 11, -83, 2.5, 3, SKIN_SHADE, { opacity: .55 }));
  } else {
    for (const s of [-1, 1]) {
      const sx = s * (sh - 6);
      const ex = s * (sh + 9);
      g.append(P(`M${sx} -150 Q${s * (sh + 16)} -121 ${ex} -90`, 'none', {
        stroke: TOP_DARK, 'stroke-width': aw + 4, 'stroke-linecap': 'round',
      }));
      g.append(P(`M${sx} -150 Q${s * (sh + 13)} -122 ${ex - s * 1.5} -93`, 'none', {
        stroke: TOP, 'stroke-width': aw, 'stroke-linecap': 'round',
      }));
      g.append(P(`M${ex - s * 4} -98 q${s * 4} 2 ${s * 7} 0`, 'none', {
        stroke: TOP_DARK, 'stroke-width': 2, 'stroke-linecap': 'round',
      }));
      g.append(C(ex, -86, female ? 6.6 : 7.5, SKIN));
      g.append(E(ex + s * 2, -83, 2.5, 3, SKIN_SHADE, { opacity: .5 }));
    }
  }
  return g;
}

function heroPack(female, pose = 'front') {
  const g = h('g');
  const sh = female ? 33 : 42;
  if (pose === 'back') {
    g.append(R(-sh + 9, -150, (sh - 9) * 2, 69, ACCENT, { rx: 12 }));
    g.append(R(-sh + 13, -144, (sh - 13) * 2, 10, 'rgba(255,245,220,.3)', { rx: 5 }));
    g.append(R(-sh + 13, -120, (sh - 13) * 2, 26, '#c49a45', { rx: 6 }));
    g.append(P(`M${-sh + 15} -112 q${sh - 15} 8 ${(sh - 15) * 2} 0`, 'none', {
      stroke: '#8c6a2e', 'stroke-width': 2,
    }));
    g.append(R(-8, -132, 16, 10, '#8c6a2e', { rx: 2 }));
    g.append(R(-7, -129, 14, 4, ACCENT, { rx: 1 }));
    g.append(R(-sh + 9, -86, 8, 10, '#b98f3e', { rx: 3 }));
    g.append(R(sh - 17, -86, 8, 10, '#b98f3e', { rx: 3 }));
    g.append(P('M-10 -150 q10 -8 20 0', 'none', {
      stroke: '#8c6a2e', 'stroke-width': 3, 'stroke-linecap': 'round',
    }));
  } else if (pose === 'threeQuarter') {
    // The pack is slung on the far shoulder; only its outer edge shows.
    g.append(R(-sh - 13, -148, 30, 63, ACCENT, { rx: 10 }));
    g.append(R(-sh - 9, -143, 22, 9, 'rgba(255,245,220,.3)', { rx: 4 }));
    g.append(R(-sh - 9, -116, 22, 22, '#c49a45', { rx: 5 }));
    g.append(R(sh - 12, -149, 8, 10, '#8c6a2e', { rx: 2 }));
  } else {
    // Front: one yellow corner peeks out behind the left shoulder.
    g.append(R(-sh - 10, -151, 21, 37, ACCENT, { rx: 8 }));
    g.append(R(-sh - 7, -146, 15, 6, 'rgba(255,245,220,.3)', { rx: 3 }));
    g.append(R(-sh - 8, -127, 17, 11, '#c49a45', { rx: 4 }));
  }
  return g;
}

function heroCamera(pose = 'front') {
  const g = h('g');
  if (pose === 'back') return g;
  if (pose === 'threeQuarter') {
    g.append(P('M-8 -153 Q6 -137 22 -125', 'none', {
      stroke: '#3a2f2a', 'stroke-width': 1.6,
    }));
    g.append(P('M9 -151 Q17 -137 25 -125', 'none', {
      stroke: '#3a2f2a', 'stroke-width': 1.6,
    }));
    g.append(R(14, -125, 29, 19, '#263235', { rx: 4 }));
    g.append(R(18, -122, 11, 4, '#4b5a5b', { rx: 1 }));
    g.append(C(29, -116, 5.6, '#8ab5ad'));
    g.append(C(29, -116, 2.6, '#1d2a2b'));
    g.append(R(16, -123, 4, 3, ACCENT, { rx: 1 }));
  } else {
    g.append(P('M-11 -153 Q-7 -137 -4 -126', 'none', {
      stroke: '#3a2f2a', 'stroke-width': 1.6,
    }));
    g.append(P('M11 -153 Q7 -137 4 -126', 'none', {
      stroke: '#3a2f2a', 'stroke-width': 1.6,
    }));
    g.append(R(-15, -126, 30, 19, '#263235', { rx: 4 }));
    g.append(R(-11, -123, 12, 4, '#4b5a5b', { rx: 1 }));
    g.append(C(0, -116, 5.8, '#8ab5ad'));
    g.append(C(0, -116, 2.7, '#1d2a2b'));
    g.append(R(-13, -124, 4, 3, ACCENT, { rx: 1 }));
  }
  return g;
}

function heroHead(female, pose = 'front') {
  const g = h('g');
  const rx = female ? 32.5 : 34.5;
  const cy = -204;
  const ry = 36;
  // Neck: short, with a little trapezius so it does not read as a stalk.
  g.append(P('M-9 -172 L9 -172 L10 -152 Q0 -148 -10 -152 Z', SKIN_SHADE));
  g.append(P('M-7 -170 L7 -170 L7 -157 Q0 -153 -7 -157 Z', SKIN, { opacity: .72 }));
  g.append(P('M-10 -154 Q-24 -150 -34 -144 L-30 -138 Q-18 -144 -8 -148 Z', SKIN_SHADE, { opacity: .58 }));
  g.append(P('M10 -154 Q24 -150 34 -144 L30 -138 Q18 -144 8 -148 Z', SKIN_SHADE, { opacity: .58 }));

  if (pose === 'back') {
    g.append(E(0, cy, rx, ry, SKIN));
    g.append(E(-rx, cy, 4.5, 8, SKIN));
    g.append(E(rx, cy, 4.5, 8, SKIN));
    const backHair = female
      ? 'M-37 -208 Q-39 -244 0 -245 Q39 -244 37 -208 L36 -176 Q22 -168 0 -168 Q-22 -168 -36 -176 Z'
      : 'M-36 -208 Q-38 -243 0 -244 Q38 -243 36 -208 L34 -182 Q22 -172 0 -172 Q-22 -172 -34 -182 Z';
    g.append(P(backHair, HAIR));
    g.append(P('M-28 -232 q28 -12 56 0', 'none', {
      stroke: '#423832', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .75,
    }));
    if (female) {
      g.append(P('M-26 -186 Q0 -176 26 -186', 'none', {
        stroke: '#423832', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .55,
      }));
    } else {
      g.append(P('M-10 -176 q10 7 20 0', 'none', {
        stroke: HAIR, 'stroke-width': 5, 'stroke-linecap': 'round',
      }));
    }
    return g;
  }

  // Hair mass behind the head.
  if (female) {
    g.append(P('M-38 -214 Q-38 -246 0 -246 Q38 -246 38 -214 L37 -176 Q31 -168 25 -174 L24 -200 Q12 -214 0 -214 Q-12 -214 -24 -200 L-25 -174 Q-31 -168 -37 -176 Z', HAIR));
  } else {
    g.append(P('M-36 -214 Q-38 -242 0 -243 Q38 -242 36 -214 L33 -198 Q18 -206 0 -206 Q-18 -206 -33 -198 Z', HAIR));
  }

  // Face.
  g.append(E(0, cy, rx, ry, SKIN));
  g.append(P('M-28 -192 Q-20 -174 0 -171 Q20 -174 28 -192', 'none', {
    stroke: SKIN_SHADE, 'stroke-width': 2, opacity: .32,
  }));
  // Ears.
  const earX = pose === 'threeQuarter' ? rx : rx;
  g.append(E(earX, -204, 4.6, 8, SKIN));
  g.append(E(earX + 1, -204, 2, 4, SKIN_SHADE, { opacity: .55 }));
  if (pose !== 'threeQuarter') {
    g.append(E(-earX, -204, 4.6, 8, SKIN));
    g.append(E(-earX - 1, -204, 2, 4, SKIN_SHADE, { opacity: .55 }));
  }

  // Fringe, drawn over the forehead but above the eyes.
  if (female) {
    g.append(P('M-35 -216 Q-30 -242 0 -243 Q30 -242 35 -218 Q27 -229 17 -233 Q8 -236 0 -230 Q-8 -224 -17 -223 Q-27 -222 -35 -216 Z', HAIR));
    g.append(P('M-34 -210 Q-36 -192 -30 -177 Q-25 -168 -21 -177 L-23 -204 Z', HAIR));
    g.append(P('M34 -210 Q36 -192 30 -177 Q25 -168 21 -177 L23 -204 Z', HAIR));
  } else {
    g.append(P('M-34 -215 Q-29 -240 0 -241 Q29 -240 34 -217 Q26 -226 16 -227 Q5 -228 -3 -222 Q-13 -215 -23 -214 Q-30 -215 -34 -215 Z', HAIR));
    g.append(P('M-32 -205 q-1 6 1 9', 'none', {
      stroke: HAIR, 'stroke-width': 3.5, 'stroke-linecap': 'round',
    }));
    g.append(P('M32 -205 q1 6 -1 9', 'none', {
      stroke: HAIR, 'stroke-width': 3.5, 'stroke-linecap': 'round',
    }));
  }
  g.append(P('M-26 -232 Q-6 -243 18 -234', 'none', {
    stroke: '#423832', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: .7,
  }));

  // Face features. In three-quarter view both eyes stay visible; the near eye
  // is a touch larger and the far eye is slightly muted.
  const three = pose === 'threeQuarter';
  const farX = three ? -4 : -12.5;
  const nearX = three ? 18 : 12.5;
  const browFar = three ? -7 : -20;
  const browNear = three ? 20 : 7;
  const eyeW = female ? 1.06 : 1;
  g.append(P(`M${browFar} -219 q6 -3 13 0`, 'none', {
    stroke: HAIR, 'stroke-width': 2.3, 'stroke-linecap': 'round',
  }));
  g.append(P(`M${browNear} -219 q6 -3 13 0`, 'none', {
    stroke: HAIR, 'stroke-width': 2.3, 'stroke-linecap': 'round',
  }));
  const eye = (cx, wid, fade) => {
    g.append(P(`M${cx - wid} -210 Q${cx} -214.6 ${cx + wid} -210 Q${cx} -205.4 ${cx - wid} -210 Z`, INK, { opacity: fade }));
    g.append(C(cx - wid * .25, -211.4, 1.15, 'rgba(255,255,255,.82)', { opacity: fade }));
    g.append(P(`M${cx - wid + 1} -206 Q${cx} -203.4 ${cx + wid - 1} -206`, 'none', {
      stroke: SKIN_SHADE, 'stroke-width': 1, opacity: .55 * fade,
    }));
  };
  eye(farX, 5.2 * eyeW, three ? .88 : 1);
  eye(nearX, 5.8 * eyeW, 1);
  if (female) {
    g.append(P(`M${farX - 5.2} -210 l-3 -2`, 'none', {
      stroke: HAIR, 'stroke-width': 1.2, 'stroke-linecap': 'round',
    }));
    g.append(P(`M${nearX + 5.8} -210 l3 -2`, 'none', {
      stroke: HAIR, 'stroke-width': 1.2, 'stroke-linecap': 'round',
    }));
  }
  const noseX = three ? 8 : 0;
  g.append(P(`M${noseX} -206 Q${noseX - 1} -199 ${noseX + 1.5} -197`, 'none', {
    stroke: SKIN_SHADE, 'stroke-width': 2, 'stroke-linecap': 'round',
  }));
  g.append(P(`M${noseX - 3} -196 Q${noseX} -194 ${noseX + 3} -196`, 'none', {
    stroke: SKIN_SHADE, 'stroke-width': 1.1, opacity: .55, 'stroke-linecap': 'round',
  }));
  const mouthX = three ? 4 : 0;
  g.append(P(`M${mouthX - 6} -188 Q${mouthX} -184 ${mouthX + 6} -188`, 'none', {
    stroke: '#9c5b4b', 'stroke-width': 2.2, 'stroke-linecap': 'round',
  }));
  g.append(P(`M${mouthX - 4} -186 Q${mouthX} -183.5 ${mouthX + 4} -186`, 'none', {
    stroke: '#c97f6c', 'stroke-width': 1.2, opacity: .5, 'stroke-linecap': 'round',
  }));
  g.append(E(-24 + (three ? 4 : 0), -194, 7, 4, '#d98d72', { opacity: .2 }));
  if (!three) g.append(E(24, -194, 7, 4, '#d98d72', { opacity: .2 }));
  g.append(P('M-5 -174 Q0 -171 5 -174', 'none', {
    stroke: SKIN_SHADE, 'stroke-width': 1.3, opacity: .35, 'stroke-linecap': 'round',
  }));

  // Cool rim on the left, warm edge on the right.
  g.append(P(`M${-rx + 3} -226 Q${-rx - 4} -204 ${-rx + 6} -184`, 'none', {
    stroke: 'rgba(246,226,184,.28)', 'stroke-width': 2.4, 'stroke-linecap': 'round',
  }));
  return g;
}

export function heroFigure(pose = 'front', sex = 'male') {
  const female = sex === 'female';
  const g = h('g');
  g.append(heroShadow(female));
  g.append(heroPack(female, pose));
  g.append(heroLegs(female, pose));
  if (pose === 'threeQuarter') g.append(heroArms(female, pose));
  g.append(heroTorso(female, pose));
  if (pose !== 'threeQuarter') g.append(heroArms(female, pose));
  g.append(heroCollar(female, pose));
  g.append(heroCamera(pose));
  g.append(heroHead(female, pose));
  return g;
}

function proportionRow(svg, { y, top, feet, female, label, note }) {
  const chin = top + 72;
  svg.append(T(70, y, label, 12, '#8b6a38', { 'font-weight': 700, 'letter-spacing': 2 }));
  svg.append(T(70, y + 16, note, 9.5, '#7c7568'));
  const bx = 632;
  svg.append(P(`M${bx} ${top}h10v${feet - top}h-10`, 'none', {
    stroke: '#8b6a38', 'stroke-width': 1, opacity: .65,
  }));
  for (const yy of [top, chin, feet]) {
    svg.append(P(`M${bx - 5} ${yy}h16`, 'none', {
      stroke: '#8b6a38', 'stroke-width': 1, opacity: .5,
    }));
  }
  svg.append(T(652, top + 4, '头顶', 9.5, '#8b8171'));
  svg.append(T(652, chin + 4, '下颌', 9.5, '#8b8171'));
  svg.append(T(652, feet + 4, '脚底', 9.5, '#8b8171'));
  svg.append(T(652, top + 118, '3.3 头身', 10.5, '#8b6a38', { 'font-weight': 700 }));
  svg.append(T(652, top + 134, '身高 240u', 9.5, '#8b8171'));
  for (const [x, pose] of [[220, 'front'], [385, 'threeQuarter'], [550, 'back']]) {
    const figure = h('g', { transform: `translate(${x} ${feet})` }, heroFigure(pose, female ? 'female' : 'male'));
    svg.append(figure);
  }
  for (const [x, name] of [[220, '正面'], [385, '3/4 侧面'], [550, '背面']]) {
    svg.append(T(x, feet + 26, name, 10.5, '#5c584e', { 'text-anchor': 'middle', 'letter-spacing': 2 }));
  }
}

export function characterSheet() {
  const svg = h('svg', {
    viewBox: '0 0 1200 840', preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': '主角双性别角色基准', xmlns: NS,
  });
  svg.append(R(0, 0, 1200, 840, '#122224'));
  svg.append(R(30, 30, 1140, 780, '#f2e8d5', { rx: 6 }));
  svg.append(T(70, 92, '角色基准 / 双主角', 30, INK, { 'font-weight': 800, 'letter-spacing': 1 }));
  svg.append(T(70, 120, '现代山城都市插画 · 3.3 头身 · 男女两套基准 · 游戏内约 90px', 13, '#6f6a5e', { 'letter-spacing': .5 }));
  svg.append(R(70, 140, 1030, 1, 'rgba(18,34,36,.18)'));
  svg.append(R(70, 456, 665, 1, 'rgba(18,34,36,.14)'));

  proportionRow(svg, {
    y: 174, top: 196, feet: 432, female: false,
    label: '男主角基准 · 男', note: '短一些的头发、宽肩、直筒裤',
  });
  proportionRow(svg, {
    y: 482, top: 500, feet: 736, female: true,
    label: '女主角基准 · 女', note: '齐肩发、窄肩、微收腰，同一色系',
  });

  // Palette.
  svg.append(T(790, 182, '色板', 11, '#8b6a38', { 'font-weight': 700, 'letter-spacing': 2 }));
  const swatches = [
    ['#4f8a7e', '外套'], ['#2d3a40', '裤装'],
    ['#d9b45a', '背包'], ['#e7b18c', '肤色'],
    ['#2a2320', '发色'], ['#d4553d', '识别红'],
  ];
  swatches.forEach(([color, label], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 790 + col * 92, y = 198 + row * 52;
    svg.append(R(x, y, 42, 27, color, { rx: 2 }));
    svg.append(T(x + 21, y + 40, label, 9.5, '#5c584e', { 'text-anchor': 'middle' }));
  });

  // Drawing rules.
  svg.append(T(790, 370, '绘制规则', 11, '#8b6a38', { 'font-weight': 700, 'letter-spacing': 2 }));
  const notes = [
    '默认 3/4 前视，两只眼睛都要看得见',
    '领口到肩线留 10—12u，脖子不被头吞掉',
    '只保留相机与背包，不叠围巾、交叉带',
    '男女同色系，靠肩宽、发型、剪影区分',
    '每件物品都要有明确用途和接触阴影',
    '游戏内约 90px，省略不必要的衣纹',
  ];
  notes.forEach((line, i) => svg.append(T(790, 392 + i * 18, `· ${line}`, 10.5, '#5c584e')));

  // Game-scale figures.
  svg.append(T(790, 540, '游戏内尺寸', 11, '#8b6a38', { 'font-weight': 700, 'letter-spacing': 2 }));
  svg.append(h('g', { transform: 'translate(838 704) scale(.375)' }, heroFigure('front', 'male')));
  svg.append(h('g', { transform: 'translate(950 704) scale(.375)' }, heroFigure('front', 'female')));
  svg.append(R(802, 706, 110, 1, 'rgba(18,34,36,.22)'));
  svg.append(T(838, 728, '男 · 90px', 9.5, '#6f6a5e', { 'text-anchor': 'middle' }));
  svg.append(T(950, 728, '女 · 90px', 9.5, '#6f6a5e', { 'text-anchor': 'middle' }));

  svg.append(T(70, 790, 'STYLE-01 · A 现代山城都市插画 · 2026-11-25 · 修订：双性别基准', 9.5, '#8b8171', { 'letter-spacing': 1 }));
  return svg;
}
