'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const {
  isPreservedPath,
} = require('./update_policy');

const REPOSITORY = 'mystiafly/Touhou_Pet';
const BRANCH = 'main';
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

function copyMissingPath(sourcePath, targetPath) {
  if (!pathExists(sourcePath)) return;
  const sourceStat = fs.statSync(sourcePath);
  if (sourceStat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyMissingPath(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }
  if (!pathExists(targetPath)) copyPath(sourcePath, targetPath);
}

function walkFiles(rootDir, callback, relativeDir = '') {
  if (!pathExists(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(rootDir, entry.name);
    const descend = callback(absolutePath, relativePath, entry);
    if (entry.isDirectory() && descend !== false) walkFiles(absolutePath, callback, relativePath);
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
  const hasPythonArchive = pathExists(path.join(sourceRoot, 'dependency-cache', 'python-env.zip'));
  const hasModelArchive = pathExists(path.join(sourceRoot, 'dependency-cache', 'models.zip'));
  walkFiles(sourceRoot, (sourcePath, relativePath, entry) => {
    const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
    if (hasPythonArchive && (normalized === 'dependency-cache/python-env' || normalized.startsWith('dependency-cache/python-env/'))) {
      return false;
    }
    if (hasModelArchive && (normalized === 'services/models' || normalized.startsWith('services/models/'))) {
      return false;
    }
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

function mirrorUrls(url) {
  if (!url.startsWith('https://github.com/') && !url.startsWith('https://raw.githubusercontent.com/')) {
    return [url];
  }
  return [
    `https://gh-proxy.com/${url}`,
    `https://ghfast.top/${url}`,
    `https://github.moeyy.xyz/${url}`,
    url,
  ];
}

async function requestJson(url) {
  let lastError = null;
  for (const candidate of mirrorUrls(url)) {
    try {
      const buffer = await requestBuffer(candidate);
      return JSON.parse(buffer.toString('utf8'));
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`无法读取远程版本清单：${lastError?.message || '未知网络错误'}`);
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

async function downloadFromMirrors(url, destination, onProgress) {
  let lastError = null;
  for (const candidate of mirrorUrls(url)) {
    try {
      await downloadFile(candidate, destination, onProgress);
      return;
    } catch (error) {
      lastError = error;
      try { fs.rmSync(destination, { force: true }); } catch (_cleanupError) {}
    }
  }
  throw new Error(`无法下载更新包：${lastError?.message || '未知网络错误'}`);
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

function extractZipSync(zipPath, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const quotePowerShell = (value) => `'${value.replaceAll("'", "''")}'`;
  const command = `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath ${quotePowerShell(zipPath)} -DestinationPath ${quotePowerShell(destination)} -Force`;
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command,
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = String(result.stderr || '').trim();
    throw new Error(`解压本地依赖缓存失败${details ? `：${details}` : '。'}`);
  }
}

function ensurePythonEnvironment(runtimeDir) {
  const environmentRoot = path.join(runtimeDir, 'dependency-cache', 'python-env');
  const pythonPath = path.join(environmentRoot, 'base-python', 'python.exe');
  if (pathExists(pythonPath)) return;
  const archivePath = path.join(runtimeDir, 'dependency-cache', 'python-env.zip');
  if (!pathExists(archivePath)) return;
  extractZipSync(archivePath, environmentRoot);
}

function ensureModelCache(runtimeDir) {
  const modelRoot = path.join(runtimeDir, 'services', 'models');
  if (pathExists(modelRoot)) return;
  const archivePath = path.join(runtimeDir, 'dependency-cache', 'models.zip');
  if (!pathExists(archivePath)) return;
  extractZipSync(archivePath, runtimeDir);
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

async function getLatestUpdate() {
  const commitInfo = await requestJson(COMMITS_URL);
  const commit = String(commitInfo.sha || '');
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('远程源码清单缺少有效提交号。');
  }
  const packageInfo = await requestJson(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/package.json`);
  const version = String(packageInfo.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('远程源码缺少有效版本号。');
  return {
    version,
    commit,
    sourceUrl: `https://github.com/${REPOSITORY}/archive/${commit}.zip`,
  };
}

function ensureRuntimeStore() {
  const runtimeDir = getRuntimeDir();
  if (!pathExists(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
  if (pathExists(getBootstrapDir())) {
    // Seed only missing files. This lets a new installer repair an older
    // launcher without replacing user data or an existing dependency cache.
    copyMissingPath(getBootstrapDir(), runtimeDir);
  }
  ensurePythonEnvironment(runtimeDir);
  ensureModelCache(runtimeDir);
  fs.mkdirSync(path.join(runtimeDir, 'launcher-state'), { recursive: true });
  return runtimeDir;
}

function getLocalState() {
  const runtimeDir = ensureRuntimeStore();
  const packagePath = path.join(runtimeDir, 'package.json');
  const releaseStatePath = path.join(runtimeDir, 'launcher-state', 'release.json');
  const pythonPath = path.join(runtimeDir, 'dependency-cache', 'python-env', 'base-python', 'python.exe');
  let packageInfo = null;
  let releaseState = null;
  try { if (pathExists(packagePath)) packageInfo = readJson(packagePath); } catch (_error) {}
  try { if (pathExists(releaseStatePath)) releaseState = readJson(releaseStatePath); } catch (_error) {}

  const hasPythonEnvironment = pathExists(pythonPath);
  const canLaunch = !!packageInfo && pathExists(path.join(runtimeDir, 'main.js')) && hasPythonEnvironment;
  const backendStatus = canLaunch
    ? '最新版源码将使用本地固定依赖环境启动。'
    : (hasPythonEnvironment ? '尚未安装正式程序。' : '缺少固定 Python 依赖环境，请重新安装启动器。');
  return {
    version: packageInfo?.version || null,
    commit: releaseState?.commit || null,
    hasDependencyCache: pathExists(path.join(runtimeDir, 'dependency-cache')),
    hasPythonEnvironment,
    canLaunch,
    backendStatus,
  };
}

async function installLatestUpdate(sendProgress) {
  const update = await getLatestUpdate();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rumia-launcher-'));
  const sourceZip = path.join(temporaryRoot, 'source.zip');
  const sourceExtracted = path.join(temporaryRoot, 'source');
  let backupRuntime = null;

  try {
    sendProgress(5, '正在下载最新版源码…');
    await downloadFromMirrors(update.sourceUrl, sourceZip, (percent) => sendProgress(5 + percent * 0.65, '正在下载最新版源码…'));
    sendProgress(75, '正在校验源码并保留本地依赖…');
    await extractZip(sourceZip, sourceExtracted);

    const sourceRoot = findSourceRoot(sourceExtracted);
    const sourcePackage = readJson(path.join(sourceRoot, 'package.json'));
    if (sourcePackage.version !== update.version) throw new Error('下载的源码版本与远程版本清单不匹配。');

    const runtimeDir = ensureRuntimeStore();
    if (pathExists(runtimeDir)) {
      // Keep the rollback copy beside the runtime, never inside it. Renaming a
      // directory into one of its own children would fail on Windows.
      backupRuntime = path.join(path.dirname(runtimeDir), 'runtime-backups', `${Date.now()}-${update.version}`);
      fs.mkdirSync(path.dirname(backupRuntime), { recursive: true });
      fs.renameSync(runtimeDir, backupRuntime);
    }
    fs.mkdirSync(runtimeDir, { recursive: true });
    copySourceFiles(sourceRoot, runtimeDir);
    if (backupRuntime) copyPreservedFiles(backupRuntime, runtimeDir);
    writeJson(path.join(runtimeDir, 'launcher-state', 'release.json'), {
      version: update.version,
      commit: update.commit,
      updated_at: new Date().toISOString(),
    });
    sendProgress(100, '源码更新完成，用户数据和依赖缓存已保留。');
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
  process.env.RUMIA_SOURCE_BACKEND = '1';
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
