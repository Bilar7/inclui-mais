// Palco 3D do intérprete: carrega o avatar, aplica o visual, anima os sinais e o rosto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildRig, solveArm, toWorld, dirV, frameQuat, thumbParams, measureBody, resolveContacts } from './rig.js';
import { resolveShape, blendShape } from './handshapes.js';
import { applyLook, hairColor } from './customize.js';
import { applyHair } from './hair.js';
import { buildScene, SCENE_OF, COLORS, GRADIENTS } from './scenes.js';

const BASE = window.__INCLUI_BASE || new URL('./', document.baseURI).href; // pasta da aplicação (funciona com ou sem empacotamento)
const FILE_MODE = location.protocol === 'file:' || !!window.__INCLUI_EMBED; // duplo clique ou página única: os modelos vêm embutidos em partes .glb.N.js
// Catálogo de modelos (assets/avatars/avatars.json). Cada modelo tem um ficheiro para computador e outro, mais leve, para telemóvel.
const IS_MOBILE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820 || (navigator.deviceMemory || 8) <= 4;
let catalog = null;
export async function modelCatalog() {
  if (catalog) return catalog;
  const list = (window.__INCLUI_CATALOG || (await (await fetch(BASE + 'assets/avatars/avatars.json')).json())).models.map((m) => ({ ...m }));
  // cada modelo tem um ficheiro para computador e outro (mais leve) para telemóvel; se um falhar ao carregar, show() usa o ilustrado
  for (const m of list) {
    m.url = BASE + 'assets/avatars/' + (IS_MOBILE ? m.files.mobile : m.files.desktop); m.available = true;
    m.thumb ||= BASE + 'assets/avatars/thumbs/' + m.files.desktop.split('/').pop().replace('.glb', '.jpg'); // rosto para o camarim
  }
  return (catalog = list);
}
// Com duplo clique (file://) o navegador não deixa ler ficheiros: cada modelo vem em <script> com os dados em base64,
// dividido em partes (m.parts) para respeitar o tamanho máximo por ficheiro dos alojamentos.
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('modelo embutido em falta: ' + src)); document.head.appendChild(s); });
async function loadEmbedded(loader, model) {
  const key = model.url.slice(BASE.length + 'assets/avatars/'.length), n = model.parts || 1;
  window.__INCLUI_GLB ||= {};
  for (let i = 0; i < n; i++) if (!window.__INCLUI_GLB[`${key}#${i}`]) await loadScript(`${model.url}.${i}.js`);
  let b64 = ''; for (let i = 0; i < n; i++) { b64 += window.__INCLUI_GLB[`${key}#${i}`]; delete window.__INCLUI_GLB[`${key}#${i}`]; }
  const bin = atob(b64), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Promise((res, rej) => loader.parse(buf.buffer, BASE + 'assets/avatars/', res, rej));
}
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();

/** Modelo para uma aparência: o escolhido no estúdio; senão um humano realista com o mesmo tom de pele
 *  (de preferência já vestido para a profissão); senão o ilustrado, que aceita qualquer tom de pele. */
export function pickModel(list, look) {
  const g = look.gender === 'm' ? 'm' : 'f';
  const chosen = list.find((m) => m.id === look.model && m.available);
  if (chosen) return chosen;
  // pessoa realista com o mesmo tom de pele; ganha a que já veste a roupa da profissão e tem a idade certa
  const score = (m) => ((m.fits || []).includes(look.outfit) ? 2 : 0) + (m.age === (look.age || 'adulto') ? 1 : 0);
  const real = list.filter((m) => m.kind === 'realistic' && m.gender === g && m.available && (m.skinTones || []).includes(look.skin))
    .sort((a, b) => score(b) - score(a));
  return real[0] || list.find((m) => m.kind === 'standard' && m.gender === g);
}

export class Interpreter {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    // luz de estúdio frontal e suave: as mãos e os dedos nunca ficam na sombra
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c6cf, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(0.7, 2.2, 3.2); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff1e2, 0.7); fill.position.set(-1.8, 1.5, 2.4); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xd6efff, 0.8); rim.position.set(0, 2.5, -2.5); this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const c = (this.controls = new OrbitControls(this.cam, canvas));
    c.enableDamping = true; c.enablePan = false; c.minDistance = 0.6; c.maxDistance = 7; c.minPolarAngle = 0.5; c.maxPolarAngle = 2.0;
    this.framing = 'full'; this.models = {}; this.rig = null; this.bgKey = null; this.backdrop = null;
    this.queue = []; this.playing = null; this.speed = 1; this.speaking = false;
    this.face = {}; this.blink = 0; this.blinkT = 2; this.clock = new THREE.Clock();
    this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder); // modelos comprimidos (leves para telemóvel)
    this.arkit = null; this.arkitAt = 0;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const tick = () => { this.update(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  resize() {
    const b = this.canvas.getBoundingClientRect(); if (!b.width || !b.height) return;
    this.renderer.setSize(b.width, b.height, false); this.cam.aspect = b.width / b.height; this.cam.updateProjectionMatrix(); this.fit();
  }
  setFraming(f) { this.framing = f; this.fit(); }
  fit() {
    const rig = this.rig; if (!rig || !this.cam.aspect) return;
    const f = this.framing === 'full' ? { y0: -0.1, y1: 1.93, w: 1.15 } : { y0: rig.shMid.y - 0.62, y1: rig.headY + 0.2, w: 1.05 };
    const h = f.y1 - f.y0, cy = (f.y0 + f.y1) / 2, t = Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2);
    const d = Math.max(h / 2 / t, f.w / 2 / (t * this.cam.aspect)) * 1.04;
    this.controls.target.set(0, cy, 0); this.cam.position.set(0, cy + 0.03, d); this.controls.update();
  }

  /** Mostra uma pessoa (perfil) num local. Carrega o modelo uma só vez por género. */
  async show(look, place) {
    const list = await modelCatalog();
    const model = pickModel(list, look);
    if (!this.models[model.id]) {
      try {
        const gltf = FILE_MODE ? await loadEmbedded(this.loader, model) : await this.loader.loadAsync(model.url);
        const rig = buildRig(gltf.scene); if (!rig) throw new Error('o modelo não tem braços e dedos completos');
        rig.model = model;
        for (const a of [rig.R, rig.L]) this.rest(a, rig, true);
        this.models[model.id] = rig;
      } catch (e) {
        // o avatar atual mantém-se enquanto o modelo realista não estiver pronto
        if (model.kind === 'standard') throw e;
        console.warn('Modelo realista indisponível:', model.id, e.message); model.available = false;
        return this.show({ ...look, model: null }, place);
      }
    }
    const rig = this.models[model.id];
    if (this.rig !== rig) { if (this.rig) this.scene.remove(this.rig.group); this.rig = rig; this.scene.add(rig.group); }
    this.forget(model.id);
    applyLook(rig, look, rig.model);
    rig.group.updateMatrixWorld(true);
    for (const a of [rig.R, rig.L]) solveArm(rig, a);
    measureBody(rig);
    if (!model.fixedOutfit) applyHair(rig, look, hairColor(look));
    rig.shMid = rig.R.arm.getWorldPosition(V()).add(rig.L.arm.getWorldPosition(V())).multiplyScalar(0.5);
    this.setBackground(look.bg || { kind: 'scene', scene: SCENE_OF[place], tone: 'medio' });
    this.fit();
  }
  /** No máximo 3 pessoas em memória (o camarim tem muitas): liberta as usadas há mais tempo. */
  forget(keep) {
    this.used = [keep, ...(this.used || []).filter((id) => id !== keep)];
    for (const id of this.used.splice(3)) {
      const r = this.models[id]; if (!r) continue; delete this.models[id];
      r.group.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); } });
    }
  }
  writeBoard(w) { this.backdrop?.userData.write?.(w); }
  setBackdrop(v) { this.showBackdrop = v; if (this.backdrop) this.backdrop.visible = v; }
  /** Fundo: cenário 3D (com tom claro/médio/escuro), cor lisa ou degradê pintados por trás da imagem. */
  setBackground(bg) {
    const key = JSON.stringify(bg); if (key === this.bgKey) return; this.bgKey = key;
    if (this.backdrop) { this.scene.remove(this.backdrop); this.backdrop = null; }
    const host = this.canvas.parentElement;
    if (bg.kind === 'scene') {
      this.backdrop = buildScene(bg.scene, bg.tone); this.backdrop.visible = this.showBackdrop !== false; this.scene.add(this.backdrop);
      host.style.background = '';
    } else host.style.background = bg.kind === 'color' ? COLORS[bg.value] || bg.value : GRADIENTS[bg.value] || bg.value;
  }

  /** Gera exemplos de treino (21 pontos da mão) a partir do próprio avatar, para o reconhecimento pela câmara. */
  synthHandSamples(shapes, n = 24, describe) {
    const rig = this.rig; if (!rig) return [];
    const a = rig.R, out = [], j = (v, r) => v + (Math.random() * 2 - 1) * r;
    const w = (o) => { const v = o.getWorldPosition(V()); return [v.x, v.y, v.z]; };
    for (const [label, hs] of Object.entries(shapes)) {
      const base = resolveShape(a, hs, thumbParams);
      for (let k = 0; k < n; k++) {
        a.cur.shape = { f: base.f.map((x) => x.map((v) => Math.max(-5, j(v, 7)))), s: base.s.map((v) => j(v, 4)), t: Object.fromEntries(Object.entries(base.t).map(([kk, v]) => [kk, j(v, 6)])) };
        a.cur.p.copy(toWorld(rig, [-0.15, 1.36, 0.32]));
        a.cur.q.copy(frameQuat(dirV('up', a.s).add(V().set(j(0, 0.25), 0, j(0, 0.25))).normalize(), dirV('fwd', a.s)));
        solveArm(rig, a);
        const pts = [w(a.hand), ...a.thumb.map(w), w(a.thumbTip || a.thumb[2])];
        a.fingers.forEach((ch, i) => { pts.push(...ch.map(w), w(a.tips[i] || ch[2])); });
        if (pts.length === 21) { out.push({ label, f: describe(pts) }); out.push({ label, f: describe(pts, true) }); }
      }
    }
    return out;
  }

  /* ---------- poses ---------- */
  spec(a, s) { return s || { p: [a.s * 0.215, 0.935, 0.07], f: 'down', palm: 'in', hs: 'relax' }; }
  setGoal(a, s, rig = this.rig) {
    s = this.spec(a, s);
    // direções por nome ('up', 'fwd+in'…) nos sinais escritos, ou vetores nos sinais gravados pela câmara
    const dir = (d) => (Array.isArray(d) ? V().fromArray(d).normalize() : dirV(d, a.s));
    a.goal.p.copy(toWorld(rig, s.p)); a.goal.q.copy(frameQuat(dir(s.f), dir(s.palm)));
    a.from = a.cur.shape ? { f: a.cur.shape.f.map((x) => x.slice()), s: a.cur.shape.s.slice(), t: { ...a.cur.shape.t } } : null;
    a.to = resolveShape(a, s.hs, thumbParams); a.tShape = 0;
  }
  rest(a, rig, snap) { this.setGoal(a, null, rig); if (snap) { a.cur.p.copy(a.goal.p); a.cur.q.copy(a.goal.q); a.cur.shape = resolveShape(a, 'relax', thumbParams); a.from = null; } }

  /** Toca uma sequência de sinais. items: [{frames:[{R,L,t,letter}], expr, head, mouth, index, word}] */
  play(items, cb = {}) { this.queue = items.map((x) => ({ ...x })); this.queue.push({ frames: [{ R: null, L: null, t: 0.7 }], end: true }); this.cb = cb; this.next(); }
  enqueue(items, cb = this.cb || {}) {
    const added = items.map((x) => ({ ...x }));
    if (!added.length) return;
    this.queue ||= [];
    this.cb = cb;
    const endIndex = this.queue.findIndex((item) => item.end);
    if (endIndex >= 0) this.queue.splice(endIndex, 0, ...added);
    else this.queue.push(...added, { frames: [{ R: null, L: null, t: 0.7 }], end: true });
    if (!this.playing || this.playing.end) this.next();
  }
  next() {
    const p = (this.playing = this.queue.shift() || null);
    this.cb?.onItem?.(p ? (p.end ? -1 : p.index) : -1, p);
    if (!p) { this.cb?.onLetter?.(''); return; }
    if (p.word && !p.end) this.writeBoard(p.word);
    p.i = 0; p.t = 0; p.el = 0; p.total = p.frames.reduce((s, f) => s + f.t, 0); this.apply();
  }
  apply() {
    const f = this.playing.frames[this.playing.i];
    if (this.rig) { this.setGoal(this.rig.R, f.R); this.setGoal(this.rig.L, f.L); }
    if (f.face) this.setFaceWeights(f.face); // expressão gravada com o sinal
    this.cb?.onLetter?.(f.letter || '');
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05), T = this.clock.elapsedTime;
    const rig = this.rig, sp = this.speed * (rig?.pace || 1);
    const p = this.playing;
    if (p) { p.t += dt * sp; p.el += dt * sp; if (p.t >= p.frames[p.i].t) { p.t = 0; p.i++; if (p.i >= p.frames.length) this.next(); else this.apply(); } }
    if (rig) {
      const k = 1 - Math.exp(-11 * sp * dt);
      for (const a of [rig.R, rig.L]) {
        a.cur.p.lerp(a.goal.p, k); a.cur.q.slerp(a.goal.q, k);
        if (a.from) { a.tShape = Math.min(1, a.tShape + dt * sp * 6); blendShape(a.cur.shape, a.from, a.to, ease(a.tShape)); }
        else a.cur.shape = a.to;
      }
      if (this.solid !== false) resolveContacts(rig); // mãos sólidas: não entram no corpo nem uma na outra
      for (const a of [rig.R, rig.L]) solveArm(rig, a);
      const act = p && !p.end ? p : null;
      // movimentos de cabeça em eixos do mundo (iguais em qualquer esqueleto): x>0 baixa a cabeça, y>0 vira para a esquerda do avatar
      let hx = Math.sin(T * 0.7) * 0.015 + (rig.stoop || 0) * 0.4, hy = Math.sin(T * 0.43) * 0.025, hz = 0;
      if (this.talk && performance.now() < this.talk.end) { hx += Math.sin(T * 6.5) * 0.02; hz += Math.sin(T * 2.1) * 0.015; }
      if (this.mood === 'think') { hz += 0.06; }
      if (act?.head === 'nod') hx += Math.sin(T * 9) * 0.1;
      if (act?.head === 'shake') hy += Math.sin(T * 8) * 0.18;
      if (act?.expr === 'yn') { hx -= 0.06; hz += 0.05; }
      if (act?.expr === 'wh') hx += 0.04;
      if (rig.spine) setWorldOffset(rig.spine, rig.spineRest, Q().setFromEuler(new THREE.Euler(Math.sin(T * 1.5) * 0.008 + (rig.stoop || 0), Math.sin(T * 0.3) * 0.01, 0, 'YXZ')));
      this.updateGaze(rig, dt, T, hx, hy, hz);
      this.updateFace(rig, act, dt, T);
    }
    this.controls.update(); this.renderer.render(this.scene, this.cam);
  }

  /* ---------- rosto: expressões ARKit + articulação da boca ---------- */
  updateFace(rig, act, dt, T) {
    const ch = rig.faceCh || (rig.faceCh = faceChannels(rig.group));
    if (!ch.has) return;
    const tgt = { ...(EXPR[this.mood || act?.expr] || EXPR[act?.expr] || EXPR.neutral) };
    const talk = this.talk;
    if (talk && performance.now() < talk.end) {
      // boca sincronizada com a palavra que a voz está a dizer
      const k = Math.min(0.999, (performance.now() - talk.start) / (talk.end - talk.start));
      for (const [n, v] of Object.entries(viseme(talk.word[Math.floor(k * talk.word.length)]))) tgt[n] = Math.max(tgt[n] || 0, v);
      tgt.browUp = Math.max(tgt.browUp || 0, 0.12 * Math.abs(Math.sin(T * 2.3)));
    } else if (act?.mouth) {
      const k = Math.min(0.999, act.el / Math.max(0.2, act.total));
      for (const [n, v] of Object.entries(viseme(act.mouth[Math.floor(k * act.mouth.length)]))) tgt[n] = Math.max(tgt[n] || 0, v);
    }
    // piscar natural: intervalos irregulares, por vezes duplo
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 1; this.blinkT = Math.random() < 0.15 ? 0.25 : 1.8 + Math.random() * 4.2; }
    this.blink = Math.max(0, this.blink - dt * 8); tgt.blink = this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0;
    for (const [n, list] of Object.entries(ch.map)) {
      if (n.startsWith('look')) continue;
      const cur = this.face[n] || 0, v = cur + ((tgt[n] || 0) - cur) * Math.min(1, dt * (n === 'blink' ? 40 : 14));
      this.face[n] = v; for (const [m, i] of list) m.morphTargetInfluences[i] = v;
    }
    // animação facial vinda de fora (NVIDIA Audio2Face-3D): pesos ARKit por nome
    if (this.arkit && performance.now() - this.arkitAt < 250)
      for (const [m, i, name] of ch.all) { const v = this.arkit[name.toLowerCase()]; if (v != null) m.morphTargetInfluences[i] = v; }
  }

  /**
   * Olhar vivo: a cabeça e os olhos procuram quem está a ver (a câmara). De vez em quando desvia o olhar
   * para o lado ou para baixo, como uma pessoa; ao pensar olha para cima e de lado; pequenas sacadas constantes.
   */
  updateGaze(rig, dt, T, hx, hy, hz) {
    this.gazeT = (this.gazeT ?? 0) - dt;
    if (this.gazeT < 0) {
      const r = Math.random();
      if (this.mood === 'think') this.gazeMode = { x: 0.35, y: 0.35, head: 0.5, t: 1.2 };
      else if (this.talk && performance.now() < this.talk.end) this.gazeMode = r < 0.85 ? { x: 0, y: 0, head: 1, t: 1 + Math.random() } : { x: (Math.random() - 0.5) * 0.5, y: -0.1, head: 0.6, t: 0.5 };
      else this.gazeMode = r < 0.72 ? { x: 0, y: 0, head: 1, t: 1.5 + Math.random() * 2.5 } : r < 0.88 ? { x: Math.random() < 0.5 ? -0.55 : 0.55, y: 0, head: 0.7, t: 0.8 + Math.random() } : { x: (Math.random() - 0.5) * 0.3, y: -0.3, head: 0.5, t: 0.6 };
      this.gazeT = this.gazeMode.t;
    }
    // pequenas sacadas dos olhos
    this.sacT = (this.sacT ?? 0) - dt;
    if (this.sacT < 0) { this.sacT = 0.25 + Math.random() * 0.9; this.sac = { x: (Math.random() - 0.5) * 0.04, y: (Math.random() - 0.5) * 0.03 }; }
    const g = this.gazeMode || { x: 0, y: 0, head: 1 }, sac = this.sac || { x: 0, y: 0 };
    const target = this.cam.position.clone();
    const right = V().setFromMatrixColumn(this.cam.matrixWorld, 0), up = V().setFromMatrixColumn(this.cam.matrixWorld, 1);
    const dist = target.distanceTo(this.controls.target);
    target.addScaledVector(right, (g.x + sac.x) * dist).addScaledVector(up, (g.y + sac.y) * dist);
    this.gazeTarget = (this.gazeTarget || target.clone()).lerp(target, Math.min(1, dt * 9));
    const FWD = V().set(0, 0, 1);
    if (rig.head) {
      const hp = rig.head.getWorldPosition(V());
      const dir = this.gazeTarget.clone().sub(hp).normalize();
      // limita a rotação da cabeça (±40° lado, ±22° cima/baixo) e acompanha só em parte (os olhos fazem o resto)
      const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.7, 0.7) * 0.55 * g.head;
      const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -0.38, 0.38) * 0.5 * g.head;
      this.hYaw = (this.hYaw ?? 0) + (yaw - (this.hYaw ?? 0)) * Math.min(1, dt * 5);
      this.hPitch = (this.hPitch ?? 0) + (pitch - (this.hPitch ?? 0)) * Math.min(1, dt * 5);
      setWorldOffset(rig.head, rig.headRest, Q().setFromEuler(new THREE.Euler(hx - this.hPitch, hy + this.hYaw, hz, 'YXZ')));
    }
    // olhos: ossos (rodam para o alvo) ou expressões eyeLook* (modelos sem ossos de olhos)
    const eyes = [rig.bones.LeftEye, rig.bones.RightEye].filter(Boolean);
    const ch = rig.faceCh || (rig.faceCh = faceChannels(rig.group));
    const useMorph = ch.map.lookUp.length + ch.map.lookL.length > 0;
    if (eyes.length && !useMorph) {
      rig.eyeRest ||= eyes.map((e) => e.quaternion.clone());
      eyes.forEach((e, i) => {
        e.quaternion.copy(rig.eyeRest[i]); e.updateWorldMatrix(true, false);
        const restW = e.getWorldQuaternion(Q()); const fwd = FWD.clone().applyQuaternion(rig.head ? rig.head.getWorldQuaternion(Q()).multiply(rig.headRest.clone().invert()) : Q());
        const want = this.gazeTarget.clone().sub(e.getWorldPosition(V())).normalize();
        const ang = fwd.angleTo(want), lim = 0.45;
        const q = Q().setFromUnitVectors(fwd, want); if (ang > lim) q.slerp(Q(), 1 - lim / ang);
        const w = q.multiply(restW); e.quaternion.copy(e.parent.getWorldQuaternion(Q()).invert().multiply(w));
      });
    } else if (useMorph && rig.head) {
      const hp = rig.head.getWorldPosition(V());
      const local = this.gazeTarget.clone().sub(hp).applyQuaternion(rig.head.getWorldQuaternion(Q()).multiply(rig.headRest.clone().invert()).invert()).normalize();
      const yaw = Math.atan2(local.x, local.z), pitch = Math.asin(THREE.MathUtils.clamp(local.y, -1, 1));
      const set = (n, v) => (ch.map[n] || []).forEach(([m, i]) => (m.morphTargetInfluences[i] = THREE.MathUtils.clamp(v, 0, 1)));
      set('lookUp', pitch * 2.2); set('lookDown', -pitch * 2.2); set('lookL', yaw * 1.8); set('lookR', -yaw * 1.8);
    }
  }
  /** Palavra a ser dita agora (para os lábios acompanharem a voz). */
  say(word, ms) { this.talk = { word: String(word).toLowerCase(), start: performance.now(), end: performance.now() + Math.max(160, ms) }; }
  /** Recebe pesos ARKit (0–1) por nome — ex.: frames do Audio2Face. */
  setFaceWeights(w) { const o = {}; for (const k in w) o[k.toLowerCase()] = w[k]; this.arkit = o; this.arkitAt = performance.now(); }
  setMood(m) { this.mood = m; }
}
const ease = (t) => t * t * (3 - 2 * t);
/** Aplica uma rotação em eixos do mundo sobre a pose de descanso de um osso. */
function setWorldOffset(bone, rest, qWorld) {
  bone.quaternion.copy(rest); bone.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const restW = parentQ.clone().multiply(rest);
  bone.quaternion.copy(parentQ.invert().multiply(qWorld.multiply(restW)));
  bone.updateWorldMatrix(false, true);
}

const EXPR = {
  neutral: { smile: 0.14 }, smile: { smile: 0.62, squint: 0.3, browUp: 0.15 }, pain: { browUp: 0.75, frown: 0.5, squint: 0.55, stretch: 0.2 },
  sad: { browUp: 0.55, frown: 0.55 }, neg: { browDown: 0.5, frown: 0.25 }, yn: { browUp: 0.9, wide: 0.35 },
  wh: { browDown: 0.6, squint: 0.35 }, think: { browDown: 0.2, pucker: 0.1 }, surprise: { browUp: 0.9, wide: 0.6, jaw: 0.25 },
};
function viseme(c = '') {
  if ('a'.includes(c)) return { jaw: 0.5, aa: 0.7 }; if ('e'.includes(c)) return { jaw: 0.28, stretch: 0.25, E: 0.6 };
  if ('i'.includes(c)) return { jaw: 0.12, smile: 0.35, I: 0.6 }; if ('o'.includes(c)) return { jaw: 0.35, funnel: 0.6, O: 0.7 };
  if ('u'.includes(c)) return { jaw: 0.1, pucker: 0.7, U: 0.7 }; if ('mbp'.includes(c)) return { close: 0.7, PP: 0.8 };
  if ('fv'.includes(c)) return { close: 0.35, FF: 0.7 }; if (c === ' ') return {}; return { jaw: 0.16, DD: 0.4 };
}
function faceChannels(root) {
  const meshes = []; root.traverse((o) => o.isMesh && o.morphTargetDictionary && meshes.push(o));
  const pick = (re) => { const out = []; for (const m of meshes) for (const [n, i] of Object.entries(m.morphTargetDictionary)) if (re.test(n)) out.push([m, i]); return out; };
  const map = {
    browUp: pick(/^(browInnerUp|browOuterUp(Left|Right)?)$/i), browDown: pick(/^browDown(Left|Right)?$/i),
    smile: pick(/^mouthSmile(Left|Right)?$/i), frown: pick(/^mouthFrown(Left|Right)?$/i),
    squint: pick(/^(eyeSquint(Left|Right)?|cheekSquint(Left|Right)?)$/i), wide: pick(/^eyeWide(Left|Right)?$/i),
    blink: pick(/^(eyeBlink(Left|Right)?|eyesClosed)$/i), jaw: pick(/^(jawOpen|mouthOpen)$/i),
    funnel: pick(/^mouthFunnel$/i), pucker: pick(/^mouthPucker$/i), close: pick(/^(mouthClose|mouthPress(Left|Right)?)$/i),
    stretch: pick(/^mouthStretch(Left|Right)?$/i),
    lookUp: pick(/^eyeLookUp(Left|Right)$/i), lookDown: pick(/^eyeLookDown(Left|Right)$/i), lookL: pick(/^(eyeLookOutLeft|eyeLookInRight)$/i), lookR: pick(/^(eyeLookInLeft|eyeLookOutRight)$/i),
    aa: pick(/^viseme_aa$/i), E: pick(/^viseme_E$/i), I: pick(/^viseme_I$/i), O: pick(/^viseme_O$/i), U: pick(/^viseme_U$/i),
    PP: pick(/^viseme_PP$/i), FF: pick(/^viseme_FF$/i), DD: pick(/^viseme_DD$/i),
  };
  const all = []; for (const m of meshes) for (const [n, i] of Object.entries(m.morphTargetDictionary)) all.push([m, i, n]);
  return { map, all, has: Object.values(map).some((l) => l.length) };
}
