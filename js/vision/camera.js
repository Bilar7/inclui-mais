// Câmara da pessoa surda: mostra a imagem logo, prepara o reconhecimento em segundo plano,
// reconhece gestos (palavras), letras do alfabeto manual e os sinais gravados (meus e da comunidade).
import { describe, fromMediaPipe, knn } from './features.js';

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
let recognizerPromise = null;

function loadRecognizer() {
  if (recognizerPromise) return recognizerPromise;
  recognizerPromise = (async () => {
    const { FilesetResolver, GestureRecognizer } = await import(`${VISION}/vision_bundle.mjs`);
    const fs = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    const opts = (d) => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numHands: 1 });
    try { return await GestureRecognizer.createFromOptions(fs, opts('GPU')); }
    catch { return await GestureRecognizer.createFromOptions(fs, opts('CPU')); }
  })();
  recognizerPromise.catch(() => { recognizerPromise = null; });
  return recognizerPromise;
}

export class DeafCamera {
  constructor({ video, overlay, onStatus, onCandidate, onCommit, onHand }) {
    Object.assign(this, { video, overlay, onStatus, onCandidate, onCommit, onHand });
    this.ctx = overlay.getContext('2d');
    this.on = false; this.mode = 'words'; this.letters = []; this.custom = []; this.meanings = {};
    this.cand = null; this.hold = 0; this.last = ''; this.lastAt = 0; this.lostAt = 0;
    this.lastFrameStamp = -1; this.lastInference = 0; this.inferenceBusy = false; this.latestResult = null;
    this.metrics = { processedFrames: 0, droppedFrames: 0, inferenceErrors: 0, captureToResultMs: 0, resultToUiMs: 0, totalLatencyMs: 0, fps: 0, lastFrameAt: 0, lastResultAt: 0, lastUiAt: 0, lastDecision: null };
    this.pendingFrame = null;
    if (typeof window !== 'undefined') {
      window.__INCLUI_METRICS__ = window.__INCLUI_METRICS__ || {};
      window.__INCLUI_METRICS__.camera = this.metrics;
    }
  }
  setSamples(letters, custom) { this.letters = letters; this.custom = custom; }

  async start() {
    this.onStatus('A ligar a câmara…', 'busy');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      this.video.srcObject = stream; await this.video.play();
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Permita o acesso à câmara (ícone do cadeado, ao lado do endereço).'
        : e.name === 'NotFoundError' ? 'Não foi encontrada nenhuma câmara neste dispositivo.'
        : window.__INCLUI_EMBED ? 'A câmara não funciona dentro desta pré-visualização. Abra a Inclui+ publicada (Netlify) ou no computador com duplo clique.'
        : !window.isSecureContext ? 'A câmara só funciona com um endereço https://. Abra a Inclui+ pelo link publicado.'
        : 'Não foi possível ligar a câmara.';
      this.onStatus(msg, 'error'); throw e;
    }
    this.on = true;
    this.onStatus('A preparar o reconhecimento… (só demora na primeira vez)', 'busy');
    const slow = setTimeout(() => this.on && !this.rec && this.onStatus('A internet está lenta. A câmara já está ligada; o reconhecimento chega em breve.', 'busy'), 12000);
    try {
      this.rec = await loadRecognizer();
      clearTimeout(slow);
      this.onStatus('Mostre a mão à câmara', 'live');
      this.loop();
    } catch (e) {
      clearTimeout(slow);
      this.onStatus('Não foi possível descarregar o reconhecimento. Verifique a internet e tente outra vez.', 'error');
    }
  }
  stop() {
    this.on = false; this.video.srcObject?.getTracks().forEach((t) => t.stop()); this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height); this.onStatus('Câmara desligada', 'off');
  }

  loop() {
    if (!this.on) return;
    const v = this.video;
    if (!v.videoWidth) return requestAnimationFrame(() => this.loop());

    const now = performance.now();
    const frameStamp = (v.currentTime || 0) * 1000;
    if (frameStamp <= this.lastFrameStamp) {
      this.metrics.droppedFrames = (this.metrics.droppedFrames || 0) + 1;
      return requestAnimationFrame(() => this.loop());
    }

    if (this.inferenceBusy || now - this.lastInference < 30) {
      this.metrics.droppedFrames = (this.metrics.droppedFrames || 0) + 1;
      return requestAnimationFrame(() => this.loop());
    }

    this.lastFrameStamp = frameStamp;
    this.lastInference = now;
    this.inferenceBusy = true;
    this.metrics.lastFrameAt = frameStamp;
    this.pendingFrame = { captureAt: now, frameStamp };
    try {
      const result = this.rec?.recognizeForVideo(v, now);
      this.onResult(result);
    } catch (error) {
      this.metrics.inferenceErrors++;
      this.metrics.lastInferenceError = error?.message || String(error);
      this.inferenceBusy = false;
      this.pendingFrame = null;
      this.onStatus('Falha ao processar a imagem da câmara. Tente desligar e ligar novamente.', 'error');
    }
    requestAnimationFrame(() => this.loop());
  }

  onResult(result) {
    this.inferenceBusy = false;
    this.latestResult = result;
    const res = result || { landmarks: [], gestures: [] };
    this.metrics.processedFrames = (this.metrics.processedFrames || 0) + 1;
    const resultAt = performance.now();
    if (this.lastResultPerfAt) this.metrics.fps = 1000 / Math.max(1, resultAt - this.lastResultPerfAt);
    this.lastResultPerfAt = resultAt;
    if (this.pendingFrame) {
      const captureToResult = Math.max(0, performance.now() - this.pendingFrame.captureAt);
      this.metrics.captureToResultMs = captureToResult;
      this.metrics.lastResultAt = resultAt;
      this.pendingFrame = null;
    }
    this.draw(res.landmarks || []);
    const lm = res.landmarks?.[0];
    if (lm) this.handle(lm, res.gestures?.[0]?.[0]); else this.none();
  }
  draw(hands) {
    const o = this.overlay, x = this.ctx; o.width = this.video.videoWidth; o.height = this.video.videoHeight; x.clearRect(0, 0, o.width, o.height);
    for (const lm of hands) {
      x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineCap = 'round';
      for (const [a, b] of CONN) { x.beginPath(); x.moveTo(lm[a].x * o.width, lm[a].y * o.height); x.lineTo(lm[b].x * o.width, lm[b].y * o.height); x.stroke(); }
      x.fillStyle = '#46b07a'; for (const p of lm) { x.beginPath(); x.arc(p.x * o.width, p.y * o.height, 5, 0, 7); x.fill(); }
    }
  }
  handle(lm, g) {
    this.lostAt = 0; this.onHand?.(true);
    const pts = fromMediaPipe(lm, this.video.videoWidth, this.video.videoHeight);
    const f = describe(pts);
    let word = null, kind = 'word';
    const own = knn(f, this.custom, 5, 1.1);
    if (own) word = own.label;
    else if (this.mode === 'letters') { const l = knn(f, this.letters, 7, 1.35); if (l) { word = l.label; kind = 'letter'; } }
    else if (g && g.score > 0.55 && g.categoryName !== 'None') word = this.meanings[g.categoryName] || null;
    if (!word && this.mode === 'words' && g?.categoryName === 'Open_Palm') word = this.wave(lm[0].x) ? this.meanings.wave : this.meanings.Open_Palm;
    if (g?.categoryName !== 'Open_Palm') this.wx = [];
    if (word && word === this.cand) this.hold++; else { this.cand = word; this.hold = 0; }

    const fast = Boolean(g && g.score > 0.78) || kind === 'letter';
    const need = kind === 'letter' ? 5 : word === this.meanings.wave ? 1 : fast ? 3 : 4;
    const candidateStartedAt = performance.now();
    this.onCandidate(word, word ? Math.min(1, this.hold / need) : 0, kind);
    const resultToUi = performance.now() - candidateStartedAt;
    if (this.metrics.lastResultAt) this.metrics.resultToUiMs = resultToUi;
    const repeat = word === this.last && performance.now() - this.lastAt < (kind === 'letter' ? 1000 : 1500);
    if (word && (this.hold >= need || (g && g.score > 0.9 && word === this.cand)) && !repeat) {
      const commitAt = performance.now();
      this.last = word; this.lastAt = commitAt; this.onCommit(word, kind);
      this.metrics.lastUiAt = commitAt;
      this.metrics.resultToUiMs = Math.max(0, commitAt - this.metrics.lastResultAt);
      this.metrics.totalLatencyMs = this.metrics.captureToResultMs + this.metrics.resultToUiMs;
      this.metrics.lastDecision = { word, kind, latencyMs: this.metrics.totalLatencyMs, at: commitAt };
      this.hold = 0;
    }
  }
  none() {
    this.cand = null; this.hold = 0; this.wx = []; this.onHand?.(false); this.onCandidate(null, 0);
    if (!this.lostAt) this.lostAt = performance.now();
    if (performance.now() - this.lostAt > 1100) { this.last = ''; if (this.mode === 'letters') this.onCommit(null, 'space'); this.lostAt = performance.now() + 1e9; }
  }
  wave(x) {
    const now = performance.now(); (this.wx ||= []).push([now, x]); this.wx = this.wx.filter(([t]) => now - t < 1200);
    if (this.wx.length < 8) return false;
    let turns = 0, dp = 0, mn = 1, mx = 0;
    for (let i = 1; i < this.wx.length; i++) { const d = this.wx[i][1] - this.wx[i - 1][1]; if (Math.abs(d) < 0.004) continue; const s = Math.sign(d); if (dp && s !== dp) turns++; dp = s; }
    for (const [, v] of this.wx) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    return turns >= 2 && mx - mn > 0.06;
  }
}
