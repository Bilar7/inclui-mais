// Professor virtual: pergunta → resposta (IA no servidor, ou modo offline) → voz com lábios sincronizados.
import { localAnswer } from './tutor-offline.js';

let hasServer = null;
async function serverUp() {
  if (hasServer !== null) return hasServer;
  if (location.protocol === 'file:' || window.__INCLUI_EMBED) return (hasServer = false);
  try { const r = await fetch('api/health', { signal: AbortSignal.timeout(2500) }); hasServer = r.ok && (await r.json()).ok === true; }
  catch { hasServer = false; }
  return hasServer;
}

/** Faz a pergunta. Devolve { answer, emotion, keywords, source }. */
const PROMPT = (lang, place) => `És o professor virtual da Inclui+ (Bilar DigitalTech Solutions, Moçambique), uma aplicação de inclusão de pessoas surdas.
Responde a perguntas de estudo de forma correta, simples e amável, em ${lang === 'en' ? 'inglês' : lang === 'es' ? 'espanhol' : 'português de Moçambique'}.
No máximo 3 frases curtas e palavras simples (a resposta é dita em voz alta e traduzida em língua de sinais). Contexto: ${place}.
Devolve APENAS JSON: {"answer":"...","emotion":"smile|think|surprise|sad|neutral","keywords":["2 a 6 palavras-chave simples"]}`;

// Dentro do claude.ai (link alojado), a página pode perguntar diretamente ao Claude.
async function askClaudeHere(question, lang, place, history) {
  const sample = await window.claude?.use?.('sample').catch?.(() => null);
  if (!sample) return null;
  const msgs = [{ role: 'user', content: PROMPT(lang, place) + '\n\nConversa até agora:\n' + history.map((m) => `${m.role === 'user' ? 'Aluno' : 'Professor'}: ${m.content}`).join('\n') + `\n\nPergunta do aluno: ${question}` }];
  const r = await sample(msgs, { modelTier: 'quick', cache: false });
  const m = r.text.match(/\{[\s\S]*\}/);
  try { const o = JSON.parse(m ? m[0] : r.text); return { answer: String(o.answer || ''), emotion: o.emotion || 'neutral', keywords: o.keywords || [], source: 'ia' }; }
  catch { return { answer: r.text.slice(0, 400), emotion: 'neutral', keywords: [], source: 'ia' }; }
}

export async function ask(question, { lang = 'pt', place = 'escola', history = [] } = {}) {
  if (window.__INCLUI_EMBED) { try { const r = await askClaudeHere(question, lang, place, history); if (r?.answer) return r; } catch (e) { console.warn('IA indisponível', e); } }
  if (await serverUp()) {
    try {
      const r = await fetch('api/tutor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, lang, place, history }), signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
    } catch { /* cai para o modo offline */ }
  }
  return { ...localAnswer(question, lang), source: 'offline' };
}

/**
 * Diz o texto com o avatar:
 *  1) voz do servidor + NVIDIA Audio2Face (lábios e rosto gerados pela voz), se configurado;
 *  2) senão, voz do navegador com lábios guiados palavra a palavra.
 */
export async function speakWithFace(text, it, { lang = 'pt-PT', words = 'pt', onEnd } = {}) {
  if (await serverUp()) {
    try {
      const r = await fetch('api/speech', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang: words }), signal: AbortSignal.timeout(40000) });
      const j = r.ok ? await r.json() : null;
      if (j?.available) return playServerSpeech(j, it, onEnd, text);
    } catch { /* usa a voz do navegador */ }
  }
  return browserSpeech(text, it, lang, onEnd);
}

function playServerSpeech({ audio, frames, names }, it, onEnd, text) {
  const el = new Audio(audio);
  let raf = 0;
  const tick = () => {
    if (frames?.length && names?.length) {
      const t = el.currentTime; let lo = 0, hi = frames.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid][0] <= t) lo = mid; else hi = mid - 1; }
      const f = frames[lo], w = {}; names.forEach((n, i) => (w[n] = f[i + 1])); it.setFaceWeights(w);
    }
    if (!el.paused && !el.ended) raf = requestAnimationFrame(tick);
  };
  el.onplay = () => { it.speaking = true; raf = requestAnimationFrame(tick); if (!frames) wordTimeline(text, el.duration, it); };
  el.onended = el.onerror = () => { it.speaking = false; cancelAnimationFrame(raf); onEnd?.(); };
  el.play().catch(() => onEnd?.());
  return el;
}

let voices = [];
const getSpeechSynthesis = () => (typeof window !== 'undefined' ? window.speechSynthesis : null);
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { const lv = () => (voices = getSpeechSynthesis().getVoices()); lv(); getSpeechSynthesis().addEventListener?.('voiceschanged', lv); }
function browserSpeech(text, it, lang, onEnd) {
  const synth = getSpeechSynthesis();
  if (!synth || !text || typeof SpeechSynthesisUtterance === 'undefined') { onEnd?.(); return null; }
  const u = new SpeechSynthesisUtterance(text);
  const v = voices.find((x) => x.lang.replace('_', '-') === lang) || voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
  u.lang = v?.lang || lang; if (v) u.voice = v; u.rate = 0.95;
  const words = text.split(/\s+/).filter(Boolean);
  let gotBoundary = false, timer = null, wi = 0;
  const msPer = (w) => 90 + w.length * 62;
  // alguns telemóveis não enviam o evento "boundary": agenda as palavras por estimativa
  const fallback = () => { if (gotBoundary || wi >= words.length) return; const w = words[wi++]; it.say(w, msPer(w)); timer = setTimeout(fallback, msPer(w) + 40); };
  u.onstart = () => { it.speaking = true; timer = setTimeout(fallback, 120); };
  u.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    gotBoundary = true; clearTimeout(timer);
    const w = text.slice(e.charIndex).split(/\s+/)[0] || ''; it.say(w, (e.charLength || w.length) * 70 + 90);
  };
  u.onend = u.onerror = () => { clearTimeout(timer); it.speaking = false; it.say('', 0); onEnd?.(); };
  synth.cancel(); synth.speak(u);
  return u;
}
// Voz do servidor sem Audio2Face: distribui as palavras pela duração real do áudio, em proporção ao tamanho.
function wordTimeline(text, durationSec, it) {
  const words = text.split(/\s+/).filter(Boolean); if (!words.length || !isFinite(durationSec)) return;
  const total = words.reduce((s, w) => s + w.length + 2, 0); let t = 0;
  for (const w of words) { const ms = ((w.length + 2) / total) * durationSec * 1000; setTimeout(() => it.say(w, ms), t); t += ms; }
}
