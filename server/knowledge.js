const WIKIPEDIA_LANGS = new Set(['pt', 'en', 'es']);
const MAX_RESULTS = 3;
const MAX_EXTRACT_LENGTH = 500;

function conciseExtract(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_EXTRACT_LENGTH) return clean;
  const excerpt = clean.slice(0, MAX_EXTRACT_LENGTH);
  const sentenceEnd = excerpt.lastIndexOf('.');
  if (sentenceEnd >= 180) return excerpt.slice(0, sentenceEnd + 1);
  return `${excerpt.slice(0, excerpt.lastIndexOf(' '))}…`;
}

export async function searchKnowledge(question, { lang = 'pt', fetchImpl = fetch } = {}) {
  const wikiLang = WIKIPEDIA_LANGS.has(lang) ? lang : 'pt';
  const url = new URL(`https://${wikiLang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: String(question || '').trim().slice(0, 300),
    gsrnamespace: '0',
    gsrlimit: String(MAX_RESULTS),
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exchars: String(MAX_EXTRACT_LENGTH),
    format: 'json',
    utf8: '1',
  });

  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'IncluiMais/2.0 (educational assistant)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Wikipedia respondeu ${response.status}`);

  const data = await response.json();
  return Object.values(data.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((page) => Number.isInteger(page.pageid) && page.title && page.extract)
    .slice(0, MAX_RESULTS)
    .map((page) => ({
      title: String(page.title).slice(0, 160),
      extract: conciseExtract(page.extract),
      url: `https://${wikiLang}.wikipedia.org/?curid=${page.pageid}`,
    }));
}
