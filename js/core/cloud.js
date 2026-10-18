// Nuvem (Firebase): contas, o mesmo ambiente em qualquer dispositivo e a aprendizagem com a comunidade.
//  • Conta: criar (nome, e-mail, palavra-passe), entrar, recuperar a palavra-passe, Google, sair.
//    Sem conta, a pessoa usa uma conta anónima neste dispositivo; ao criar conta, os dados passam para ela.
//  • Perfil sincronizado: preferências, intérpretes, local, língua de sinais (users/{uid}).
//  • Os meus sinais gravados (users/{uid}/signs) e os sinais da comunidade (signs). A conta é opcional:
//    sem conta, os sinais gravados também vão para a base comum. A comunidade vota (3 votos a favor aprovam)
//    e os intérpretes validadores podem aprovar ou rejeitar diretamente. Os sinais aprovados chegam a todos.
//  • Conversas guardadas (só se a pessoa ligar a opção) e estatísticas de uso anónimas (Analytics).
// A configuração do projeto está em assets/firebase-config.js. Sem ela, tudo fica só no dispositivo.
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const cloud = { state: 'off', user: null, msg: '', reviewer: false };
let fb = null, analytics = null;
const listeners = [];
const emit = () => listeners.forEach((f) => f(cloud));
export const onCloud = (f) => { listeners.push(f); f(cloud); };
function set(state, msg) { cloud.state = state; cloud.msg = msg; emit(); }
const ready = () => !!(fb && cloud.user);
const signedIn = () => ready() && !cloud.user.isAnonymous;
export const hasAccount = signedIn;

export async function initCloud() {
  const cfg = window.__INCLUI_FIREBASE;
  if (window.__INCLUI_EMBED) return set('off', 'Está a usar sem conta, com os sinais deste dispositivo. Os sinais aprendidos com toda a comunidade chegam ao abrir a Inclui+ no site: bilar7.github.io/inclui-mais.');
  if (!cfg?.apiKey) return set('off', 'Nuvem por configurar: os dados ficam só neste dispositivo.');
  if (location.protocol === 'file:') return set('off', 'Está a usar sem conta, com os sinais deste dispositivo. Os sinais aprendidos com toda a comunidade chegam ao abrir a Inclui+ no site: bilar7.github.io/inclui-mais.');
  set('loading', 'A ligar à nuvem…');
  try {
    const [app, auth, fs] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => import(SDK + f)));
    const a = app.initializeApp(cfg);
    fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
    fb.auth.languageCode = 'pt';
    if (cfg.measurementId) import(SDK + 'firebase-analytics.js').then(async (m) => { if (await m.isSupported()) analytics = { m, a: m.getAnalytics(a) }; }).catch(() => {});
    fb.A.onAuthStateChanged(fb.auth, async (u) => {
      cloud.user = u; cloud.reviewer = false;
      if (!u) return set('guest', 'Entre ou crie uma conta para guardar tudo na nuvem.');
      set('on', u.isAnonymous ? 'A usar sem conta: já recebe todos os sinais aprendidos com a comunidade. A conta é opcional — serve para levar os seus sinais e preferências para outro telemóvel.' : `Ligado como ${u.displayName || u.email}. Tudo guardado na nuvem.`);
      if (!u.isAnonymous) {
        cloud.reviewer = await fb.F.getDoc(fb.F.doc(fb.db, 'admins', u.uid)).then((d) => d.exists()).catch(() => false);
        emit();
      }
    });
    await fb.auth.authStateReady?.();
    if (!fb.auth.currentUser) await fb.A.signInAnonymously(fb.auth).catch(() => set('guest', 'Entre ou crie uma conta para guardar tudo na nuvem.'));
  } catch (e) {
    console.warn('Firebase:', e);
    set('error', 'Não foi possível ligar à nuvem. Verifique a internet.');
  }
}

/* ---------- conta ---------- */
const ERR = {
  'auth/email-already-in-use': 'Já existe uma conta com este nome ou e-mail. Use "Entrar" ou escolha outro.',
  'auth/credential-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
  'auth/invalid-email': 'O e-mail ou o nome de utilizador não é válido.',
  'auth/weak-password': 'A palavra-passe precisa de pelo menos 6 caracteres.',
  'auth/invalid-credential': 'Nome, e-mail ou palavra-passe errados.',
  'auth/wrong-password': 'E-mail ou palavra-passe errados.',
  'auth/user-not-found': 'Não existe conta com este e-mail.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente outra vez.',
  'auth/network-request-failed': 'Sem internet. Tente outra vez.',
  'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
  'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase (Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'Este método de entrada ainda não está ativo no Firebase (Authentication → Sign-in method).',
};
export const authError = (e) => ERR[e?.code] || 'Não foi possível concluir. Tente outra vez.';

/** Contas só com nome de utilizador (sem e-mail): o Firebase precisa de um e-mail, por isso usa-se um interno. */
export const USER_DOMAIN = '@utilizador.inclui-mais.app';
export function toEmail(v) {
  if (v.includes('@')) return v;
  const u = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
  return u.length >= 3 ? u + USER_DOMAIN : null;
}
/** Criar conta. Se a pessoa já usava a conta anónima, os dados dela passam para a conta nova. */
export async function register(name, email, pass) {
  const { A, auth } = fb, cur = auth.currentUser;
  const cred = cur?.isAnonymous ? await A.linkWithCredential(cur, A.EmailAuthProvider.credential(email, pass)) : await A.createUserWithEmailAndPassword(auth, email, pass);
  if (name) await A.updateProfile(cred.user, { displayName: name });
  if (!email.endsWith(USER_DOMAIN)) A.sendEmailVerification(cred.user).catch(() => {});
  await cred.user.reload(); cloud.user = auth.currentUser;
  track('sign_up'); set('on', `Conta criada. Bem-vindo(a), ${name || email}!`);
}
export async function login(email, pass) {
  await fb.A.signInWithEmailAndPassword(fb.auth, email, pass);
  track('login', { method: 'email' });
}
export const resetPassword = (email) => fb.A.sendPasswordResetEmail(fb.auth, email);
/** Entrar com Google (janela; nos telemóveis que bloqueiam janelas, redireciona). */
export async function signInGoogle() {
  const { A, auth } = fb, p = new A.GoogleAuthProvider(), cur = auth.currentUser;
  try {
    if (cur?.isAnonymous) await A.linkWithPopup(cur, p).catch((e) => (e.code === 'auth/credential-already-in-use' ? A.signInWithPopup(auth, p) : Promise.reject(e)));
    else await A.signInWithPopup(auth, p);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, p);
    throw e;
  }
  track('login', { method: 'google' });
}
export async function logout() { await fb.A.signOut(fb.auth); await fb.A.signInAnonymously(fb.auth).catch(() => {}); }

/* ---------- perfil sincronizado ---------- */
const userDoc = () => fb.F.doc(fb.db, 'users', cloud.user.uid);
export async function loadProfile() { if (!ready()) return null; const s = await fb.F.getDoc(userDoc()); return s.exists() ? s.data() : null; }
let pushT = null;
export function pushProfile(data) {
  if (!ready()) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => fb.F.setDoc(userDoc(), { ...data, updatedAt: Date.now() }, { merge: true }).catch((e) => console.warn('nuvem', e)), 1500);
}

/* ---------- conversas (opcional) ---------- */
const session = 's' + Date.now().toString(36);
let convT = null;
export function saveConversation(lines, meta) {
  if (!ready()) return;
  clearTimeout(convT);
  convT = setTimeout(() => fb.F.setDoc(fb.F.doc(fb.db, 'users', cloud.user.uid, 'conversations', session), {
    ...meta, lines: lines.map((l) => ({ who: l.who, t: l.t, at: l.at.getTime() })), updatedAt: Date.now(),
  }).catch((e) => console.warn('nuvem', e)), 2000);
}

/* ---------- sinais gravados ---------- */
// No Firestore os fotogramas vão em texto JSON (o Firestore não aceita listas dentro de listas).
const pack = (s) => ({ sl: s.sl, lang: s.lang, words: s.words, data: JSON.stringify(s.frames), samples: JSON.stringify(s.samples || []), createdAt: s.createdAt });
const unpack = (id, d) => ({ id, sl: d.sl, lang: d.lang, words: d.words, frames: JSON.parse(d.data), samples: JSON.parse(d.samples || '[]'), createdAt: d.createdAt, status: d.status, author: d.author, authorName: d.authorName, up: d.up || [], down: d.down || [] });

/** Guarda um sinal meu; com share, envia-o também para a comunidade (fica pendente até um intérprete validar). */
export async function saveSign(s, share) {
  if (!ready()) return false;
  await fb.F.setDoc(fb.F.doc(fb.db, 'users', cloud.user.uid, 'signs', s.id), { ...pack(s), shared: !!share });
  if (share) {
    await fb.F.setDoc(fb.F.doc(fb.db, 'signs', s.id), { ...pack(s), author: cloud.user.uid, authorName: cloud.user.displayName || 'Anónimo', status: 'pendente', up: [], down: [] });
    track('sign_shared', { sl: s.sl });
  }
  return true;
}
export async function deleteSign(id) {
  if (!ready()) return;
  await fb.F.deleteDoc(fb.F.doc(fb.db, 'users', cloud.user.uid, 'signs', id));
  await fb.F.deleteDoc(fb.F.doc(fb.db, 'signs', id)).catch(() => {}); // só apaga se ainda for meu e estiver pendente
}
export async function loadMySigns() {
  if (!ready()) return [];
  const q = await fb.F.getDocs(fb.F.collection(fb.db, 'users', cloud.user.uid, 'signs'));
  return q.docs.map((d) => unpack(d.id, d.data()));
}
/** Sinais aprovados da comunidade numa língua de sinais (leitura pública, com ou sem conta). */
export async function loadCommunity(sl) {
  if (!fb) return null;
  const { F, db } = fb;
  const q = await F.getDocs(F.query(F.collection(db, 'signs'), F.where('sl', '==', sl), F.where('status', '==', 'aprovado'), F.limit(800)));
  return q.docs.map((d) => unpack(d.id, d.data()));
}
/** Sinais à espera de validação (de outras pessoas), para a comunidade votar. */
export async function loadPending(sl) {
  if (!ready()) return [];
  const { F, db } = fb;
  const q = await F.getDocs(F.query(F.collection(db, 'signs'), F.where('sl', '==', sl), F.where('status', '==', 'pendente'), F.limit(100)));
  return q.docs.map((d) => unpack(d.id, d.data())).filter((s) => s.author !== cloud.user.uid);
}
/** Voto da comunidade: 3 votos a favor (e menos de metade contra) aprovam; 3 contra (mais do que a favor) rejeitam. */
export async function voteSign(id, ok) {
  const { F, db } = fb, uid = cloud.user.uid, ref = F.doc(db, 'signs', id);
  return F.runTransaction(db, async (tx) => {
    const d = (await tx.get(ref)).data();
    if (d.up.includes(uid) || d.down.includes(uid)) return d.status;
    const up = ok ? [...d.up, uid] : d.up, down = ok ? d.down : [...d.down, uid];
    const status = up.length >= 3 && down.length * 2 < up.length ? 'aprovado' : down.length >= 3 && down.length > up.length ? 'rejeitado' : d.status;
    tx.update(ref, { up, down, status });
    return status;
  }).then((st) => { track('sign_voted', { ok }); return st; });
}
export async function reviewSign(id, ok) {
  await fb.F.updateDoc(fb.F.doc(fb.db, 'signs', id), { status: ok ? 'aprovado' : 'rejeitado', reviewedBy: cloud.user.uid, reviewedAt: Date.now() });
  track('sign_reviewed', { ok });
}

/* ---------- estatísticas anónimas (Firebase Analytics) ---------- */
export function track(name, params) { try { analytics?.m.logEvent(analytics.a, name, params); } catch { /* sem estatísticas */ } }
