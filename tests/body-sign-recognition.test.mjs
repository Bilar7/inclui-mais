import test from 'node:test';
import assert from 'node:assert/strict';

import { poseFeatures, poseHandsRaised, poseMotion } from '../js/vision/features.js';
import { classify } from '../js/vision/phrases.js';

function makePose() {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0.2 + (i % 5) * 0.06,
    y: 0.1 + Math.floor(i / 5) * 0.055,
    z: i * 0.002,
    visibility: 1,
  }));
}

test('pose features cover all body landmarks and are independent of camera scale', () => {
  const pose = makePose();
  const scaled = pose.map((p) => ({ ...p, x: p.x * 2, y: p.y * 2, z: p.z * 2 }));

  assert.equal(poseFeatures(pose).length, 33 * 4);
  assert.deepEqual(poseFeatures(scaled), poseFeatures(pose));
});

test('phrase matching distinguishes body movements when hand poses are the same', () => {
  const makeFrames = (armY) => Array.from({ length: 8 }, () => {
    const body = poseFeatures(makePose());
    body[15 * 4 + 1] = armY;
    return { R: null, L: null, body };
  });
  const signs = [
    { words: ['braços baixos'], frames: makeFrames(-0.2) },
    { words: ['braço levantado'], frames: makeFrames(1.2) },
  ];

  assert.equal(classify(makeFrames(1.2), signs)?.word, 'braço levantado');
});

test('body-based recording detects raised pose wrists even without hand landmarks', () => {
  const pose = makePose();
  pose[15].y = 0.4;
  pose[16].y = 0.4;
  pose[23].y = 0.65;
  pose[24].y = 0.65;
  assert.equal(poseHandsRaised(pose), true);
  assert.ok(poseMotion(poseFeatures(pose), poseFeatures(makePose())) > 0.008);
});
