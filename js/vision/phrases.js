// Reconhecimento de frases em língua de sinais: cada sinal feito à câmara é comparado com os sinais aprendidos
// (os meus e os da comunidade) por DTW — compara movimentos mesmo que sejam feitos mais depressa ou devagar.
// Os sinais reconhecidos juntam-se numa frase, que é dita em voz alta quando a pessoa baixa as mãos.

// descrição de um fotograma: para cada mão, posição do pulso, direção dos dedos, normal da palma e dobra de cada dedo
const HAND = 14;
function handVec(h, out, o) {
  if (!h) { out[o + 13] = 0; return; }
  out.set(h.p, o); out.set(h.f, o + 3); out.set(h.palm, o + 6);
  h.hs.f.forEach((d, i) => (out[o + 9 + i] = (d[0] + d[1] + d[2]) / 300)); // 0 = esticado, 1 = fechado
  out[o + 13] = 1; // mão presente
}
// pesos: a posição conta mais, depois a forma da mão e a orientação
const W = Float32Array.from([2.2, 2.2, 2.2, 0.8, 0.8, 0.8, 0.6, 0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 1]);
function features(frames) {
  return frames.map((f) => { const v = new Float32Array(HAND * 2); handVec(f.R, v, 0); handVec(f.L, v, HAND); return v; });
}
function dist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = (a[i] - b[i]) * W[i % HAND]; s += d * d; }
  return Math.sqrt(s);
}
/** Distância DTW normalizada entre duas sequências (com faixa de Sakoe-Chiba para não deformar demais). */
function dtw(a, b) {
  const n = a.length, m = b.length, band = Math.max(3, Math.ceil(Math.max(n, m) * 0.35));
  let prev = new Float32Array(m + 1).fill(Infinity), cur = new Float32Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const c = Math.round(i * m / n), lo = Math.max(1, c - band), hi = Math.min(m, c + band);
    for (let j = lo; j <= hi; j++) cur[j] = dist(a[i - 1], b[j - 1]) + Math.min(prev[j], prev[j - 1], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

/** Sinal aprendido mais parecido; null se nenhum for parecido o suficiente. */
export function classify(frames, signs, maxD = 0.55) {
  const q = features(frames);
  let best = null;
  for (const s of signs) {
    const t = (s._feat ||= features(s.frames));
    const d = dtw(q, t);
    if (!best || d < best.d) best = { word: s.words[0], d, sign: s };
  }
  return best && best.d < maxD ? best : null;
}
