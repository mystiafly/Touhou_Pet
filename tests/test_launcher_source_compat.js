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

test('launcher update checks do not depend on the rate-limited commits API', () => {
  const launcherMain = fs.readFileSync(path.join(__dirname, '..', 'launcher', 'main.js'), 'utf8');
  const launcherRenderer = fs.readFileSync(path.join(__dirname, '..', 'launcher', 'renderer.js'), 'utf8');

  assert.doesNotMatch(launcherMain, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/commits/);
  assert.match(launcherMain, /raw\.githubusercontent\.com\/\$\{REPOSITORY\}\/\$\{BRANCH\}\/package\.json/);
  assert.match(launcherMain, /archive\/refs\/heads\/\$\{BRANCH\}\.zip/);
  assert.match(launcherMain, /GITEE_REPOSITORY = 'liu2721858715\/touhou_pet'/);
  assert.match(launcherMain, /gitee\.com\/\$\{GITEE_REPOSITORY\}\/raw\/\$\{BRANCH\}\/package\.json/);
  assert.match(launcherMain, /gitee\.com\/\$\{GITEE_REPOSITORY\}\/repository\/archive\/\$\{BRANCH\}\.zip/);
  assert.match(launcherMain, /downloadFromCandidates\(\s*update\.sourceUrls/);
  assert.match(launcherMain, /if \(validate\) await validate\(url\)/);
  assert.match(launcherMain, /upToDate: state\.version === latest\.version && state\.canLaunch/);
  assert.match(launcherRenderer, /formatRevision/);
});

test('keeps the desktop pet entrypoint separate from the launcher entrypoint', () => {
  const desktopMain = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

  assert.match(desktopMain, /createWindow/);
  assert.match(desktopMain, /startBackendService/);
  assert.doesNotMatch(desktopMain, /require\('\.\/runtime_files'\)/);
  assert.doesNotMatch(desktopMain, /require\('\.\/runtime_cache'\)/);
});
