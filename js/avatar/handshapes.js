// Configurações de mão em ângulos anatómicos (graus).
// f = [MCP, PIP, DIP] de indicador, médio, anelar e mindinho · s = abertura lateral de cada dedo
// t = polegar: abd (afastar do indicador), opp (oposição, rodar para a frente da palma), cmc, mcp, ip (dobrar)

const E = [0, 0, 0];          // estendido
const C = [88, 100, 65];      // fechado (punho)
const K = [85, 4, 0];         // dobrado só na base (mão em "pá")
const H = [8, 95, 70];        // gancho (letra X)
const CV = [22, 40, 30];      // curvo (letra C)
const OV = [48, 58, 42];      // em "O"
const EE = [70, 98, 75];      // dobrado sobre o polegar (letra E)
const R = [6, 8, 5];          // relaxado

// posições do polegar: resolvidas para cada avatar por cinemática inversa (ver rig.js · THUMB_TARGETS)
const T = { out: 'out', side: 'side', across: 'across', tuck: 'tuck', oppose: 'oppose', cgap: 'cgap', under: 'under', between: 'between', rest: 'rest', up: 'up' };
const shape = (f, t, s = [0, 0, 0, 0]) => ({ f, t, s });

export const HS = {
  relax:  shape([[8, 12, 8], [10, 15, 10], [12, 18, 12], [14, 22, 14]], T.rest, [2, 0, -2, -4]),
  open:   shape([E, E, E, E], T.out, [8, 1, -6, -13]),       // mão aberta "5"
  flat:   shape([E, E, E, E], T.tuck),                         // B
  four:   shape([E, E, E, E], T.tuck, [8, 1, -6, -13]),        // 4
  flatT:  shape([E, E, E, E], T.side),                         // mão plana com polegar junto
  fist:   shape([C, C, C, C], T.across),                       // S
  A:      shape([C, C, C, C], T.side),
  point:  shape([E, C, C, C], T.across),                       // indicador (1)
  D:      shape([E, OV, OV, OV], T.oppose),
  V:      shape([E, E, C, C], T.across, [9, -9, 0, 0]),
  U:      shape([E, E, C, C], T.across, [1, -1, 0, 0]),
  W:      shape([E, E, E, C], T.across, [8, 0, -8, 0]),
  thumb:  shape([C, C, C, C], T.up),                           // 👍
  L:      shape([E, C, C, C], T.out),
  Y:      shape([C, C, C, E], T.out, [0, 0, 0, -14]),
  ILY:    shape([E, C, C, E], T.out, [4, 0, 0, -12]),
  C:      shape([CV, CV, CV, CV], T.cgap),
  O:      shape([OV, OV, OV, OV], T.oppose),
  pinky:  shape([C, C, C, E], T.across),                       // I
  claw:   shape([[25, 60, 45], [25, 60, 45], [25, 60, 45], [25, 60, 45]], T.out, [7, 1, -5, -11]),
  E:      shape([EE, EE, EE, EE], T.tuck),
  F:      shape([[45, 55, 40], E, E, E], T.oppose, [0, 3, -4, -10]),
  G:      shape([E, C, C, C], T.side),
  H:      shape([E, E, C, C], T.across, [1, -1, 0, 0]),
  K:      shape([E, [40, 0, 0], C, C], T.between, [8, -12, 0, 0]),
  M:      shape([[80, 75, 40], [80, 75, 40], [80, 75, 40], C], T.under),
  N:      shape([[80, 75, 40], [80, 75, 40], C, C], T.under),
  R:      shape([E, E, C, C], T.across, [-6, 9, 0, 0]),        // dedos cruzados
  T:      shape([[75, 70, 30], C, C, C], T.between),
  X:      shape([H, C, C, C], T.across),
  bent:   shape([K, K, K, K], T.side),                         // mão em "pá"
  relaxed:shape([R, R, R, R], T.rest),
};

/** Converte uma configuração (com o polegar por nome) em ângulos numéricos para um braço concreto. */
export function resolveShape(arm, hs, thumbParams) {
  const src = typeof hs === 'string' ? (HS[hs] || HS.open) : hs;
  // mãos gravadas pela câmara (abs): ângulos absolutos → relativos à pose de descanso deste avatar
  const f = src.abs && arm.restAng ? src.f.map((x, i) => x.map((v, j) => v - arm.restAng[i][j])) : src.f.map((x) => x.slice());
  const s = src.abs && arm.restSpread ? src.s.map((v, i) => (src.s[i] === 0 ? 0 : v - arm.restSpread[i])) : src.s.slice();
  return { f, s, t: typeof src.t === 'string' ? { ...thumbParams(arm, src.t) } : { ...src.t } };
}

/** Interpola entre duas configurações já resolvidas; o mindinho segue ligeiramente atrás (movimento natural). */
export function blendShape(out, a, b, t) {
  const lag = [1, 0.93, 0.86, 0.8];
  for (let i = 0; i < 4; i++) {
    const ti = Math.min(1, t * lag[i]);
    for (let j = 0; j < 3; j++) out.f[i][j] = a.f[i][j] + (b.f[i][j] - a.f[i][j]) * ti;
    out.s[i] = a.s[i] + (b.s[i] - a.s[i]) * ti;
  }
  for (const k of ['abd', 'opp', 'cmc', 'mcp', 'ip']) out.t[k] = a.t[k] + (b.t[k] - a.t[k]) * t;
  return out;
}
