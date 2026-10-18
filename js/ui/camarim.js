// Camarim: todas as pessoas 3D da Inclui+ numa grelha com o rosto de cada uma.
// Escolhe-se a pessoa (cara, corpo e roupa dela); as personalizáveis abrem a loja de roupa e cabelo do estúdio.
import { pickModel } from '../avatar/avatar.js';
import { esc } from '../core/store.js';

const GROUPS = { dia: 'Dia a dia', saude: 'Saúde', escritorio: 'Escritório e escola', personalizavel: 'Personalizáveis — roupa, cabelo e pele à escolha' };
let who = 'todas'; // filtro aberto (mantém-se entre aberturas)

/** onPick(modelo) · onWardrobe() abre a loja de roupa do estúdio */
export function renderCamarim(root, models, look, { onPick, onWardrobe }) {
  const current = pickModel(models, look);
  const list = models.filter((m) => m.available && (who === 'todas' || m.gender === who));
  const card = (m) => `<button class="cam-card" data-id="${m.id}" aria-pressed="${m.id === current?.id}">
      <img src="${m.thumb}" alt="" loading="lazy" width="160" height="160"><b>${esc(m.label)}</b><small>${esc(m.desc || '')}</small></button>`;
  root.innerHTML = `
    <div class="tabs" role="tablist">${Object.entries({ todas: 'Todas', f: 'Mulheres', m: 'Homens' }).map(([k, l]) =>
      `<button role="tab" data-w="${k}" aria-selected="${k === who}">${l}</button>`).join('')}</div>
    ${Object.entries(GROUPS).map(([g, title]) => {
      const items = list.filter((m) => (m.group || 'personalizavel') === g);
      return items.length ? `<h3 class="cam-h">${title}</h3><div class="cam-grid">${items.map(card).join('')}</div>` : '';
    }).join('')}
    <button class="btn sun" id="camWear">👗 Loja de roupa e cabelo</button>
    <p class="note">As pessoas digitalizadas já vêm vestidas: para trocar a roupa peça a peça escolha uma das <b>Personalizáveis</b>.</p>`;
  root.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { who = b.dataset.w; renderCamarim(root, models, look, { onPick, onWardrobe }); }));
  root.querySelectorAll('.cam-card').forEach((b) => (b.onclick = () => onPick(models.find((m) => m.id === b.dataset.id))));
  root.querySelector('#camWear').onclick = onWardrobe;
}
