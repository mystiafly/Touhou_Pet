'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { patchSourceBackendEntryPoint } = require('../launcher/source_compat');

test('repairs the previous launcher injection without stacking another branch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-source-test-'));
  try {
    const mainPath = path.join(root, 'main.js');
    fs.writeFileSync(mainPath,
      "function startBackendService(force = false) {\n" +
      "    if (process.env.RUMIA_SOURCE_BACKEND === '1') {\n" +
      "        return;\n" +
      "    }\n" +
      "    if (!app.isPackaged && process.env.RUMIA_BACKEND_SPAWNED === '1') return;\n" +
      "}\n");
    patchSourceBackendEntryPoint(root);
    const patched = fs.readFileSync(mainPath, 'utf8');
    assert.equal((patched.match(/RUMIA_LAUNCHER_BACKEND_V2/g) || []).length, 1);
    assert.equal((patched.match(/if \(process\.env\.RUMIA_SOURCE_BACKEND === '1'\)/g) || []).length, 1);
    assert.match(patched, /RUMIA_LAUNCHER_BACKEND_LOG/);
    assert.match(patched, /backendProcess && backendProcess\.exitCode === null/);
    patchSourceBackendEntryPoint(root);
    assert.equal(fs.readFileSync(mainPath, 'utf8'), patched);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
