// Sinais aprendidos: os que cada pessoa grava com a câmara e os validados pela comunidade (Firebase).
// Cada sinal pertence a uma língua de sinais (lsm, libras, asl…) e tem as palavras que traduz numa língua falada.
// O tradutor usa-os antes do vocabulário de demonstração; o reconhecimento pela câmara aprende as formas de mão deles.
import { strip } from './text.js';

const state = { sl: 'lsm', mine: [], community: [] };
let cache = null;

/** Língua de sinais em uso (os sinais aprendidos de outras línguas ficam guardados mas não são usados). */
export function setSignLang(sl) { if (state.sl !== sl) { state.sl = sl; cache = null; } }
export const signLang = () => state.sl;
export function setLearned({ mine, community }) {
  if (mine) state.mine = mine;
  if (community) state.community = community;
  cache = null;
}
export const mySigns = () => state.mine;

/** Índice palavra → sinal para a língua de sinais e a língua falada em uso (os meus sinais têm prioridade). */
export function learnedIndex(lang) {
  const key = state.sl + '|' + lang;
  if (cache?.key === key) return cache.map;
  const map = new Map();
  for (const s of [...state.community, ...state.mine]) {
    if (s.sl !== state.sl || (s.lang && s.lang !== lang)) continue;
    for (const w of s.words) map.set(strip(w.toLowerCase()), s);
  }
  cache = { key, map };
  return map;
}

/** Sinais gravados da língua de sinais em uso (para reconhecer frases pela câmara). */
export const learnedSigns = () => [...state.community, ...state.mine].filter((s) => s.sl === state.sl && s.frames?.length);

/** Exemplos de forma de mão (para o reconhecimento pela câmara), com a palavra como etiqueta. */
export function learnedSamples() {
  const out = [];
  for (const s of [...state.community, ...state.mine]) if (s.sl === state.sl) for (const f of s.samples || []) out.push({ label: s.words[0], f });
  return out;
}
