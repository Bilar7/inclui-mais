// Liga qualquer avatar humanoide (Ready Player Me, Mixamo, Avaturn) ao motor de sinais:
// cinemática inversa dos braços, orientação da mão e articulações anatómicas dos dedos.
import * as THREE from 'three';
import { measureHand } from './handmeasure.js';

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const wpos = (o) => o.getWorldPosition(V());
const wquat = (o) => o.getWorldQuaternion(Q());
const D2R = Math.PI / 180;
const clean = (n) => n.replace(/^mixamorig[:_]?/i, '').replace(/^.*[:|]/, '');

// Nomes do esqueleto do Unreal / MetaHuman → nomes usados pela Inclui+
const UE = { upperarm: 'Arm', lowerarm: 'ForeArm', hand: 'Hand', clavicle: 'Shoulder', thigh: 'UpLeg' };
const UE_F = { index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Pinky', thumb: 'Thumb' };
// Esqueleto Biped (3ds Max / Microsoft Rocketbox): Bip01_L_UpperArm, Bip01_L_Finger12…
const BIP = { Pelvis: 'Hips', Spine: 'Spine', Spine1: 'Spine1', Spine2: 'Spine2', Neck: 'Neck', Head: 'Head', LEye: 'LeftEye', REye: 'RightEye' };
const BIP_LR = { Clavicle: 'Shoulder', UpperArm: 'Arm', Forearm: 'ForeArm', Hand: 'Hand', Thigh: 'UpLeg', Calf: 'Leg', Foot: 'Foot', Toe0: 'ToeBase' };
const BIP_F = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
function biped(n) {
  let m = n.match(/^Bip01_(\w+)$/); if (!m) return null;
  if (BIP[m[1]]) return BIP[m[1]];
  m = n.match(/^Bip01_(L|R)_(\w+?)(\d*)$/); if (!m) return null;
  const side = m[1] === 'L' ? 'Left' : 'Right';
  if (BIP_LR[m[2] + m[3]]) return side + BIP_LR[m[2] + m[3]];
  if (m[2] === 'Finger' && m[3]) return side + 'Hand' + BIP_F[+m[3][0]] + (m[3].length === 1 ? 1 : +m[3][1] + 1);
  return null;
}
function alias(n) {
  const b = biped(n); if (b) return b;
  const m = n.toLowerCase().match(/^(upperarm|lowerarm|hand|clavicle|thigh)_(l|r)$/);
  if (m) return (m[2] === 'l' ? 'Left' : 'Right') + UE[m[1]];
  const f = n.toLowerCase().match(/^(index|middle|ring|pinky|thumb)_0?([1-4])_(l|r)$/);
  if (f) return (f[3] === 'l' ? 'Left' : 'Right') + 'Hand' + UE_F[f[1]] + f[2];
  const o = { head: 'Head', neck_01: 'Neck', spine_05: 'Spine2', spine_04: 'Spine1', spine_03: 'Spine', pelvis: 'Hips' }[n.toLowerCase()];
  return o || null;
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

/** Constrói o "esqueleto de sinais" a partir do modelo carregado. Devolve null se faltar braços/dedos. */
export function buildRig(model) {
  const group = new THREE.Group();
  group.add(model);
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) { const c = clean(o.name); bones[c] = o; const a = alias(c); if (a && !bones[a]) bones[a] = o; }
    if (o.isMesh) o.frustumCulled = false;
  });
  const need = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightHandIndex1', 'RightHandMiddle1', 'RightHandPinky1', 'LeftHandIndex1', 'LeftHandMiddle1', 'LeftHandPinky1'];
  if (need.some((n) => !bones[n])) return null;

  // escala real (1,72 m), pés no chão, centrado e virado para a câmara (+Z)
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  model.scale.multiplyScalar(1.72 / (box.max.y - box.min.y));
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(V());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
  if (wpos(bones.RightArm).x > wpos(bones.LeftArm).x) group.rotation.y = Math.PI;
  group.updateMatrixWorld(true);

  const arm = (s, pre) => makeArm(s, pre, bones);
  const R = arm(-1, 'Right');
  const L = arm(1, 'Left');
  const chain = [R, L].flatMap((a) => a.all);
  const rest = new Map(chain.map((b) => [b, b.quaternion.clone()]));
  [R, L].forEach((a) => calibrateHand(a));

  const shMid = wpos(R.arm).add(wpos(L.arm)).multiplyScalar(0.5);
  const armLen = wpos(R.arm).distanceTo(wpos(R.fore)) + wpos(R.fore).distanceTo(wpos(R.hand));
  const head = bones.Head;
  return {
    group, bones, R, L, rest, shMid, armLen,
    headY: head ? wpos(head).y : shMid.y + 0.27,
    head, headRest: head?.quaternion.clone(),
    spine: bones.Spine2 || bones.Spine1, spineRest: (bones.Spine2 || bones.Spine1)?.quaternion.clone(),
  };
}

function makeArm(s, pre, bones) {
  const g = (n) => bones[pre + n];
  const fingers = FINGERS.map((f) => [1, 2, 3].map((i) => g('Hand' + f + i)).filter(Boolean));
  const tips = FINGERS.map((f) => g('Hand' + f + '4'));
  const thumb = [1, 2, 3].map((i) => g('HandThumb' + i)).filter(Boolean);
  const thumbTip = g('HandThumb4');
  const a = {
    s, arm: g('Arm'), fore: g('ForeArm'), hand: g('Hand'), fingers, tips, thumb, thumbTip,
    cur: { p: V(), q: Q(), shape: null }, goal: { p: V(), q: Q(), shape: null },
  };
  a.all = [a.arm, a.fore, a.hand, ...fingers.flat(), ...thumb];
  return a;
}

/** Referencial da mão: F = direção dos dedos, S = para o lado do polegar, N = normal da palma. */
function handFrame(a) {
  const h = wpos(a.hand);
  const F = wpos(a.fingers[1][0]).sub(h).normalize();
  const S = wpos(a.fingers[0][0]).sub(wpos(a.fingers[3][0])).normalize();
  S.addScaledVector(F, -S.dot(F)).normalize();
  const N = V().crossVectors(S, F).multiplyScalar(a.s < 0 ? 1 : -1).normalize();
  return { F, S, N };
}

// direção do osso: do osso para o filho seguinte
function boneDir(b, next) {
  const n = next || b.children.find((o) => o.isBone);
  return n ? wpos(n).sub(wpos(b)).normalize() : null;
}

/** Calcula, na pose de descanso, os eixos anatómicos de cada articulação (no espaço local do osso). */
function calibrateHand(a) {
  a.hand.updateWorldMatrix(true, true);
  const { F, S, N } = handFrame(a);
  // confirma o lado da palma: a base do polegar fica à frente da palma
  const tb = a.thumb[0] ? wpos(a.thumb[0]).sub(wpos(a.hand)) : null;
  const flip = tb && tb.dot(N) < -0.002 ? -1 : 1;
  const Np = N.clone().multiplyScalar(flip);
  const toLocal = (b, w) => w.clone().applyQuaternion(wquat(b).invert()).normalize();
  const signed = (b, axis, want, next) => {
    // garante que um ângulo positivo leva a ponta do osso na direção desejada
    const d = boneDir(b, next); if (!d) return axis;
    const moved = d.clone().applyAxisAngle(axis, 0.1).sub(d);
    return moved.dot(want) >= 0 ? axis : axis.clone().negate();
  };
  a.ax = { fingers: [], thumb: [] };
  a.fingers.forEach((ch, i) => {
    const list = ch.map((b, j) => {
      const next = ch[j + 1] || a.tips[i];
      const d = boneDir(b, next) || F;
      const flex = signed(b, V().crossVectors(d, Np).normalize(), Np, next);
      const spread = signed(b, Np.clone(), S, next);
      return { flex: toLocal(b, flex), spread: toLocal(b, spread) };
    });
    a.ax.fingers.push(list);
  });
  a.thumb.forEach((b, j) => {
    const next = a.thumb[j + 1] || a.thumbTip;
    const d = boneDir(b, next) || F;
    const across = S.clone().negate();                                   // para o lado do mindinho
    const flex = signed(b, V().crossVectors(d, Np).normalize(), Np, next); // dobrar para a palma
    const opp = signed(b, F.clone(), Np, next);                          // rodar para a frente da palma
    const abd = signed(b, Np.clone(), S, next);                          // afastar do indicador
    a.ax.thumb.push({ flex: toLocal(b, flex), opp: toLocal(b, opp), abd: toLocal(b, abd), across });
  });
  a.frame0 = { F, S, Np, origin: wpos(a.hand), P: wpos(a.fingers[1][0]).distanceTo(wpos(a.hand)) };
  // ângulos dos dedos em descanso (para converter mãos gravadas pela câmara, que vêm em ângulos absolutos)
  const pts = [a.hand, ...a.thumb, a.thumbTip || a.thumb[2], ...a.fingers.flatMap((ch, i) => [...ch, a.tips[i] || ch[2]])].map((b) => wpos(b).toArray());
  if (pts.length === 21) { const m = measureHand(pts, a.s); a.restAng = m.f; a.restSpread = m.s; }
  a.thumbPose = {};
  for (const [k, tgt] of Object.entries(THUMB_TARGETS)) a.thumbPose[k] = solveThumb(a, tgt);
  // repõe o descanso
  a.thumb.forEach((b) => b.quaternion.copy(a.thumbRest.get(b)));
}

// Onde deve ficar a ponta do polegar, em unidades do comprimento da palma:
// [para o lado do polegar, ao longo dos dedos, para a frente da palma]
export const THUMB_TARGETS = {
  out:    [0.95, 0.45, 0.12],  // L, Y, mão aberta
  side:   [0.42, 0.78, 0.18],  // A: encostado ao lado do indicador
  across: [-0.02, 0.72, 0.62], // S: por cima dos dedos fechados
  tuck:   [-0.22, 0.52, 0.3],  // B: dobrado sobre a palma
  oppose: [0.12, 0.9, 0.52],   // O, D, F: ponta com ponta
  cgap:   [0.32, 0.72, 0.62],  // C: abertura
  under:  [0.08, 0.92, 0.32],  // M, N: por baixo dos dedos
  between:[0.22, 1.0, 0.45],   // T: entre indicador e médio
  up:     [0.9, 0.3, 0.05],    // 👍
  rest:   [0.55, 0.55, 0.32],
};
// limites anatómicos dos dedos (graus): MCP, PIP, DIP — nunca dobram para trás nem além do humano
const FLEX_LIM = [[-12, 92], [0, 108], [0, 82]];
const T_BOUNDS = { abd: [-45, 60], opp: [-25, 95], cmc: [-25, 65], mcp: [-10, 65], ip: [-10, 80] };

function applyThumb(a, t) {
  a.thumb.forEach((b, j) => {
    const ax = a.ax.thumb[j], r = a.thumbRest.get(b);
    b.quaternion.copy(r);
    if (j === 0) {
      b.quaternion.multiply(_q.setFromAxisAngle(ax.abd, t.abd * D2R));
      b.quaternion.multiply(_q.setFromAxisAngle(ax.opp, t.opp * D2R));
      b.quaternion.multiply(_q.setFromAxisAngle(ax.flex, t.cmc * D2R));
    } else b.quaternion.multiply(_q.setFromAxisAngle(ax.flex, (j === 1 ? t.mcp : t.ip) * D2R));
  });
  a.thumb[0].updateWorldMatrix(false, true);
}
/** Procura os ângulos do polegar que levam a ponta ao alvo (feito uma vez por avatar). */
function solveThumb(a, tgt) {
  if (!a.thumbRest) a.thumbRest = new Map(a.thumb.map((b) => [b, b.quaternion.clone()]));
  const tip = a.thumbTip || a.thumb[a.thumb.length - 1];
  const { F, S, Np, origin, P } = a.frame0;
  const goal = origin.clone().addScaledVector(S, tgt[0] * P).addScaledVector(F, tgt[1] * P).addScaledVector(Np, tgt[2] * P);
  const t = { abd: 10, opp: 30, cmc: 10, mcp: 15, ip: 15 };
  const cost = () => { applyThumb(a, t); let c = wpos(tip).distanceTo(goal) / P;
    c += 0.00002 * (t.abd ** 2 + t.opp ** 2 + t.cmc ** 2) + 0.00004 * (t.mcp ** 2 + t.ip ** 2); return c; };
  let best = cost();
  for (let step = 16; step >= 0.5; step /= 2) {
    let improved = true;
    for (let it = 0; it < 40 && improved; it++) {
      improved = false;
      for (const k of Object.keys(t)) for (const dir of [1, -1]) {
        const old = t[k]; t[k] = THREE.MathUtils.clamp(old + dir * step, ...T_BOUNDS[k]);
        const c = cost(); if (c < best - 1e-6) { best = c; improved = true; } else t[k] = old;
      }
    }
  }
  return { ...t };
}

/* ---------- pose ---------- */
const REF_SH = 1.455, REF_ARM = 0.56;
export function toWorld(rig, p) {
  const k = rig.armLen / REF_ARM;
  return V().set(rig.shMid.x + p[0] * k, rig.shMid.y + (p[1] - REF_SH) * k, rig.shMid.z + p[2] * k);
}
const DIRS = { up: [0, 1, 0], down: [0, -1, 0], fwd: [0, 0, 1], back: [0, 0, -1], in: [1, 0, 0], out: [-1, 0, 0] };
export function dirV(spec, s) {
  const v = V();
  for (const k of spec.split('+')) {
    const d = DIRS[k];
    v.x += k === 'in' || k === 'out' ? d[0] * -s : 0; v.y += d[1]; v.z += d[2];
  }
  return v.normalize();
}
export function frameQuat(f, n) {
  const F = f.clone().normalize();
  const N = n.clone().addScaledVector(F, -n.dot(F));
  if (N.lengthSq() < 1e-6) N.set(0, 0, 1).addScaledVector(F, -F.z);
  N.normalize();
  const B = V().crossVectors(F, N);
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(F, N, B));
}

/* ---------- resolver o braço todos os fotogramas ---------- */
function setWQ(b, q) { b.quaternion.copy(wquat(b.parent).invert().multiply(q)); b.updateWorldMatrix(false, true); }
function rotToward(b, from, to) { setWQ(b, Q().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()).multiply(wquat(b))); }
function twistOf(q, axis) {
  const p = axis.clone().multiplyScalar(axis.dot(V().set(q.x, q.y, q.z)));
  const t = Q().set(p.x, p.y, p.z, q.w);
  return t.lengthSq() < 1e-9 ? Q() : t.normalize();
}
const _q = new THREE.Quaternion();

export function solveArm(rig, a) {
  for (const b of a.all) b.quaternion.copy(rig.rest.get(b));
  a.arm.updateWorldMatrix(true, true);
  const S = wpos(a.arm), E0 = wpos(a.fore), W0 = wpos(a.hand);
  const L1 = S.distanceTo(E0), L2 = E0.distanceTo(W0);
  const dir = a.cur.p.clone().sub(S); let d = dir.length(); dir.normalize();
  d = THREE.MathUtils.clamp(d, 0.25 * (L1 + L2), (L1 + L2) * 0.999);
  const ang = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const pole = V().set(a.s * 0.55, -1, -0.35).normalize(); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, L1 * Math.cos(ang)).addScaledVector(pole, L1 * Math.sin(ang));
  const W = S.clone().addScaledVector(dir, d);
  rotToward(a.arm, E0.clone().sub(S), E.clone().sub(S));
  const E1 = wpos(a.fore); rotToward(a.fore, wpos(a.hand).sub(E1), W.clone().sub(E1));
  // orientação da mão; parte da torção passa para o antebraço (pulso natural)
  const hf = handFrame(a);
  const want = a.cur.q.clone().multiply(frameQuat(hf.F, hf.N).invert()).multiply(wquat(a.hand));
  const fq = wquat(a.fore);
  const tw = twistOf(fq.clone().invert().multiply(want), a.hand.position.clone().normalize());
  setWQ(a.fore, fq.multiply(Q().slerp(tw, 0.6)));
  // pulso com limites humanos: dobra até ~75° e roda no máximo ~50° além do antebraço
  const fore2 = wquat(a.fore), rel = fore2.clone().invert().multiply(want);
  const axis = a.hand.position.clone().normalize();
  let twist = twistOf(rel, axis); const swing = rel.clone().multiply(twist.clone().invert());
  const lim = (q, max) => { const ang = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(q.w), 0, 1)); if (ang > max) q.copy(Q().slerp(q, max / ang)); return q; };
  lim(swing, 75 * D2R); lim(twist, 50 * D2R);
  setWQ(a.hand, fore2.multiply(swing.multiply(twist)));
  // dedos e polegar, em ângulos anatómicos (graus) sobre eixos calibrados
  const sh = a.cur.shape; if (!sh) return;
  a.fingers.forEach((ch, i) => ch.forEach((b, j) => {
    const ax = a.ax.fingers[i][j], r = rig.rest.get(b);
    b.quaternion.copy(r);
    if (j === 0 && sh.s[i]) b.quaternion.multiply(_q.setFromAxisAngle(ax.spread, THREE.MathUtils.clamp(sh.s[i], -22, 22) * D2R));
    b.quaternion.multiply(_q.setFromAxisAngle(ax.flex, THREE.MathUtils.clamp(sh.f[i][j], ...FLEX_LIM[j]) * D2R));
  }));
  applyThumb(a, sh.t);
}
/* ---------- corpo sólido: as mãos não atravessam o tronco, a cabeça nem a outra mão ---------- */
const SKIP_MESH = /hair|beard|glass|headwear|hat|eye|teeth|tongue|lash|brow/i;
const TORSO_BONES = /^(Hips|Spine|Spine1|Spine2|Neck)$/;
/**
 * Mede o corpo a partir da própria malha (vértices presos a cada osso):
 *  tronco = fatias horizontais com elipse (largura e profundidade reais, incluindo a roupa e o corpo escolhido);
 *  cabeça = esfera presa ao osso da cabeça (acompanha o olhar).
 */
export function measureBody(rig) {
  rig.group.updateMatrixWorld(true);
  const torso = [], head = [], v = V();
  const meshes = []; rig.group.traverse((o) => { if (o.isSkinnedMesh && !SKIP_MESH.test(o.name + ' ' + [].concat(o.material).map((m) => m.name).join(' '))) meshes.push(o); });
  for (const m of meshes) {
    m.skeleton.update();
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, n = m.geometry.attributes.position.count;
    const step = Math.max(1, Math.floor(n / 6000));
    for (let i = 0; i < n; i += step) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const name = clean(m.skeleton.bones[best]?.name || '');
      const isHead = name === 'Head' || alias(name) === 'Head';
      const isTorso = TORSO_BONES.test(name) || TORSO_BONES.test(alias(name) || '');
      if (!isHead && !isTorso) continue;
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      (isHead ? head : torso).push(v.clone());
    }
  }
  // acessórios sólidos (ex.: aba da bata) também contam como corpo
  rig.group.traverse((o) => {
    if (!o.isMesh || !o.userData.solid) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) torso.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  const body = { slices: [], head: null };
  if (torso.length > 50) {
    const y0 = Math.min(...torso.map((p) => p.y)), y1 = rig.shMid.y + 0.02, N = 14, hgt = (y1 - y0) / N;
    for (let k = 0; k < N; k++) {
      const pts = torso.filter((p) => p.y >= y0 + k * hgt && p.y < y0 + (k + 1) * hgt);
      if (pts.length < 8) continue;
      const xs = pts.map((p) => p.x).sort((a, b) => a - b), zs = pts.map((p) => p.z).sort((a, b) => a - b);
      const q = (arr, f) => arr[Math.floor(f * (arr.length - 1))];
      const xa = q(xs, 0.02), xb = q(xs, 0.98), za = q(zs, 0.02), zb = q(zs, 0.98);
      body.slices.push({ y: y0 + (k + 0.5) * hgt, cx: (xa + xb) / 2, cz: (za + zb) / 2, ax: (xb - xa) / 2, az: (zb - za) / 2 });
    }
    body.yMin = y0; body.yMax = y1;
  }
  if (head.length > 30 && rig.head) {
    const b = new THREE.Box3().setFromPoints(head), c = b.getCenter(V()), sz = b.getSize(V());
    // esfera um pouco menor que a caixa (o nariz e as orelhas não devem afastar demasiado as mãos)
    body.head = { local: rig.head.worldToLocal(c.clone()), r: Math.min(sz.x, sz.z) * 0.5 * 0.92, box: b };
  }
  rig.body = body;
  return body;
}
function sliceAt(body, y) {
  const S = body.slices; if (!S.length || y < body.yMin || y > body.yMax) return null;
  if (y <= S[0].y) return S[0]; if (y >= S[S.length - 1].y) return S[S.length - 1];
  for (let i = 0; i < S.length - 1; i++) if (y >= S[i].y && y <= S[i + 1].y) {
    const t = (y - S[i].y) / (S[i + 1].y - S[i].y), a = S[i], b = S[i + 1];
    return { cx: a.cx + (b.cx - a.cx) * t, cz: a.cz + (b.cz - a.cz) * t, ax: a.ax + (b.ax - a.ax) * t, az: a.az + (b.az - a.az) * t };
  }
  return null;
}
/** Quanto é preciso mover um ponto para ficar fora do corpo (vetor nulo se já está fora). */
function pushOut(rig, p, margin) {
  const out = V(), body = rig.body; if (!body) return out;
  const s = sliceAt(body, p.y);
  if (s) {
    const ax = s.ax + margin, az = s.az + margin;
    const dx = (p.x - s.cx) / ax, dz = (p.z - s.cz) / az, r2 = dx * dx + dz * dz;
    if (r2 < 1) {
      // sai pela frente do peito (direção mais natural para os sinais), ou pelo lado se já está de lado
      const r = Math.sqrt(r2) || 1e-3, k = 1 / r;
      const side = V().set(s.cx + dx * k * ax, p.y, s.cz + dz * k * az).sub(p);
      const front = V().set(0, 0, s.cz + az * Math.sqrt(Math.max(0, 1 - Math.min(1, dx * dx))) - p.z);
      out.copy(front.length() < side.length() * 1.6 ? front : side);
    }
  }
  if (body.head) {
    const c = rig.head.localToWorld(body.head.local.clone()), r = body.head.r + margin;
    const d = p.clone().sub(c), l = d.length();
    if (l < r) { const o = d.multiplyScalar((r - l) / Math.max(l, 1e-4)); if (o.length() > out.length()) out.copy(o); }
  }
  return out;
}
// segmento da mão: do pulso até à ponta dos dedos (mais curto com a mão fechada)
function handSegment(a) {
  const F = V().set(1, 0, 0).applyQuaternion(a.cur.q);
  const sh = a.cur.shape, curl = sh ? sh.f.reduce((s, f) => s + (f[0] + f[1] + f[2]) / 260, 0) / 4 : 0;
  const len = (a.frame0?.P || 0.09) * (1 + 0.95 * (1 - THREE.MathUtils.clamp(curl, 0, 1)));
  return [a.cur.p.clone(), a.cur.p.clone().addScaledVector(F, len)];
}
function closestSeg(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  let s = den > 1e-8 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
  return [p1.clone().addScaledVector(d1, s), p2.clone().addScaledVector(d2, t)];
}
const HAND_HALF = 0.016; // meia espessura da mão (m)
/** Corrige as posições das duas mãos para que fiquem fora do corpo e não se atravessem. */
export function resolveContacts(rig) {
  if (!rig.body) return;
  for (let it = 0; it < 3; it++) {
    for (const a of [rig.R, rig.L]) {
      const [w, tip] = handSegment(a), mid = w.clone().lerp(tip, 0.5);
      let o = V();
      for (const p of [w, mid, tip]) { const q = pushOut(rig, p, HAND_HALF); if (q.lengthSq() > o.lengthSq()) o = q; }
      a.cur.p.add(o);
    }
    const [a1, b1] = handSegment(rig.R), [a2, b2] = handSegment(rig.L);
    const [c1, c2] = closestSeg(a1, b1, a2, b2), d = c1.clone().sub(c2), l = d.length(), min = HAND_HALF * 2;
    if (l < min) {
      // as mãos tocam-se mas não entram uma na outra
      const n = l > 1e-4 ? d.divideScalar(l) : V().set(-1, 0, 0);
      rig.R.cur.p.addScaledVector(n, (min - l) / 2); rig.L.cur.p.addScaledVector(n, -(min - l) / 2);
    }
  }
}

/** Ângulos do polegar já resolvidos para este avatar, por nome de posição. */
export const thumbParams = (a, key) => a.thumbPose[key] || a.thumbPose.rest;
