'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { ensureExtracted } = require('../launcher/runtime_cache');

test('an incomplete Python environment is rebuilt before it is marked ready', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-cache-test-'));
  try {
    const archive = path.join(root, 'python-env.zip');
    const target = path.join(root, 'python-env');
    fs.writeFileSync(archive, 'fixture');
    fs.mkdirSync(path.join(target, 'base-python'), { recursive: true });
    fs.writeFileSync(path.join(target, 'base-python', 'python.exe'), 'partial');
    let validated = false;
    await ensureExtracted({
      archive,
      target,
      isComplete: (directory) => fs.existsSync(path.join(directory, 'site-packages', 'starlette', '__init__.py')),
      extract: async (_archive, destination) => {
        fs.mkdirSync(path.join(destination, 'site-packages', 'starlette'), { recursive: true });
        fs.writeFileSync(path.join(destination, 'site-packages', 'starlette', '__init__.py'), 'complete');
      },
      validate: async () => { validated = true; },
    });
    assert.equal(validated, true);
    assert.equal(fs.existsSync(path.join(target, '.launcher-ready')), true);
    assert.equal(fs.readdirSync(root).some((name) => name.startsWith('python-env.incomplete-')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a failed validation keeps the previous environment intact', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-cache-test-'));
  try {
    const archive = path.join(root, 'python-env.zip');
    const target = path.join(root, 'python-env');
    fs.writeFileSync(archive, 'fixture');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'user-file'), 'keep');
    await assert.rejects(ensureExtracted({
      archive,
      target,
      isComplete: () => true,
      extract: async (_archive, destination) => fs.mkdirSync(destination),
      validate: async () => { throw new Error('invalid imports'); },
    }), /invalid imports/);
    assert.equal(fs.readFileSync(path.join(target, 'user-file'), 'utf8'), 'keep');
    assert.equal(fs.existsSync(path.join(target, '.launcher-ready')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
