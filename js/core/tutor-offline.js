// Professor virtual sem internet nem chave de IA: contas simples e um pequeno conjunto de respostas.
// Serve para demonstrar quando não há ligação. Com ANTHROPIC_API_KEY, o servidor usa a IA completa.
import { strip as noAccents } from '../sign/text.js';
const strip = (t) => noAccents(t).toLowerCase();

const KB = [
  { k: ['inclui', 'o que e esta app', 'quem es'], pt: 'Sou o professor virtual da Inclui+. Respondo às tuas perguntas com voz, texto e língua de sinais.', emotion: 'smile', kw: ['eu', 'professor', 'ajuda'] },
  { k: ['lingua de sinais', 'lingua gestual', 'lsm'], pt: 'A língua de sinais usa as mãos, o rosto e o corpo para comunicar. Em Moçambique usamos a Língua de Sinais de Moçambique.', emotion: 'smile', kw: ['falar', 'surdo'] },
  { k: ['capital de mocambique'], pt: 'A capital de Moçambique é Maputo.', emotion: 'smile', kw: ['casa'] },
  { k: ['independencia de mocambique', 'independencia'], pt: 'Moçambique tornou-se independente a 25 de junho de 1975.', emotion: 'smile', kw: ['dia'] },
  { k: ['fotossintese'], pt: 'A fotossíntese é o processo em que as plantas usam a luz do sol, a água e o ar para fazer o seu alimento e libertar oxigénio.', emotion: 'think', kw: ['comer', 'agua', 'respirar'] },
  { k: ['ciclo da agua'], pt: 'A água evapora com o calor do sol, forma nuvens e volta a cair como chuva. Este caminho chama-se ciclo da água.', emotion: 'think', kw: ['agua', 'tempo'] },
  { k: ['coracao', 'sangue'], pt: 'O coração é um músculo que bombeia o sangue para todo o corpo.', emotion: 'think', kw: ['coracao', 'sangue'] },
  { k: ['ola', 'bom dia', 'boa tarde', 'boa noite'], pt: 'Olá! Em que posso ajudar hoje?', emotion: 'smile', kw: ['ola', 'ajuda'] },
  { k: ['obrigad'], pt: 'De nada! Estou aqui para ajudar.', emotion: 'smile', kw: ['bem', 'ajuda'] },
];
const OPS = { mais: '+', '+': '+', menos: '-', '-': '-', vezes: '*', x: '*', '*': '*', 'dividido por': '/', '/': '/' };

export function localAnswer(question, lang = 'pt') {
  const q = strip(question);
  const m = q.match(/(-?\d+(?:[.,]\d+)?)\s*(mais|menos|vezes|dividido por|[+\-*/x])\s*(-?\d+(?:[.,]\d+)?)/);
  if (m) {
    const a = +m[1].replace(',', '.'), b = +m[3].replace(',', '.'), op = OPS[m[2]];
    const v = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : b === 0 ? NaN : a / b;
    if (Number.isFinite(v)) {
      const r = Math.round(v * 1000) / 1000;
      return { answer: `${m[1]} ${m[2]} ${m[3]} é igual a ${String(r).replace('.', ',')}.`, emotion: 'smile', keywords: [] };
    }
    return { answer: 'Não se pode dividir por zero.', emotion: 'think', keywords: ['nao'] };
  }
  const hit = KB.find((e) => e.k.some((k) => q.includes(k)));
  if (hit) return { answer: hit.pt, emotion: hit.emotion, keywords: hit.kw };
  return { answer: 'Ainda não encontrei uma resposta fiável para esta pergunta. Verifica a ligação à internet, tenta reformular ou pergunta ao professor da turma.', emotion: 'think', keywords: ['nao', 'perguntar', 'professor'] };
}
