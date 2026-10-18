// Aprender: dicionário de sinais por tema, alfabeto manual e números.
import { SIGNS } from '../sign/lexicon.js';
import { LETTERS } from '../sign/alphabet.js';
import { SIGN_LANGS } from '../core/languages.js';
import { esc } from '../core/store.js';
import { strip } from '../sign/text.js';

export function renderLearn(root, { lang, sl, onSign, onLetter, tab = 'sinais', q = '' }) {
  const L = SIGN_LANGS[sl];
  const words = Object.entries(SIGNS).filter(([, s]) => s.cat !== 'Números');
  const match = ([, s]) => !q || (s.words[lang] || s.words.pt).some((w) => strip(w).includes(strip(q.toLowerCase())));
  const cats = {};
  for (const e of words.filter(match)) (cats[e[1].cat] ||= []).push(e);
  const head = `<div class="tabs" role="tablist">${['sinais', 'alfabeto', 'numeros'].map((t) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${{ sinais: 'Sinais', alfabeto: 'Alfabeto', numeros: 'Números' }[t]}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'sinais') {
    body = `<input class="search" id="learnQ" placeholder="Procurar um sinal…" value="${esc(q)}" autocomplete="off">` +
      (Object.entries(cats).map(([c, list]) => `<p class="cat">${c}</p><div class="grid">${list.map(([id, s]) => `<button class="word" data-id="${id}">${esc(cap((s.words[lang] || s.words.pt)[0]))}</button>`).join('')}</div>`).join('') || '<p class="empty">Ainda não há este sinal. Escreva a palavra e o intérprete soletra.</p>') +
      `<p class="note"><b>Vocabulário de demonstração (${Object.keys(SIGNS).length} sinais).</b> O vocabulário oficial de cada língua é gravado com intérpretes certificados e com a comunidade surda.</p>`;
  } else if (tab === 'alfabeto') {
    const ok = L.alphabet === 'asl';
    body = `<div class="note">${ok ? '<b>Alfabeto manual ASL (EUA).</b> Toque numa letra para o intérprete a mostrar.' :
      `<b>O alfabeto oficial de ${esc(L.short)} ainda não foi gravado com intérpretes.</b> Para não mostrar letras erradas, mostramos o alfabeto ASL (EUA), indicado como tal.`}</div>
      <div class="letters">${LETTERS.map((c) => `<button data-l="${c}">${c.toUpperCase()}</button>`).join('')}</div>`;
  } else {
    body = `<div class="grid">${Object.entries(SIGNS).filter(([, s]) => s.cat === 'Números').map(([id, s]) => `<button class="word" data-id="${id}">${esc(s.words.pt.at(-1))} · ${esc(cap((s.words[lang] || s.words.pt)[0]))}</button>`).join('')}</div>`;
  }
  root.innerHTML = head + body;
  const again = (o) => renderLearn(root, { lang, sl, onSign, onLetter, tab, q, ...o });
  root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => again({ tab: b.dataset.tab }));
  root.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => onSign(b.dataset.id));
  root.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => onLetter(b.dataset.l));
  const qi = root.querySelector('#learnQ');
  if (qi) qi.oninput = () => { const pos = qi.selectionStart; again({ q: qi.value }); const n = root.querySelector('#learnQ'); n.focus(); n.setSelectionRange(pos, pos); };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
