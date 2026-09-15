'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    clampPetScale,
    getPetScaleBounds,
    getPetWindowSize,
} = require('../window_scale');

test('window scale changes the whole base frame size', () => {
    assert.deepEqual(getPetWindowSize(1), { width: 400, height: 600 });
    assert.deepEqual(getPetWindowSize(1.5), { width: 600, height: 900 });
});

test('window scale is limited by the current work area', () => {
    assert.deepEqual(getPetScaleBounds({ width: 1920, height: 1080 }), { min: 0.5, max: 1.8 });
    assert.equal(clampPetScale(2.0, { width: 1920, height: 1080 }), 1.8);
    assert.equal(clampPetScale(0.1, { width: 1920, height: 1080 }), 0.5);
});

test('invalid scale values safely return the default', () => {
    assert.equal(clampPetScale('not-a-number', { width: 1920, height: 1080 }), 1);
});
