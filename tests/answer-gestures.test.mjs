import test from 'node:test';
import assert from 'node:assert/strict';

import { translateResponse } from '../js/sign/translate.js';

test('translateResponse gestures tutor keywords and spells words without a known sign', () => {
  const result = translateResponse({
    answer: 'Uma resposta completa que é mais extensa.',
    keywords: ['Ada', 'Lovelace'],
  });

  assert.deepEqual(result.labels, ['Ada', 'Lovelace']);
  assert.equal(result.items.length, 2);
  assert.equal(result.items.every((item) => item.spelled), true);
});

test('translateResponse uses a source title when the answer has no keywords', () => {
  const result = translateResponse({
    answer: 'Augusta Ada Byron King foi uma matemática e escritora inglesa.',
    keywords: [],
    sources: [{ title: 'Ada Lovelace' }],
  });

  assert.deepEqual(result.labels, ['Ada', 'Lovelace']);
  assert.equal(result.items.length, 2);
});

test('translateResponse falls back to the answer when a source title has no translatable words', () => {
  const result = translateResponse({
    answer: 'Olá, professor.',
    keywords: [],
    sources: [{ title: 'a' }],
  });

  assert.equal(result.labels.includes('Olá'), true);
  assert.equal(result.items.length > 0, true);
});
