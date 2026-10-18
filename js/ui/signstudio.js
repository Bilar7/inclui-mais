// Gravar sinais: a pessoa (ou um intérprete) grava sinais com a câmara e o intérprete 3D aprende-os.
// Cada sinal fica nos "meus sinais" (no dispositivo e na conta) e, se a pessoa quiser, vai para a comunidade,
// onde um intérprete validador o aprova. Os sinais aprovados chegam a todos: a Inclui+ aprende todos os dias.
import { SignRecorder } from '../vision/recorder.js';
import { setLearned, mySigns } from '../sign/learned.js';
import { cloud, saveSign, deleteSign, loadPending, reviewSign, voteSign, track } from '../core/cloud.js';
import { store, esc } from '../core/store.js';
import { SIGN_LANGS } from '../core/languages.js';
import { flag } from '../core/flags.js';

export function setupSignStudio({ $, it, toast, ctx }) {
  // ctx: { sl(), lang(), share(), onOpen(), onClose(), onLearned() }
  let queue = [], next = 0, takes = [];
  const rec = new SignRecorder({
    video: $('recVideo'), overlay: $('recOverlay'),
    onStatus: (t, kind) => { $('recState').textContent = t; $('recState').className = 'rec-state ' + kind; $('recPip').classList.toggle('on', kind === 'rec'); },
    onSign: (s) => {
      const word = queue[next] || ''; if (queue[next]) next++;
      const take = { ...s, id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), word };
      takes.unshift(take); drawTakes(); preview(take);
      if (rec.mode === 'manual') setGo(false); // no manual, cada gravação é um sinal
      if (rec.mode === 'auto' && queue.length && next >= queue.length) { rec.disarm(); setGo(false); $('recState').textContent = 'Todas as palavras gravadas. Veja cada sinal e guarde.'; }
      else if (queue[next]) $('recState').textContent = `Gravado “${word}”. Agora: “${queue[next]}”.`;
    },
  });

  /* ---------- abrir / fechar ---------- */
  async function open() {
    ctx.onOpen(); $('panelTeach').hidden = false; $('recPip').hidden = false;
    const L = SIGN_LANGS[ctx.sl()]; $('teachLang').innerHTML = `· ${flag(L.country)} ${L.short}`;
    if (!rec.on) await rec.start();
  }
  function close() { rec.stop(); setGo(false); $('panelTeach').hidden = true; $('recPip').hidden = true; ctx.onClose(); }
  $('teachClose').onclick = close;

  /* ---------- modo e gravação ---------- */
  const setMode = (m) => { rec.mode = m; $('recAuto').setAttribute('aria-pressed', m === 'auto'); $('recManual').setAttribute('aria-pressed', m === 'manual'); };
  $('recAuto').onclick = () => setMode('auto'); $('recManual').onclick = () => setMode('manual');
  let going = false;
  const setGo = (v) => { going = v; $('recGo').textContent = v ? '■ Parar' : '● Gravar'; };
  $('recGo').onclick = () => {
    if (!rec.on) { toast('A câmara ainda não está pronta.'); return; }
    if (going) { rec.disarm(); setGo(false); return; }
    queue = $('recWords').value.split(',').map((w) => w.trim()).filter(Boolean); next = 0;
    if (queue.length) $('recState').textContent = `Agora: “${queue[0]}”${queue.length > 1 ? ` (1 de ${queue.length})` : ''}.`;
    setGo(true); rec.arm();
  };

  /* ---------- sinais gravados por guardar ---------- */
  function preview(s) { it.setFraming('upper'); it.play([{ index: 0, word: s.word || s.words?.[0], frames: s.frames, mouth: '' }], {}); }
  function drawTakes() {
    $('takes').innerHTML = takes.map((t) => `<div class="take" data-id="${t.id}">
      <button data-a="play" aria-label="Ver no intérprete">▶</button>
      <input value="${esc(t.word)}" placeholder="Que palavra é?" aria-label="Palavra do sinal">
      <small>${t.duration.toFixed(1)} s</small>
      <button class="ok" data-a="save">Guardar</button><button data-a="del" aria-label="Apagar">✕</button></div>`).join('');
    $('takes').querySelectorAll('.take').forEach((row) => {
      const t = takes.find((x) => x.id === row.dataset.id);
      row.querySelector('input').oninput = (e) => (t.word = e.target.value.trim());
      row.querySelector('[data-a=play]').onclick = () => preview(t);
      row.querySelector('[data-a=del]').onclick = () => { takes = takes.filter((x) => x !== t); drawTakes(); };
      row.querySelector('[data-a=save]').onclick = () => save(t);
    });
  }
  async function save(t) {
    if (!t.word) { toast('Escreva a palavra que este sinal quer dizer.'); return; }
    const sign = { id: t.id, sl: ctx.sl(), lang: ctx.lang(), words: t.word.split('/').map((w) => w.trim()).filter(Boolean), frames: t.frames, samples: t.samples, createdAt: Date.now() };
    const list = [sign, ...mySigns().filter((x) => x.id !== sign.id)];
    store.set('mySigns', list); setLearned({ mine: list }); ctx.onLearned();
    takes = takes.filter((x) => x !== t); drawTakes();
    track('sign_recorded', { sl: sign.sl });
    const shared = ctx.share();
    try {
      const ok = await saveSign(sign, shared);
      toast(ok ? (shared ? `“${sign.words[0]}” aprendido e enviado para validação.` : `“${sign.words[0]}” aprendido e guardado na sua conta.`) : `“${sign.words[0]}” aprendido neste dispositivo.`);
    } catch { toast(`“${sign.words[0]}” aprendido neste dispositivo (sem ligação à nuvem).`); }
  }

  /* ---------- os meus sinais ---------- */
  function renderMine() {
    const list = mySigns();
    const L = (sl) => SIGN_LANGS[sl] || { short: sl };
    $('mySigns').innerHTML = `<p class="note">${list.length === 1 ? '1 sinal gravado' : list.length + ' sinais gravados'}. O intérprete usa-os na tradução e a câmara reconhece-os.</p>` +
      (list.map((s) => `<div class="sign-row" data-id="${s.id}"><button data-a="play">▶</button><b>${esc(s.words.join(' / '))}</b><small>${flag(L(s.sl).country)} ${L(s.sl).short}</small><button data-a="del" aria-label="Apagar">✕</button></div>`).join('')
      || '<p class="empty">Ainda não gravou nenhum sinal. Use “Gravar sinais” no menu.</p>');
    $('mySigns').querySelectorAll('.sign-row').forEach((row) => {
      const s = list.find((x) => x.id === row.dataset.id);
      row.querySelector('[data-a=play]').onclick = () => { $('mySignsSheet').close(); preview(s); };
      row.querySelector('[data-a=del]').onclick = async () => {
        const rest = mySigns().filter((x) => x.id !== s.id); store.set('mySigns', rest); setLearned({ mine: rest }); ctx.onLearned(); renderMine();
        deleteSign(s.id).catch(() => {});
      };
    });
  }
  $('mySignsBtn').onclick = () => { renderMine(); $('mySignsSheet').showModal(); };

  /* ---------- validação pela comunidade (votos) e pelos intérpretes validadores ---------- */
  async function renderReview() {
    $('review').innerHTML = '<p class="empty">A carregar…</p>';
    const list = await loadPending(ctx.sl()).catch(() => []);
    $('review').innerHTML = `<p class="note">Veja cada sinal no intérprete e diga se está correto na ${SIGN_LANGS[ctx.sl()].name}. Com 3 votos a favor, o sinal passa a ser usado por todos.</p>` +
      (list.map((s) => `<div class="sign-row" data-id="${s.id}"><button data-a="play" aria-label="Ver no intérprete">▶</button><b>${esc(s.words.join(' / '))}</b><small>👍 ${s.up.length} · 👎 ${s.down.length}</small>
        <button class="ok" data-a="yes" aria-label="Está correto">👍</button><button data-a="no" aria-label="Está errado">👎</button>
        ${cloud.reviewer ? '<button class="ok" data-a="approve">Aprovar</button><button data-a="reject">Rejeitar</button>' : ''}</div>`).join('')
      || '<p class="empty">Não há sinais à espera de validação nesta língua de sinais.</p>');
    $('review').querySelectorAll('.sign-row').forEach((row) => {
      const s = list.find((x) => x.id === row.dataset.id);
      const done = (msg) => { toast(msg); row.remove(); };
      row.querySelector('[data-a=play]').onclick = () => { $('reviewSheet').close(); preview(s); };
      const vote = (ok) => voteSign(s.id, ok).then((st) => done(st === 'aprovado' ? 'Obrigado! O sinal foi aprovado e já chega a todos.' : 'Obrigado pelo seu voto.')).catch(() => toast('Não foi possível votar.'));
      row.querySelector('[data-a=yes]').onclick = () => vote(true);
      row.querySelector('[data-a=no]').onclick = () => vote(false);
      const decide = (ok) => reviewSign(s.id, ok).then(() => done(ok ? 'Aprovado: já chega a todos.' : 'Rejeitado.')).catch(() => toast('Não foi possível guardar a decisão.'));
      row.querySelector('[data-a=approve]')?.addEventListener('click', () => decide(true));
      row.querySelector('[data-a=reject]')?.addEventListener('click', () => decide(false));
    });
  }

  return { open, close, renderMine, renderReview, rec };
}
