// Cenários de fundo: consultório, sala de aula com quadro, escritório, receção e estúdio neutro,
// cada um em tom claro, médio ou escuro (o escuro dá mais contraste às mãos e ao rosto).
import * as THREE from 'three';

export const SCENES = { consultorio: 'Consultório', sala: 'Sala de aula', escritorio: 'Escritório', rececao: 'Receção', estudio: 'Estúdio' };
export const TONES = { claro: 'Claro', medio: 'Médio', escuro: 'Escuro' };
/** Cenário de cada local, quando a pessoa ainda não escolheu outro fundo. */
export const SCENE_OF = { hospital: 'consultorio', escola: 'sala', empresa: 'escritorio', servicos: 'rececao' };

// cores de cada cenário: parede (cima, baixo), friso, chão — por tom
const PAL = {
  consultorio: { claro: ['#e3efec', '#cfe2dd', '#8fc9bc', '#b9c7c4'], medio: ['#b9d3cd', '#9fbfb8', '#5fa695', '#8a9b97'], escuro: ['#2c4743', '#203733', '#3f8a7a', '#1c2826'] },
  sala:        { claro: ['#ece2cf', '#dccdb1', '#c4a97c', '#b8a68a'], medio: ['#cdb894', '#b49f7a', '#8f744c', '#8c7a5f'], escuro: ['#3f3527', '#30281d', '#7a6240', '#221c15'] },
  escritorio:  { claro: ['#e4e7ec', '#d2d7de', null, '#b7bdc6'], medio: ['#aeb7c4', '#98a2b0', null, '#7d8794'], escuro: ['#283241', '#1e2633', null, '#151b24'] },
  rececao:     { claro: ['#e1ebf2', '#cbdbe6', '#9cc0d8', '#b4c3cf'], medio: ['#a9c1d3', '#90abc0', '#5b8db3', '#7f93a3'], escuro: ['#22344a', '#19283a', '#3b6f9c', '#121c29'] },
  estudio:     { claro: ['#e9ecf1', '#d9dee6', null, '#c4cad3'], medio: ['#9aa6b6', '#7f8c9e', null, '#6b7787'], escuro: ['#1d2533', '#141a25', null, '#0e131b'] },
};

const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.canvas = c; return t;
};
const plane = (w, h, mat, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); return m; };
const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });

function wall(top, bottom, stripe) {
  return canvasTex(512, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (stripe) { x.fillStyle = stripe; x.fillRect(0, h * 0.72, w, h * 0.05); }
  });
}
function floor(color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), flat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -0.3); return m;
}
function floorShadow() {
  const t = canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(15,27,45,.35)'); g.addColorStop(1, 'rgba(15,27,45,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m;
}

/* ---------- quadro de giz que escreve o que o professor sinaliza ---------- */
function chalkboard() {
  const tex = canvasTex(1024, 420, () => {});
  const board = new THREE.Group();
  board.add(new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.9, 0.04), flat(0x8a5a36)));
  board.add(plane(2.0, 0.82, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), [0, 0, 0.022]));
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.03, 0.08), flat(0x7a4d2c)); ledge.position.set(0, -0.46, 0.05); board.add(ledge);
  const lines = [];
  board.userData.write = (word) => {
    if (word === null) lines.length = 0; else if (word) { lines.push(word); if (lines.length > 6) lines.shift(); }
    const c = tex.userData.canvas, x = c.getContext('2d');
    x.fillStyle = '#23402f'; x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 0.06; x.fillStyle = '#fff'; // marcas de giz apagado
    for (let i = 0; i < 40; i++) x.fillRect((i * 97) % c.width, (i * 53) % c.height, 120, 14);
    // a palavra sinalizada aparece no topo do quadro, por cima da cabeça; as anteriores ficam dos lados
    x.globalAlpha = 1; x.fillStyle = '#f2f0e6'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.font = '700 72px Caveat, "Comic Sans MS", cursive';
    x.fillText(lines[lines.length - 1] || 'Aula de hoje', c.width / 2, 46);
    x.globalAlpha = 0.6; x.font = '600 48px Caveat, "Comic Sans MS", cursive';
    lines.slice(-5, -1).reverse().forEach((l, i) => x.fillText(l, i % 2 ? c.width * 0.84 : c.width * 0.16, 170 + Math.floor(i / 2) * 70));
    tex.needsUpdate = true;
  };
  board.userData.write('');
  return board;
}
function hospitalSign() {
  return canvasTex(512, 512, (x) => {
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(256, 256, 240, 0, 7); x.fill();
    x.fillStyle = '#16a085'; x.fillRect(206, 96, 100, 320); x.fillRect(96, 206, 320, 100);
  });
}

/** Cria um cenário num tom. Devolve um grupo (com userData.write quando tem quadro). */
export function buildScene(scene = 'estudio', tone = 'medio') {
  const [top, bottom, stripe, ground] = (PAL[scene] || PAL.estudio)[tone] || PAL.estudio.medio;
  const g = new THREE.Group(), Z = -1.15, dark = tone === 'escuro';
  g.add(floor(ground), floorShadow());
  g.add(plane(7, 4, new THREE.MeshStandardMaterial({ map: wall(top, bottom, stripe), color: 0x8c8c8c, roughness: 1 }), [0, 1.7, Z - 0.02])); // parede menos iluminada que a pessoa: as mãos destacam-se
  if (scene === 'sala') {
    const b = chalkboard(); b.position.set(0, 1.55, Z); g.add(b); g.userData.write = b.userData.write;
  } else if (scene === 'consultorio') {
    g.add(plane(0.42, 0.42, new THREE.MeshBasicMaterial({ map: hospitalSign(), transparent: true }), [-0.72, 1.62, Z]));
    g.add(plane(0.7, 0.9, new THREE.MeshBasicMaterial({ color: dark ? 0x3a5675 : 0xf4f8fb }), [0.85, 1.45, Z]));
    g.add(plane(0.03, 0.9, flat(dark ? 0x22303a : 0xa9b9b6), [0.85, 1.45, Z + 0.005]));
  } else if (scene === 'escritorio') {
    // painéis de madeira discretos dos lados (nada atrás da cabeça)
    for (const x of [-1.25, 1.25]) g.add(plane(0.9, 1.3, flat(dark ? 0x4a3a2c : 0xb59a7c), [x, 1.5, Z]));
  } else if (scene === 'rececao') {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.45), flat(dark ? 0x2b3a4c : 0x9fb2c4)); counter.position.set(0, 0.4, 0.55); g.add(counter);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.55), flat(0x3b86d1)); desk.position.set(0, 0.82, 0.55); g.add(desk);
  }
  return g;
}

// fundos sem cenário: cores lisas e degradês (pintados por trás da imagem 3D)
export const COLORS = { branco: '#f4f6f8', cinzento: '#8d97a5', 'azul-escuro': '#16294a', preto: '#0d1117', verde: '#2f6b4f', 'verde-croma': '#00b140', 'azul-claro': '#cfe3f5', bege: '#e9dcc6' };
export const GRADIENTS = {
  aurora: 'linear-gradient(160deg, #1d3f6e, #2f8f8a 60%, #46b07a)',
  oceano: 'linear-gradient(180deg, #5bbde8, #1d3f6e)',
  noite: 'radial-gradient(circle at 50% 30%, #2a3b5c, #0b111d 75%)',
  'por-do-sol': 'linear-gradient(180deg, #f2c94c, #e67e22 45%, #7b2638)',
  suave: 'linear-gradient(180deg, #eef3f9, #c9d6e4)',
};
