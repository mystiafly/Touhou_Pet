'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isPreservedPath,
  normalizeRelativePath,
} = require('../launcher/update_policy');

test('normalizes Windows relative paths before applying update rules', () => {
  assert.equal(normalizeRelativePath('.\\services\\characters\\aya\\daily_history\\chat.log'), 'services/characters/aya/daily_history/chat.log');
  assert.equal(isPreservedPath('.\\data\\usage_stats.db'), true);
  assert.equal(isPreservedPath('services/characters/aya/daily_history/chat.log'), true);
  assert.equal(isPreservedPath('services/api/routers/system.py'), false);
});

test('preserves user configuration and character memories', () => {
  assert.equal(isPreservedPath('.env'), true);
  assert.equal(isPreservedPath('services/global_config.json'), true);
  assert.equal(isPreservedPath('services/characters/flandre/favorability.json'), true);
  assert.equal(isPreservedPath('services/characters/flandre/config.json'), true);
  assert.equal(isPreservedPath('services/characters/flandre/presets/custom_presets.json'), true);
  assert.equal(isPreservedPath('services/characters/flandre/presets.json'), false);
});
