// Modo Orientação para pessoas cegas ou com baixa visão.
// Tudo é dito em voz alta, com botões enormes e vibração:
//  • Onde estou?          → localização (GPS) + morada (OpenStreetMap)
//  • O que está à frente? → câmara traseira + deteção de objetos/pessoas, com direção e distância aproximada
//  • Ler texto            → fotografia + leitura de texto (OCR) em voz alta
//  • Pedir ajuda          → mensagem grande no ecrã, som e vibração, para quem estiver perto ajudar
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const DETECT_MODEL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

// nomes das classes do detetor (COCO) em português
const PT = { person: 'pessoa', bicycle: 'bicicleta', car: 'carro', motorcycle: 'mota', bus: 'autocarro', truck: 'camião', 'traffic light': 'semáforo',
  'fire hydrant': 'boca de incêndio', 'stop sign': 'sinal de stop', bench: 'banco', dog: 'cão', cat: 'gato', chair: 'cadeira', couch: 'sofá', bed: 'cama',
  'dining table': 'mesa', toilet: 'sanita', tv: 'televisão', laptop: 'computador', 'cell phone': 'telemóvel', bottle: 'garrafa', cup: 'copo',
  backpack: 'mochila', handbag: 'mala', suitcase: 'mala de viagem', umbrella: 'guarda-chuva', book: 'livro', clock: 'relógio', sink: 'lava-loiça',
  refrigerator: 'frigorífico', 'potted plant': 'vaso', door: 'porta', keyboard: 'teclado', mouse: 'rato', scissors: 'tesoura', knife: 'faca', bowl: 'tigela' };

export class BlindMode {
  constructor({ root, speak, video, onExit }) {
    Object.assign(this, { root, speak, video, onExit });
    this.$ = (s) => root.querySelector(s);
    this.$('[data-b=where]').onclick = () => this.where();
    this.$('[data-b=ahead]').onclick = () => (this.scanning ? this.stopScan() : this.ahead());
    this.$('[data-b=read]').onclick = () => this.read();
    this.$('[data-b=help]').onclick = () => this.help();
    this.$('[data-b=exit]').onclick = () => this.exit();
    this.$('[data-b=voice]').onclick = () => this.voice();
    this.$('.help-screen').onclick = () => this.$('.help-screen').hidden = true;
  }
  open() {
    this.root.hidden = false;
    this.say('Modo orientação. Toque no topo para saber onde está. No meio, para saber o que está à sua frente. Em baixo, para ler um texto ou pedir ajuda.');
  }
  exit() { this.stopScan(); this.stopCam(); this.root.hidden = true; speechSynthesis.cancel(); this.onExit?.(); }
  say(t, vib = 30) { this.$('.b-status').textContent = t; this.speak(t); navigator.vibrate?.(vib); }

  /* ---------- onde estou ---------- */
  where() {
    if (!navigator.geolocation) return this.say('Este dispositivo não indica a localização.');
    this.say('A procurar a sua localização…');
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { latitude: la, longitude: lo, accuracy } = p.coords;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&accept-language=pt&zoom=18`, { signal: AbortSignal.timeout(9000) });
        const j = await r.json(); const a = j.address || {};
        const rua = a.road || a.pedestrian || a.footway || '', bairro = a.suburb || a.neighbourhood || a.quarter || '', cidade = a.city || a.town || a.village || '';
        const lugar = j.name && j.name !== rua ? j.name + ', ' : '';
        this.say(`Está em ${lugar}${rua || 'local sem nome de rua'}${bairro ? ', ' + bairro : ''}${cidade ? ', ' + cidade : ''}. Precisão de cerca de ${Math.round(accuracy)} metros.`);
      } catch { this.say(`Localização encontrada, mas sem internet para dizer a morada. Latitude ${la.toFixed(4)}, longitude ${lo.toFixed(4)}.`); }
    }, (e) => this.say(e.code === 1 ? 'Permita o acesso à localização para eu poder dizer onde está.' : 'Não consegui obter a localização. Tente perto de uma janela ou na rua.'), { enableHighAccuracy: true, timeout: 15000 });
  }

  /* ---------- câmara ---------- */
  async startCam() {
    if (this.video.srcObject) return true;
    try {
      this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      await this.video.play(); this.$('.b-cam').hidden = false; return true;
    } catch (e) {
      this.say(window.__INCLUI_EMBED ? 'A câmara não funciona nesta pré-visualização. Abra a Inclui+ publicada ou no computador.' : e.name === 'NotAllowedError' ? 'Permita o acesso à câmara.' : 'Não foi possível ligar a câmara.');
      return false;
    }
  }
  stopCam() { this.video.srcObject?.getTracks().forEach((t) => t.stop()); this.video.srcObject = null; this.$('.b-cam').hidden = true; }

  /* ---------- o que está à frente ---------- */
  async ahead() {
    if (!(await this.startCam())) return;
    this.say('A preparar a câmara para descrever o que está à frente…');
    try {
      if (!this.detector) {
        const { FilesetResolver, ObjectDetector } = await import(`${VISION}/vision_bundle.mjs`);
        const fs = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
        const o = (d) => ({ baseOptions: { modelAssetPath: DETECT_MODEL, delegate: d }, runningMode: 'VIDEO', scoreThreshold: 0.45, maxResults: 6 });
        try { this.detector = await ObjectDetector.createFromOptions(fs, o('GPU')); } catch { this.detector = await ObjectDetector.createFromOptions(fs, o('CPU')); }
      }
    } catch { return this.say('Não consegui descarregar o reconhecimento de objetos. Verifique a internet.'); }
    this.scanning = true; this.lastSaid = ''; this.lastAt = 0;
    this.$('[data-b=ahead] b').textContent = 'Parar de descrever';
    this.say('A descrever. Aponte o telemóvel para a frente e mova-o devagar.');
    const loop = () => {
      if (!this.scanning) return;
      const v = this.video;
      if (v.videoWidth && v.currentTime !== this.lt) {
        this.lt = v.currentTime;
        const res = this.detector.detectForVideo(v, performance.now());
        const now = performance.now();
        if (now - this.lastAt > 2600) {
          const items = (res.detections || []).map((d) => {
            const c = d.categories[0], bb = d.boundingBox, cx = (bb.originX + bb.width / 2) / v.videoWidth, area = (bb.width * bb.height) / (v.videoWidth * v.videoHeight);
            const where = cx < 0.36 ? 'à esquerda' : cx > 0.64 ? 'à direita' : 'à frente';
            const near = area > 0.25 ? 'muito perto' : area > 0.08 ? 'perto' : 'mais longe';
            return { name: PT[c.categoryName] || c.categoryName, where, near, area };
          }).sort((a, b) => b.area - a.area).slice(0, 3);
          const text = items.length ? items.map((i) => `${i.name} ${i.where}, ${i.near}`).join('. ') : '';
          if (text && text !== this.lastSaid) { this.say(text, items[0].near === 'muito perto' ? [80, 60, 80] : 30); this.lastSaid = text; this.lastAt = now; }
          else if (!text && now - this.lastAt > 6000) { this.say('Caminho livre à frente, até onde a câmara vê.', 15); this.lastAt = now; this.lastSaid = ''; }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }
  stopScan() { if (!this.scanning) return; this.scanning = false; this.$('[data-b=ahead] b').textContent = 'O que está à minha frente?'; this.say('Parei de descrever.'); this.stopCam(); }

  /* ---------- ler texto ---------- */
  async read() {
    this.stopScan();
    if (!(await this.startCam())) return;
    this.say('Aponte a câmara para o texto e fique quieto. Vou ler daqui a três segundos.');
    await new Promise((r) => setTimeout(r, 3000));
    const c = document.createElement('canvas'); c.width = this.video.videoWidth; c.height = this.video.videoHeight;
    c.getContext('2d').drawImage(this.video, 0, 0); this.say('A ler…');
    try {
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = TESSERACT; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      this.ocr ||= await window.Tesseract.createWorker('por');
      const { data } = await this.ocr.recognize(c);
      const text = data.text.replace(/\s+/g, ' ').trim();
      this.say(text.length > 3 ? text : 'Não encontrei texto. Aproxime mais a câmara e tente outra vez.');
    } catch { this.say('Não consegui ler o texto. É preciso internet na primeira vez.'); }
    this.stopCam();
  }

  /* ---------- pedir ajuda ---------- */
  help() {
    const scr = this.$('.help-screen'); scr.hidden = false;
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    this.speak('Preciso de ajuda, por favor. Sou uma pessoa cega. Preciso de ajuda, por favor.');
  }

  /* ---------- comandos por voz ---------- */
  voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return this.say('Os comandos por voz precisam do Google Chrome.');
    const r = new SR(); r.lang = 'pt-PT';
    this.say('Diga: onde estou, o que está à frente, ler, ou ajuda.', 20);
    setTimeout(() => {
      r.onresult = (e) => {
        const t = e.results[0][0].transcript.toLowerCase();
        if (/onde/.test(t)) this.where(); else if (/frente|ver|descrev/.test(t)) this.ahead(); else if (/ler|leia|texto/.test(t)) this.read();
        else if (/ajuda|socorro/.test(t)) this.help(); else if (/sair|voltar/.test(t)) this.exit(); else this.say('Não percebi. Tente outra vez.');
      };
      r.onerror = () => this.say('Não ouvi. Toque outra vez no botão de voz.');
      r.start();
    }, 2600);
  }
}
