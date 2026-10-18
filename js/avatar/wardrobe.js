// Guarda-roupa: troca a roupa peça a peça em qualquer modelo (ilustrado ou humano realista).
// As peças são geradas a partir da superfície da roupa original do próprio modelo, com os mesmos pesos dos ossos,
// por isso acompanham todos os movimentos. O que deixa de estar coberto (braços, pernas) aparece como pele.
import * as THREE from 'three';
import { attach } from './customize.js';

export const TOPS = { original: 'Do modelo', camiseta: 'Camiseta', camisa: 'Camisa', semmangas: 'Sem mangas', vestido: 'Vestido' };
export const BOTTOMS = { original: 'Do modelo', calcas: 'Calças', calcoes: 'Calções', saia: 'Saia' };
export const JACKETS = { nenhum: 'Nenhum', casaco: 'Casaco', bata: 'Bata' };
export const CLOTH = {
  branco: '#f4f6f8', 'azul-claro': '#a9cdee', azul: '#3b86d1', marinho: '#24395e', verde: '#46b07a', 'verde-escuro': '#2f6b4f',
  amarelo: '#f2c94c', laranja: '#e67e22', vermelho: '#c0392b', vinho: '#7b2638', rosa: '#e8a0b4', bege: '#d8c3a5',
  castanho: '#7a4b35', cinzento: '#8a94a3', preto: '#22252b',
};

const V = () => new THREE.Vector3();
// categorias de cada vértice, pelo osso que mais o move
const C = { torso: 0, hips: 1, upperArm: 2, fore: 3, hand: 4, thigh: 5, shin: 6, foot: 7 };
const UPPER = new Set([C.torso, C.upperArm, C.fore, C.hand]);
const LIMB = new Set([C.upperArm, C.fore, C.thigh, C.shin]);

/** Para cada osso: categoria e osso seguinte (para medir a posição ao longo do membro, de 0 a 1). */
function boneTable(rig) {
  const b = rig.bones, map = new Map();
  const put = (n, cat, next) => b[n] && map.set(b[n], { cat, next: next && b[next] });
  for (const n of ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']) put(n, C.torso);
  put('Hips', C.hips);
  for (const s of ['Left', 'Right']) {
    put(s + 'Arm', C.upperArm, s + 'ForeArm'); put(s + 'ForeArm', C.fore, s + 'Hand'); put(s + 'Hand', C.hand);
    put(s + 'UpLeg', C.thigh, s + 'Leg'); put(s + 'Leg', C.shin, s + 'Foot'); put(s + 'Foot', C.foot); put(s + 'ToeBase', C.foot);
  }
  return (bone) => { // ossos desconhecidos (dedos, ossos de torção) herdam do pai
    for (let o = bone; o; o = o.parent) if (map.has(o)) return map.get(o);
    return { cat: C.torso };
  };
}

/** Analisa uma malha de roupa uma única vez: categoria, posição ao longo do membro e posição no mundo de cada vértice. */
function analyse(rig, m) {
  if (m.userData.wr) return m.userData.wr;
  const info = boneTable(rig), geo = m.geometry, n = geo.attributes.position.count;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const cat = new Uint8Array(n), t = new Float32Array(n), axis = new Float32Array(n * 3), world = new Float32Array(n * 3), v = V(), a = V(), b = V();
  m.skeleton.update();
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const bone = m.skeleton.bones[best], inf = info(bone);
    m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); v.toArray(world, i * 3);
    cat[i] = inf.cat;
    if (inf.next) { bone.getWorldPosition(a); inf.next.getWorldPosition(b); const d = b.clone().sub(a); t[i] = THREE.MathUtils.clamp(v.clone().sub(a).dot(d) / d.lengthSq(), 0, 1); d.toArray(axis, i * 3); }
  }
  const toLocal = new THREE.Matrix3().setFromMatrix4(m.matrixWorld).invert(); // mundo → espaço da malha (pose de repouso)
  return (m.userData.wr = { cat, t, axis, world, toLocal, scale: V().setFromMatrixScale(m.matrixWorld).x });
}

// O que cada peça cobre: para cada parte do corpo, até onde vai (0 = nada, 1 = tudo, 0.5 = até meio do membro)
//                 tronco anca braço antebraço mão coxa perna pé
const COVER = {
  camiseta:  [1, 1, 0.5, 0, 0, 0, 0, 0],
  camisa:    [1, 1, 1, 0.93, 0, 0, 0, 0],
  semmangas: [1, 1, 0.05, 0, 0, 0, 0, 0],
  vestido:   [1, 1, 0.05, 0, 0, 0, 0, 0],
  calcas:    [1, 1, 0, 0, 0, 1, 0.95, 0],
  calcoes:   [1, 1, 0, 0, 0, 0.6, 0, 0],
  saia:      [1, 1, 0, 0, 0, 0, 0, 0],
  jacket:    [1, 1, 1, 0.88, 0, 0, 0, 0],
};
const covers = (lim, c, tt) => lim[c] > 0 && (lim[c] >= 1 || tt <= lim[c]);

/** Copia um conjunto de triângulos de uma malha com ossos, afastando-os da pele (offset em metros, + para fora). */
function subset(m, tris, offset, scale, shift) {
  const src = m.geometry, idx = src.index ? src.index.array : null, remap = new Map(), order = [];
  const out = [];
  for (const tr of tris) for (let k = 0; k < 3; k++) {
    const vi = idx ? idx[tr * 3 + k] : tr * 3 + k;
    if (!remap.has(vi)) { remap.set(vi, order.length); order.push(vi); }
    out.push(remap.get(vi));
  }
  const g = new THREE.BufferGeometry(), off = offset / scale;
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const a = src.attributes[name]; if (!a) continue;
    const arr = new a.array.constructor(order.length * a.itemSize);
    order.forEach((vi, j) => { for (let c = 0; c < a.itemSize; c++) arr[j * a.itemSize + c] = a.getComponent(vi, c); });
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  const p = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const d = shift?.(order[i]); // bainha: vértices fora do limite são puxados até à linha do corte
    if (d) p.setXYZ(i, p.getX(i) + d.x, p.getY(i) + d.y, p.getZ(i) + d.z);
    if (off && nn) p.setXYZ(i, p.getX(i) + nn.getX(i) * off, p.getY(i) + nn.getY(i) * off, p.getZ(i) + nn.getZ(i) * off);
  }
  g.setIndex(out);
  return g;
}
function skinned(m, geo, mat, name) {
  const s = new THREE.SkinnedMesh(geo, mat);
  s.name = name; s.frustumCulled = false; s.bindMode = m.bindMode;
  s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale);
  m.parent.add(s); s.bind(m.skeleton, m.bindMatrix);
  return s;
}

/* ---------- materiais ---------- */
let weave = null;
function fabric() { // textura de tecido muito suave (trama), igual em todas as peças
  if (weave) return weave;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(0,0,0,${0.025 + Math.random() * 0.03})`; x.fillRect(0, i, 128, 1); x.fillRect(i, 0, 1, 128); }
  weave = new THREE.CanvasTexture(c); weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(24, 24); weave.colorSpace = THREE.SRGBColorSpace;
  return weave;
}
const cloth = (color) => new THREE.MeshStandardMaterial({ color, map: fabric(), roughness: 0.86, side: THREE.DoubleSide });
const skinMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

/** Cor média da pele do rosto (para braços e pernas que ficam à mostra nos modelos realistas). */
function faceColor(rig) {
  if (rig.faceColor) return rig.faceColor;
  let col = '#c99773';
  const head = rig.parts.skin.find(({ mesh }) => /head/i.test(mesh.name))?.mat;
  try {
    const img = head?.map?.image, c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    x.drawImage(img, 0, 0, 32, 32); const d = x.getImageData(8, 8, 16, 16).data; let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
    if (n) col = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)})`;
  } catch { /* textura indisponível: tom padrão */ }
  return (rig.faceColor = col);
}

/* ---------- peças extra: saia, aba da bata e gravata ---------- */
// Medidas tiradas da própria roupa: largura da anca, frente do peito, altura do joelho.
function bodyRefs(rig, meshes) {
  const hip = [], front = [];
  const yHip = rig.bones.Hips.getWorldPosition(V()).y, knee = (rig.bones.LeftLeg || rig.bones.Hips).getWorldPosition(V()).y;
  for (const m of meshes) {
    const { cat, world } = analyse(rig, m);
    for (let i = 0; i < cat.length; i++) {
      const x = world[i * 3], y = world[i * 3 + 1], z = world[i * 3 + 2];
      if ((cat[i] === C.hips || cat[i] === C.thigh) && Math.abs(y - yHip) < 0.05) hip.push([x, z]);
      if (cat[i] === C.torso && Math.abs(x) < 0.03) front.push([y, z]);
    }
  }
  const ext = (arr, k) => [Math.min(...arr.map((p) => p[k])), Math.max(...arr.map((p) => p[k]))];
  const [x0, x1] = hip.length ? ext(hip, 0) : [-0.17, 0.17], [z0, z1] = hip.length ? ext(hip, 1) : [-0.11, 0.11];
  return { yHip, knee, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2,
    frontZ: (y) => { let best = -1; for (const [yy, z] of front) if (Math.abs(yy - y) < 0.015 && z > best) best = z; return best > -1 ? best : 0.12; } };
}
// Prende uma malha feita em coordenadas do mundo a um osso (segue esse osso).
function attachWorld(rig, bone, mesh) {
  const g = new THREE.Group(); attach(rig, bone, g);
  const holder = g.parent; holder.updateMatrixWorld(true);
  const p = mesh.geometry.attributes.position, v = V();
  for (let i = 0; i < p.count; i++) { holder.worldToLocal(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  mesh.geometry.computeVertexNormals(); g.add(mesh);
}
// Saia ou aba de bata: cone elíptico da cintura ao joelho (open = abertura à frente, em radianos)
function skirt(rig, R, color, { length, flare = 1.25, open = 0, solid = true, wide = 1, rise = 0.07 }) {
  const top = R.yHip + rise, bottom = R.knee - length, h = top - bottom;
  const g = new THREE.CylinderGeometry(1, flare, h, 56, 6, true, open / 2 + Math.PI, Math.PI * 2 - open);
  g.scale(R.rx * 1.06 * wide, 1, R.rz * 1.1 * wide); g.translate(R.cx, (top + bottom) / 2, R.cz);
  const m = new THREE.Mesh(g, cloth(color)); m.userData.solid = solid;
  attachWorld(rig, rig.bones.Hips, m);
}
// Gravata: nó no colarinho e lâmina sobre a camisa, a seguir a forma do peito
function tie(rig, R, color) {
  const neck = rig.shMid.y - 0.02, len = 0.36, pos = [], idx = [];
  const rows = 14;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, y = neck - t * len, w = t < 0.12 ? 0.012 + t * 0.06 : 0.019 + t * 0.026, z = R.frontZ(y) + 0.008;
    const tip = j === rows ? 0.03 : 0;
    pos.push(-w, y, z, 0, y - tip, z + 0.002, w, y, z);
  }
  for (let j = 0; j < rows; j++) { const a = j * 3, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.45, side: THREE.DoubleSide }));
  attachWorld(rig, rig.bones.Spine2 || rig.bones.Spine1, m);
}

/**
 * Veste o avatar. w = { top, bottom, jacket, tie, topColor, bottomColor, jacketColor, tieColor }.
 * Com tudo "original" mostra a roupa do modelo; caso contrário esconde-a e gera as peças escolhidas.
 */
export function dress(rig, w, skinColor) {
  rig.wear?.forEach((o) => o.parent?.remove(o)); rig.wear = [];
  const base = [...rig.parts.top, ...rig.parts.bottom].map((p) => p.mesh).filter((m, i, a) => m.isSkinnedMesh && a.indexOf(m) === i);
  const bottom = w.top === 'vestido' ? 'vestido' : w.bottom;
  const custom = w.top !== 'original' || bottom !== 'original' || w.jacket !== 'nenhum';
  base.forEach((m) => (m.visible = !custom));
  if (!custom || !base.length) return;
  const R = bodyRefs(rig, base);
  for (const m of base) {
    const { cat, t, axis, toLocal, scale, world } = analyse(rig, m);
    const idx = m.geometry.index ? m.geometry.index.array : null, nTri = (idx ? idx.length : cat.length) / 3;
    const names = m.name + [].concat(m.material).map((x) => x.name).join('');
    const onlyTop = rig.parts.top.some((p) => p.mesh === m) && !/_look_/.test(names);
    const lists = { orig: [], up: [], low: [], skin: [], jacket: [] };
    for (let tr = 0; tr < nTri; tr++) {
      const vs = [0, 1, 2].map((k) => (idx ? idx[tr * 3 + k] : tr * 3 + k)), cs = vs.map((v) => cat[v]);
      // a bainha da camisa original (presa à anca) continua a ser parte de cima
      const upper = cs.filter((c) => UPPER.has(c)).length >= 2 || (onlyTop && cs.every((c) => c === C.hips || UPPER.has(c)));
      const style = upper ? w.top : bottom;
      if (cs.some((c) => c === C.hand || c === C.foot)) { if (style === 'original') lists.orig.push(tr); continue; } // punhos e bainhas sobre mãos/pés
      if (w.jacket !== 'nenhum' && (upper || cs.some((c) => c === C.hips)) && vs.some((v) => covers(COVER.jacket, cat[v], t[v]))) lists.jacket.push(tr);
      if (style === 'original') { lists.orig.push(tr); continue; }
      if (!upper && onlyTop) continue; // abas compridas do casaco original desaparecem quando se escolhe outra parte de baixo
      const lim = COVER[style === 'vestido' ? (upper ? 'vestido' : 'saia') : style];
      const cov = vs.map((v) => covers(lim, cat[v], t[v]));
      if (cov.some(Boolean)) lists[upper ? 'up' : 'low'].push(tr);
      // a parte de cima desce um pouco sobre a cintura (por fora), para não ficar uma linha recortada
      if (!upper && w.top !== 'original' && w.top !== 'vestido' && cs.every((c) => c === C.hips || c === C.torso) && vs.every((v) => world[v * 3 + 1] > R.yHip - 0.02)) lists.up.push(tr);
      if (vs.some((v, k) => !cov[k] && LIMB.has(cat[v]))) lists.skin.push(tr); // só braços e pernas ficam à mostra
    }
    // deslocação (em espaço da malha) que leva um vértice descoberto até ao limite da peça, ao longo do osso
    const hem = (lim) => (vi) => {
      const c = cat[vi], L = lim[c];
      if (!(L > 0 && L < 1) || t[vi] <= L) return null;
      return V().fromArray(axis, vi * 3).multiplyScalar(L - t[vi]).applyMatrix3(toLocal);
    };
    const add = (o) => rig.wear.push(o);
    const upLim = lists.up.length && COVER[w.top === 'vestido' ? 'vestido' : w.top], lowLim = lists.low.length && COVER[bottom === 'vestido' ? 'saia' : bottom];
    if (lists.orig.length) add(skinned(m, subset(m, lists.orig, 0, scale), m.material, 'roupa-original'));
    if (lists.up.length) add(skinned(m, subset(m, lists.up, 0.0045, scale, hem(upLim)), cloth(w.topColor), 'parte-de-cima'));
    if (lists.low.length) add(skinned(m, subset(m, lists.low, 0.002, scale, hem(lowLim)), cloth(bottom === 'vestido' ? w.topColor : w.bottomColor), 'parte-de-baixo'));
    if (lists.skin.length) add(skinned(m, subset(m, lists.skin, -0.006, scale), skinMat(skinColor || faceColor(rig)), 'pele'));
    if (lists.jacket.length) {
      // casaco/bata: camada por cima, aberta à frente para se ver a camisa (e a gravata)
      const yTop = rig.shMid.y, yLow = R.yHip + 0.12;
      const keep = lists.jacket.filter((tr) => {
        const vs = [0, 1, 2].map((k) => (idx ? idx[tr * 3 + k] : tr * 3 + k));
        const c = vs.reduce((s, v) => s.add(V().fromArray(world, v * 3)), V()).divideScalar(3);
        const gap = 0.018 + 0.06 * THREE.MathUtils.clamp((c.y - yLow) / (yTop - yLow), 0, 1);
        return !(c.z > R.cz && Math.abs(c.x - R.cx) < gap && cat[vs[0]] === C.torso);
      });
      add(skinned(m, subset(m, keep, 0.011, scale, hem(COVER.jacket)), cloth(w.jacketColor), w.jacket));
    }
  }
  if (bottom === 'saia') skirt(rig, R, w.bottomColor, { length: 0.0 });
  if (bottom === 'vestido') skirt(rig, R, w.topColor, { length: 0.06, flare: 1.3 });
  if (w.jacket === 'bata') skirt(rig, R, w.jacketColor, { length: -0.02, flare: 1.15, open: 0.5, wide: 1.14, rise: 0.12 });
  if (w.tie && w.top === 'camisa') tie(rig, R, w.tieColor);
}
