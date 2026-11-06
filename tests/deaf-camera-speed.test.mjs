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
  cam.meanings = { Closed_Fist: 'sim' };
  const lm = makeLandmarks();

  for (let i = 0; i < 4; i++) {
    cam.handle(lm, { score: 0.9, categoryName: 'Closed_Fist' });
  }

  assert.equal(commits.length, 1, 'should commit after a few repeated recognitions, not after many frames');
  assert.equal(commits[0].word, 'sim');
  assert.equal(commits[0].kind, 'word');
});

test('DeafCamera confirms a stable medium-confidence gesture after two frames', () => {
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
  cam.meanings = { Thumb_Up: 'olá' };
  const lm = makeLandmarks();

  cam.handle(lm, { score: 0.8, categoryName: 'Thumb_Up' });
  assert.equal(commits.length, 0, 'should not commit an unconfirmed medium-confidence frame');
  cam.handle(lm, { score: 0.8, categoryName: 'Thumb_Up' });

  assert.deepEqual(commits, [{ word: 'olá', kind: 'word' }]);
});

test('DeafCamera draws both hands and recognizes a gesture on the second hand', () => {
  const commits = [];
  let strokes = 0;
  const strokeStyles = [];
  const fillStyles = [];
  const handStates = [];
  const ctx = makeCanvasContext();
  ctx.stroke = () => { strokes++; strokeStyles.push(ctx.strokeStyle); };
  ctx.fill = () => fillStyles.push(ctx.fillStyle);
  const cam = new DeafCamera({
    video: { videoWidth: 640, videoHeight: 480 },
    overlay: { getContext: () => ctx },
    onStatus() {},
    onCandidate() {},
    onCommit: (word, kind) => commits.push({ word, kind }),
    onHand: (visible) => handStates.push(visible),
  });
  cam.mode = 'words';
  cam.meanings = { Victory: 'olá' };
  const hands = [makeLandmarks(), makeLandmarks()];
  const gestures = [
    [{ score: 0.9, categoryName: 'None' }],
    [{ score: 0.9, categoryName: 'Victory' }],
  ];

  cam.onResult({ landmarks: hands, gestures });
  assert.equal(strokes, 84, 'should outline the skeleton for both detected hands');
  assert.ok(strokeStyles.includes('rgba(13,27,51,.9)') && strokeStyles.includes('#fff'), 'skeleton lines should have contrasting outlines');
  assert.ok(fillStyles.includes('#b7ff4a'), 'joints should be clearly visible');
  cam.onResult({ landmarks: hands, gestures });

  assert.deepEqual(commits, [{ word: 'olá', kind: 'word' }], 'should recognize the hand with the detected gesture');
  cam.onResult({ landmarks: [], gestures: [] });
  assert.deepEqual(handStates, [true, false], 'should report when hands enter and leave the camera view');
});

test('DeafCamera confirms lower-confidence gestures from either hand across frames', () => {
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
  cam.meanings = { Thumb_Up: 'olá' };
  const hands = [makeLandmarks(), makeLandmarks()];
  const gestures = [
    [{ score: 0.99, categoryName: 'None' }],
    [{ score: 0.45, categoryName: 'Thumb_Up' }],
  ];

  cam.onResult({ landmarks: hands, gestures });
  cam.onResult({ landmarks: hands, gestures });
  assert.equal(commits.length, 0, 'a weak gesture should be confirmed, not committed from one frame');
  cam.onResult({ landmarks: hands, gestures });

  assert.deepEqual(commits, [{ word: 'olá', kind: 'word' }]);
});

test('DeafCamera recognizes an open-palm wave as movement instead of committing it as a static palm', () => {
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
  cam.meanings = { wave: 'Olá', Open_Palm: 'Espere' };
  const gesture = { score: 0.9, categoryName: 'Open_Palm' };
  for (const x of [0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3]) {
    const lm = makeLandmarks();
    lm[0].x = x;
    cam.handle(lm, gesture);
  }
  assert.equal(commits.length, 0, 'wait for enough motion samples before treating an open palm as static');

  for (const x of [0.4, 0.3]) {
    const lm = makeLandmarks();
    lm[0].x = x;
    cam.handle(lm, gesture);
  }
  assert.deepEqual(commits, [{ word: 'Olá', kind: 'word' }]);
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
  cam.meanings = { Thumb_Up: 'olá' };
  const lm = makeLandmarks();
  cam.pendingFrame = { captureAt: performance.now() - 18, startedAt: performance.now() };
  cam.onResult({ landmarks: [lm], gestures: [[{ score: 0.95, categoryName: 'Thumb_Up' }]] });

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

test('DeafCamera does not resize the overlay when camera dimensions are unchanged', () => {
  let width = 640, height = 480, widthWrites = 0, heightWrites = 0;
  const overlay = {
    getContext: makeCanvasContext,
    get width() { return width; },
    set width(value) { widthWrites++; width = value; },
    get height() { return height; },
    set height(value) { heightWrites++; height = value; },
  };
  const cam = new DeafCamera({
    video: { videoWidth: 640, videoHeight: 480 },
    overlay,
    onStatus() {},
    onCandidate() {},
    onCommit() {},
    onHand() {},
  });

  cam.draw([]);
  cam.draw([]);

  assert.equal(widthWrites, 0);
  assert.equal(heightWrites, 0);
});
