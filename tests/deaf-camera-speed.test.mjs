import test from 'node:test';
import assert from 'node:assert/strict';

import { DeafCamera } from '../js/vision/camera.js';

function makeLandmarks() {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.15 + (i % 5) * 0.08,
    y: 0.2 + Math.floor(i / 5) * 0.08,
    z: 0.02,
  }));
}

function makeCanvasContext() {
  return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {} };
}

test('DeafCamera commits the same gesture quickly without long hold delays', () => {
  const commits = [];
  const cam = new DeafCamera({
    video: { videoWidth: 640, videoHeight: 480 },
    overlay: { getContext: makeCanvasContext },
    onStatus() {},
    onCandidate() {},
    onCommit: (word, kind) => commits.push({ word, kind }),
    onHand() {},
  });

  cam.mode = 'words';
  cam.meanings = { Open_Palm: 'olá' };
  const lm = makeLandmarks();

  for (let i = 0; i < 4; i++) {
    cam.handle(lm, { score: 0.9, categoryName: 'Open_Palm' });
  }

  assert.equal(commits.length, 1, 'should commit after a few repeated recognitions, not after many frames');
  assert.equal(commits[0].word, 'olá');
  assert.equal(commits[0].kind, 'word');
});

test('DeafCamera exposes latency metrics and discards stale frames while busy', () => {
  const commits = [];
  const cam = new DeafCamera({
    video: { videoWidth: 640, videoHeight: 480 },
    overlay: { getContext: makeCanvasContext },
    onStatus() {},
    onCandidate() {},
    onCommit: (word, kind) => commits.push({ word, kind }),
    onHand() {},
  });

  cam.mode = 'words';
  cam.meanings = { Open_Palm: 'olá' };
  const lm = makeLandmarks();
  cam.pendingFrame = { captureAt: performance.now() - 18, startedAt: performance.now() };
  cam.onResult({ landmarks: [lm], gestures: [[{ score: 0.95, categoryName: 'Open_Palm' }]] });

  assert.ok(cam.metrics.captureToResultMs >= 10, 'should record the time from capture to model result');
  assert.equal(cam.metrics.lastDecision.word, 'olá');
  assert.ok(cam.metrics.totalLatencyMs >= cam.metrics.captureToResultMs, 'should accumulate the final latency for the UI update');

  const oldRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  const calls = [];
  cam.on = true;
  cam.inferenceBusy = true;
  cam.lastFrameStamp = 100;
  cam.rec = { recognizeForVideo() { calls.push('infer'); } };
  cam.video = { videoWidth: 640, videoHeight: 480, currentTime: 0.11 };
  cam.loop();

  assert.equal(calls.length, 0, 'should not enqueue a stale frame while the model is still busy');
  assert.ok(cam.metrics.droppedFrames >= 1, 'should count stale frame drops to quantify the non-blocking pipeline');
  globalThis.requestAnimationFrame = oldRAF;
});

test('DeafCamera processes fresh frames through the MediaPipe VIDEO API', () => {
  const cam = new DeafCamera({
    video: { videoWidth: 640, videoHeight: 480, currentTime: 0.1 },
    overlay: { getContext: makeCanvasContext },
    onStatus() {},
    onCandidate() {},
    onCommit() {},
    onHand() {},
  });
  const calls = [];
  cam.on = true;
  cam.rec = {
    recognizeForVideo(video, timestamp) {
      calls.push({ video, timestamp });
      return { landmarks: [], gestures: [] };
    },
  };
  const oldRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;

  cam.loop();

  globalThis.requestAnimationFrame = oldRAF;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].video, cam.video);
  assert.ok(Number.isFinite(calls[0].timestamp));
  assert.equal(cam.metrics.lastFrameAt, 100);
  assert.equal(cam.inferenceBusy, false);
  assert.equal(cam.metrics.processedFrames, 1);
});
