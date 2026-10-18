// Medição de uma mão a partir de 21 pontos 3D (ordem do MediaPipe), igual para a câmara e para o avatar:
// ângulos de cada articulação dos dedos, abertura lateral e posição da ponta do polegar.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180 / Math.PI;
const FINGERS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

/** h: 21 pontos [x,y,z] nos eixos do avatar · side: -1 mão direita, 1 esquerda. */
export function measureHand(h, side) {
  const w = h[0], F = norm(sub(h[9], w));
  let S = sub(h[5], h[17]); S = norm(sub(S, mul(F, dot(S, F))));
  const N = mul(norm(cross(S, F)), side < 0 ? 1 : -1); // normal da palma (como rig.js · handFrame)
  const f = FINGERS.map(([m, p, d, t]) => [angle(sub(h[m], w), sub(h[p], h[m])), angle(sub(h[p], h[m]), sub(h[d], h[p])), angle(sub(h[d], h[p]), sub(h[t], h[d]))]);
  const s = FINGERS.map(([m, p]) => { const d = sub(h[p], h[m]), q = sub(d, mul(N, dot(d, N))); return Math.atan2(dot(q, S), dot(q, F)) * 180 / Math.PI; });
  let Np = N; if (dot(sub(h[2], w), Np) < 0) Np = mul(Np, -1);
  const P = len(sub(h[9], w)), tip = sub(h[4], w);
  return { F, S, N, f, s, thumb: [dot(tip, S) / P, dot(tip, F) / P, dot(tip, Np) / P] };
}
