import test from 'node:test';
import assert from 'node:assert/strict';

import { searchKnowledge } from '../server/knowledge.js';

test('searchKnowledge returns short extracts with safe Wikipedia source links', async () => {
  let requestedUrl;
  const pages = {
    42: { pageid: 42, index: 2, title: 'Clorofila', extract: '  Pigmento   verde das plantas.  ' },
    11: { pageid: 11, index: 1, title: 'Fotossíntese', extract: 'Processo feito pelas plantas.' },
    99: { pageid: 99, index: 3, title: 'Luz', extract: 'Radiação visível.' },
    100: { pageid: 100, index: 4, title: 'Excesso', extract: 'Não deve ser incluída.' },
  };
  const result = await searchKnowledge('fotossíntese', {
    lang: 'pt',
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ query: { pages } }) };
    },
  });

  assert.equal(requestedUrl.hostname, 'pt.wikipedia.org');
  assert.equal(requestedUrl.searchParams.get('gsrlimit'), '3');
  assert.equal(requestedUrl.searchParams.get('origin'), '*');
  assert.deepEqual(result.map((item) => item.title), ['Fotossíntese', 'Clorofila', 'Luz']);
  assert.equal(result[1].extract, 'Pigmento verde das plantas.');
  assert.equal(result[0].url, 'https://pt.wikipedia.org/?curid=11');
});

test('searchKnowledge uses an allowlisted language and reports HTTP errors', async () => {
  let requestedUrl;
  await assert.rejects(
    searchKnowledge('question', {
      lang: 'fr',
      fetchImpl: async (url) => {
        requestedUrl = new URL(url);
        return { ok: false, status: 503 };
      },
    }),
    /Wikipedia respondeu 503/,
  );
  assert.equal(requestedUrl.hostname, 'pt.wikipedia.org');
});

test('searchKnowledge keeps long source summaries concise at sentence boundaries', async () => {
  const extract = `${'A'.repeat(300)}. ${'B'.repeat(500)}. Extra text after the limit.`;
  const result = await searchKnowledge('long article', {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ query: { pages: { 1: { pageid: 1, index: 1, title: 'Long', extract } } } }),
    }),
  });

  assert.equal(result[0].extract.length <= 500, true);
  assert.equal(result[0].extract.endsWith('.'), true);
});
