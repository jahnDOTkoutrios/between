import test from 'node:test';
import assert from 'node:assert/strict';
import { typeState, mixColor, stateIndex, pointerAmount, tokenize, metricKey, DEFAULT_A, DEFAULT_B } from '../src/engine/morph.js';
import { summarizeFrames } from '../src/benchmark/runner.js';

test('all numeric properties share exact A/B endpoints and midpoint', () => {
  assert.deepEqual(typeState(DEFAULT_A, DEFAULT_B, 0), { size: 30, weight: 350, tracking: -.5 });
  assert.deepEqual(typeState(DEFAULT_A, DEFAULT_B, 1), { size: 46, weight: 720, tracking: 1.4 });
  assert.equal(typeState(DEFAULT_A, DEFAULT_B, .5).size, 38);
  assert.equal(typeState(DEFAULT_A, DEFAULT_B, .5).weight, 535);
});
test('color interpolates independently without losing exact endpoints', () => {
  assert.equal(mixColor('#000000', '#ffffff', 0), 'rgb(0 0 0)');
  assert.equal(mixColor('#000000', '#ffffff', .5), 'rgb(128 128 128)');
  assert.equal(mixColor('#000000', '#ffffff', 1), 'rgb(255 255 255)');
});
test('sampling is bounded with exact endpoints and half-state error limit', () => {
  assert.equal(stateIndex(-1), 0); assert.equal(stateIndex(1), 64); assert.equal(stateIndex(2), 64);
  for (let i = 0; i <= 1000; i++) assert.ok(Math.abs(stateIndex(i / 1000) / 64 - i / 1000) <= 1 / 128 + 1e-12);
});
test('pointer falloff is symmetric, bounded and strongest at its center', () => {
  assert.equal(pointerAmount(0, 0, null), 0); assert.equal(pointerAmount(0, 0, { x: 0, y: 0 }), 1);
  assert.equal(pointerAmount(-100, 0, { x: 0, y: 0 }), pointerAmount(100, 0, { x: 0, y: 0 }));
  assert.ok(pointerAmount(400, 0, { x: 0, y: 0 }) < pointerAmount(100, 0, { x: 0, y: 0 }));
});
test('tokenization preserves paragraph breaks and whole punctuated words', () => {
  assert.deepEqual(tokenize('In   fading.\r\n\r\nA memory.'), [['In', 'fading.'], [], ['A', 'memory.']]);
  assert.deepEqual(tokenize(''), [[]]);
});
test('color-only edits do not invalidate measurement keys', () => {
  assert.equal(metricKey(DEFAULT_A, DEFAULT_B), metricKey({ ...DEFAULT_A, color: '#ffffff' }, DEFAULT_B));
  assert.notEqual(metricKey(DEFAULT_A, DEFAULT_B), metricKey({ ...DEFAULT_A, size: 31 }, DEFAULT_B));
});
test('benchmark distinguishes JS update cost from RAF delivery and missed frames', () => {
  const result = summarizeFrames([16, 16, 32, 16], [.1, .2, .3, .4], 16);
  assert.equal(result.fps, 50); assert.equal(result.slowFrames, 1); assert.equal(result.estimatedMissedFrames, 1);
  assert.equal(result.frames, 4); assert.equal(result.updateP95Ms, .3);
});
