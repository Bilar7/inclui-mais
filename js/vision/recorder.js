// Gravador de sinais: a câmara vê o corpo, as duas mãos e o rosto de quem sinaliza e transforma cada sinal
// em animação do intérprete (com a expressão do rosto) e em exemplos para o reconhecimento pela câmara.
//  • Manual: contagem 3-2-1, grava até carregar em Parar (máx. 8 s).
//  • Automático: começa quando as mãos sobem e termina quando descem — grava várias palavras seguidas.
//  • Frases (pauseSplit): durante a sinalização contínua, uma pausa curta das mãos também separa os sinais.
import { frameFrom, faceFrom } from './retarget.js';
import { describe, fromMediaPipe } from './features.js';

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const M = 'https://storage.googleapis.com/mediapipe-models/';
const MODELS = {
  hand: M + 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  pose: M + 'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  face: M + 'face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};
const FPS = 12;          // fotogramas por segundo guardados em cada sinal
const MAX_MS = 8000;     // duração máxima de um sinal
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

let base = null, faceTask = null;
const make = async (V, fs, Cls, model, extra) => {
  const o = (d) => ({ baseOptions: { modelAssetPath: model, delegate: d }, runningMode: 'VIDEO', ...extra });
  try { return await Cls.createFromOptions(fs, o('GPU')); } catch { return Cls.createFromOptions(fs, o('CPU')); }
};
const vision = () => import(`${VISION}/vision_bundle.mjs`).then(async (V) => ({ V, fs: await V.FilesetResolver.forVisionTasks(`${VISION}/wasm`) }));
/** Descarrega (uma vez) os detetores do MediaPipe: mãos e corpo; o rosto só quando é preciso (gravar sinais). */
async function loadTasks(withFace) {
  base ||= vision().then(async ({ V, fs }) => ({ V, fs, hand: await make(V, fs, V.HandLandmarker, MODELS.hand, { numHands: 2 }), pose: await make(V, fs, V.PoseLandmarker, MODELS.pose, { numPoses: 1 }) }));
  const b = await base.catch((e) => { base = null; throw e; });
  if (withFace) faceTask ||= make(b.V, b.fs, b.V.FaceLandmarker, MODELS.face, { numFaces: 1, outputFaceBlendshapes: true }).catch((e) => { faceTask = null; throw e; });
  return { hand: b.hand, pose: b.pose, face: withFace ? await faceTask : null };
}

export class SignRecorder {
  /** onStatus(texto, tipo) · onSign(sinal gravado) */
  constructor({ video, overlay, onStatus, onSign, face = true, pauseSplit = false }) {
    Object.assign(this, { video, overlay, onStatus, onSign, useFace: face, pauseSplit });
    this.ctx = overlay.getContext('2d');
    this.mode = 'auto'; this.on = false; this.armed = false; this.take = null;
  }

  async start() {
    this.onStatus('A ligar a câmara…', 'busy');
    try {
      this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      await this.video.play();
    } catch (e) {
      this.onStatus(window.__INCLUI_EMBED ? 'A câmara não funciona nesta pré-visualização. Abra a Inclui+ publicada.'
        : e.name === 'NotAllowedError' ? 'Permita o acesso à câmara.' : !window.isSecureContext ? 'A câmara só funciona num endereço https://.' : 'Não foi possível ligar a câmara.', 'error');
      return false;
    }
    this.on = true;
    this.onStatus('A preparar o reconhecimento do corpo, das mãos e do rosto… (só demora na primeira vez)', 'busy');
    try { this.t = await loadTasks(this.useFace); } catch { this.onStatus('Não foi possível descarregar o reconhecimento. Verifique a internet.', 'error'); return false; }
    this.onStatus('Pronto. Fique de frente, com o corpo da cintura para cima visível.', 'live');
    this.loop();
    return true;
  }
  stop() {
    this.on = false; this.armed = false; this.take = null;
    this.video.srcObject?.getTracks().forEach((t) => t.stop()); this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  /** Manual: contagem e começa a gravar. Automático: fica à espera que as mãos subam. */
  arm() {
    if (this.mode === 'auto') { this.armed = true; this.onStatus('À espera do sinal: levante as mãos para começar e baixe-as no fim.', 'live'); return; }
    let n = 3; this.onStatus(`A gravar em ${n}…`, 'busy');
    clearInterval(this.cd);
    this.cd = setInterval(() => { n--; if (n > 0) this.onStatus(`A gravar em ${n}…`, 'busy'); else { clearInterval(this.cd); this.begin(); } }, 700);
  }
  disarm() { this.armed = false; clearInterval(this.cd); if (this.take) this.finish(); else this.onStatus('Parado.', 'live'); }
  begin() { this.take = { t0: performance.now(), frames: [], hands: [] }; this.onStatus('● A gravar… faça o sinal', 'rec'); navigator.vibrate?.(30); }

  loop() {
    if (!this.on) return;
    const v = this.video;
    if (v.videoWidth && v.currentTime !== this.lastT) {
      this.lastT = v.currentTime;
      const now = performance.now();
      const pose = this.t.pose.detectForVideo(v, now), hands = this.t.hand.detectForVideo(v, now);
      // o rosto é mais pesado: um em cada dois fotogramas chega para a expressão
      if (this.useFace && (this.n = (this.n || 0) + 1) % 2 === 0) this.face = faceFrom(this.t.face.detectForVideo(v, now).faceBlendshapes?.[0]?.categories);
      this.draw(pose.landmarks?.[0], hands.landmarks || []);
      const fr = pose.landmarks?.[0] && frameFrom({ pose: pose.landmarks[0], poseWorld: pose.worldLandmarks?.[0], hands: hands.landmarks || [], handsWorld: hands.worldLandmarks || [], face: this.face });
      this.step(fr, pose.landmarks?.[0], hands.landmarks || [], now);
    }
    requestAnimationFrame(() => this.loop());
  }

  /** Decide quando começa e acaba cada sinal e guarda os fotogramas. */
  step(fr, pose, hands, now) {
    // mãos "ativas": detetadas e acima da cintura (a meio entre os ombros e as ancas, ou mais alto)
    const up = pose && hands.length && [15, 16].some((i) => pose[i].visibility > 0.5 && pose[i].y < (pose[23].y + pose[11].y) / 2 + 0.06);
    if (this.mode === 'auto' && this.armed) {
      this.upN = up ? (this.upN || 0) + 1 : 0; this.downN = up ? 0 : (this.downN || 0) + 1;
      const moving = this.motion(fr);
      if (this.downN === 20) this.onRest?.(); // mãos em baixo há algum tempo: fim da frase
      if (!this.take && this.upN >= 3 && (!this.paused || moving)) { this.paused = false; this.begin(); }
      else if (this.take && this.downN >= 8) { this.finish(); return; }
      else if (this.take && this.pauseSplit && this.stillN >= 9 && now - this.take.t0 > 450) { this.finish(); this.paused = true; return; }
    }
    if (!this.take || !fr) return;
    this.take.frames.push({ at: now, ...fr });
    // a forma de mão de cada fotograma também ensina o reconhecimento pela câmara
    if (hands[0]) this.take.hands.push(describe(fromMediaPipe(hands[0], this.video.videoWidth, this.video.videoHeight)));
    if (now - this.take.t0 > MAX_MS) this.finish();
  }

  /** Mãos em movimento? (conta os fotogramas parados, para separar sinais numa frase) */
  motion(fr) {
    const p = fr && (fr.R?.p || fr.L?.p);
    const d = p && this.lastP ? Math.hypot(p[0] - this.lastP[0], p[1] - this.lastP[1], p[2] - this.lastP[2]) : 0;
    this.lastP = p || null;
    this.stillN = d < 0.004 ? (this.stillN || 0) + 1 : 0;
    return d > 0.008;
  }

  /** Fecha o sinal: limpa, suaviza, reamostra a FPS fotogramas por segundo e entrega-o. */
  finish() {
    const take = this.take; this.take = null;
    if (!take || take.frames.length < 4 || take.frames[take.frames.length - 1].at - take.t0 < 350) { this.onStatus('Sinal muito curto. Tente outra vez.', 'live'); return; }
    const frames = resample(fillGaps(take.frames));
    const step = Math.max(1, Math.floor(take.hands.length / 24));
    const samples = take.hands.filter((_, i) => i % step === 0).slice(0, 24);
    this.onStatus(this.mode === 'auto' && this.armed ? 'Sinal gravado. Pode fazer o seguinte.' : 'Sinal gravado.', 'live');
    navigator.vibrate?.([30, 60, 30]);
    this.onSign({ frames, samples, duration: frames.length / FPS });
  }

  draw(pose, hands) {
    const o = this.overlay, x = this.ctx; o.width = this.video.videoWidth; o.height = this.video.videoHeight; x.clearRect(0, 0, o.width, o.height);
    x.lineCap = 'round';
    if (pose) {
      x.strokeStyle = this.take ? 'rgba(229,72,77,.9)' : 'rgba(91,189,232,.9)'; x.lineWidth = 6;
      for (const [a, b] of BONES) { x.beginPath(); x.moveTo(pose[a].x * o.width, pose[a].y * o.height); x.lineTo(pose[b].x * o.width, pose[b].y * o.height); x.stroke(); }
    }
    x.fillStyle = '#46b07a';
    for (const lm of hands) for (const p of lm) { x.beginPath(); x.arc(p.x * o.width, p.y * o.height, 4, 0, 7); x.fill(); }
  }
}

// mão que desaparece por instantes: mantém a última posição (até 4 fotogramas)
function fillGaps(frames) {
  for (const k of ['R', 'L']) {
    let last = null, miss = 0;
    for (const f of frames) { if (f[k]) { last = f[k]; miss = 0; } else if (last && ++miss <= 4) f[k] = last; }
  }
  return frames;
}
// reamostra no tempo (FPS constante) com média móvel das posições e direções
function resample(frames) {
  const t0 = frames[0].at, t1 = frames[frames.length - 1].at, n = Math.max(2, Math.round((t1 - t0) / 1000 * FPS));
  const avg = (list, key) => { const v = list.filter(Boolean).map((s) => s[key]); if (!v.length) return null; return v[0].map((_, j) => Math.round(v.reduce((a, b) => a + b[j], 0) / v.length * 1000) / 1000); };
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (i / (n - 1)) * (t1 - t0);
    const near = frames.filter((f) => Math.abs(f.at - t) <= 1000 / FPS);
    const pick = near.length ? near : [frames.reduce((a, b) => (Math.abs(b.at - t) < Math.abs(a.at - t) ? b : a))];
    const mid = pick[Math.floor(pick.length / 2)];
    const hand = (k) => {
      const list = pick.map((f) => f[k]);
      if (!mid[k] && list.filter(Boolean).length < pick.length / 2) return null;
      const ref = mid[k] || list.find(Boolean);
      return { p: avg(list, 'p'), f: avg(list, 'f'), palm: avg(list, 'palm'), hs: ref.hs };
    };
    out.push({ R: hand('R'), L: hand('L'), face: mid.face || undefined, t: 1 / FPS });
  }
  out[0].t = 0.25; // entrada suave no primeiro fotograma
  return out;
}
