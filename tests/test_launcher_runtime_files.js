'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { copySourceFiles, copyPreservedFiles, hasRequiredSourceFiles } = require('../launcher/runtime_files');

function put(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

test('fresh download keeps default character configs but excludes dependency caches', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-files-test-'));
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    put(source, 'services/characters/rumia/config.json', 'default');
    put(source, 'main.js', 'main');
    put(source, 'services/web_interface.py', 'backend');
    put(source, 'services/global_config.json', 'global');
    put(source, 'services/models/huge.bin', 'cache');
    put(source, 'dependency-cache/python-env.zip', 'cache');
    await copySourceFiles(source, target);
    assert.equal(fs.readFileSync(path.join(target, 'services/characters/rumia/config.json'), 'utf8'), 'default');
    assert.equal(hasRequiredSourceFiles(target), true);
    assert.equal(fs.existsSync(path.join(target, 'services/models/huge.bin')), false);
    assert.equal(fs.existsSync(path.join(target, 'dependency-cache/python-env.zip')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an old download missing default configuration is not launchable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-files-test-'));
  try {
    put(root, 'main.js', 'main');
    put(root, 'services/web_interface.py', 'backend');
    assert.equal(hasRequiredSourceFiles(root), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('update overlays user configs and memories without moving old caches', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-files-test-'));
  try {
    const source = path.join(root, 'source');
    const previous = path.join(root, 'previous');
    const target = path.join(root, 'target');
    put(source, 'services/characters/rumia/config.json', 'default');
    put(previous, 'services/characters/rumia/config.json', 'personal');
    put(previous, 'services/characters/rumia/daily_history/2026-09-13.json', 'memory');
    put(previous, 'dependency-cache/python-env.zip', 'cache');
    await copySourceFiles(source, target);
    await copyPreservedFiles(previous, target);
    assert.equal(fs.readFileSync(path.join(target, 'services/characters/rumia/config.json'), 'utf8'), 'personal');
    assert.equal(fs.readFileSync(path.join(target, 'services/characters/rumia/daily_history/2026-09-13.json'), 'utf8'), 'memory');
    assert.equal(fs.existsSync(path.join(target, 'dependency-cache/python-env.zip')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
