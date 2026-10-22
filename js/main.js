// Inclui+ — arranque da aplicação: liga a interface, o intérprete 3D, a voz e a câmara.
import { Interpreter, modelCatalog, pickModel } from './avatar/avatar.js';
import { PERSONAS } from './avatar/customize.js';
import { HS } from './avatar/handshapes.js';
import { translate, translateResponse } from './sign/translate.js';
import { SIGNS, signLabel } from './sign/lexicon.js';
import { letterFrames, LETTER_SPEC } from './sign/alphabet.js';
import { SIGN_LANGS } from './core/languages.js';
import { PLACES, GESTURE_NAMES, meanings, phrasesFor, ROLES, autoName } from './core/places.js';
import { store, speak, listen, esc } from './core/store.js';
import { DeafCamera } from './vision/camera.js';
import { describe } from './vision/features.js';
import { renderStudio, setStudioTab } from './ui/studio.js';
import { renderCamarim } from './ui/camarim.js';
import { flag } from './core/flags.js';
import { renderLearn } from './ui/learn.js';
import { ask, speakWithFace } from './core/teacher.js';
import { BlindMode } from './ui/blind.js';
import { renderAAC } from './ui/aac.js';
import { Captions, SoundAlert } from './ui/deaftools.js';
import { cloud, initCloud, onCloud, hasAccount, loadProfile, pushProfile, saveConversation, saveSign, loadMySigns, loadCommunity, track as trackEvent } from './core/cloud.js';
import { setSignLang, setLearned, mySigns, learnedSamples, learnedSigns } from './sign/learned.js';
import { SignRecorder } from './vision/recorder.js';
import { classify } from './vision/phrases.js';
import { setupSignStudio } from './ui/signstudio.js';
import { renderAccount } from './ui/account.js';

const $ = (id) => document.getElementById(id);
const toast = (t) => { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 3000); };

/* ---------- estado ---------- */
const prefs = { read: false, vib: true, big: false, hc: false, speed: 1, sync: true, conv: false, contrib: true, ...store.get('prefs', {}) };
let place = store.get('place', 'hospital');
let sl = store.get('signLang', 'lsm');
let looks = store.get('looks', {});
const lookOf = (p = place) => ({ ...PERSONAS[p], ...(looks[p] || {}) });
const L = () => SIGN_LANGS[sl];
const LOG = [];
// sinais aprendidos (os meus e os da comunidade) da língua de sinais em uso
const loadLearned = () => { setSignLang(sl); setLearned({ mine: store.get('mySigns', []), community: store.get('community:' + sl, []) }); };
loadLearned();

/* ---------- intérprete ---------- */
const it = new Interpreter($('avatarCanvas'));
it.speed = prefs.speed;
async function showLook() {
  try {
    await it.show(lookOf(), place);
    $('loading').hidden = true;
    const lk = lookOf();
    $('whoName').textContent = lk.name; $('whoRole').textContent = lk.role; $('whoIco').textContent = PLACES[place].ico;
  } catch (e) {
    console.error(e);
    $('loading').innerHTML = '<b>Não foi possível carregar o intérprete.</b><span>Abra a Inclui+ no Google Chrome ou Edge atualizados.</span>';
  }
}

/* ---------- abertura ---------- */
const stage = $('stage');
// o avatar carrega por trás da abertura, para estar pronto quando a pessoa entrar
showLook();
$('startBtn').onclick = () => $('whoSheet').showModal();

/* ---------- quem vai usar: cada pessoa escolhe o seu caminho ---------- */
let user = store.get('user', 'pro');
let afterPlace = null;
document.querySelectorAll('#profiles .profile').forEach((b) => (b.onclick = () => chooseUser(b.dataset.u)));
function chooseUser(u) {
  user = u; store.set('user', u); $('whoSheet').close(); trackEvent('profile_selected', { profile: u });
  if (u === 'blind') { blind.open(); return; }
  if (u === 'captions') { captions.open(); return; }
  const go = () => {
    if (!$('intro').hidden) enterApp();
    if (u === 'deaf') setMode('deaf'); else if (u === 'aac') setMode('cards'); else if (u === 'learn') { setMode('ask'); openSheet('learnSheet'); } else setMode('hear');
  };
  if (u === 'pro' || u === 'deaf') { afterPlace = go; renderPlaces(); $('placeSheet').showModal(); } else go();
}
const captions = new Captions({ root: $('captions'), lang: () => L().speech, toast, speak: (t) => { log('d', t); speak(t, L().speech); } });
const sounds = new SoundAlert({ root: $('sounds'), toast });
const blind = new BlindMode({ root: $('blind'), video: $('blindVideo'), speak: (t) => speak(t, L().speech, { rate: 1 }), onExit: () => {} });
$('howBtn').onclick = () => openTour();

/* ---------- como funciona: ecrãs que se deslizam ---------- */
const track = $('tourTrack'), slides = [...track.children];
$('tourDots').innerHTML = slides.map(() => '<i></i>').join('');
const tourIndex = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
function tourSync() {
  const i = tourIndex();
  [...$('tourDots').children].forEach((d, k) => d.classList.toggle('on', k === i));
  $('tourNext').textContent = i === slides.length - 1 ? 'Começar' : 'Seguinte';
}
track.addEventListener('scroll', () => requestAnimationFrame(tourSync), { passive: true });
function openTour() { $('tour').hidden = false; track.scrollTo({ left: 0 }); tourSync(); }
function closeTour(thenPick) { $('tour').hidden = true; if (thenPick) $('whoSheet').showModal(); }
$('tourNext').onclick = () => { const i = tourIndex(); if (i >= slides.length - 1) closeTour(!$('intro').hidden); else track.scrollTo({ left: (i + 1) * track.clientWidth, behavior: 'smooth' }); };
$('tourSkip').onclick = () => closeTour(!$('intro').hidden);
addEventListener('keydown', (e) => { if ($('tour').hidden) return; if (e.key === 'ArrowRight') $('tourNext').click(); if (e.key === 'Escape') closeTour(false); });

function enterApp() {
  $('intro').hidden = true; $('app').hidden = false;
  store.set('entered', true);
  it.fit?.();
}

/* ---------- folhas ---------- */
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
document.querySelectorAll('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => {
  $('menuSheet').close(); const o = b.dataset.open;
  if (o === 'tour') openTour(); else if (o === 'blind') blind.open(); else if (o === 'cards') setMode('cards');
  else if (o === 'captions') captions.open(); else if (o === 'sounds') sounds.open(); else if (o === 'install') install();
  else if (o === 'teach') { if (!$('intro').hidden) enterApp(); signStudio.open(); } else openSheet(o);
}));
$('menuBtn').onclick = () => $('menuSheet').showModal();
$('placeChip').onclick = () => openSheet('placeSheet');
$('langChip').onclick = () => openSheet('langSheet');
function openSheet(id) {
  if (id === 'placeSheet') renderPlaces();
  if (id === 'studioSheet') studio();
  if (id === 'camarimSheet') camarim();
  if (id === 'learnSheet') learn();
  if (id === 'langSheet') langs();
  if (id === 'logSheet') renderLog();
  if (id === 'gestSheet') gestures();
  if (id === 'accountSheet') renderAccount($('account'), {
    toast,
    onChange: () => { if (fromIntro && hasAccount()) { fromIntro = false; $('accountSheet').close(); $('whoSheet').showModal(); } },
    onGuest: () => { $('accountSheet').close(); if (fromIntro) { fromIntro = false; $('whoSheet').showModal(); } },
  });
  if (id === 'reviewSheet') signStudio.renderReview();
  $(id).showModal();
}

/* ---------- local ---------- */
function renderPlaces() {
  $('places').innerHTML = Object.entries(PLACES).map(([k, p]) =>
    `<button class="place" data-p="${k}" aria-pressed="${k === place}"><span>${p.ico}</span><b>${p.name}</b><small>${p.desc}</small></button>`).join('');
  $('places').querySelectorAll('.place').forEach((b) => (b.onclick = () => {
    setPlace(b.dataset.p); $('placeSheet').close();
    if (afterPlace) { const f = afterPlace; afterPlace = null; f(); } else if (!$('intro').hidden) enterApp();
  }));
}
function setPlace(p) { place = p; store.set('place', p); refreshChrome(); showLook(); it.writeBoard(null); }
function refreshChrome() {
  $('placeChip').textContent = `${PLACES[place].ico} ${PLACES[place].name}`;
  $('langChip').innerHTML = `${flag(L().country)} ${L().short}`;
  $('phrases').innerHTML = phrasesFor(place, lang()).map((t) => `<button>${esc(t)}</button>`).join('');
  $('phrases').querySelectorAll('button').forEach((b) => (b.onclick = () => hearing(b.textContent)));
  $('sayInput').placeholder = { pt: 'Fale ou escreva… ex.: Onde dói?', en: 'Speak or type… e.g. Where does it hurt?', es: 'Hable o escriba… ej.: ¿Dónde duele?' }[lang()];
  cam.meanings = meanings(place, lang());
}
const lang = () => L().words;

/* ---------- língua de sinais ---------- */
function langs() {
  $('langs').innerHTML = `<div class="langs">${Object.entries(SIGN_LANGS).map(([k, v]) =>
    `<button class="lang" data-l="${k}" aria-pressed="${k === sl}"><span>${flag(v.country)}</span><div><b>${v.short}</b><small>${v.name} · voz em ${v.speech}</small></div></button>`).join('')}</div>
    <p class="note">A língua escolhida muda a língua da voz (ouvir e falar), as frases e o alfabeto. O vocabulário de cada língua de sinais é completado com intérpretes certificados de cada país.</p>`;
  $('langs').querySelectorAll('.lang').forEach((b) => (b.onclick = () => { sl = b.dataset.l; store.set('signLang', sl); loadLearned(); syncCommunity(); loadSamples(); refreshChrome(); langs(); toast(L().name); }));
}

/* ---------- ouvinte → sinais ---------- */
function signText(text) {
  const { labels, items } = translate(text, lang());
  if (!items.length) return;
  trackEvent('translate', { sl, learned: items.filter((x) => x.learned).length });
  $('sub').innerHTML = labels.map((l) => `<span>${esc(l)} </span>`).join('');
  const spans = [...$('sub').children];
  it.play(items, {
    onItem: (i) => spans.forEach((s, k) => { s.classList.toggle('now', k === i); if (i === -1 || k < i) s.classList.add('done'); }),
    onLetter: (c) => ($('letter').textContent = c),
  });
}
const streamSignSpans = [];
const streamSignCallbacks = {
  onItem: (index) => streamSignSpans.forEach((span, i) => {
    span.classList.toggle('now', i === index);
    if (index === -1 || i < index) span.classList.add('done');
  }),
  onLetter: (letter) => ($('letter').textContent = letter),
};
function appendSignText(text) {
  const { labels, items } = translate(text, lang());
  if (!items.length) return;
  trackEvent('translate', { sl, learned: items.filter((x) => x.learned).length });
  const offset = streamSignSpans.length;
  for (const label of labels) {
    const span = document.createElement('span');
    span.textContent = `${label} `;
    streamSignSpans.push(span);
    $('sub').appendChild(span);
  }
  it.enqueue(items.map((item) => ({ ...item, index: item.index + offset })), streamSignCallbacks);
}
function hearing(t, { stream = false } = {}) {
  t = t.trim(); if (!t) return;
  log('h', t);
  if (stream) appendSignText(t); else signText(t);
  if (prefs.read && !stream) speak(t, L().speech);
  if (prefs.vib) navigator.vibrate?.(60);
}
$('sayForm').onsubmit = (e) => { e.preventDefault(); hearing($('sayInput').value); $('sayInput').value = ''; $('sayInput').blur(); };
let rec = null;
let micActive = false;
let micInitialized = false;
let lastMicFinal = '';
let lastMicFinalAt = 0;
function finishMicUi() {
  $('micBtn').classList.remove('on');
  $('listening').hidden = true;
}
function startContinuousMic() {
  const recognition = listen(L().speech, {
    continuous: true,
    onStart: () => {
      if (!micInitialized) {
        streamSignSpans.length = 0;
        $('sub').replaceChildren();
        it.play([], streamSignCallbacks);
        micInitialized = true;
      }
      $('micBtn').classList.add('on');
      $('listening').innerHTML = '<i></i>A ouvir…';
      $('listening').hidden = false;
    },
    onFinal: (t) => {
      const key = t.trim().toLocaleLowerCase().replace(/[.!?,;:]+$/g, '');
      const now = performance.now();
      if (!key || (key === lastMicFinal && now - lastMicFinalAt < 1500)) return;
      lastMicFinal = key;
      lastMicFinalAt = now;
      hearing(t, { stream: true });
    },
    onError: (err) => {
      if (err === 'no-speech' || err === 'aborted') return;
      if (['unsupported', 'not-allowed', 'service-not-allowed', 'audio-capture'].includes(err)) micActive = false;
      toast(err === 'unsupported' ? 'Para falar, use o Google Chrome ou o Edge. Também pode escrever.' : err === 'not-allowed' || err === 'service-not-allowed' ? 'Permita o microfone (ícone do cadeado, ao lado do endereço).' : err === 'audio-capture' ? 'Não foi possível acessar o microfone.' : 'Não ouvi bem. Vou tentar continuar a escuta.');
    },
    onEnd: () => {
      if (rec === recognition) rec = null;
      if (micActive) {
        setTimeout(() => { if (micActive && !rec) startContinuousMic(); }, 250);
        return;
      }
      micInitialized = false;
      finishMicUi();
    },
  });
  rec = recognition;
  if (!recognition) {
    micActive = false;
    micInitialized = false;
    finishMicUi();
  }
}
$('micBtn').onclick = () => {
  if (micActive) { micActive = false; rec?.stop(); return; }
  micActive = true;
  startContinuousMic();
};

/* ---------- modos ---------- */
function setMode(m) {
  if (m !== 'teach' && !$('panelTeach').hidden) signStudio.close();
  for (const [k, id] of [['hear', 'Hear'], ['deaf', 'Deaf'], ['ask', 'Ask'], ['cards', 'Cards']]) { $('tab' + id).setAttribute('aria-selected', m === k); $('panel' + id).hidden = m !== k; }
  if (m === 'cards' && !$('panelCards').children.length) renderAAC($('panelCards'), { onSay: sayCard });
  $('pip').hidden = m !== 'deaf'; stage.classList.toggle('has-pip', m === 'deaf');
  if (m !== 'deaf') { if (cam.on) cam.stop(); if (reader.on) reader.stop(); }
  if (m === 'deaf' && !cam.on && !reader.on) startCam();
}
$('tabHear').onclick = () => setMode('hear');
$('tabDeaf').onclick = () => setMode('deaf');
$('tabAsk').onclick = () => setMode('ask');
$('tabCards').onclick = () => setMode('cards');
// cartão tocado → voz + sinais + legenda (a pessoa que não fala é ouvida e vista por todos)
function sayCard(t) {
  log('d', t); $('sub').innerHTML = `<span class="now">🔊 ${esc(t)}</span>`;
  speakWithFace(t, it, { lang: L().speech, words: lang() });
  const { items } = translate(t, lang()); const signs = items.filter((x) => !x.spelled);
  if (signs.length) it.play(signs.map((x, i) => ({ ...x, index: i })), {});
}

/* ---------- professor virtual: pergunta → resposta com voz, rosto e sinais ---------- */
const history = [];
async function askTeacher(q) {
  q = q.trim(); if (!q) return;
  log('h', q); $('askInput').value = ''; $('askBtn').disabled = true;
  $('answer').innerHTML = '<span class="thinking">A pensar…</span>';
  $('sub').innerHTML = `<span class="done">${esc(q)}</span>`;
  it.setMood('think');
  const r = await ask(q, { lang: lang(), place: PLACES[place].name, history });
  history.push({ role: 'user', content: q }, { role: 'assistant', content: r.answer });
  $('askBtn').disabled = false;
  const sourceLabel = r.source === 'ia' ? 'Resposta da inteligência artificial'
    : r.source === 'wikipedia' ? 'Informação da Wikipédia — configure a IA no servidor para obter um resumo'
    : 'Modo offline — ligue a IA no servidor para respostas completas';
  const references = (r.sources || []).filter((source) => {
    try { return new URL(source.url).hostname.endsWith('.wikipedia.org'); } catch { return false; }
  });
  const sourceLinks = references.length
    ? `<small>Fontes: ${references.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>`).join(' · ')}</small>`
    : '';
  const sourceWarning = r.sourcesUnavailable ? '<small>A pesquisa de fontes públicas não está disponível neste momento.</small>' : '';
  $('answer').innerHTML = `${esc(r.answer)}<small>${sourceLabel}</small>${sourceLinks}${sourceWarning}`;
  $('sub').innerHTML = '';
  log('t', r.answer);
  it.setMood(r.emotion && r.emotion !== 'neutral' ? r.emotion : null);
  // Sinaliza os conceitos-chave em simultâneo com a voz; palavras sem sinal são soletradas.
  const { labels, items: signs } = translateResponse(r, lang());
  if (signs.length) {
    $('sub').innerHTML = labels.map((l) => `<span>${esc(l)} </span>`).join('');
    const spans = [...$('sub').children];
    it.play(signs.map((x, i) => ({ ...x, index: i })), { onItem: (i) => spans.forEach((sp, k) => { sp.classList.toggle('now', k === i); if (i === -1 || k < i) sp.classList.add('done'); }) });
  }
  speakWithFace(r.answer, it, { lang: L().speech, words: lang(), onEnd: () => setTimeout(() => it.setMood(null), 400) });
}
$('askForm').onsubmit = (e) => { e.preventDefault(); askTeacher($('askInput').value); };
let askRec = null;
$('askMic').onclick = () => {
  if (askRec) { askRec.stop(); return; }
  askRec = listen(L().speech, {
    onStart: () => { $('askMic').classList.add('on'); $('listening').hidden = false; },
    onText: (t) => ($('askInput').value = t),
    onFinal: (t) => askTeacher(t),
    onError: (err) => toast(err === 'unsupported' ? 'Para falar, use o Google Chrome ou o Edge.' : 'Não ouvi bem. Tente outra vez.'),
    onEnd: () => { askRec = null; $('askMic').classList.remove('on'); $('listening').hidden = true; },
  });
};
$('frameBtn').onclick = () => { const up = it.framing === 'full'; it.setFraming(up ? 'upper' : 'full'); $('frameBtn').textContent = up ? 'Ver corpo inteiro' : 'Ver mãos de perto'; };

/* ---------- pessoa surda → voz ---------- */
let heard = [], word = '';
const cam = new DeafCamera({
  video: $('video'), overlay: $('overlay'),
  onStatus: (msg, kind, p) => { $('camState').textContent = msg; $('camBtn').textContent = kind === 'off' || kind === 'error' ? '📷 Ligar câmara' : '⏹ Desligar'; if (p != null) $('hold').style.width = p * 100 + '%'; if (kind === 'error') toast(msg); },
  onCandidate: (w, p) => { $('hold').style.width = p * 100 + '%'; if (w) $('camState').textContent = w; showHeard(w && p < 1 ? w : null); },
  onCommit: (w, kind) => {
    if (kind === 'space') { if (word) { heard.push(word); say(word); word = ''; showHeard(); } return; }
    if (kind === 'letter') { word += w; showHeard(); navigator.vibrate?.(25); return; }
    heard.push(w); showHeard(); say(w); navigator.vibrate?.(40);
  },
});
cam.meanings = meanings(place, lang());
function say(t) {
  log('d', t); $('sub').innerHTML = `<span class="now">🔊 ${esc(t)}</span>`;
  speakWithFace(t, it, { lang: L().speech, words: lang() });
}
function showHeard(pending) {
  const parts = [...heard]; if (word) parts.push(word + (cam.mode === 'letters' ? '▍' : ''));
  const el = $('heard');
  if (!parts.length && !pending) { el.innerHTML = '<span class="ph">O que a pessoa surda disser aparece aqui.</span>'; return; }
  el.textContent = parts.join(' · ');
  if (pending && cam.mode !== 'letters') { const s = document.createElement('span'); s.className = 'pend'; s.textContent = (parts.length ? ' · ' : '') + pending + '…'; el.appendChild(s); }
}
async function startCam() {
  $('pip').hidden = false; stage.classList.add('has-pip'); loadSamples();
  if (recogMode === 'phrases') { await startReader(); return; }
  try { await cam.start(); } catch { /* mensagem já mostrada */ }
}
$('camBtn').onclick = () => (cam.on || reader.on ? (cam.stop(), reader.stop(), camStatus('Câmara desligada', 'off')) : startCam());
$('mWords').onclick = () => setRecog('words');
$('mLetters').onclick = () => setRecog('letters');
$('mPhrases').onclick = () => setRecog('phrases');
let recogMode = 'words';
function setRecog(m) {
  const was = cam.on || reader.on; recogMode = m;
  for (const [id, k] of [['mWords', 'words'], ['mLetters', 'letters'], ['mPhrases', 'phrases']]) $(id).setAttribute('aria-pressed', m === k);
  if (m !== 'phrases') { cam.mode = m; if (reader.on) reader.stop(); } else if (cam.on) cam.stop();
  loadSamples(); if (was) startCam();
  toast(m === 'letters' ? 'Soletre com o alfabeto manual. Baixe a mão para terminar a palavra.'
    : m === 'phrases' ? `Faça uma frase com os sinais aprendidos (${learnedSigns().length}). Uma pausa separa os sinais; baixe as mãos para terminar.` : 'A reconhecer gestos.');
}

/* ---------- frases completas: sinais seguidos, reconhecidos por DTW contra os sinais aprendidos ---------- */
let phrase = [];
const camStatus = (msg, kind) => { $('camState').textContent = msg; $('camBtn').textContent = kind === 'off' || kind === 'error' ? '📷 Ligar câmara' : '⏹ Desligar'; if (kind === 'error') toast(msg); };
const reader = new SignRecorder({
  video: $('video'), overlay: $('overlay'), face: false, pauseSplit: true,
  onStatus: (msg, kind) => camStatus(kind === 'live' ? 'Faça os sinais da frase' : msg, kind),
  onSign: (s) => {
    const r = classify(s.frames, learnedSigns());
    if (!r) { $('camState').textContent = 'Sinal não reconhecido'; return; }
    phrase.push(r.word); word = phrase.join(' '); showHeard(); navigator.vibrate?.(25);
  },
});
reader.onRest = () => { if (!phrase.length) return; const t = phrase.join(' '); phrase = []; word = ''; heard.push(t); showHeard(); say(t); };
async function startReader() {
  if (!learnedSigns().length) { toast('Ainda não há sinais gravados nesta língua. Grave sinais em Menu → Gravar sinais.'); }
  if (await reader.start()) { reader.mode = 'auto'; reader.armed = true; }
}
$('sayBack').onclick = () => { const t = [...heard, word].filter(Boolean).join(', '); t ? say(t) : toast('Ainda não há nada para repetir.'); };
$('clearHeard').onclick = () => { heard = []; word = ''; showHeard(); };
$('writeBtn').onclick = () => { $('writeForm').hidden = !$('writeForm').hidden; if (!$('writeForm').hidden) $('writeInput').focus(); };
$('writeForm').onsubmit = (e) => { e.preventDefault(); const t = $('writeInput').value.trim(); if (!t) return; heard.push(t); showHeard(); say(t); $('writeInput').value = ''; };

// exemplos de treino: alfabeto gerado a partir do próprio avatar + formas de mão dos sinais gravados (meus e da comunidade)
let letterSamples = null;
function loadSamples() {
  if (!letterSamples && it.rig) {
    const shapes = Object.fromEntries(Object.entries(LETTER_SPEC).map(([c, s]) => [c.toUpperCase(), s.hs]));
    letterSamples = it.synthHandSamples(shapes, 28, describe);
  }
  cam.setSamples(letterSamples || [], learnedSamples());
}

/* ---------- gestos que a câmara reconhece ---------- */
function gestures() {
  const mine = mySigns();
  $('gestures').innerHTML = `
    <p class="empty">Mantenha o gesto meio segundo em frente à câmara.</p>
    <ul class="list">${Object.entries(cam.meanings).map(([g, m]) => `<li><span>${GESTURE_NAMES[g]}</span><b>${esc(m)}</b></li>`).join('')}</ul>
    <p class="note">A câmara também reconhece os ${mine.length} sinais que gravou e os sinais validados pela comunidade na ${L().name}.</p>
    <button class="btn sun" id="gTeach">🎥 Gravar sinais novos</button>`;
  $('gTeach').onclick = () => { $('gestSheet').close(); signStudio.open(); };
}

/* ---------- gravar sinais: o intérprete aprende com cada pessoa ---------- */
const signStudio = setupSignStudio({
  $, it, toast,
  ctx: {
    sl: () => sl, lang, share: () => prefs.contrib && !!cloud.user, // com ou sem conta, os sinais vão para a base comum
    onOpen: () => { for (const id of ['Hear', 'Deaf', 'Ask', 'Cards']) { $('panel' + id).hidden = true; $('tab' + id).setAttribute('aria-selected', false); } if (cam.on) cam.stop(); $('pip').hidden = true; stage.classList.remove('has-pip'); },
    onClose: () => setMode('hear'),
    onLearned: () => loadSamples(),
  },
});

/* ---------- estúdio e camarim ---------- */
/** Muda a aparência do intérprete deste local (a profissão e a pessoa puxam a farda, o género e o título do nome). */
function changeLook(patch) {
  const cur = lookOf();
  if (patch.role && ROLES[patch.role]) {
    const r = ROLES[patch.role];
    Object.assign(patch, { outfit: r.outfit, gender: r.g, name: autoName(cur.name, patch.role, r.g) });
    if (r.g !== cur.gender) patch.model = null;
  } else if (patch.gender && patch.gender !== cur.gender) {
    const role = PLACES[place].roles.find((x) => ROLES[x]?.g === patch.gender && ROLES[x]?.outfit === cur.outfit) || PLACES[place].roles.find((x) => ROLES[x]?.g === patch.gender) || cur.role;
    Object.assign(patch, { role, model: patch.model ?? null, name: autoName(cur.name, role, patch.gender), outfit: ROLES[role]?.outfit || cur.outfit });
  }
  // escolher a cor da pele fixa o modelo ilustrado (o realista não muda de pele)
  if (patch.skin) patch.model = cur.model || `std-${cur.gender === 'm' ? 'm' : 'f'}`;
  if (patch.outfit && patch.outfit !== cur.outfit) patch.wear = {}; // nova farda: começa com as peças dela
  looks[place] = { ...(looks[place] || {}), ...patch }; store.set('looks', looks);
  showLook();
}
async function studio() {
  const models = await modelCatalog();
  renderStudio($('studio'), lookOf(), PLACES[place].roles,
    (patch, rerender = true) => { changeLook(patch); if (rerender) studio(); },
    () => { delete looks[place]; store.set('looks', looks); showLook(); studio(); }, models, place);
}
$('studio').addEventListener('camarim', () => { $('studioSheet').close(); openSheet('camarimSheet'); });
async function camarim() {
  const models = await modelCatalog();
  renderCamarim($('camarim'), models, lookOf(), {
    onPick: (m) => {
      const patch = { model: m.id, gender: m.gender };
      if (m.kind === 'realistic') patch.age = m.age || 'adulto';
      changeLook(patch);
      if (m.skinTones) { looks[place].skin = m.skinTones[0]; store.set('looks', looks); } // o tom da pessoa escolhida
      camarim(); toast(`${m.label} é agora o intérprete deste local.`);
    },
    onWardrobe: () => {
      const m = pickModel(models, lookOf());
      if (m?.fixedOutfit) changeLook({ model: lookOf().gender === 'm' ? 'std-m' : 'std-f' });
      $('camarimSheet').close(); setStudioTab('roupa'); openSheet('studioSheet');
    },
  });
}
$('who').onclick = () => openSheet('camarimSheet');

/* ---------- aprender ---------- */
function learn() {
  renderLearn($('learn'), {
    lang: lang(), sl,
    onSign: (id) => { $('learnSheet').close(); signText(signLabel(id, lang())); },
    onLetter: (c) => { $('learnSheet').close(); $('sub').innerHTML = `<span class="now">${c.toUpperCase()}</span>`; it.setFraming('upper'); $('frameBtn').textContent = 'Ver corpo inteiro'; it.play([{ index: 0, frames: letterFrames(c, 1.6), mouth: c }], { onLetter: (x) => ($('letter').textContent = x) }); },
  });
}

/* ---------- conversa ---------- */
function log(who, t) { LOG.push({ who, t, at: new Date() }); if (prefs.conv) saveConversation(LOG, { place, signLang: sl }); }
function renderLog() {
  $('log').innerHTML = LOG.length ? LOG.map((m) => `<div class="logrow ${m.who}"><time>${m.at.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</time><b>${{ d: 'Surdo', h: 'Ouvinte', t: 'Professor' }[m.who]}</b><span>${esc(m.t)}</span></div>`).join('') : '<p class="empty">Ainda não há conversa.</p>';
}
$('logClear').onclick = () => { LOG.length = 0; renderLog(); };
// partilhar a conversa (WhatsApp, e-mail…) ou copiar o texto
$('logShare').onclick = async () => {
  const txt = LOG.map((m) => `[${m.at.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}] ${{ d: 'Surdo', h: 'Ouvinte', t: 'Professor' }[m.who]}: ${m.t}`).join('\n');
  if (!txt) { toast('Ainda não há conversa.'); return; }
  const text = `Conversa Inclui+ (${new Date().toLocaleDateString('pt-PT')})\n${txt}`;
  try { if (navigator.share) await navigator.share({ title: 'Conversa Inclui+', text }); else { await navigator.clipboard.writeText(text); toast('Conversa copiada. Cole no WhatsApp ou no e-mail.'); } }
  catch (e) { if (e.name !== 'AbortError') toast('Não foi possível partilhar.'); }
};

/* ---------- baixar a aplicação (PWA) ---------- */
// O botão "Baixar a aplicação" está sempre na abertura. Onde o navegador permite (Android, computador), instala logo;
// no iPhone e nos outros casos mostra os passos. Na primeira visita aparece também uma barra a convidar.
let installEv = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const SITE = 'https://bilar7.github.io/inclui-mais/';
function showInstall(v) { $('installBtn').hidden = !v; $('installTile').hidden = !v; if (!v) $('installBar').hidden = true; }
showInstall(!standalone);
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e; });
addEventListener('appinstalled', () => { showInstall(false); toast('Inclui+ instalada. Abra-a pelo ícone no ecrã.'); });
if (!standalone && !store.get('installBarSeen', false)) setTimeout(() => { if (!$('intro').hidden) $('installBar').hidden = false; }, 1200);
$('installBarX').onclick = () => { $('installBar').hidden = true; store.set('installBarSeen', true); };
$('installBarGo').onclick = () => { $('installBar').hidden = true; store.set('installBarSeen', true); install(); };
async function install() {
  if (installEv) { installEv.prompt(); const r = await installEv.userChoice; if (r.outcome === 'accepted') showInstall(false); installEv = null; return; }
  const steps = window.__INCLUI_EMBED || location.protocol === 'file:'
    ? `<p class="note">Esta é uma pré-visualização. Para baixar a aplicação, abra a Inclui+ no telemóvel pelo endereço:</p><p class="site"><b>${SITE}</b></p><button class="btn sun" id="copySite">Copiar o endereço</button>`
    : isIOS ? '<ol class="steps"><li>Abra esta página no <b>Safari</b>.</li><li>Toque em <b>Partilhar</b> (□↑) em baixo.</li><li>Escolha <b>Adicionar ao ecrã principal</b> e depois <b>Adicionar</b>.</li></ol>'
      : '<ol class="steps"><li>Abra o menu do navegador <b>⋮</b> (no canto de cima).</li><li>Escolha <b>Instalar aplicação</b> ou <b>Adicionar ao ecrã principal</b>.</li><li>Confirme em <b>Instalar</b>. O ícone da Inclui+ aparece no ecrã.</li></ol>';
  $('installHelp').innerHTML = steps + '<p class="note">Depois de instalada, a Inclui+ abre como uma aplicação, com o ícone no ecrã, e funciona sem internet.</p>';
  $('copySite')?.addEventListener('click', () => navigator.clipboard?.writeText(SITE).then(() => toast('Endereço copiado.'), () => toast(SITE)));
  $('installSheet').showModal();
}
$('installBtn').onclick = install;
addEventListener('offline', () => toast('Sem internet: o intérprete continua a funcionar; a IA e o reconhecimento novo voltam com a ligação.'));

/* ---------- definições ---------- */
function applyPrefs() {
  document.documentElement.classList.toggle('big', prefs.big); document.documentElement.classList.toggle('hc', prefs.hc);
  $('optRead').checked = prefs.read; $('optVib').checked = prefs.vib; $('optSync').checked = prefs.sync; $('optConv').checked = prefs.conv; $('optContrib').checked = prefs.contrib; $('optBig').checked = prefs.big; $('optHc').checked = prefs.hc; $('optSpeed').value = prefs.speed;
  it.speed = +prefs.speed; store.set('prefs', prefs);
}
for (const [id, k] of [['optRead', 'read'], ['optVib', 'vib'], ['optBig', 'big'], ['optHc', 'hc'], ['optSync', 'sync'], ['optConv', 'conv'], ['optContrib', 'contrib']]) $(id).onchange = (e) => { prefs[k] = e.target.checked; applyPrefs(); };
$('optSpeed').oninput = (e) => { prefs.speed = +e.target.value; applyPrefs(); };
applyPrefs(); refreshChrome();

addEventListener('keydown', (e) => { if (e.target.matches('input')) return; if (e.key === 'm') $('micBtn').click(); });

/* ---------- nuvem (Firebase): a conta guarda o ambiente e a Inclui+ aprende com a comunidade ---------- */
const SYNC = ['prefs', 'looks', 'place', 'signLang', 'user'];
const snapshot = () => Object.fromEntries(SYNC.map((k) => [k, store.get(k, null)]).filter(([, v]) => v != null));
let applying = false;
store.onSet = (k) => { if (!applying && prefs.sync && SYNC.includes(k)) { store.set('syncAt', Date.now()); pushProfile(snapshot()); } };
// sinais validados da comunidade (guardados também no dispositivo, para funcionar sem internet)
async function syncCommunity() {
  const list = await loadCommunity(sl).catch(() => null); if (!list) return;
  store.set('community:' + sl, list); loadLearned(); loadSamples();
}
// os meus sinais: junta os do dispositivo com os da conta (nos dois sentidos)
async function syncMySigns() {
  const remote = await loadMySigns().catch(() => null); if (!remote) return;
  const local = store.get('mySigns', []), ids = new Set(remote.map((s) => s.id));
  for (const s of local) if (!ids.has(s.id)) saveSign(s, false).catch(() => {});
  const merged = [...remote, ...local.filter((s) => !ids.has(s.id))];
  store.set('mySigns', merged); loadLearned(); loadSamples();
}
onCloud(async (c) => {
  $('cloudState').textContent = c.msg;
  $('cloudBox').dataset.state = c.state;
  $('cloudAccount').hidden = c.state === 'off' || c.state === 'error';
  $('reviewTile').hidden = !c.user;
  const named = hasAccount();
  $('accTileName').textContent = named ? (c.user.displayName || 'A minha conta') : 'Conta';
  $('accTileSub').textContent = named ? 'Ambiente guardado na nuvem' : 'Entrar ou criar conta';
  if (!c.user || c.synced === c.user.uid) return;
  c.synced = c.user.uid;
  try {
    // ao entrar numa conta (por exemplo num telemóvel novo), o ambiente da conta substitui o deste dispositivo
    const remote = prefs.sync ? await loadProfile() : null, switched = store.get('syncUid', null) !== c.user.uid;
    if (remote && (switched || (remote.updatedAt || 0) > store.get('syncAt', 0))) {
      applying = true;
      for (const k of SYNC) if (remote[k] != null) store.set(k, remote[k]);
      store.set('syncAt', remote.updatedAt); applying = false;
      Object.assign(prefs, store.get('prefs', {})); looks = store.get('looks', {}); place = store.get('place', place); sl = store.get('signLang', sl);
      applyPrefs(); refreshChrome(); showLook(); toast('O seu ambiente foi restaurado.');
    } else if (prefs.sync) pushProfile(snapshot());
    store.set('syncUid', c.user.uid);
    await syncMySigns(); await syncCommunity();
  } catch (e) { applying = false; console.warn('nuvem', e); }
});
const openAccount = () => openSheet('accountSheet');
let fromIntro = false; // conta aberta na abertura: ao entrar (ou continuar sem conta) segue para "Quem vai usar"
$('cloudAccount').onclick = () => { $('setSheet').close(); openAccount(); };
$('introLogin').onclick = () => { fromIntro = true; openAccount(); };
initCloud();
// instalação como aplicação (só quando a Inclui+ está publicada num endereço https)
if (location.protocol === 'https:' && !window.__INCLUI_EMBED) {
  const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.appendChild(l);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.__inclui = { cloud, it, translate, signText, setMode, enterApp, chooseUser, blind, captions, sounds, signStudio, loadLearned, SIGNS, HS };
