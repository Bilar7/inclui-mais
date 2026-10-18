// Vocabulário de sinais (demonstração), com palavras em português, inglês e espanhol.
// Cada sinal é uma sequência de fotogramas: posição do pulso, direção dos dedos, palma e configuração de mão.
// Posições em metros num corpo de referência (x negativo = lado direito do intérprete).

export const P = {
  RAISE: [-0.3, 1.6, 0.16], CHIN: [-0.03, 1.47, 0.2], MOUTH: [-0.03, 1.5, 0.22], FORE: [-0.04, 1.63, 0.24],
  EYE: [-0.05, 1.6, 0.24], TEMPLE: [-0.17, 1.62, 0.12], EAR: [-0.19, 1.58, 0.06], CHEST: [-0.05, 1.27, 0.22],
  HEART: [0.04, 1.28, 0.21], BELLY: [-0.03, 1.03, 0.22], N: [-0.13, 1.22, 0.34], NH: [-0.14, 1.36, 0.36],
  NL: [-0.12, 1.12, 0.32], SPELL: [-0.15, 1.36, 0.32], SHL: [0.17, 1.38, 0.12], CHEEK: [-0.1, 1.55, 0.2],
};
const m = (p) => [-p[0], p[1], p[2]];
const add = (p, d) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const r = (p, f, palm, hs) => ({ p, f, palm, hs });
const fr = (R, L = null, t = 0.42) => ({ R, L, t });
const both = (p, f, palm, hs) => [r(p, f, palm, hs), r(m(p), f, palm, hs)];
const fr2 = ([R, L], t) => fr(R, L, t);
// repete um toque: alterna entre a posição e um pequeno deslocamento
const taps = (spec, n = 2, d = [0, -0.03, 0.02], L = null, t = 0.18) => {
  const out = [fr(spec, L, 0.32)];
  for (let i = 0; i < n; i++) { out.push(fr({ ...spec, p: add(spec.p, d) }, L, t)); out.push(fr(spec, L, t)); }
  return out;
};
const circle = (spec, rad = 0.03, L = null) => [0, 1, 2, 3, 4].map((i) => fr({ ...spec, p: add(spec.p, [Math.cos(i * 1.57) * rad, Math.sin(i * 1.57) * rad, 0]) }, L, i ? 0.16 : 0.3));
const S = (words, frames, meta = {}) => ({ words, frames, ...meta });

export const SIGNS = {
  /* ----- cumprimentos e básico ----- */
  ola: S({ pt: ['olá', 'oi', 'ola'], en: ['hello', 'hi'], es: ['hola'] },
    [fr(r(P.RAISE, 'up', 'fwd', 'open'), null, 0.4), fr(r(add(P.RAISE, [-0.07, 0, 0]), 'up+out', 'fwd', 'open'), null, 0.22), fr(r(add(P.RAISE, [0.03, 0, 0]), 'up+in', 'fwd', 'open'), null, 0.22), fr(r(add(P.RAISE, [-0.07, 0, 0]), 'up+out', 'fwd', 'open'), null, 0.22)], { expr: 'smile', cat: 'Cumprimentos' }),
  adeus: S({ pt: ['adeus', 'tchau', 'xau'], en: ['bye', 'goodbye'], es: ['adiós', 'chao'] },
    [fr(r(P.RAISE, 'up', 'fwd', 'open'), null, 0.3), fr(r(P.RAISE, 'fwd+up', 'down', 'bent'), null, 0.18), fr(r(P.RAISE, 'up', 'fwd', 'open'), null, 0.18), fr(r(P.RAISE, 'fwd+up', 'down', 'bent'), null, 0.18)], { expr: 'smile', cat: 'Cumprimentos' }),
  obrigado: S({ pt: ['obrigado', 'obrigada', 'agradeço'], en: ['thanks', 'thank'], es: ['gracias'] },
    [fr(r(P.CHIN, 'up', 'back', 'flat'), null, 0.4), fr(r([-0.1, 1.3, 0.44], 'up+fwd', 'up', 'flat'), null, 0.5)], { expr: 'smile', head: 'nod', cat: 'Cumprimentos' }),
  porfavor: S({ pt: ['por favor', 'favor'], en: ['please'], es: ['por favor'] }, circle(r(P.CHEST, 'in', 'back', 'flat'), 0.035), { expr: 'smile', cat: 'Cumprimentos' }),
  desculpa: S({ pt: ['desculpa', 'desculpe', 'perdão'], en: ['sorry'], es: ['perdón', 'lo siento'] }, circle(r(P.CHEST, 'in', 'back', 'fist'), 0.035), { expr: 'sad', cat: 'Cumprimentos' }),
  sim: S({ pt: ['sim'], en: ['yes'], es: ['sí', 'si'] },
    [fr(r(P.NH, 'up', 'fwd', 'fist'), null, 0.3), fr(r(add(P.NH, [0, -0.07, 0.03]), 'fwd', 'down', 'fist'), null, 0.22), fr(r(P.NH, 'up', 'fwd', 'fist'), null, 0.22), fr(r(add(P.NH, [0, -0.07, 0.03]), 'fwd', 'down', 'fist'), null, 0.22)], { head: 'nod', cat: 'Cumprimentos' }),
  nao: S({ pt: ['não', 'nao'], en: ['no', 'not'], es: ['no'] },
    [fr(r(P.NH, 'up', 'fwd', 'point'), null, 0.3), fr(r(add(P.NH, [-0.06, 0, 0]), 'up+out', 'fwd', 'point'), null, 0.18), fr(r(add(P.NH, [0.05, 0, 0]), 'up+in', 'fwd', 'point'), null, 0.18), fr(r(add(P.NH, [-0.06, 0, 0]), 'up+out', 'fwd', 'point'), null, 0.18)], { expr: 'neg', head: 'shake', cat: 'Cumprimentos' }),
  bem: S({ pt: ['bem', 'bom', 'boa', 'tudo bem', 'está bem', 'estou bem', 'ok'], en: ['good', 'fine', 'well', 'ok'], es: ['bien', 'bueno', 'buena'] },
    [fr(r(P.NH, 'up', 'in', 'thumb'), null, 0.3), fr(r(add(P.NH, [0, 0.02, 0.07]), 'up', 'in', 'thumb'), null, 0.35)], { expr: 'smile', cat: 'Cumprimentos' }),
  mal: S({ pt: ['mal', 'estou mal', 'ruim'], en: ['bad', 'sick'], es: ['mal'] },
    [fr(r(P.NH, 'down', 'in', 'thumb'), null, 0.3), fr(r(add(P.NH, [0, -0.06, 0.03]), 'down', 'in', 'thumb'), null, 0.35)], { expr: 'sad', cat: 'Cumprimentos' }),
  bemvindo: S({ pt: ['bem-vindo', 'bem vindo', 'bem-vinda'], en: ['welcome'], es: ['bienvenido', 'bienvenida'] },
    [fr(r([-0.25, 1.2, 0.35], 'fwd+out', 'up', 'open'), null, 0.3), fr(r([-0.05, 1.22, 0.22], 'fwd+in', 'up', 'open'), null, 0.45)], { expr: 'smile', cat: 'Cumprimentos' }),
  nome: S({ pt: ['nome', 'chamo'], en: ['name'], es: ['nombre', 'llamo'] },
    taps(r([-0.02, 1.27, 0.33], 'in', 'back', 'H'), 2, [0, -0.02, 0], r(m([-0.06, 1.24, 0.33]), 'in', 'back', 'H')), { cat: 'Cumprimentos' }),

  /* ----- pessoas ----- */
  eu: S({ pt: ['eu', 'sou', 'meu', 'minha', 'me'], en: ['i', 'me', 'my'], es: ['yo', 'mi'] }, [fr(r([-0.06, 1.2, 0.36], 'back', 'in', 'point'), null, 0.5)], { cat: 'Pessoas' }),
  voce: S({ pt: ['você', 'voce', 'tu', 'seu', 'sua', 'senhor', 'senhora'], en: ['you', 'your'], es: ['tú', 'tu', 'usted'] },
    [fr(r([-0.1, 1.28, 0.36], 'fwd', 'down', 'point'), null, 0.25), fr(r([-0.06, 1.3, 0.47], 'fwd', 'down', 'point'), null, 0.4)], { cat: 'Pessoas' }),
  ele: S({ pt: ['ele', 'ela', 'dele', 'dela'], en: ['he', 'she', 'him', 'her'], es: ['él', 'ella'] }, [fr(r([-0.24, 1.26, 0.38], 'fwd+out', 'down', 'point'), null, 0.45)], { cat: 'Pessoas' }),
  nos: S({ pt: ['nós', 'nos', 'vamos', 'nosso'], en: ['we', 'us', 'our'], es: ['nosotros', 'vamos'] },
    [fr(r([-0.1, 1.3, 0.25], 'back', 'in', 'point'), null, 0.3), fr(r([0.08, 1.3, 0.25], 'back', 'in', 'point'), null, 0.4)], { cat: 'Pessoas' }),
  amigo: S({ pt: ['amigo', 'amiga', 'amigos'], en: ['friend'], es: ['amigo', 'amiga'] },
    [fr(r([-0.05, 1.28, 0.33], 'in', 'down', 'X'), r(m([-0.05, 1.24, 0.33]), 'in', 'up', 'X'), 0.35), fr(r([-0.05, 1.24, 0.33], 'in', 'up', 'X'), r(m([-0.05, 1.28, 0.33]), 'in', 'down', 'X'), 0.35)], { expr: 'smile', cat: 'Pessoas' }),
  familia: S({ pt: ['família', 'familia'], en: ['family'], es: ['familia'] },
    [fr2(both([-0.06, 1.28, 0.36], 'up', 'fwd', 'F'), 0.3), fr2(both([-0.16, 1.24, 0.28], 'up', 'fwd', 'F'), 0.25), fr2(both([-0.06, 1.2, 0.2], 'up', 'back', 'F'), 0.3)], { cat: 'Pessoas' }),
  mae: S({ pt: ['mãe', 'mae', 'mamã'], en: ['mother', 'mom'], es: ['madre', 'mamá'] }, taps(r([-0.06, 1.44, 0.24], 'up', 'in', 'open'), 2, [0, 0, 0.03]), { cat: 'Pessoas' }),
  pai: S({ pt: ['pai', 'papá'], en: ['father', 'dad'], es: ['padre', 'papá'] }, taps(r([-0.06, 1.6, 0.25], 'up', 'in', 'open'), 2, [0, 0, 0.03]), { cat: 'Pessoas' }),
  bebe: S({ pt: ['bebé', 'bebe', 'criança', 'filho', 'filha'], en: ['baby', 'child', 'son', 'daughter'], es: ['bebé', 'niño', 'hijo', 'hija'] },
    [fr(r([-0.12, 1.12, 0.3], 'in', 'up', 'flat'), r(m([-0.02, 1.14, 0.28]), 'in', 'up', 'flat'), 0.35), fr(r([-0.12, 1.16, 0.3], 'in+up', 'up', 'flat'), r(m([-0.02, 1.12, 0.28]), 'in+down', 'up', 'flat'), 0.3), fr(r([-0.12, 1.12, 0.3], 'in', 'up', 'flat'), r(m([-0.02, 1.16, 0.28]), 'in+up', 'up', 'flat'), 0.3)], { expr: 'smile', cat: 'Pessoas' }),
  surdo: S({ pt: ['surdo', 'surda', 'surdos'], en: ['deaf'], es: ['sordo', 'sorda'] }, [fr(r(P.EAR, 'up+in', 'back', 'point'), null, 0.3), fr(r(P.MOUTH, 'up+in', 'back', 'point'), null, 0.3)], { cat: 'Pessoas' }),

  /* ----- perguntas ----- */
  onde: S({ pt: ['onde', 'aonde'], en: ['where'], es: ['dónde', 'donde'] }, [fr(r(P.NH, 'up', 'fwd', 'point'), null, 0.25), fr(r(add(P.NH, [-0.04, 0, 0]), 'up', 'fwd', 'point'), null, 0.15), fr(r(add(P.NH, [0.03, 0, 0]), 'up', 'fwd', 'point'), null, 0.15)], { wh: 1, cat: 'Perguntas' }),
  oque: S({ pt: ['o que', 'que', 'qual', 'quê'], en: ['what', 'which'], es: ['qué', 'que', 'cuál'] },
    [fr2(both(P.N, 'fwd', 'up', 'open'), 0.3), fr2(both(add(P.N, [-0.03, 0, 0]), 'fwd+out', 'up', 'open'), 0.25)], { wh: 1, cat: 'Perguntas' }),
  quando: S({ pt: ['quando'], en: ['when'], es: ['cuándo', 'cuando'] }, [fr(r([-0.04, 1.26, 0.35], 'down', 'down', 'point'), r(m([-0.04, 1.22, 0.33]), 'up', 'in', 'point'), 0.3), fr(r([-0.06, 1.28, 0.37], 'in', 'down', 'point'), r(m([-0.04, 1.22, 0.33]), 'up', 'in', 'point'), 0.3)], { wh: 1, cat: 'Perguntas' }),
  como: S({ pt: ['como'], en: ['how'], es: ['cómo', 'como'] }, [fr2(both(P.N, 'fwd', 'down', 'claw'), 0.3), fr2(both(P.N, 'fwd', 'up', 'claw'), 0.3)], { wh: 1, cat: 'Perguntas' }),
  quem: S({ pt: ['quem'], en: ['who'], es: ['quién', 'quien'] }, circle(r(add(P.CHIN, [0, 0.02, 0.04]), 'up', 'in', 'point'), 0.015), { wh: 1, cat: 'Perguntas' }),
  porque: S({ pt: ['porquê', 'porque', 'por que'], en: ['why'], es: ['por qué', 'porque'] }, [fr(r(P.FORE, 'up+in', 'back', 'flat'), null, 0.3), fr(r(add(P.FORE, [-0.05, -0.05, 0.1]), 'up', 'back', 'Y'), null, 0.35)], { wh: 1, cat: 'Perguntas' }),
  quanto: S({ pt: ['quanto', 'quantos', 'quanta', 'quantas', 'custa'], en: ['how much', 'how many', 'cost'], es: ['cuánto', 'cuantos'] },
    [fr(r(P.N, 'up', 'back', 'fist'), null, 0.3), fr(r(add(P.N, [0, 0.06, 0]), 'up', 'back', 'open'), null, 0.3)], { wh: 1, cat: 'Perguntas' }),

  /* ----- hospital ----- */
  medico: S({ pt: ['médico', 'médica', 'medico', 'medica', 'doutor', 'doutora'], en: ['doctor'], es: ['médico', 'doctor', 'doctora'] },
    taps(r([-0.03, 1.21, 0.32], 'in+down', 'down', 'V'), 2, [0, -0.03, 0], r(m([-0.1, 1.18, 0.3]), 'in', 'up', 'open')), { cat: 'Hospital' }),
  enfermeiro: S({ pt: ['enfermeiro', 'enfermeira', 'enfermagem'], en: ['nurse'], es: ['enfermero', 'enfermera'] },
    taps(r([-0.03, 1.21, 0.32], 'in+down', 'down', 'U'), 2, [0, -0.03, 0], r(m([-0.1, 1.18, 0.3]), 'in', 'up', 'open')), { cat: 'Hospital' }),
  hospital: S({ pt: ['hospital', 'clínica', 'centro de saúde'], en: ['hospital', 'clinic'], es: ['hospital', 'clínica'] },
    [fr(r([0.14, 1.4, 0.18], 'up', 'back', 'U'), null, 0.35), fr(r([0.14, 1.3, 0.18], 'up', 'back', 'U'), null, 0.25), fr(r([0.1, 1.36, 0.2], 'in', 'back', 'U'), null, 0.2), fr(r([0.19, 1.36, 0.18], 'in', 'back', 'U'), null, 0.25)], { cat: 'Hospital' }),
  dor: S({ pt: ['dor', 'dói', 'doi', 'dores', 'doer', 'doendo', 'magoado'], en: ['pain', 'hurt', 'hurts', 'ache'], es: ['dolor', 'duele'] },
    [fr2(both([-0.13, 1.27, 0.32], 'in', 'down', 'point'), 0.35), fr2(both([-0.06, 1.27, 0.32], 'in', 'back', 'point'), 0.3), fr2(both([-0.13, 1.27, 0.32], 'in', 'down', 'point'), 0.3)], { expr: 'pain', cat: 'Hospital' }),
  cabeca: S({ pt: ['cabeça', 'cabeca'], en: ['head', 'headache'], es: ['cabeza'] }, taps(r(P.TEMPLE, 'in+up', 'back', 'point'), 1, [0, 0.01, 0.02]), { cat: 'Hospital' }),
  barriga: S({ pt: ['barriga', 'estômago', 'estomago', 'abdómen'], en: ['stomach', 'belly'], es: ['estómago', 'barriga'] }, circle(r(P.BELLY, 'in', 'back', 'flat'), 0.03), { cat: 'Hospital' }),
  febre: S({ pt: ['febre', 'quente'], en: ['fever'], es: ['fiebre'] }, [fr(r(P.FORE, 'in', 'back', 'open'), null, 0.45), fr(r(add(P.FORE, [-0.03, 0, 0.04]), 'in', 'back', 'open'), null, 0.3)], { expr: 'sad', cat: 'Hospital' }),
  remedio: S({ pt: ['remédio', 'remedio', 'medicamento', 'comprimido', 'comprimidos'], en: ['medicine', 'pill', 'pills'], es: ['medicina', 'medicamento', 'pastilla'] },
    circle(r([-0.02, 1.24, 0.33], 'down', 'down', 'point'), 0.02, r(m([-0.02, 1.18, 0.33]), 'fwd+in', 'up', 'flat')), { cat: 'Hospital' }),
  injecao: S({ pt: ['injeção', 'injecao', 'vacina', 'pica'], en: ['injection', 'shot', 'vaccine'], es: ['inyección', 'vacuna'] },
    [fr(r(m(P.SHL).map((v, i) => (i === 0 ? -0.12 : v)), 'in', 'back', 'L'), null, 0.3), fr(r([0.1, 1.3, 0.2], 'in', 'back', 'L'), null, 0.25), fr(r([0.1, 1.3, 0.2], 'in', 'back', 'fist'), null, 0.3)], { expr: 'pain', cat: 'Hospital' }),
  coracao: S({ pt: ['coração', 'coracao'], en: ['heart'], es: ['corazón'] }, taps(r(P.HEART, 'in', 'back', 'K'), 2, [0, 0, 0.03]), { cat: 'Hospital' }),
  respirar: S({ pt: ['respirar', 'respiração', 'ar'], en: ['breathe', 'breath'], es: ['respirar'] },
    [fr2(both([-0.06, 1.26, 0.26], 'in', 'back', 'open'), 0.35), fr2(both([-0.06, 1.3, 0.36], 'in', 'back', 'open'), 0.4), fr2(both([-0.06, 1.26, 0.26], 'in', 'back', 'open'), 0.4)], { cat: 'Hospital' }),
  tosse: S({ pt: ['tosse', 'tossir'], en: ['cough'], es: ['tos', 'toser'] }, taps(r([-0.04, 1.3, 0.24], 'in', 'back', 'fist'), 3, [0, 0, 0.03]), { expr: 'pain', cat: 'Hospital' }),
  tontura: S({ pt: ['tontura', 'tonturas', 'tonto', 'tonta'], en: ['dizzy'], es: ['mareo', 'mareado'] }, circle(r(add(P.FORE, [-0.02, 0, 0.06]), 'up', 'back', 'claw'), 0.04), { expr: 'sad', cat: 'Hospital' }),
  vomito: S({ pt: ['vómito', 'vomito', 'vomitar', 'enjoo'], en: ['vomit', 'nausea'], es: ['vómito', 'vomitar'] }, [fr(r(P.MOUTH, 'up+fwd', 'down', 'open'), null, 0.3), fr(r([-0.08, 1.35, 0.5], 'fwd+down', 'down', 'open'), null, 0.4)], { expr: 'pain', cat: 'Hospital' }),
  gravida: S({ pt: ['grávida', 'gravida', 'gravidez'], en: ['pregnant'], es: ['embarazada'] }, [fr(r([-0.04, 1.12, 0.22], 'in', 'back', 'flat'), null, 0.3), fr(r([-0.04, 1.05, 0.36], 'in+down', 'back', 'flat'), null, 0.45)], { cat: 'Hospital' }),
  sangue: S({ pt: ['sangue', 'sangrar'], en: ['blood', 'bleeding'], es: ['sangre'] }, [fr(r([-0.04, 1.48, 0.24], 'in', 'back', 'open'), r(m(P.N), 'in', 'back', 'flat'), 0.3), fr(r([-0.06, 1.3, 0.3], 'down', 'back', 'open'), r(m(P.N), 'in', 'back', 'flat'), 0.45)], { cat: 'Hospital' }),
  urgente: S({ pt: ['urgente', 'urgência', 'emergência', 'emergencia', 'socorro'], en: ['emergency', 'urgent', 'help now'], es: ['urgente', 'emergencia', 'socorro'] },
    [fr(r(P.NH, 'up', 'fwd', 'E'), null, 0.2), fr(r(add(P.NH, [-0.04, 0, 0]), 'up', 'fwd', 'E'), null, 0.12), fr(r(add(P.NH, [0.03, 0, 0]), 'up', 'fwd', 'E'), null, 0.12), fr(r(add(P.NH, [-0.04, 0, 0]), 'up', 'fwd', 'E'), null, 0.12)], { expr: 'surprise', cat: 'Hospital' }),
  examinar: S({ pt: ['examinar', 'exame', 'consulta', 'observar'], en: ['examine', 'exam', 'check'], es: ['examinar', 'examen', 'consulta'] },
    [fr(r(P.EYE, 'up', 'back', 'V'), null, 0.25), fr(r([-0.06, 1.3, 0.4], 'fwd+down', 'down', 'V'), null, 0.25), fr(r([0, 1.27, 0.4], 'fwd+down', 'down', 'V'), null, 0.25), fr(r([-0.12, 1.24, 0.4], 'fwd+down', 'down', 'V'), null, 0.25)], { expr: 'think', cat: 'Hospital' }),
  dormir: S({ pt: ['dormir', 'sono', 'deitar'], en: ['sleep', 'tired'], es: ['dormir', 'sueño'] }, [fr(r([-0.07, 1.62, 0.24], 'up', 'back', 'open'), null, 0.3), fr(r([-0.07, 1.52, 0.24], 'up', 'back', 'O'), null, 0.45)], { expr: 'sad', cat: 'Hospital' }),
  frio: S({ pt: ['frio', 'frios'], en: ['cold'], es: ['frío'] }, [fr2(both([-0.1, 1.28, 0.28], 'up', 'in', 'fist'), 0.2), fr2(both([-0.08, 1.28, 0.28], 'up', 'in', 'fist'), 0.12), fr2(both([-0.1, 1.28, 0.28], 'up', 'in', 'fist'), 0.12), fr2(both([-0.08, 1.28, 0.28], 'up', 'in', 'fist'), 0.12)], { expr: 'pain', cat: 'Hospital' }),
  melhor: S({ pt: ['melhor', 'melhorar'], en: ['better'], es: ['mejor'] }, [fr(r(P.CHIN, 'up', 'back', 'flat'), null, 0.3), fr(r(add(P.NH, [0, 0.08, 0]), 'up', 'in', 'thumb'), null, 0.4)], { expr: 'smile', cat: 'Hospital' }),
  pior: S({ pt: ['pior', 'piorar'], en: ['worse'], es: ['peor'] }, [fr(r(P.NH, 'down', 'in', 'thumb'), null, 0.3), fr(r(add(P.NH, [0, -0.12, 0]), 'down', 'in', 'thumb'), null, 0.4)], { expr: 'sad', cat: 'Hospital' }),
  sentar: S({ pt: ['sentar', 'sente', 'sente-se', 'senta'], en: ['sit'], es: ['sentar', 'siéntese'] }, [fr(r([-0.04, 1.28, 0.34], 'in', 'down', 'U'), r(m([-0.06, 1.22, 0.33]), 'in', 'down', 'U'), 0.3), fr(r([-0.04, 1.24, 0.34], 'in', 'down', 'U'), r(m([-0.06, 1.22, 0.33]), 'in', 'down', 'U'), 0.3)], { cat: 'Hospital' }),
  agua: S({ pt: ['água', 'agua'], en: ['water'], es: ['agua'] }, taps(r(P.CHIN, 'up', 'in', 'W'), 2), { cat: 'Hospital' }),
  comer: S({ pt: ['comer', 'comida', 'fome'], en: ['eat', 'food', 'hungry'], es: ['comer', 'comida', 'hambre'] }, taps(r(P.MOUTH, 'up+back', 'in', 'O'), 2, [0, -0.04, 0.04]), { cat: 'Hospital' }),
  beber: S({ pt: ['beber', 'bebe', 'beba', 'tomar', 'tome'], en: ['drink', 'take'], es: ['beber', 'tomar'] }, [fr(r([-0.05, 1.42, 0.26], 'in', 'in', 'C'), null, 0.3), fr(r([-0.03, 1.47, 0.2], 'in+up', 'in', 'C'), null, 0.35)], { cat: 'Hospital' }),
  wc: S({ pt: ['casa de banho', 'banheiro', 'wc', 'sanitário'], en: ['bathroom', 'toilet', 'restroom'], es: ['baño', 'servicio'] },
    [fr(r(P.NH, 'up', 'fwd', 'T'), null, 0.2), fr(r(add(P.NH, [-0.03, 0, 0]), 'up+out', 'fwd', 'T'), null, 0.15), fr(r(add(P.NH, [0.02, 0, 0]), 'up+in', 'fwd', 'T'), null, 0.15)], { cat: 'Hospital' }),

  /* ----- escola ----- */
  escola: S({ pt: ['escola', 'aula', 'aulas', 'turma'], en: ['school', 'class'], es: ['escuela', 'clase'] },
    [fr(r([-0.03, 1.28, 0.33], 'fwd+in', 'down', 'flat'), r(m([-0.03, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.35), fr(r([-0.03, 1.23, 0.33], 'fwd+in', 'down', 'flat'), r(m([-0.03, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.18), fr(r([-0.03, 1.3, 0.33], 'fwd+in', 'down', 'flat'), r(m([-0.03, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.18), fr(r([-0.03, 1.23, 0.33], 'fwd+in', 'down', 'flat'), r(m([-0.03, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.18)], { cat: 'Escola' }),
  professor: S({ pt: ['professor', 'professora', 'docente'], en: ['teacher'], es: ['profesor', 'profesora', 'maestro'] },
    [fr2(both([-0.1, 1.5, 0.24], 'up+fwd', 'in', 'O'), 0.25), fr2(both([-0.1, 1.42, 0.38], 'up+fwd', 'in', 'O'), 0.25), fr2(both([-0.13, 1.18, 0.3], 'fwd', 'in', 'flat'), 0.3)], { cat: 'Escola' }),
  aluno: S({ pt: ['aluno', 'aluna', 'alunos', 'estudante', 'estudantes'], en: ['student', 'students', 'pupil'], es: ['alumno', 'alumna', 'estudiante'] },
    [fr(r([-0.04, 1.26, 0.34], 'down', 'down', 'claw'), r(m([-0.06, 1.22, 0.33]), 'fwd+in', 'up', 'flat'), 0.25), fr(r([-0.06, 1.55, 0.26], 'up', 'back', 'O'), r(m([-0.06, 1.22, 0.33]), 'fwd+in', 'up', 'flat'), 0.3), fr2(both([-0.13, 1.18, 0.3], 'fwd', 'in', 'flat'), 0.3)], { cat: 'Escola' }),
  livro: S({ pt: ['livro', 'livros', 'caderno'], en: ['book', 'notebook'], es: ['libro', 'cuaderno'] },
    [fr2(both([-0.02, 1.25, 0.34], 'fwd+up', 'in', 'flatT'), 0.3), fr2(both([-0.08, 1.25, 0.34], 'fwd+up', 'up+in', 'flatT'), 0.4)], { cat: 'Escola' }),
  escrever: S({ pt: ['escrever', 'escreva', 'escreve', 'escrita'], en: ['write', 'writing'], es: ['escribir', 'escriba'] },
    [fr(r([-0.04, 1.26, 0.33], 'fwd+down', 'down', 'O'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.2), fr(r([0.02, 1.25, 0.33], 'fwd+down', 'down', 'O'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.2), fr(r([-0.04, 1.24, 0.33], 'fwd+down', 'down', 'O'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.2), fr(r([0.03, 1.23, 0.33], 'fwd+down', 'down', 'O'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.2)], { cat: 'Escola' }),
  ler: S({ pt: ['ler', 'leia', 'lê', 'leitura'], en: ['read', 'reading'], es: ['leer', 'lea'] },
    [fr(r([-0.04, 1.3, 0.36], 'down', 'down', 'V'), r(m([-0.06, 1.22, 0.34]), 'up', 'back', 'flat'), 0.3), fr(r([-0.04, 1.2, 0.36], 'down', 'down', 'V'), r(m([-0.06, 1.22, 0.34]), 'up', 'back', 'flat'), 0.4)], { cat: 'Escola' }),
  aprender: S({ pt: ['aprender', 'aprende', 'aprendo'], en: ['learn', 'learning'], es: ['aprender'] },
    [fr(r([-0.04, 1.25, 0.34], 'up', 'back', 'claw'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.3), fr(r(P.FORE, 'up', 'back', 'O'), r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat'), 0.4)], { cat: 'Escola' }),
  estudar: S({ pt: ['estudar', 'estuda', 'estudo'], en: ['study'], es: ['estudiar'] },
    [fr(r([-0.04, 1.3, 0.38], 'down', 'down', 'open'), r(m([-0.06, 1.2, 0.33]), 'up', 'back', 'flat'), 0.25), fr(r([-0.04, 1.28, 0.38], 'down', 'down', 'claw'), r(m([-0.06, 1.2, 0.33]), 'up', 'back', 'flat'), 0.15), fr(r([-0.04, 1.3, 0.38], 'down', 'down', 'open'), r(m([-0.06, 1.2, 0.33]), 'up', 'back', 'flat'), 0.15), fr(r([-0.04, 1.28, 0.38], 'down', 'down', 'claw'), r(m([-0.06, 1.2, 0.33]), 'up', 'back', 'flat'), 0.15)], { cat: 'Escola' }),
  perceber: S({ pt: ['perceber', 'percebeu', 'percebi', 'entender', 'entendeu', 'compreender'], en: ['understand'], es: ['entender', 'comprender'] },
    [fr(r(add(P.FORE, [-0.04, 0, 0.04]), 'up', 'back', 'fist'), null, 0.3), fr(r(add(P.FORE, [-0.04, 0, 0.04]), 'up', 'back', 'point'), null, 0.35)], { expr: 'surprise', cat: 'Escola' }),
  pergunta: S({ pt: ['pergunta', 'perguntar', 'dúvida', 'questão'], en: ['question', 'ask'], es: ['pregunta', 'preguntar'] },
    [fr(r(P.NH, 'up', 'fwd', 'point'), null, 0.25), fr(r(add(P.NH, [0.02, -0.05, 0.04]), 'fwd', 'down', 'X'), null, 0.3), fr(r(add(P.NH, [0.02, -0.1, 0.06]), 'fwd', 'down', 'X'), null, 0.25)], { expr: 'yn', cat: 'Escola' }),
  quadro: S({ pt: ['quadro', 'lousa'], en: ['board', 'blackboard'], es: ['pizarra'] },
    [fr2(both([-0.04, 1.48, 0.4], 'up', 'fwd', 'flatT'), 0.3), fr2(both([-0.24, 1.48, 0.4], 'up', 'fwd', 'flatT'), 0.3), fr2(both([-0.24, 1.26, 0.4], 'up', 'fwd', 'flatT'), 0.3)], { cat: 'Escola' }),
  intervalo: S({ pt: ['intervalo', 'pausa', 'descanso'], en: ['break', 'rest'], es: ['recreo', 'descanso', 'pausa'] }, [fr(r([-0.06, 1.3, 0.34], 'in', 'back', 'flat'), r(m([-0.02, 1.24, 0.34]), 'up', 'in', 'flat'), 0.5)], { cat: 'Escola' }),
  trabalhos: S({ pt: ['trabalho de casa', 'tpc', 'exercício', 'exercicio'], en: ['homework', 'exercise'], es: ['tarea', 'ejercicio'] },
    taps(r([-0.02, 1.24, 0.33], 'fwd+in', 'down', 'fist'), 2, [0, 0.04, 0], r(m([-0.02, 1.18, 0.33]), 'fwd+in', 'down', 'fist')), { cat: 'Escola' }),

  /* ----- trabalho e serviços ----- */
  trabalho: S({ pt: ['trabalho', 'trabalhar', 'empresa', 'emprego'], en: ['work', 'job', 'company'], es: ['trabajo', 'trabajar', 'empresa'] },
    taps(r([-0.02, 1.24, 0.33], 'fwd+in', 'down', 'fist'), 2, [0, -0.04, 0], r(m([-0.02, 1.18, 0.33]), 'fwd+in', 'down', 'fist')), { cat: 'Trabalho' }),
  reuniao: S({ pt: ['reunião', 'reuniao', 'encontro'], en: ['meeting'], es: ['reunión'] }, [fr2(both([-0.18, 1.24, 0.34], 'up', 'in', 'open'), 0.3), fr2(both([-0.05, 1.24, 0.34], 'up', 'in', 'O'), 0.4)], { cat: 'Trabalho' }),
  dinheiro: S({ pt: ['dinheiro', 'pagar', 'pagamento', 'preço'], en: ['money', 'pay', 'price'], es: ['dinero', 'pagar', 'precio'] },
    taps(r([-0.04, 1.24, 0.34], 'fwd+in', 'up', 'O'), 2, [0, -0.03, 0], r(m([-0.06, 1.2, 0.33]), 'fwd+in', 'up', 'flat')), { cat: 'Trabalho' }),
  telefone: S({ pt: ['telefone', 'telemóvel', 'ligar', 'chamar'], en: ['phone', 'call'], es: ['teléfono', 'llamar'] }, [fr(r([-0.16, 1.55, 0.12], 'up', 'in', 'Y'), null, 0.55)], { cat: 'Trabalho' }),
  documento: S({ pt: ['documento', 'documentos', 'papel', 'formulário', 'bi'], en: ['document', 'paper', 'form', 'id'], es: ['documento', 'papel', 'formulario'] },
    [fr(r([-0.04, 1.26, 0.34], 'fwd+in', 'down', 'flat'), r(m([-0.06, 1.2, 0.34]), 'fwd+in', 'up', 'flat'), 0.3), fr(r([-0.04, 1.22, 0.36], 'fwd+in', 'down', 'flat'), r(m([-0.06, 1.2, 0.34]), 'fwd+in', 'up', 'flat'), 0.3)], { cat: 'Trabalho' }),
  ajuda: S({ pt: ['ajuda', 'ajudar', 'ajude', 'apoio'], en: ['help'], es: ['ayuda', 'ayudar'] },
    [fr(r([-0.02, 1.18, 0.32], 'up', 'in', 'thumb'), r(m([-0.02, 1.13, 0.32]), 'fwd', 'up', 'flat'), 0.4), fr(r([-0.02, 1.3, 0.36], 'up', 'in', 'thumb'), r(m([-0.02, 1.25, 0.36]), 'fwd', 'up', 'flat'), 0.45)], { cat: 'Trabalho' }),
  esperar: S({ pt: ['esperar', 'espere', 'espera', 'aguarde', 'aguardar'], en: ['wait'], es: ['esperar', 'espere'] },
    [fr(r(P.N, 'fwd', 'up', 'open'), r(m(add(P.N, [0.05, -0.03, -0.06])), 'fwd', 'up', 'open'), 0.35), fr(r(P.N, 'fwd', 'up', 'claw'), r(m(add(P.N, [0.05, -0.03, -0.06])), 'fwd', 'up', 'claw'), 0.2), fr(r(P.N, 'fwd', 'up', 'open'), r(m(add(P.N, [0.05, -0.03, -0.06])), 'fwd', 'up', 'open'), 0.2)], { cat: 'Trabalho' }),
  precisar: S({ pt: ['precisar', 'precisa', 'preciso', 'necessito'], en: ['need'], es: ['necesitar', 'necesito'] }, taps(r(P.NH, 'fwd', 'down', 'X'), 2, [0, -0.06, 0]), { cat: 'Trabalho' }),
  ter: S({ pt: ['ter', 'tem', 'tenho', 'tens', 'temos'], en: ['have', 'has'], es: ['tener', 'tengo', 'tiene'] }, [fr2(both([-0.06, 1.28, 0.3], 'in+up', 'back', 'open'), 0.3), fr2(both([-0.04, 1.26, 0.24], 'in+up', 'back', 'claw'), 0.3)], { cat: 'Trabalho' }),
  casa: S({ pt: ['casa', 'morar', 'mora', 'moro', 'vive'], en: ['home', 'house', 'live'], es: ['casa', 'vivir', 'vive'] }, [fr2(both([-0.07, 1.4, 0.32], 'up+in', 'in+down', 'flat'), 0.4), fr2(both([-0.15, 1.26, 0.32], 'up', 'in', 'flat'), 0.4)], { cat: 'Trabalho' }),
  aqui: S({ pt: ['aqui', 'cá'], en: ['here'], es: ['aquí', 'acá'] }, [fr2(both(P.NL, 'fwd', 'up', 'flat'), 0.3), fr2(both(add(P.NL, [0, -0.04, 0]), 'fwd', 'up', 'flat'), 0.3)], { cat: 'Trabalho' }),
  isto: S({ pt: ['isto', 'este', 'esta', 'esse', 'essa', 'isso'], en: ['this', 'that'], es: ['esto', 'este', 'esta', 'eso'] }, [fr(r([-0.1, 1.15, 0.4], 'fwd+down', 'down', 'point'), null, 0.45)], { cat: 'Trabalho' }),
  ver: S({ pt: ['ver', 'olhar', 'veja', 'olhe'], en: ['see', 'look'], es: ['ver', 'mirar'] }, [fr(r(P.EYE, 'up', 'back', 'V'), null, 0.3), fr(r([-0.08, 1.48, 0.44], 'fwd', 'down', 'V'), null, 0.4)], { cat: 'Trabalho' }),
  ouvir: S({ pt: ['ouvir', 'ouve', 'escutar'], en: ['hear', 'listen'], es: ['oír', 'escuchar'] }, [fr(r(P.EAR, 'up+in', 'back', 'point'), null, 0.45)], { cat: 'Trabalho' }),
  falar: S({ pt: ['falar', 'fala', 'dizer', 'diga'], en: ['speak', 'talk', 'say'], es: ['hablar', 'decir'] }, [fr(r(P.MOUTH, 'up+in', 'back', 'point'), null, 0.25), fr(r([-0.07, 1.46, 0.42], 'fwd+in', 'down', 'point'), null, 0.35)], { cat: 'Trabalho' }),

  /* ----- tempo ----- */
  hoje: S({ pt: ['hoje', 'agora'], en: ['today', 'now'], es: ['hoy', 'ahora'] }, [fr2(both([-0.14, 1.26, 0.34], 'fwd', 'up', 'bent'), 0.3), fr2(both([-0.14, 1.18, 0.34], 'fwd', 'up', 'bent'), 0.3)], { cat: 'Tempo' }),
  amanha: S({ pt: ['amanhã', 'amanha'], en: ['tomorrow'], es: ['mañana'] }, [fr(r([-0.15, 1.55, 0.15], 'up', 'fwd', 'thumb'), null, 0.25), fr(r([-0.15, 1.55, 0.32], 'up+fwd', 'in', 'thumb'), null, 0.35)], { cat: 'Tempo' }),
  ontem: S({ pt: ['ontem'], en: ['yesterday'], es: ['ayer'] }, [fr(r([-0.15, 1.52, 0.22], 'up', 'fwd', 'A'), null, 0.25), fr(r([-0.18, 1.56, 0.04], 'up+back', 'in', 'A'), null, 0.35)], { cat: 'Tempo' }),
  dia: S({ pt: ['dia', 'dias'], en: ['day'], es: ['día'] }, [fr(r([-0.15, 1.2, 0.32], 'up', 'in', 'point'), r(m([0, 1.16, 0.3]), 'in', 'down', 'flat'), 0.3), fr(r([-0.03, 1.42, 0.32], 'up+in', 'in', 'point'), r(m([0, 1.16, 0.3]), 'in', 'down', 'flat'), 0.4)], { cat: 'Tempo' }),
  noite: S({ pt: ['noite', 'tarde'], en: ['night', 'evening'], es: ['noche', 'tarde'] }, [fr(r([-0.1, 1.3, 0.34], 'fwd+in', 'down', 'bent'), r(m([-0.02, 1.2, 0.32]), 'in', 'down', 'flat'), 0.3), fr(r([-0.02, 1.24, 0.34], 'down+in', 'down', 'bent'), r(m([-0.02, 1.2, 0.32]), 'in', 'down', 'flat'), 0.35)], { cat: 'Tempo' }),
  tempo: S({ pt: ['tempo', 'hora', 'horas', 'minutos'], en: ['time', 'hour', 'minutes'], es: ['tiempo', 'hora', 'horas'] }, taps(r([-0.02, 1.22, 0.32], 'down+in', 'down', 'point'), 2, [0, -0.03, 0], r(m([-0.08, 1.17, 0.3]), 'in', 'down', 'fist')), { cat: 'Tempo' }),
  ate: S({ pt: ['até', 'ate', 'até logo'], en: ['until', 'see you'], es: ['hasta'] }, [fr(r(P.NH, 'up', 'fwd', 'open'), null, 0.25), fr(r(P.NH, 'fwd+up', 'down', 'bent'), null, 0.15), fr(r(P.NH, 'up', 'fwd', 'open'), null, 0.15)], { expr: 'smile', cat: 'Tempo' }),

  /* ----- sentimentos ----- */
  amor: S({ pt: ['amor', 'amo', 'gosto', 'gostar'], en: ['love', 'like'], es: ['amor', 'amo', 'gusta'] }, [fr2(both([0.05, 1.3, 0.2], 'up+in', 'back', 'fist'), 0.7)], { expr: 'smile', cat: 'Sentimentos' }),
  feliz: S({ pt: ['feliz', 'alegre', 'contente'], en: ['happy', 'glad'], es: ['feliz', 'contento'] }, circle(r(P.CHEST, 'in', 'back', 'flat'), 0.04), { expr: 'smile', cat: 'Sentimentos' }),
  triste: S({ pt: ['triste', 'tristeza'], en: ['sad'], es: ['triste'] }, [fr2(both([-0.08, 1.62, 0.24], 'up', 'back', 'claw'), 0.3), fr2(both([-0.1, 1.42, 0.28], 'up', 'back', 'claw'), 0.5)], { expr: 'sad', cat: 'Sentimentos' }),
  medo: S({ pt: ['medo', 'assustado'], en: ['afraid', 'scared', 'fear'], es: ['miedo'] }, [fr2(both([-0.16, 1.3, 0.36], 'up', 'fwd', 'fist'), 0.25), fr2(both([-0.06, 1.28, 0.26], 'up+in', 'back', 'open'), 0.35)], { expr: 'surprise', cat: 'Sentimentos' }),
  cansado: S({ pt: ['cansado', 'cansada', 'cansaço'], en: ['tired'], es: ['cansado', 'cansada'] }, [fr2(both([-0.08, 1.32, 0.22], 'in+up', 'back', 'bent'), 0.3), fr2(both([-0.08, 1.24, 0.24], 'in+down', 'back', 'bent'), 0.45)], { expr: 'sad', cat: 'Sentimentos' }),

  /* ----- números ----- */
  um: S({ pt: ['um', 'uma', '1'], en: ['one', '1'], es: ['uno', 'una', '1'] }, [fr(r(P.SPELL, 'up', 'back', 'point'), null, 0.55)], { cat: 'Números' }),
  dois: S({ pt: ['dois', 'duas', '2'], en: ['two', '2'], es: ['dos', '2'] }, [fr(r(P.SPELL, 'up', 'back', 'V'), null, 0.55)], { cat: 'Números' }),
  tres: S({ pt: ['três', 'tres', '3'], en: ['three', '3'], es: ['tres', '3'] }, [fr(r(P.SPELL, 'up', 'back', 'W'), null, 0.55)], { cat: 'Números' }),
  quatro: S({ pt: ['quatro', '4'], en: ['four', '4'], es: ['cuatro', '4'] }, [fr(r(P.SPELL, 'up', 'back', 'four'), null, 0.55)], { cat: 'Números' }),
  cinco: S({ pt: ['cinco', '5'], en: ['five', '5'], es: ['cinco', '5'] }, [fr(r(P.SPELL, 'up', 'back', 'open'), null, 0.55)], { cat: 'Números' }),
};

/** Nome da palavra principal de um sinal, na língua da interface. */
export const signLabel = (id, lang = 'pt') => (SIGNS[id]?.words[lang] || SIGNS[id]?.words.pt || [id])[0];
