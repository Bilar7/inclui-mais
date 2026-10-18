// Alfabeto manual (datilologia). Formas de mão do alfabeto americano (ASL), de uma só mão.
// J e Z têm movimento. Para outras línguas, o alfabeto oficial é gravado com intérpretes certificados.
const POS = [-0.15, 1.36, 0.32];
const add = (p, d) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const one = (hs, f = 'up', palm = 'fwd', p = POS) => ({ p, f, palm, hs });

const STATIC = {
  a: one('A'), b: one('flat'), c: one('C', 'up', 'in'), d: one('D'), e: one('E'), f: one('F'),
  g: one('G', 'in', 'back'), h: one('H', 'in', 'back'), i: one('pinky'), k: one('K'), l: one('L'),
  m: one('M'), n: one('N'), o: one('O', 'up', 'in'), p: one('K', 'down+fwd', 'in'), q: one('G', 'down', 'in'),
  r: one('R'), s: one('fist'), t: one('T'), u: one('U'), v: one('V'), w: one('W'), x: one('X'), y: one('Y'),
};
/** Fotogramas para uma letra (com o movimento de J e Z). */
export function letterFrames(ch, t = 0.42) {
  const L = ch.toUpperCase();
  if (ch === 'j') return [
    { R: one('pinky'), L: null, t: 0.2, letter: L },
    { R: one('pinky', 'up+in', 'back', add(POS, [0.02, -0.06, 0])), L: null, t: 0.18, letter: L },
    { R: one('pinky', 'in', 'back', add(POS, [0.05, -0.07, 0])), L: null, t: 0.2, letter: L },
  ];
  if (ch === 'z') return [
    { R: one('point', 'up', 'fwd', add(POS, [-0.04, 0.04, 0])), L: null, t: 0.18, letter: L },
    { R: one('point', 'up', 'fwd', add(POS, [0.04, 0.04, 0])), L: null, t: 0.16, letter: L },
    { R: one('point', 'up', 'fwd', add(POS, [-0.04, -0.03, 0])), L: null, t: 0.16, letter: L },
    { R: one('point', 'up', 'fwd', add(POS, [0.04, -0.03, 0])), L: null, t: 0.16, letter: L },
  ];
  const s = STATIC[ch];
  return s ? [{ R: s, L: null, t, letter: L }] : [];
}
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const LETTER_SPEC = STATIC;
