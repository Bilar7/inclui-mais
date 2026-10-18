// Normalização de texto para comparar palavras (sem acentos).
export const strip = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
