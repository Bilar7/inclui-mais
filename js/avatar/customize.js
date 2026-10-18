// Personalização do avatar sem serviços pagos: tom de pele, cabelo, idade, corpo, roupa por profissão e acessórios.
import * as THREE from 'three';
import { dress } from './wardrobe.js';

export const SKIN = {
  'muito-escuro': '#4a2b1c', escuro: '#6b3f26', medio: '#9a6440', claro: '#c99773', 'muito-claro': '#efc9a8', albino: '#f6dccb',
};
export const HAIR = { preto: '#1b1512', castanho: '#4b2e1d', ruivo: '#8a3a17', loiro: '#c9a15a', platinado: '#efe4c4', grisalho: '#cfcac2', branco: '#f0eeea' };
/** Cor do cabelo a usar (idosos ficam grisalhos, exceto se escolheram branco). */
export const hairColor = (look) => (look.age === 'idoso' && look.hair !== 'branco' ? HAIR.grisalho : HAIR[look.hair] || HAIR.preto);

// Fardas prontas por profissão: as peças e as cores de cada uma (a pessoa pode depois mudar peça a peça)
export const OUTFITS = {
  bata:       { label: 'Bata médica', acc: ['steto', 'cracha'], wear: { top: 'camisa', topColor: '#a9cdee', bottom: 'calcas', bottomColor: '#24395e', jacket: 'bata', jacketColor: '#f4f6f8' } },
  enfermagem: { label: 'Enfermagem', acc: ['cracha'], wear: { top: 'camiseta', topColor: '#46b07a', bottom: 'calcas', bottomColor: '#46b07a', jacket: 'nenhum' } },
  professor:  { label: 'Professor', acc: ['cracha'], wear: { top: 'camisa', topColor: '#f4f6f8', bottom: 'calcas', bottomColor: '#3a3f4a', jacket: 'casaco', jacketColor: '#7a4b35', tie: true, tieColor: '#2f6b4f' } },
  executivo:  { label: 'Executivo', acc: ['cracha'], wear: { top: 'camisa', topColor: '#f4f6f8', bottom: 'calcas', bottomColor: '#24395e', jacket: 'casaco', jacketColor: '#24395e', tie: true, tieColor: '#7b2638' } },
  atendimento:{ label: 'Atendimento', acc: ['cracha'], wear: { top: 'camisa', topColor: '#3b86d1', bottom: 'calcas', bottomColor: '#22252b', jacket: 'nenhum' } },
  casual:     { label: 'Roupa do modelo', acc: [], wear: { top: 'original', bottom: 'original', jacket: 'nenhum' } },
};
const WEAR_DEFAULT = { top: 'original', bottom: 'original', jacket: 'nenhum', tie: false, topColor: '#f4f6f8', bottomColor: '#24395e', jacketColor: '#24395e', tieColor: '#7b2638' };
/** Roupa final: a farda da profissão com as mudanças que a pessoa fez peça a peça. */
export const wearOf = (look) => ({ ...WEAR_DEFAULT, ...(OUTFITS[look.outfit] || OUTFITS.casual).wear, ...(look.wear || {}) });
export const AGES = { jovem: 'Jovem', adulto: 'Adulto', idoso: 'Idoso' };
export const BODIES = { fina: 'Fina', media: 'Média', forte: 'Forte' };

const PART = (n) => {
  n = n.toLowerCase();
  if (/head|body|skin/.test(n) && !/headwear/.test(n)) return 'skin';
  if (/headwear/.test(n)) return 'hat';
  if (/hair/.test(n)) return 'hair';
  if (/beard/.test(n)) return 'beard';
  if (/glasses/.test(n)) return 'glasses';
  if (/outfit_top|top|_look_/.test(n)) return 'top';
  if (/outfit_bottom|bottom/.test(n)) return 'bottom';
  if (/footwear|shoe/.test(n)) return 'shoes';
  return 'other';
};

/** Luminância média de uma textura (para recolorir a pele e o cabelo mantendo o sombreado). */
function avgLum(tex) {
  try {
    const img = tex?.image; if (!img) return 0.5;
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) { s += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; n++; }
    return n ? Math.max(0.02, Math.pow(s / n, 2.2)) : 0.22; // em espaço linear, como o shader
  } catch { return 0.5; }
}

/** Prepara um material para ser recolorido em tempo real (shader com tom + força). */
function tintable(mat) {
  if (mat.userData.tint) return mat.userData.tint;
  const u = { uTint: { value: new THREE.Color(1, 1, 1) }, uAmt: { value: 0 }, uRef: { value: avgLum(mat.map) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint; uniform float uAmt; uniform float uRef;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 rec = uTint * clamp(pow(lum / uRef, 0.85), 0.0, 1.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, rec, uAmt);`);
  };
  mat.customProgramCacheKey = () => 'tint';
  mat.needsUpdate = true;
  mat.userData.tint = u;
  return u;
}

/** Agrupa as malhas do modelo por parte do corpo/roupa (pelo nome do material ou da malha). */
function indexParts(model) {
  const parts = { hat: [], skin: [], hair: [], beard: [], glasses: [], top: [], bottom: [], shoes: [], other: [] };
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) { const p = PART(m.name || o.name); parts[p].push({ mesh: o, mat: m }); }
  });
  return parts;
}

const setTint = (list, hex, amt) => list.forEach(({ mat }) => {
  const u = tintable(mat); u.uTint.value.set(hex || '#ffffff').convertSRGBToLinear(); u.uAmt.value = hex ? amt : 0;
});

/* ---------- acessórios presos aos ossos ---------- */
function makeTexturePlate(text, sub) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(0, 0, 256, 96, 16); x.fill();
  x.fillStyle = '#3b86d1'; x.fillRect(0, 0, 18, 96);
  x.fillStyle = '#0f1b2d'; x.font = '700 34px Manrope, sans-serif'; x.fillText(text.slice(0, 13), 32, 46);
  x.fillStyle = '#5d6b7e'; x.font = '600 22px Manrope, sans-serif'; x.fillText(sub.slice(0, 18), 32, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function stethoscope() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: 0.9, roughness: 0.25 });
  // tubo à volta do pescoço e a cair sobre o peito
  const pts = [[-0.07, 0.17, -0.01], [-0.085, 0.12, 0.08], [-0.07, 0.04, 0.15], [-0.045, -0.05, 0.165], [-0.02, -0.12, 0.165]];
  for (const sx of [1, -1]) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x * sx, y, z)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 8), mat));
  }
  const back = new THREE.CatmullRomCurve3([[-0.07, 0.17, -0.01], [0, 0.2, -0.07], [0.07, 0.17, -0.01]].map((p) => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(back, 16, 0.006, 8), mat));
  const drop = new THREE.CatmullRomCurve3([[-0.02, -0.12, 0.165], [0.01, -0.19, 0.17], [0.03, -0.24, 0.17]].map((p) => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(drop, 12, 0.006, 8), mat));
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), metal); bell.rotation.x = Math.PI / 2; bell.position.set(0.03, -0.255, 0.172); g.add(bell);
  return g;
}

/** Aplica o perfil completo ao avatar carregado. */
export function applyLook(rig, look, model = {}) {
  const parts = rig.parts || (rig.parts = indexParts(rig.group));
  // modelos realistas (rosto digitalizado): a pele e o cabelo verdadeiros não são pintados
  const skinOK = model.skinTint !== false;
  setTint(parts.skin, skinOK ? SKIN[look.skin] : null, 0.9);
  const hair = skinOK ? hairColor(look) : null;
  const ha = look.age === 'idoso' ? (skinOK ? 1 : 0.75) : 0.92; setTint(parts.hair, hair, ha); setTint(parts.beard, hair, ha);
  if (skinOK) parts.beard.forEach(({ mesh }) => (mesh.visible = !!look.beard));
  parts.glasses.forEach(({ mesh }) => (mesh.visible = look.age === 'idoso' || !!look.glasses));
  parts.hat.forEach(({ mesh }) => (mesh.visible = false));

  // corpo: fina / média / forte (escala dos ossos do tronco, compensando os braços)
  const b = rig.bones; const k = { fina: 0.9, media: 1, forte: 1.16 }[look.body || 'media'];
  for (const n of ['Spine', 'Spine1', 'Hips']) b[n]?.scale.set(k, 1, k * (n === 'Spine1' ? 1.06 : 1));
  if (b.Spine2) b.Spine2.scale.set(1 / k * (k > 1 ? 1.06 : 1), 1, 1 / k * (k > 1 ? 1.04 : 1));
  for (const n of ['LeftUpLeg', 'RightUpLeg']) b[n]?.scale.set(k > 1 ? 1.05 : 1, 1, k > 1 ? 1.05 : 1);
  rig.group.updateMatrixWorld(true);
  // idade: postura ligeiramente curvada e gestos mais calmos
  rig.stoop = look.age === 'idoso' ? 0.12 : 0;
  rig.pace = look.age === 'idoso' ? 0.85 : 1;

  // roupa peça a peça e acessórios da profissão
  rig.acc?.forEach((o) => o.parent?.remove(o)); rig.acc = [];
  const outfit = OUTFITS[look.outfit] || OUTFITS.casual, wear = wearOf(look);
  const chest = b.Spine2 || b.Spine1;
  if (model.fixedOutfit) { // modelo já vestido: só os acessórios da profissão
    if (chest && look.name && outfit.acc.includes('cracha')) badge(rig, chest, look);
    if (chest && outfit.acc.includes('steto') && !model.ownSteto && (model.fits || []).includes(look.outfit)) attach(rig, chest, stethoscope()); // só em quem veste para a profissão
    return;
  }
  dress(rig, wear, skinOK ? SKIN[look.skin] : null);
  if (chest && outfit.acc.includes('steto') && wear.jacket === 'bata') attach(rig, chest, stethoscope());
  if (chest && outfit.acc.includes('cracha') && look.name) badge(rig, chest, look);
}
/** Crachá com o nome e a profissão, preso ao peito. */
function badge(rig, chest, look) {
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.032), new THREE.MeshStandardMaterial({ map: makeTexturePlate(look.name, look.role || ''), roughness: 0.6 }));
  attach(rig, chest, plate, look.gender === 'f' ? [-0.085, 0.02, 0.15] : [-0.09, 0.05, 0.14]);
}
/** Prende um objeto a um osso (o objeto segue o osso), compensando a escala do modelo; pos em metros. */
export function attach(rig, bone, obj, pos) {
  const holder = new THREE.Object3D();
  bone.add(holder);
  const ws = new THREE.Vector3(); bone.getWorldScale(ws); holder.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  const q = new THREE.Quaternion(); bone.getWorldQuaternion(q); holder.quaternion.copy(q.invert()).multiply(rig.group.quaternion);
  if (pos) obj.position.set(...pos);
  holder.add(obj); rig.acc.push(holder);
}
/* ---------- perfis prontos (cada pessoa pode mudar e dar o seu nome) ---------- */
export const PERSONAS = {
  hospital: { name: 'Dra. Amina', role: 'Médica', gender: 'f', skin: 'escuro', age: 'adulto', body: 'media', outfit: 'bata', hair: 'preto' },
  escola:   { name: 'Prof. Bilar', role: 'Professor', gender: 'm', skin: 'escuro', age: 'adulto', body: 'media', outfit: 'professor', hair: 'preto', beard: true },
  empresa:  { name: 'Sara', role: 'Executiva', gender: 'f', skin: 'claro', age: 'adulto', body: 'media', outfit: 'executivo', hair: 'castanho' },
  servicos: { name: 'Bilar', role: 'Funcionário', gender: 'm', skin: 'muito-escuro', age: 'jovem', body: 'media', outfit: 'atendimento', hair: 'preto' },
};
