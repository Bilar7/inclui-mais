// Estúdio do avatar: cada pessoa personaliza o intérprete de cada local, em quatro separadores
// (Pessoa · Cabelo · Roupa · Fundo). Cada escolha aparece logo no intérprete e fica guardada no dispositivo.
import { pickModel } from '../avatar/avatar.js';
import { SKIN, HAIR, OUTFITS, AGES, BODIES, wearOf } from '../avatar/customize.js';
import { HAIRSTYLES } from '../avatar/hair.js';
import { TOPS, BOTTOMS, JACKETS, CLOTH } from '../avatar/wardrobe.js';
import { SCENES, TONES, SCENE_OF, COLORS, GRADIENTS } from '../avatar/scenes.js';
import { esc } from '../core/store.js';

let tab = 'pessoa'; // separador aberto (mantém-se entre aberturas do estúdio)
export const setStudioTab = (t) => { tab = t; };

// botões de escolha (um ativo), amostras de cor e barras deslizantes
const opts = (label, items, value, key) => `
  <div class="field"><span>${label}</span><div class="opts">${Object.entries(items).map(([k, v]) =>
    `<button data-k="${key}" data-v="${k}" aria-pressed="${k === value}">${esc(typeof v === 'string' ? v : v.label)}</button>`).join('')}</div></div>`;
const swatches = (label, items, value, key) => `
  <div class="field"><span>${label}</span><div class="swatches">${Object.entries(items).map(([k, c]) =>
    `<button data-k="${key}" data-v="${c}" data-name="${k}" aria-pressed="${c === value}" style="background:${c}" aria-label="${k}" title="${k}"></button>`).join('')}</div></div>`;
const slider = (label, key, value) => `
  <div class="field"><label for="sl-${key}">${label}</label><input type="range" id="sl-${key}" data-range="${key}" min="0.6" max="1.5" step="0.05" value="${value}"></div>`;

export function renderStudio(root, look, roles, onChange, onReset, models = [], place = 'hospital') {
  const current = pickModel(models, look);
  const realFace = current?.skinTint === false;
  const w = wearOf(look), style = look.hairStyle || 'original';
  const bg = look.bg || { kind: 'scene', scene: SCENE_OF[place], tone: 'medio' };
  const panes = {
    pessoa: `
      <div class="field"><label for="avName">Nome do intérprete</label><input type="text" id="avName" maxlength="20" value="${esc(look.name)}"></div>
      ${opts('Profissão', Object.fromEntries(roles.map((r) => [r, r])), look.role, 'role')}
      ${opts('Pessoa', { f: 'Mulher', m: 'Homem' }, look.gender, 'gender')}
      <button class="cam-pick" id="avPick"><img src="${current?.thumb || ''}" alt="" width="56" height="56"><span><b>${esc(current?.label || '')}</b><small>${esc(current?.desc || '')}</small></span><span class="btn">Mudar de pessoa</span></button>
      ${realFace ? '<p class="note"><b>Rosto realista:</b> é uma pessoa digitalizada, por isso a pele não se pinta. Para escolher o tom de pele use o modelo <b>Ilustrado</b>.</p>'
        : swatches('Tom de pele', SKIN, SKIN[look.skin], 'skin')}
      ${opts('Idade', AGES, look.age, 'age')}
      ${opts('Corpo', BODIES, look.body, 'body')}
      ${opts('Detalhes', { glasses: 'Óculos', beard: 'Barba' }, null, 'flag')}`,
    cabelo: current?.fixedOutfit ? '<p class="note">Esta pessoa digitalizada mantém o cabelo original.</p>' : `
      ${opts('Corte', HAIRSTYLES, style, 'hairStyle')}
      ${style === 'original' || style === 'rapado' ? '' : slider('Comprimento', 'hairLen', look.hairLen ?? 1) + slider('Volume', 'hairVol', look.hairVol ?? 1)}
      ${realFace && style === 'original' ? '<p class="note">Escolha um corte para mudar a cor do cabelo deste modelo.</p>' : swatches('Cor do cabelo', HAIR, HAIR[look.hair] || HAIR.preto, 'hair')}`,
    roupa: current?.fixedOutfit ? `
      ${opts('Profissão', OUTFITS, look.outfit, 'outfit')}
      <p class="note"><b>${esc(current.label)}</b> já vem vestido(a). Para trocar a roupa peça a peça escolha uma pessoa <b>Personalizável</b> no camarim (botão Mudar de pessoa, em Pessoa).</p>` : `
      ${opts('Farda pronta', OUTFITS, look.outfit, 'outfit')}
      ${opts('Parte de cima', TOPS, w.top, 'w.top')}
      ${w.top === 'original' ? '' : swatches('Cor', CLOTH, w.topColor, 'w.topColor')}
      ${w.top === 'vestido' ? '' : opts('Parte de baixo', BOTTOMS, w.bottom, 'w.bottom')}
      ${w.top === 'vestido' || w.bottom === 'original' ? '' : swatches('Cor', CLOTH, w.bottomColor, 'w.bottomColor')}
      ${opts('Casaco', JACKETS, w.jacket, 'w.jacket')}
      ${w.jacket === 'nenhum' ? '' : swatches('Cor', CLOTH, w.jacketColor, 'w.jacketColor')}
      ${w.top === 'camisa' ? opts('Gravata', { sim: 'Com gravata', nao: 'Sem gravata' }, w.tie ? 'sim' : 'nao', 'w.tie') : ''}
      ${w.top === 'camisa' && w.tie ? swatches('Cor', CLOTH, w.tieColor, 'w.tieColor') : ''}`,
    fundo: `
      ${opts('Fundo', { scene: 'Cenário', color: 'Cor', gradient: 'Degradê' }, bg.kind, 'bg.kind')}
      ${bg.kind === 'scene' ? opts('Cenário', SCENES, bg.scene, 'bg.scene') + opts('Tom', TONES, bg.tone, 'bg.tone') : ''}
      ${bg.kind === 'color' ? swatches('Cor', COLORS, COLORS[bg.value], 'bg.value') : ''}
      ${bg.kind === 'gradient' ? swatches('Degradê', GRADIENTS, GRADIENTS[bg.value], 'bg.value') : ''}
      <p class="note">Um fundo mais escuro ou de cor dá mais contraste às mãos e ao rosto do intérprete.</p>`,
  };
  root.innerHTML = `
    <div class="tabs" role="tablist">${Object.entries({ pessoa: 'Pessoa', cabelo: 'Cabelo', roupa: 'Roupa', fundo: 'Fundo' }).map(([k, l]) =>
      `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    <div class="studio-pane">${panes[tab]}</div>
    <button class="btn" id="avReset">Repor o intérprete deste local</button>`;

  root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderStudio(root, look, roles, onChange, onReset, models, place); }));
  root.querySelectorAll('[data-k="flag"]').forEach((b) => b.setAttribute('aria-pressed', !!look[b.dataset.v]));
  root.querySelector('#avName')?.addEventListener('input', (e) => onChange({ name: e.target.value.trim() || look.name }, false));
  root.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'flag') onChange({ [b.dataset.v]: !look[b.dataset.v] });
    else if (k.startsWith('bg.')) { // fundo: ao mudar de tipo, começa com uma opção desse tipo
      const key = k.slice(3), v = key === 'value' ? b.dataset.name : b.dataset.v;
      const first = { scene: { scene: SCENE_OF[place], tone: 'escuro' }, color: { value: 'azul-escuro' }, gradient: { value: 'aurora' } };
      onChange({ bg: key === 'kind' ? { kind: v, ...first[v] } : { ...bg, [key]: v } });
    } else if (k.startsWith('w.')) { // peça de roupa: guarda só a mudança feita sobre a farda
      const key = k.slice(2); onChange({ wear: { ...(look.wear || {}), [key]: key === 'tie' ? b.dataset.v === 'sim' : b.dataset.v } });
    } else onChange({ [k]: b.dataset.name || b.dataset.v }); // pele e cabelo guardam o nome da cor
  }));
  root.querySelectorAll('[data-range]').forEach((r) => r.addEventListener('change', () => onChange({ [r.dataset.range]: +r.value })));
  root.querySelector('#avReset').addEventListener('click', onReset);
  root.querySelector('#avPick')?.addEventListener('click', () => root.dispatchEvent(new Event('camarim'))); // abre o camarim
}
