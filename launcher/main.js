'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const {
  isPreservedPath,
  validateMatchingArtifacts,
} = require('./update_policy');

const REPOSITORY = 'mystiafly/Touhou_Pet';
const BRANCH = 'main';
const SOURCE_PACKAGE_URL = `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/package.json`;
const COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits/${BRANCH}`;
const USER_AGENT = 'RumiaDesktopPetLauncher/1.x';

function getRuntimeDir() {
  return path.join(app.getPath('userData'), 'runtime');
}

function getBootstrapDir() {
  return path.join(process.resourcesPath, 'bootstrap');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function copyPath(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

function walkFiles(rootDir, callback, relativeDir = '') {
  if (!pathExists(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(rootDir, entry.name);
    callback(absolutePath, relativePath, entry);
    if (entry.isDirectory()) walkFiles(absolutePath, callback, relativePath);
  }
}

function copySourceFiles(sourceRoot, targetRoot) {
  walkFiles(sourceRoot, (sourcePath, relativePath, entry) => {
    const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
    if (normalized === 'dist/backend' || normalized.startsWith('dist/backend/')) return;
    if (isPreservedPath(relativePath)) return;
    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(targetRoot, relativePath), { recursive: true });
      return;
    }
    copyPath(sourcePath, path.join(targetRoot, relativePath));
  });
}

function copyPreservedFiles(sourceRoot, targetRoot) {
  walkFiles(sourceRoot, (sourcePath, relativePath, entry) => {
    if (!isPreservedPath(relativePath)) return;
    copyPath(sourcePath, path.join(targetRoot, relativePath));
    // A protected directory is copied as a whole, so walking its children again
    // is unnecessary and can cause duplicate work for large history folders.
    if (entry.isDirectory()) return;
  });
}

function requestBuffer(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('远程地址重定向次数过多。'));
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        requestBuffer(new URL(response.headers.location, url).toString(), redirectCount + 1)
          .then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`远程服务器返回 HTTP ${response.statusCode}。`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(30000, () => request.destroy(new Error('连接远程服务器超时。')));
    request.on('error', reject);
  });
}

async function requestJson(url) {
  const buffer = await requestBuffer(url);
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (_error) {
    throw new Error('远程版本清单不是有效 JSON。');
  }
}

function downloadFile(url, destination, onProgress, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('下载地址重定向次数过多。'));
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadFile(new URL(response.headers.location, url).toString(), destination, onProgress, redirectCount + 1)
          .then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`下载失败，远程服务器返回 HTTP ${response.statusCode}。`));
        return;
      }

      const total = Number(response.headers['content-length']) || 0;
      let received = 0;
      const output = fs.createWriteStream(destination);
      response.on('data', (chunk) => {
        received += chunk.length;
        onProgress(total ? (received / total) * 100 : 0);
      });
      response.pipe(output);
      output.on('finish', () => output.close(resolve));
      output.on('error', (error) => {
        output.destroy();
        reject(error);
      });
      response.on('error', (error) => {
        output.destroy();
        reject(error);
      });
    });
    request.setTimeout(120000, () => request.destroy(new Error('下载远程更新超时。')));
    request.on('error', reject);
  });
}

function extractZip(zipPath, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const quotePowerShell = (value) => `'${value.replaceAll("'", "''")}'`;
  const command = `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath ${quotePowerShell(zipPath)} -DestinationPath ${quotePowerShell(destination)} -Force`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    child.stderr?.on('data', (chunk) => { errorOutput += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`解压更新包失败${errorOutput ? `：${errorOutput.trim()}` : '。'}`));
    });
  });
}

function findDirectoryWithFile(rootDir, fileName) {
  if (pathExists(path.join(rootDir, fileName))) return rootDir;
  let found = null;
  walkFiles(rootDir, (absolutePath, _relativePath, entry) => {
    if (found || !entry.isDirectory()) return;
    if (pathExists(path.join(absolutePath, fileName))) found = absolutePath;
  });
  return found;
}

function findSourceRoot(extractedDir) {
  const packageRoot = findDirectoryWithFile(extractedDir, 'package.json');
  if (!packageRoot) throw new Error('源码包缺少 package.json。');
  return packageRoot;
}

function getBackendRoot(extractedDir) {
  const manifestRoot = findDirectoryWithFile(extractedDir, 'backend-manifest.json');
  if (!manifestRoot) throw new Error('后端包缺少 backend-manifest.json。');
  if (!pathExists(path.join(manifestRoot, 'web_interface.exe'))) {
    throw new Error('后端包缺少 web_interface.exe。');
  }
  return manifestRoot;
}

async function getLatestUpdate() {
  const [packageInfo, commitInfo] = await Promise.all([
    requestJson(SOURCE_PACKAGE_URL),
    requestJson(COMMITS_URL),
  ]);
  const version = String(packageInfo.version || '');
  const commit = String(commitInfo.sha || '');
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('远程源码版本清单缺少有效版本号或提交号。');
  }
  return {
    version,
    commit,
    sourceUrl: `https://github.com/${REPOSITORY}/archive/${commit}.zip`,
    backendUrl: `https://github.com/${REPOSITORY}/releases/download/v${version}/Rumia-Backend-${version}-${commit}.zip`,
  };
}

function ensureRuntimeStore() {
  const runtimeDir = getRuntimeDir();
  if (!pathExists(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
    if (pathExists(getBootstrapDir())) copyPath(getBootstrapDir(), runtimeDir);
  } else if (!pathExists(path.join(runtimeDir, 'dependency-cache')) && pathExists(path.join(getBootstrapDir(), 'dependency-cache'))) {
    copyPath(path.join(getBootstrapDir(), 'dependency-cache'), path.join(runtimeDir, 'dependency-cache'));
  }
  fs.mkdirSync(path.join(runtimeDir, 'launcher-state'), { recursive: true });
  return runtimeDir;
}

function getLocalState() {
  const runtimeDir = ensureRuntimeStore();
  const packagePath = path.join(runtimeDir, 'package.json');
  const backendManifestPath = path.join(runtimeDir, 'dist', 'backend', 'backend-manifest.json');
  let packageInfo = null;
  let backendManifest = null;
  try { if (pathExists(packagePath)) packageInfo = readJson(packagePath); } catch (_error) {}
  try { if (pathExists(backendManifestPath)) backendManifest = readJson(backendManifestPath); } catch (_error) {}

  let canLaunch = false;
  let backendStatus = '尚未安装正式程序。';
  if (packageInfo && backendManifest) {
    try {
      validateMatchingArtifacts({ version: packageInfo.version, commit: backendManifest.source_commit }, backendManifest);
      canLaunch = pathExists(path.join(runtimeDir, 'main.js'));
      backendStatus = canLaunch ? '源码与对应后端已匹配。' : '正式程序入口缺失。';
    } catch (error) {
      backendStatus = error.message;
    }
  }
  return {
    version: packageInfo?.version || null,
    commit: backendManifest?.source_commit || null,
    hasDependencyCache: pathExists(path.join(runtimeDir, 'dependency-cache')),
    canLaunch,
    backendStatus,
  };
}

async function installLatestUpdate(sendProgress) {
  const update = await getLatestUpdate();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-launcher-'));
  const sourceZip = path.join(temporaryRoot, 'source.zip');
  const backendZip = path.join(temporaryRoot, 'backend.zip');
  const sourceExtracted = path.join(temporaryRoot, 'source');
  const backendExtracted = path.join(temporaryRoot, 'backend');
  let oldRuntime = null;
  let backupRuntime = null;

  try {
    sendProgress(5, '正在下载最新版源码…');
    await downloadFile(update.sourceUrl, sourceZip, (percent) => sendProgress(5 + percent * 0.3, '正在下载最新版源码…'));
    sendProgress(35, '正在下载对应版本后端…');
    await downloadFile(update.backendUrl, backendZip, (percent) => sendProgress(35 + percent * 0.45, '正在下载对应版本后端…'));
    sendProgress(82, '正在校验源码与后端…');
    await extractZip(sourceZip, sourceExtracted);
    await extractZip(backendZip, backendExtracted);

    const sourceRoot = findSourceRoot(sourceExtracted);
    const backendRoot = getBackendRoot(backendExtracted);
    const sourcePackage = readJson(path.join(sourceRoot, 'package.json'));
    const backendManifest = readJson(path.join(backendRoot, 'backend-manifest.json'));
    if (sourcePackage.version !== update.version) throw new Error('下载的源码版本与远程版本清单不匹配。');
    validateMatchingArtifacts({ version: update.version, commit: update.commit }, backendManifest);

    const runtimeDir = ensureRuntimeStore();
    if (pathExists(runtimeDir)) {
      // Keep the rollback copy beside the runtime, never inside it. Renaming a
      // directory into one of its own children would fail on Windows.
      backupRuntime = path.join(path.dirname(runtimeDir), 'runtime-backups', `${Date.now()}-${update.version}`);
      fs.mkdirSync(path.dirname(backupRuntime), { recursive: true });
      oldRuntime = runtimeDir;
      fs.renameSync(runtimeDir, backupRuntime);
    }
    fs.mkdirSync(runtimeDir, { recursive: true });
    copySourceFiles(sourceRoot, runtimeDir);
    if (backupRuntime) copyPreservedFiles(backupRuntime, runtimeDir);
    copyPath(backendRoot, path.join(runtimeDir, 'dist', 'backend'));
    writeJson(path.join(runtimeDir, 'launcher-state', 'release.json'), {
      version: update.version,
      commit: update.commit,
      updated_at: new Date().toISOString(),
    });
    sendProgress(100, '更新完成，用户数据和依赖缓存已保留。');
    return getLocalState();
  } catch (error) {
    const runtimeDir = getRuntimeDir();
    if (backupRuntime && pathExists(backupRuntime)) {
      if (pathExists(runtimeDir)) fs.rmSync(runtimeDir, { recursive: true, force: true });
      fs.renameSync(backupRuntime, runtimeDir);
    }
    throw error;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

let launcherWindow = null;
let updating = false;

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 820,
    height: 690,
    minWidth: 620,
    minHeight: 560,
    title: '大贤者启动器',
    backgroundColor: '#111018',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  launcherWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  launcherWindow.loadFile(path.join(__dirname, 'index.html'));
  launcherWindow.on('closed', () => { launcherWindow = null; });
}

function sendProgress(percent, message) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('launcher:update-progress', { percent, message });
  }
}

function registerHandlers() {
  ipcMain.handle('launcher:get-state', () => getLocalState());
  ipcMain.handle('launcher:check-for-update', async () => {
    const latest = await getLatestUpdate();
    const state = getLocalState();
    return { ...latest, upToDate: state.version === latest.version && state.commit === latest.commit && state.canLaunch };
  });
  ipcMain.handle('launcher:install-update', async () => {
    if (updating) throw new Error('更新正在进行中。');
    updating = true;
    try { return await installLatestUpdate(sendProgress); }
    finally { updating = false; }
  });
  ipcMain.handle('launcher:launch-formal-app', () => {
    if (updating) throw new Error('请等待更新完成。');
    const state = getLocalState();
    if (!state.canLaunch) throw new Error('正式程序尚未准备好，请先下载更新。');
    app.relaunch({ args: process.argv.slice(1).filter((arg) => arg !== '--run-formal').concat('--run-formal') });
    app.exit(0);
  });
  ipcMain.handle('launcher:quit', () => app.quit());
}

const runningFormalApp = process.argv.includes('--run-formal');
if (runningFormalApp) {
  process.env.RUMIA_APP_ROOT = getRuntimeDir();
  require(path.join(getRuntimeDir(), 'main.js'));
} else {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (launcherWindow) {
        if (launcherWindow.isMinimized()) launcherWindow.restore();
        launcherWindow.show();
        launcherWindow.focus();
      }
    });
    app.whenReady().then(() => {
      ensureRuntimeStore();
      registerHandlers();
      createLauncherWindow();
    });
  }
}
