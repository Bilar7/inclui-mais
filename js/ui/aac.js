// Cartões que falam (Comunicação Aumentativa e Alternativa) — para quem não fala ou não lê:
// pessoas sem fala, com autismo, depois de um AVC, crianças, ou quem não sabe ler.
// Cada cartão tem imagem, é dito em voz alta e o intérprete faz o sinal.
const AAC = {
  'Preciso': [['💧', 'Quero água'], ['🍲', 'Tenho fome'], ['🚻', 'Preciso da casa de banho'], ['💊', 'Preciso do remédio'], ['🛏️', 'Quero descansar'], ['🆘', 'Preciso de ajuda']],
  'Sinto': [['😀', 'Estou feliz'], ['😢', 'Estou triste'], ['🤕', 'Dói-me'], ['🥶', 'Tenho frio'], ['🥵', 'Tenho calor'], ['😨', 'Tenho medo'], ['😴', 'Estou cansado'], ['🤢', 'Estou enjoado']],
  'Responder': [['👍', 'Sim'], ['👎', 'Não'], ['🙏', 'Por favor'], ['🤝', 'Obrigado'], ['✋', 'Espere'], ['❓', 'Não percebi']],
  'Pessoas': [['👩🏾‍⚕️', 'Chame o médico'], ['👨🏾‍🏫', 'Chame o professor'], ['👪', 'Quero a minha família'], ['🧑🏾‍🦯', 'Ajude-me a caminhar']],
  'Onde dói': [['🧠', 'Dói-me a cabeça'], ['🫃', 'Dói-me a barriga'], ['🦷', 'Dói-me o dente'], ['🫀', 'Dói-me o peito'], ['🦵', 'Dói-me a perna'], ['👂', 'Dói-me o ouvido']],
};

export function renderAAC(root, { onSay }) {
  const sentence = [];
  root.innerHTML = `
    <div class="aac-strip" id="aacStrip"><span class="ph">Toque nos cartões para formar a frase.</span></div>
    <div class="row"><button class="btn sun" id="aacSay">🔊 Dizer a frase</button><button class="btn" id="aacClear">Limpar</button></div>
    ${Object.entries(AAC).map(([cat, cards]) => `<p class="cat">${cat}</p><div class="aac-grid">${cards.map(([e, t]) => `<button class="aac-card" data-t="${t}"><span>${e}</span>${t}</button>`).join('')}</div>`).join('')}`;
  const strip = root.querySelector('#aacStrip');
  const draw = () => { strip.innerHTML = sentence.length ? sentence.map((t) => `<b>${t}</b>`).join(' ') : '<span class="ph">Toque nos cartões para formar a frase.</span>'; };
  root.querySelectorAll('.aac-card').forEach((b) => b.onclick = () => { sentence.push(b.dataset.t); draw(); onSay(b.dataset.t); navigator.vibrate?.(25); });
  root.querySelector('#aacSay').onclick = () => sentence.length && onSay(sentence.join('. '));
  root.querySelector('#aacClear').onclick = () => { sentence.length = 0; draw(); };
}
