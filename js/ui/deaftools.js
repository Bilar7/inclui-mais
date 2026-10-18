// Ferramentas para pessoas surdas no dia a dia:
//  • Legendas ao vivo — tudo o que se diz à volta aparece em letras grandes (aulas, consultas, reuniões).
//  • Alerta de sons — quando há um som forte (campainha, alarme, alguém a chamar) o ecrã pisca e o telemóvel vibra.
import { esc } from '../core/store.js';

export class Captions {
  constructor({ root, lang, onExit, toast, speak }) {
    Object.assign(this, { root, lang, onExit, toast, speak });
    this.$ = (s) => root.querySelector(s);
    this.lines = []; this.size = 1;
    this.$('[data-c=exit]').onclick = () => this.close();
    this.$('[data-c=pause]').onclick = () => (this.on ? this.stop(true) : this.start());
    this.$('[data-c=clear]').onclick = () => { this.lines = []; this.draw(''); };
    this.$('[data-c=bigger]').onclick = () => this.zoom(0.15);
    this.$('[data-c=smaller]').onclick = () => this.zoom(-0.15);
    this.$('[data-c=reply]').onsubmit = (e) => {
      e.preventDefault(); const i = this.$('[data-c=replyIn]'), t = i.value.trim(); if (!t) return;
      this.lines.push({ me: true, t }); this.draw(''); this.speak(t); i.value = '';
    };
  }
  open() { this.root.hidden = false; this.lines = []; this.draw(''); this.start(); }
  close() { this.stop(true); this.root.hidden = true; this.onExit?.(); }
  zoom(d) { this.size = Math.min(2, Math.max(0.7, this.size + d)); this.root.style.setProperty('--cap', this.size); }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.draw(''); this.$('.cap-text').innerHTML = '<p class="cap-ph">As legendas ao vivo precisam do Google Chrome ou do Edge (no telemóvel: Chrome no Android, Safari no iPhone recente).</p>'; return; }
    const r = (this.rec = new SR()); r.lang = this.lang(); r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) { if (t) this.lines.push({ t, at: new Date() }); } else interim += t + ' ';
      }
      this.draw(interim);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed') { this.toast('Permita o microfone para ver as legendas.'); this.stop(true); } };
    r.onend = () => { if (this.on) try { r.start(); } catch { /* já a ouvir */ } }; // continua sem parar
    this.on = true; this.$('[data-c=pause]').textContent = '⏸ Pausa'; this.$('.cap-live').hidden = false;
    try { r.start(); } catch { /* já a ouvir */ }
  }
  stop(user) { this.on = false; try { this.rec?.stop(); } catch { /* */ } if (user) { this.$('[data-c=pause]').textContent = '▶ Continuar'; this.$('.cap-live').hidden = true; } }
  draw(interim) {
    const box = this.$('.cap-text');
    box.innerHTML = this.lines.slice(-30).map((l) => `<p class="${l.me ? 'me' : ''}">${esc(l.t)}</p>`).join('') +
      (interim ? `<p class="interim">${esc(interim)}</p>` : '') + (!this.lines.length && !interim ? '<p class="cap-ph">À escuta… o que for dito aparece aqui em letras grandes.</p>' : '');
    box.scrollTop = box.scrollHeight;
  }
  text() { return this.lines.map((l) => (l.me ? 'Eu: ' : '') + l.t).join('\n'); }
}

export class SoundAlert {
  constructor({ root, onExit, toast }) {
    Object.assign(this, { root, onExit, toast });
    this.$ = (s) => root.querySelector(s);
    this.$('[data-s=exit]').onclick = () => this.close();
    this.$('[data-s=toggle]').onclick = () => (this.on ? this.stop() : this.start());
    this.$('[data-s=sens]').oninput = (e) => (this.sens = +e.target.value);
    this.sens = +this.$('[data-s=sens]').value; this.events = [];
  }
  open() { this.root.hidden = false; }
  close() { this.stop(); this.root.hidden = true; this.onExit?.(); }
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { this.toast(window.__INCLUI_EMBED ? 'O microfone não funciona nesta pré-visualização. Abra a Inclui+ publicada.' : 'Permita o microfone para detetar sons.'); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const an = ctx.createAnalyser(); an.fftSize = 2048; ctx.createMediaStreamSource(this.stream).connect(an);
    const buf = new Float32Array(an.fftSize); let base = 0.01, hold = 0;
    this.on = true; this.$('[data-s=toggle]').textContent = '⏹ Parar'; this.$('.snd-state').textContent = 'A escutar sons à sua volta…';
    const loop = () => {
      if (!this.on) return;
      an.getFloatTimeDomainData(buf);
      let s = 0; for (const v of buf) s += v * v; const rms = Math.sqrt(s / buf.length);
      base = base * 0.995 + Math.min(rms, base * 3) * 0.005; // nível de fundo que se adapta ao ambiente
      const level = Math.min(1, rms * 8); this.$('.snd-meter i').style.width = level * 100 + '%';
      const k = 10 - this.sens * 0.8; // sensibilidade 1–10
      if (rms > Math.max(0.02, base * k) && performance.now() > hold) { hold = performance.now() + 2500; this.alert(rms); }
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.on = false; this.stream?.getTracks().forEach((t) => t.stop()); this.ctx?.close(); this.ctx = null; this.$('[data-s=toggle]').textContent = '▶ Começar a escutar'; this.$('.snd-state').textContent = 'Desligado'; }
  alert(rms) {
    navigator.vibrate?.([400, 150, 400]);
    this.root.classList.remove('flash'); void this.root.offsetWidth; this.root.classList.add('flash');
    const t = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.events.unshift(`${rms > 0.25 ? 'Som muito forte' : 'Som forte'} · ${t}`);
    this.$('.snd-log').innerHTML = this.events.slice(0, 8).map((e) => `<li>🔔 ${esc(e)}</li>`).join('');
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Inclui+ · Som detetado', { body: this.events[0] });
  }
}
