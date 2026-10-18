// Línguas de sinais disponíveis e a língua falada associada a cada uma.
export const SIGN_LANGS = {
  lsm:  { country: 'mz', name: 'Língua de Sinais de Moçambique', short: 'LSM', speech: 'pt-PT', words: 'pt', alphabet: 'pendente' },
  libras:{ country: 'br', name: 'Libras — Brasil', short: 'Libras', speech: 'pt-BR', words: 'pt', alphabet: 'pendente' },
  lgp:  { country: 'pt', name: 'Língua Gestual Portuguesa', short: 'LGP', speech: 'pt-PT', words: 'pt', alphabet: 'pendente' },
  asl:  { country: 'us', name: 'American Sign Language', short: 'ASL', speech: 'en-US', words: 'en', alphabet: 'asl' },
  lse:  { country: 'es', name: 'Lengua de Signos Española', short: 'LSE', speech: 'es-ES', words: 'es', alphabet: 'pendente' },
};
export const STOP = {
  pt: new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'e', 'é', 'para', 'pra', 'ao', 'à', 'se', 'com', 'ou', 'vou', 'vai', 'está', 'esta', 'muito', 'lhe', 'ser', 'estou', 'estás', 'vamos']),
  en: new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'and', 'is', 'are', 'am', 'be', 'will', 'do', 'does', 'it', 'at', 'for', 'very']),
  es: new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'y', 'es', 'para', 'a', 'al', 'con', 'muy', 'está', 'estoy', 'voy']),
};
