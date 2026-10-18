// Locais de uso: profissões, frases rápidas e significado dos gestos reconhecidos pela câmara.
export const PLACES = {
  hospital: { ico: '🏥', name: 'Hospital', desc: 'Consultas, urgências e farmácia', roles: ['Médica', 'Médico', 'Enfermeira', 'Enfermeiro', 'Farmacêutica', 'Rececionista'],
    phrases: { pt: ['Olá, sou a médica.', 'Onde dói?', 'Tem febre?', 'Tem tonturas?', 'Vou examinar.', 'Tome este remédio.', 'Espere aqui, por favor.'],
      en: ['Hello, I am the doctor.', 'Where does it hurt?', 'Do you have a fever?', 'Please wait here.'], es: ['Hola, soy la médica.', '¿Dónde duele?', '¿Tiene fiebre?', 'Espere aquí, por favor.'] } },
  escola: { ico: '🏫', name: 'Escola', desc: 'Aulas, secretaria e reuniões', roles: ['Professor', 'Professora', 'Diretor', 'Diretora', 'Secretária'],
    phrases: { pt: ['Bom dia, turma.', 'Qual é o seu nome?', 'Vamos ler o livro.', 'Escreva no caderno.', 'Tem alguma pergunta?', 'Percebeu?', 'Até amanhã.'],
      en: ['Good morning, class.', 'What is your name?', 'Read the book.', 'Do you understand?'], es: ['Buenos días, clase.', '¿Cuál es tu nombre?', 'Lean el libro.', '¿Entiendes?'] } },
  empresa: { ico: '🏢', name: 'Empresa', desc: 'Entrevistas, reuniões e RH', roles: ['Empresário', 'Empresária', 'Executiva', 'Executivo', 'Funcionário', 'Funcionária', 'Recursos Humanos'],
    phrases: { pt: ['Bem-vindo ao trabalho.', 'Qual é o seu nome?', 'A reunião é hoje.', 'Precisa de ajuda?', 'Obrigado.'],
      en: ['Welcome to work.', 'What is your name?', 'Do you need help?'], es: ['Bienvenido al trabajo.', '¿Necesita ayuda?'] } },
  servicos: { ico: '🛎️', name: 'Atendimento', desc: 'Balcões, conservatória e banco', roles: ['Atendente', 'Funcionário', 'Funcionária', 'Agente'],
    phrases: { pt: ['Olá, como posso ajudar?', 'Qual é o seu nome?', 'Tem o documento?', 'Espere, por favor.', 'Quanto custa?'],
      en: ['Hello, how can I help?', 'Do you have your ID?', 'Please wait.'], es: ['Hola, ¿cómo puedo ayudar?', 'Espere, por favor.'] } },
};

// gestos do reconhecedor → frase falada (por local)
const BASE = { wave: 'Olá', Open_Palm: 'Espere', Closed_Fist: 'Sim', Thumb_Up: 'Está bem', Thumb_Down: 'Não', Victory: 'Obrigado', Pointing_Up: 'Tenho uma pergunta', ILoveYou: 'Preciso de ajuda' };
const MEAN_PT = {
  hospital: { ...BASE, Thumb_Up: 'Estou bem', Thumb_Down: 'Estou mal', Pointing_Up: 'Dói aqui' },
  escola: { ...BASE, Thumb_Up: 'Percebi', Thumb_Down: 'Não percebi' },
  empresa: { ...BASE, Thumb_Down: 'Há um problema' },
  servicos: { ...BASE, Pointing_Up: 'Quero isto' },
};
const TR = {
  en: { 'Olá': 'Hello', 'Espere': 'Wait', 'Sim': 'Yes', 'Está bem': 'Okay', 'Não': 'No', 'Obrigado': 'Thank you', 'Tenho uma pergunta': 'I have a question', 'Preciso de ajuda': 'I need help', 'Estou bem': 'I am fine', 'Estou mal': 'I feel sick', 'Dói aqui': 'It hurts here', 'Percebi': 'I understand', 'Não percebi': "I don't understand", 'Há um problema': 'There is a problem', 'Quero isto': 'I want this' },
  es: { 'Olá': 'Hola', 'Espere': 'Espere', 'Sim': 'Sí', 'Está bem': 'Está bien', 'Não': 'No', 'Obrigado': 'Gracias', 'Tenho uma pergunta': 'Tengo una pregunta', 'Preciso de ajuda': 'Necesito ayuda', 'Estou bem': 'Estoy bien', 'Estou mal': 'Me siento mal', 'Dói aqui': 'Me duele aquí', 'Percebi': 'Entiendo', 'Não percebi': 'No entiendo', 'Há um problema': 'Hay un problema', 'Quero isto': 'Quiero esto' },
};
export const GESTURE_NAMES = { wave: 'Acenar com a mão aberta', Open_Palm: 'Mão aberta parada', Closed_Fist: 'Punho fechado', Thumb_Up: 'Polegar para cima', Thumb_Down: 'Polegar para baixo', Victory: 'Dois dedos em V', Pointing_Up: 'Indicador para cima', ILoveYou: 'Polegar, indicador e mindinho' };
export function meanings(place, lang = 'pt') {
  const m = MEAN_PT[place] || MEAN_PT.hospital;
  if (lang === 'pt') return { ...m };
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, TR[lang]?.[v] || v]));
}
export const phrasesFor = (place, lang) => PLACES[place].phrases[lang] || PLACES[place].phrases.pt;

// Cada profissão define a farda, a pessoa (mulher/homem) e o título do nome do intérprete.
export const ROLES = {
  'Médica': { g: 'f', outfit: 'bata', title: 'Dra.' }, 'Médico': { g: 'm', outfit: 'bata', title: 'Dr.' },
  'Enfermeira': { g: 'f', outfit: 'enfermagem', title: 'Enf.' }, 'Enfermeiro': { g: 'm', outfit: 'enfermagem', title: 'Enf.' },
  'Farmacêutica': { g: 'f', outfit: 'bata', title: 'Dra.' }, 'Rececionista': { g: 'f', outfit: 'atendimento', title: '' },
  'Professor': { g: 'm', outfit: 'professor', title: 'Prof.' }, 'Professora': { g: 'f', outfit: 'professor', title: 'Prof.ª' },
  'Diretor': { g: 'm', outfit: 'executivo', title: 'Dr.' }, 'Diretora': { g: 'f', outfit: 'executivo', title: 'Dra.' },
  'Secretária': { g: 'f', outfit: 'atendimento', title: '' },
  'Empresário': { g: 'm', outfit: 'executivo', title: 'Sr.' }, 'Empresária': { g: 'f', outfit: 'executivo', title: 'Sra.' },
  'Executiva': { g: 'f', outfit: 'executivo', title: '' }, 'Executivo': { g: 'm', outfit: 'executivo', title: '' },
  'Funcionário': { g: 'm', outfit: 'atendimento', title: '' }, 'Funcionária': { g: 'f', outfit: 'atendimento', title: '' },
  'Recursos Humanos': { g: 'f', outfit: 'executivo', title: '' },
  'Atendente': { g: 'f', outfit: 'atendimento', title: '' }, 'Agente': { g: 'm', outfit: 'atendimento', title: '' },
};
const BASE_NAMES = { f: 'Amina', m: 'Bilar' };
/** Nome automático para uma profissão, mantendo o nome próprio que a pessoa escolheu. */
export function autoName(currentName, role, gender) {
  const r = ROLES[role] || { title: '' };
  const first = String(currentName || '').replace(/^(Dra?\.|Prof\.ª|Prof\.|Enf\.|Sra?\.)\s*/, '').trim();
  const isDefault = !first || first === BASE_NAMES.f || first === BASE_NAMES.m;
  const name = isDefault ? BASE_NAMES[gender] : first;
  return (r.title ? r.title + ' ' : '') + name;
}
