import test from 'node:test';
import assert from 'node:assert/strict';

import { answerFromKnowledge } from '../js/core/teacher.js';

test('answerFromKnowledge returns a cited extract when a public source is found', async () => {
  const sources = [{ title: 'Fotossíntese', extract: 'As plantas usam a luz para produzir alimento.', url: 'https://pt.wikipedia.org/?curid=123' }];
  const result = await answerFromKnowledge('O que é fotossíntese?', 'pt', async () => sources);

  assert.equal(result.answer, sources[0].extract);
  assert.equal(result.source, 'wikipedia');
  assert.deepEqual(result.sources, sources);
});

test('answerFromKnowledge reports an empty search distinctly from a failed search', async () => {
  const empty = await answerFromKnowledge('pergunta sem resultados', 'pt', async () => []);
  const failed = await answerFromKnowledge('sem internet', 'pt', async () => { throw new Error('offline'); });

  assert.deepEqual(empty, { answer: null, unavailable: false });
  assert.deepEqual(failed, { answer: null, unavailable: true });
});
