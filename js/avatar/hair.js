// Cortes de cabelo gerados em 3D e moldados à cabeça de cada avatar (sem pacotes pagos):
// curto, rapado, afro, tranças, rastas, coque, rabo-de-cavalo, comprido liso — ou o cabelo original do modelo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attach } from './customize.js';

// O primeiro é a cabeça rapada: a partir dela escolhe-se o corte (ou volta-se ao cabelo do modelo)
export const HAIRSTYLES = {
  rapado: 'Rapado', curto: 'Curto', afro: 'Afro', trancas: 'Tranças', rastas: 'Rastas',
  coque: 'Coque', rabo: 'Rabo-de-cavalo', comprido: 'Comprido liso', original: 'Do modelo',
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SKIP = /hair|beard|glass|headwear|hat|eye|teeth|tongue|lash|brow/i;

/* ---------- forma da cabeça ---------- */
// Pontos da cabeça (vértices presos ao osso da cabeça) no referencial do suporte preso a esse osso.
function headPoints(rig, holder) {
  const pts = [], v = V();
  rig.group.traverse((m) => {
    if (!m.isSkinnedMesh || SKIP.test(m.name + ' ' + [].concat(m.material).map((x) => x.name).join(' '))) return;
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, n = m.geometry.attributes.position.count;
    const headIdx = m.skeleton.bones.indexOf(rig.head); if (headIdx < 0) return;
    m.skeleton.update();
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (best !== headIdx) continue;
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); pts.push(holder.worldToLocal(v.clone()));
    }
  });
  return pts;
}
/** Couro cabeludo: centro, raios e uma função r(direção) que segue a forma real da cabeça. */
function scalp(pts) {
  const box = new THREE.Box3().setFromPoints(pts), size = box.getSize(V());
  const rx = size.x * 0.46, rz = size.z * 0.47, ry = (rx + rz) / 2 * 1.05;
  const c = V((box.min.x + box.max.x) / 2, box.max.y - ry, box.min.z + rz);
  const rel = pts.map((p) => p.clone().sub(c)), len = rel.map((p) => p.length()), dir = rel.map((p, i) => p.divideScalar(len[i] || 1));
  // raio da cabeça numa grelha de direções (latitude × longitude), depois suavizado: superfície lisa, sem facetas
  const NU = 48, NV = 32, cos = Math.cos(12 * Math.PI / 180), grid = new Float32Array(NU * NV);
  const ell = (d) => 1 / Math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2 + (d.z / rz) ** 2);
  const dOf = (i, j) => { const th = (i / NU) * Math.PI * 2, ph = (j / (NV - 1)) * Math.PI; return V(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)); };
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const d = dOf(i, j); let m = 0;
    for (let k = 0; k < dir.length; k++) if (len[k] > m && dir[k].dot(d) > cos) m = len[k];
    grid[j * NU + i] = m || ell(d);
  }
  for (let pass = 0; pass < 3; pass++) {
    const g2 = grid.slice();
    for (let j = 1; j < NV - 1; j++) for (let i = 0; i < NU; i++) {
      let sum = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += g2[(j + dj) * NU + (i + di + NU) % NU];
      grid[j * NU + i] = Math.max(sum / 9, g2[j * NU + i] * 0.985);
    }
  }
  const r = (d) => {
    const th = (Math.atan2(d.x, d.z) / (Math.PI * 2) + 1) % 1 * NU, ph = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI * (NV - 1);
    const i0 = Math.floor(th), j0 = Math.min(NV - 2, Math.floor(ph)), fi = th - i0, fj = ph - j0, at = (i, j) => grid[j * NU + (i % NU)];
    return (at(i0, j0) * (1 - fi) + at(i0 + 1, j0) * fi) * (1 - fj) + (at(i0, j0 + 1) * (1 - fi) + at(i0 + 1, j0 + 1) * fi) * fj;
  };
  return { c, rx, ry, rz, r };
}
// linha do cabelo: alta na testa, acima das orelhas dos lados, baixa na nuca (u = direção unitária)
const hairline = (u) => { const th = Math.atan2(u.x, u.z); return -0.025 + 0.6 * Math.cos(th) + 0.025 * Math.cos(2 * th); };

/* ---------- ruído para a textura do cabelo ---------- */
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise(p) {
  const i = V(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), f = p.clone().sub(i), u = f.clone().multiply(f).multiply(V(3, 3, 3).sub(f.clone().multiplyScalar(2)));
  let v = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    v += hash(i.x + a, i.y + b, i.z + c) * (a ? u.x : 1 - u.x) * (b ? u.y : 1 - u.y) * (c ? u.z : 1 - u.z);
  return v;
}
function strandTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 256, 256);
  if (kind === 'curly') {
    for (let i = 0; i < 2600; i++) { const g = 90 + Math.random() * 140; x.strokeStyle = `rgb(${g},${g},${g})`; x.lineWidth = 1.2; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 1.5 + Math.random() * 3, 0, 6.3 * Math.random()); x.stroke(); }
  } else if (kind === 'braid') {
    for (let y = -256; y < 256; y += 14) { x.strokeStyle = '#d8d8d8'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y + 128); x.stroke(); x.strokeStyle = '#5a5a5a'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, y + 7); x.lineTo(256, y + 135); x.stroke(); }
  } else {
    for (let i = 0; i < 1600; i++) { const g = 80 + Math.random() * 170; x.strokeStyle = `rgba(${g},${g},${g},.8)`; x.lineWidth = 0.6 + Math.random(); const px = Math.random() * 256; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 6, 90, px - 6, 170, px + 3, 256); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const TEX = {};
const tex = (k) => (TEX[k] ||= strandTexture(k));
function hairMat(color, kind = 'straight') {
  const m = new THREE.MeshStandardMaterial({ color, map: tex(kind), roughness: kind === 'curly' ? 0.95 : 0.82, metalness: 0, side: THREE.DoubleSide });
  m.map.repeat.set(kind === 'braid' ? 1 : 3, kind === 'braid' ? 6 : 3);
  return m;
}

/* ---------- formas ---------- */
// capa que cobre o couro cabeludo até à linha do cabelo; thick(u, m) = espessura extra (m = distância à linha)
function cap(S, thick = () => 0.004, bumps = 0) {
  // esfera completa; o que fica abaixo da linha do cabelo é encostado à linha e escondido sob a pele (bordo liso)
  const geo = new THREE.SphereGeometry(1, 96, 64), pos = geo.attributes.position, u = V();
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i).normalize();
    const m = u.y - hairline(u);
    let r;
    if (m < 0) { const h = hairline(u), k = Math.sqrt(Math.max(0, 1 - h * h)) / (Math.hypot(u.x, u.z) || 1); u.set(u.x * k, h, u.z * k).normalize(); r = S.r(u) - 0.003; }
    else { r = S.r(u) + thick(u, m) * THREE.MathUtils.smoothstep(m, 0, 0.06); if (bumps) r += (noise(u.clone().multiplyScalar(14)) - 0.5) * bumps * Math.min(1, m * 4); }
    const p = S.c.clone().addScaledVector(u, r); pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals(); return geo;
}
const onScalp = (S, u, off = 0) => S.c.clone().addScaledVector(u, S.r(u) + off);
const dirAt = (th, y) => { const h = Math.sqrt(Math.max(0, 1 - y * y)); return V(Math.sin(th) * h, y, Math.cos(th) * h).normalize(); };
// tubo com espessura a diminuir até à ponta
function taperTube(curve, seg, rad, radial, taper) {
  const g = new THREE.TubeGeometry(curve, seg, rad, radial, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (radial + 1)), t = ring / seg, c = curve.getPointAt(Math.min(1, t));
    const v = V(p.getX(i), p.getY(i), p.getZ(i)).sub(c).multiplyScalar(taper(t)).add(c); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// madeixas (tranças ou rastas) a cair da parte de trás e dos lados da cabeça
function locks(S, { n, rad, len, rows }) {
  const geos = [];
  for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
    const th = Math.PI * (0.38 + 1.24 * (i + (row % 2) * 0.5) / n); // de lado a lado, por trás
    const side = Math.abs(Math.sin(th)) > 0.8 && Math.cos(th) > -0.3;
    const u0 = dirAt(th, 0); u0.y = hairline(u0) + 0.04 + row * 0.18; u0.normalize();
    const start = onScalp(S, u0, 0.004);
    const outw = V(u0.x, 0, u0.z).normalize();
    const L = (side ? len * 0.55 : len) * (0.9 + hash(i, row, 3) * 0.2);
    const pts = [start, start.clone().addScaledVector(outw, 0.02).add(V(0, -0.04, 0)),
      start.clone().addScaledVector(outw, 0.045).add(V(0, -L * 0.5, -0.015)), start.clone().addScaledVector(outw, 0.06).add(V(0, -L, -0.03))];
    geos.push(taperTube(new THREE.CatmullRomCurve3(pts), 14, rad, 6, (t) => 1 - t * 0.35));
  }
  return mergeGeometries(geos);
}

/** Cria o corte pedido. len = comprimento e vol = volume (0.6 a 1.5; 1 = normal). Devolve um grupo no referencial da cabeça. */
function build(style, S, color, len = 1, vol = 1) {
  const g = new THREE.Group(), add = (geo, kind) => g.add(new THREE.Mesh(geo, hairMat(color, kind)));
  const smooth = (m, a) => THREE.MathUtils.smoothstep(m, 0, a);
  switch (style) {
    case 'curto': add(cap(S, (u, m) => (0.004 + 0.008 * smooth(m, 0.3)) * vol * len, 0.002)); break;
    case 'afro': add(cap(S, (u, m) => 0.012 + 0.07 * vol * len * smooth(m, 0.45) * (0.75 + 0.25 * Math.max(0, u.y)), 0.018), 'curly'); break;
    case 'trancas': add(cap(S, () => 0.005)); add(locks(S, { n: 22, rad: 0.0065 * vol, len: 0.34 * len, rows: 2 }), 'braid'); break;
    case 'rastas': add(cap(S, () => 0.008, 0.004), 'curly'); add(locks(S, { n: 18, rad: 0.009 * vol, len: 0.22 * len, rows: 2 }), 'curly'); break;
    case 'coque': {
      add(cap(S, (u, m) => 0.005 + 0.004 * smooth(m, 0.3)));
      const u = V(0, 0.55, -0.85).normalize(), c = onScalp(S, u, 0.035);
      const bun = new THREE.SphereGeometry(0.042 * vol, 24, 16); bun.scale(1.1, 0.95, 0.9); bun.translate(c.x, c.y, c.z); add(bun);
      break;
    }
    case 'rabo': {
      add(cap(S, (u, m) => 0.005 + 0.004 * smooth(m, 0.3)));
      const s = onScalp(S, V(0, 0.2, -1).normalize(), 0.01);
      const curve = new THREE.CatmullRomCurve3([s, s.clone().add(V(0, -0.015, -0.045)), s.clone().add(V(0, -0.11 * len, -0.075)), s.clone().add(V(0, -0.26 * len, -0.06))]);
      add(taperTube(curve, 20, 0.024, 12, (t) => (t < 0.08 ? 0.55 + t * 5 : 1 - (t - 0.08) * 0.8)));
      break;
    }
    case 'comprido': {
      add(cap(S, (u, m) => 0.007 + 0.006 * smooth(m, 0.3)));
      // cortina de cabelo por trás e dos lados, a cair até às costas
      const cols = 40, rows = 16, pos = [], uv = [], idx = [];
      for (let i = 0; i <= cols; i++) {
        const th = Math.PI * (0.42 + 1.16 * i / cols), u0 = dirAt(th, 0); u0.y = hairline(u0) + 0.3; u0.normalize();
        const top = onScalp(S, u0, 0.003), outw = V(u0.x, 0, u0.z).normalize();
        const back = -Math.cos(th), L = (0.16 + 0.24 * Math.max(0, back)) * len;
        for (let j = 0; j <= rows; j++) {
          const t = j / rows, p = top.clone().addScaledVector(outw, 0.004 + 0.05 * Math.sin(t * Math.PI * 0.6)).add(V(0, -(L + 0.05) * t, -0.02 * t));
          pos.push(p.x, p.y, p.z); uv.push(i / cols * 3, 1 - t);
        }
      }
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      add(geo);
      break;
    }
    default: break; // rapado: só a cabeça
  }
  return g;
}

/** Aplica o corte de cabelo ao avatar (esconde o cabelo do modelo quando se escolhe outro corte). */
export function applyHair(rig, look, color) {
  rig.hairHolder?.parent?.remove(rig.hairHolder); rig.hairHolder = null;
  const style = look.hairStyle || 'original';
  rig.parts.hair.forEach(({ mesh }) => (mesh.visible = style === 'original'));
  if (style === 'original' || !rig.head) return;
  const g = new THREE.Group();
  attach(rig, rig.head, g);
  const holder = g.parent; rig.acc.pop(); rig.hairHolder = holder; // sai e entra com o corte, não com a farda
  holder.updateMatrixWorld(true);
  const pts = headPoints(rig, holder);
  if (pts.length < 50) return;
  rig.scalp ||= {}; const S = (rig.scalp[rig.model?.id || 'x'] ||= scalp(pts));
  g.add(build(style, S, color, look.hairLen ?? 1, look.hairVol ?? 1));
}
