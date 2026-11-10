// Descritor de uma mão (21 pontos) independente da posição, do tamanho e da rotação.
// Os pontos são escritos no referencial da própria palma: x = para o indicador, y = para os dedos, z = normal.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

/** pts: 21 pontos [x,y,z] num referencial direito (y para cima, z para a câmara). */
export function describe(pts, flipZ = false) {
  const w = pts[0];
  const yv = sub(pts[9], w); const scale = Math.hypot(...yv) || 1;
  const y = norm(yv);
  let x = sub(pts[5], pts[17]); x = norm(sub(x, y.map((v) => v * dot(x, y))));
  const z = cross(x, y);
  const f = [];
  for (let i = 1; i < 21; i++) {
    const d = sub(pts[i], w);
    f.push(dot(d, x) / scale, dot(d, y) / scale, (flipZ ? -1 : 1) * dot(d, z) / scale);
  }
  return f;
}

/** Converte os pontos do MediaPipe (imagem, y para baixo) para o referencial direito. */
export function fromMediaPipe(lm, w = 640, h = 480) {
  return lm.map((p) => [p.x * w, -p.y * h, -p.z * w]);
}

/** Corpo normalizado pelo tronco: conserva movimentos da cabeça, braços, tronco e pernas sem depender da distância à câmara. */
export function poseFeatures(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;
  const point = (i) => landmarks[i];
  const hipsVisible = point(23).visibility >= 0.35 && point(24).visibility >= 0.35;
  const center = hipsVisible
    ? [(point(23).x + point(24).x) / 2, (point(23).y + point(24).y) / 2, (point(23).z + point(24).z) / 2]
    : [(point(11).x + point(12).x) / 2, (point(11).y + point(12).y) / 2, (point(11).z + point(12).z) / 2];
  const shoulderWidth = Math.hypot(point(11).x - point(12).x, point(11).y - point(12).y, point(11).z - point(12).z) || 0.1;
  const result = [];
  for (const p of landmarks) {
    const visibility = Math.max(0, Math.min(1, p.visibility ?? p.presence ?? 0));
    result.push(
      Math.round((p.x - center[0]) / shoulderWidth * 1000) / 1000,
      Math.round((center[1] - p.y) / shoulderWidth * 1000) / 1000,
      Math.round((p.z - center[2]) / shoulderWidth * 1000) / 1000,
      Math.round(visibility * 100) / 100,
    );
  }
  return result;
}

export function poseHandsRaised(landmarks) {
  if (!landmarks || landmarks.length < 33) return false;
  const hipsVisible = landmarks[23].visibility > 0.3 && landmarks[24].visibility > 0.3;
  const waist = hipsVisible ? (landmarks[23].y + landmarks[24].y) / 2 : landmarks[11].y;
  return [15, 16].some((i) => landmarks[i].visibility > 0.5 && landmarks[i].y < waist + 0.06);
}

export function poseMotion(a, b) {
  if (!a || !b || a.length !== 33 * 4 || b.length !== 33 * 4) return null;
  const points = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const moved = points.filter((i) => a[i * 4 + 3] >= 0.35 && b[i * 4 + 3] >= 0.35);
  if (!moved.length) return null;
  return moved.reduce((sum, i) => {
    const o = i * 4;
    return sum + Math.hypot(a[o] - b[o], a[o + 1] - b[o + 1], a[o + 2] - b[o + 2]);
  }, 0) / moved.length;
}

function distance(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); }

/** k vizinhos mais próximos com voto. Devolve { label, d } ou null. */
export function knn(f, samples, k = 5, maxD = 1.25) {
  if (!samples.length) return null;
  const best = [];
  for (const s of samples) {
    const d = distance(f, s.f);
    if (best.length < k || d < best[best.length - 1].d) { best.push({ d, l: s.label }); best.sort((a, b) => a.d - b.d); if (best.length > k) best.pop(); }
  }
  const votes = {}; for (const b of best) votes[b.l] = (votes[b.l] || 0) + 1 / (0.15 + b.d);
  const [label] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  const d = best.find((b) => b.l === label).d;
  return d < maxD ? { label, d } : null;
}
