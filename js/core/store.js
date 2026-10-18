// Preferências guardadas no dispositivo e utilitários de voz.
export const store = {
  get(k, d) { try { const v = localStorage.getItem('incluimais.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('incluimais.' + k, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } store.onSet?.(k, v); },
};

let voices = [];
const loadVoices = () => { voices = speechSynthesis.getVoices(); };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

/** Fala um texto na língua escolhida. */
export function speak(text, lang = 'pt-PT', hooks = {}) {
  if (!('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  const base = lang.slice(0, 2);
  const v = voices.find((x) => x.lang.replace('_', '-') === lang) || voices.find((x) => x.lang.startsWith(base));
  u.lang = v?.lang || lang; if (v) u.voice = v;
  u.onstart = () => hooks.start?.(); u.onend = u.onerror = () => hooks.end?.();
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

/** Reconhecimento de fala (Chrome / Edge / Android). */
export function listen(lang, { onText, onFinal, onStart, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError?.('unsupported'); return null; }
  const r = new SR(); r.lang = lang; r.interimResults = true; r.continuous = false;
  r.onstart = () => onStart?.();
  r.onresult = (e) => { let t = '', fin = false; for (const x of e.results) { t += x[0].transcript; fin = x.isFinal; } onText?.(t); if (fin) onFinal?.(t); };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => onEnd?.();
  r.start(); return r;
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
