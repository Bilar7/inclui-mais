import test from 'node:test';
import assert from 'node:assert/strict';

class FakeRecognition {
  start() {}
  stop() {}
}

globalThis.window = { SpeechRecognition: FakeRecognition };
const { listen } = await import('../js/core/store.js');

function result(transcript, isFinal) {
  return { 0: { transcript }, isFinal };
}

test('continuous speech emits each finalized segment once and keeps interim text', () => {
  const texts = [];
  const finals = [];
  const recognition = listen('pt-BR', {
    continuous: true,
    onText: (text) => texts.push(text),
    onFinal: (text) => finals.push(text),
  });

  recognition.onresult({ results: [result('Bom dia.', true), result('Estamos começando', false)] });
  recognition.onresult({ results: [result('Bom dia.', true), result('Estamos começando a aula.', true)] });
  recognition.onresult({ results: [result('Bom dia.', true), result('Estamos começando a aula.', true)] });

  assert.equal(recognition.continuous, true);
  assert.deepEqual(finals, ['Bom dia.', 'Estamos começando a aula.']);
  assert.equal(texts.at(-1), 'Bom dia. Estamos começando a aula.');
});

test('one-shot speech waits for the complete final result', () => {
  const finals = [];
  const recognition = listen('pt-BR', { onFinal: (text) => finals.push(text) });

  recognition.onresult({ results: [result('O professor', true), result('explica', false)] });
  assert.deepEqual(finals, []);

  recognition.onresult({ results: [result('O professor', true), result('explica bem.', true)] });
  assert.deepEqual(finals, ['O professor explica bem.']);
});