// Converte uma frase (falada ou escrita) numa sequência de sinais, com expressão facial e soletração.
import { SIGNS } from './lexicon.js';
import { letterFrames } from './alphabet.js';
import { STOP } from '../core/languages.js';
import { strip } from './text.js';
import { learnedIndex } from './learned.js';
const INDEX = {};
function index(lang) {
  if (INDEX[lang]) return INDEX[lang];
  const map = new Map();
  for (const [id, s] of Object.entries(SIGNS)) for (const w of s.words[lang] || []) map.set(strip(w.toLowerCase()), id);
  return (INDEX[lang] = map);
}

/** Devolve { labels, items } prontos para o intérprete. */
export function translate(text, lang = 'pt') {
  const idx = index(lang), mine = learnedIndex(lang), stop = STOP[lang] || STOP.pt;
  const hasQ = /\?/.test(text);
  const words = strip(text.toLowerCase()).replace(/[.,!?;:¿¡"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  const raw = text.replace(/[.,!?;:¿¡"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    let id = null, used = 1;
    for (const n of [3, 2, 1]) {
      if (i + n > words.length) continue;
      const k = words.slice(i, i + n).join(' ');
      if (mine.has(k)) { id = mine.get(k); used = n; break; } // sinal gravado (meu ou da comunidade)
      if (idx.has(k)) { id = idx.get(k); used = n; break; }
    }
    const label = raw.slice(i, i + used).join(' ');
    if (id) out.push({ label, id });
    else if (!stop.has(words[i])) out.push({ label, letters: words[i].replace(/[^a-z0-9]/g, '') });
    i += used - 1;
  }
  const wh = out.some((o) => typeof o.id === 'string' && SIGNS[o.id].wh);
  const q = hasQ ? (wh ? 'wh' : 'yn') : null;
  const labels = []; const items = [];
  for (const o of out) {
    if (!labels.length || labels[labels.length - 1] !== o.label) labels.push(o.label);
    const index = labels.length - 1;
    if (o.id && typeof o.id === 'object') { // sinal gravado: fotogramas da câmara, com a expressão gravada
      items.push({ index, id: o.id.id, word: o.label, frames: o.id.frames, expr: q, mouth: strip(o.label.toLowerCase()), learned: true });
    } else if (o.id) {
      const s = SIGNS[o.id];
      items.push({ index, id: o.id, word: o.label, frames: s.frames, expr: s.expr || q, head: s.head || null, mouth: strip(o.label.toLowerCase()) });
    } else if (o.letters) {
      const frames = [...o.letters].slice(0, 14).flatMap((c) => letterFrames(c, 0.38));
      if (frames.length) items.push({ index, word: o.label, frames, expr: q, mouth: o.letters, spelled: true });
    }
  }
  return { labels, items };
}

/** Prepara os conceitos da resposta do professor para o intérprete, soletrando palavras sem sinal conhecido. */
export function translateResponse(response, lang = 'pt') {
  const keywords = Array.isArray(response?.keywords)
    ? response.keywords.filter((word) => typeof word === 'string' && word.trim()).join(' ')
    : '';
  const sourceTitle = Array.isArray(response?.sources)
    ? response.sources.find((source) => typeof source?.title === 'string' && source.title.trim())?.title.trim()
    : '';
  const answer = typeof response?.answer === 'string' ? response.answer : '';
  const text = keywords || sourceTitle || answer;
  const translated = translate(text, lang);
  return translated.items.length || text === answer ? translated : translate(answer, lang);
}
