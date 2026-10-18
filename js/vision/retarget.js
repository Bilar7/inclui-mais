// Converte o que a câmara vê (MediaPipe: corpo, mãos e rosto) em fotogramas do intérprete 3D.
// Eixos do MediaPipe: x para a direita da imagem, y para baixo, z para longe da câmara.
// Eixos do avatar: x para a esquerda do intérprete (= direita da imagem), y para cima, z para quem vê.
// A conversão (x, −y, −z) é uma rotação de 180° em x: as medidas e os produtos vetoriais mantêm-se.
import { THUMB_TARGETS } from '../avatar/rig.js';
import { measureHand } from '../avatar/handmeasure.js';

const REF_SH = 1.455, REF_ARM = 0.56; // corpo de referência dos sinais (ver rig.js · toWorld)
const A = (p) => [p.x, -p.y, -(p.z || 0)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);

// pose: 11/12 ombros, 13/14 cotovelos, 15/16 pulsos (esquerdo/direito da pessoa)
const SIDE = { R: { sh: 12, el: 14, wr: 16, s: -1 }, L: { sh: 11, el: 13, wr: 15, s: 1 } };

/** Configuração da mão em ângulos absolutos (abs: o avatar desconta a sua própria pose de descanso). */
function handShape(m) {
  // dedo muito dobrado: a direção lateral deixa de ser fiável, por isso não se abre
  const s = m.s.map((v, i) => Math.round(m.f[i][0] > 50 ? 0 : v));
  let t = 'rest', best = Infinity;
  for (const [k, g] of Object.entries(THUMB_TARGETS)) { const d = Math.hypot(m.thumb[0] - g[0], m.thumb[1] - g[1], m.thumb[2] - g[2]); if (d < best) { best = d; t = k; } }
  return { f: m.f.map((x) => x.map(Math.round)), s, t, abs: true };
}

/**
 * Um fotograma do intérprete a partir de uma imagem da câmara.
 * pose / poseWorld: 33 pontos (imagem e metros) · hands / handsWorld: listas de 21 pontos · face: blendshapes (nome → peso)
 * Devolve { R, L, face } — cada mão: { p: posição do pulso, f: direção dos dedos, palm: normal da palma, hs } ou null.
 */
export function frameFrom({ pose, poseWorld, hands = [], handsWorld = [], face = null }) {
  if (!poseWorld) return null;
  const W = poseWorld.map(A), shMid = mul(add(W[11], W[12]), 0.5);
  const arm = (k) => len(sub(W[SIDE[k].sh], W[SIDE[k].el])) + len(sub(W[SIDE[k].el], W[SIDE[k].wr]));
  const scale = REF_ARM / (((arm('R') + arm('L')) / 2) || REF_ARM);
  // cada mão detetada pertence ao pulso do corpo que estiver mais perto na imagem
  const owner = hands.map((h) => {
    const d = (k) => Math.hypot(h[0].x - pose[SIDE[k].wr].x, h[0].y - pose[SIDE[k].wr].y);
    return d('R') < d('L') ? 'R' : 'L';
  });
  const out = { R: null, L: null, face };
  for (const k of ['R', 'L']) {
    const i = owner.indexOf(k);
    if (i < 0 || !handsWorld[i]) continue;
    const m = measureHand(handsWorld[i].map(A), SIDE[k].s);
    const rel = mul(sub(W[SIDE[k].wr], shMid), scale);
    out[k] = { p: r3([rel[0], REF_SH + rel[1], rel[2]]), f: r3(m.F), palm: r3(m.N), hs: handShape(m) };
  }
  return out;
}

// expressões do rosto que acompanham os sinais (sobrancelhas, olhos, boca)
const FACE_KEYS = ['browInnerUp', 'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight', 'eyeWideLeft', 'eyeWideRight',
  'eyeSquintLeft', 'eyeSquintRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthPucker', 'mouthFunnel', 'cheekPuff'];
export function faceFrom(categories) {
  if (!categories) return null;
  const o = {}; for (const c of categories) if (FACE_KEYS.includes(c.categoryName)) o[c.categoryName] = Math.round(c.score * 100) / 100;
  return o;
}
