'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isPreservedPath,
  normalizeRelativePath,
  validateMatchingArtifacts,
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

test('requires backend and source to carry matching metadata', () => {
  const source = { version: '1.52.10', commit: 'abc123' };
  assert.equal(validateMatchingArtifacts(source, {
    format: 1,
    version: '1.52.10',
    source_commit: 'abc123',
  }), true);

  assert.throws(() => validateMatchingArtifacts(source, {
    format: 1,
    version: '1.52.9',
    source_commit: 'abc123',
  }), /版本不匹配/);
  assert.throws(() => validateMatchingArtifacts(source, {
    format: 1,
    version: '1.52.10',
    source_commit: 'def456',
  }), /提交不匹配/);
});
