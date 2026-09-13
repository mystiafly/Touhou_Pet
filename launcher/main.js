'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { copySourceFiles, copyPreservedFiles, hasRequiredSourceFiles } = require('./runtime_files');
const { ensureExtracted } = require('./runtime_cache');
const { patchSourceBackendEntryPoint } = require('./source_compat');
const { getLauncherStorageRoot } = require('./storage_paths');

const REPOSITORY = 'mystiafly/Touhou_Pet';
const BRANCH = 'main';
const COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits/${BRANCH}`;
const USER_AGENT = 'RumiaDesktopPetLauncher/1.x';

function getLauncherDir() {
  return getLauncherStorageRoot({
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    appPath: app.getAppPath(),
    override: process.env.RUMIA_LAUNCHER_DIR,
  });
}

function getRuntimeDir() {
  return path.join(getLauncherDir(), 'runtime');
}

function getDependencyDir() {
  return path.join(getLauncherDir(), 'dependency-cache');
}

function getLogDir() {
  return path.join(getLauncherDir(), 'logs');
}

function getLegacyLauncherDir() {
  return app.getPath('userData');
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

function walkFiles(rootDir, callback, relativeDir = '') {
  if (!pathExists(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(rootDir, entry.name);
    const descend = callback(absolutePath, relativePath, entry);
    if (entry.isDirectory() && descend !== false) walkFiles(absolutePath, callback, relativePath);
  }
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

function pythonEnvironmentComplete(root) {
  return [
    'base-python/python.exe',
    'base-python/Lib/os.py',
    'site-packages/fastapi/__init__.py',
    'site-packages/starlette/__init__.py',
    'site-packages/uvicorn/__init__.py',
    'site-packages/mem0/__init__.py',
  ].every((relativePath) => pathExists(path.join(root, relativePath)));
}

function validatePythonEnvironment(root) {
  const pythonPath = path.join(root, 'base-python', 'python.exe');
  const sitePackages = path.join(root, 'site-packages');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ['-c', 'import fastapi, starlette, uvicorn, mem0, langgraph'], {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: sitePackages,
        PYTHONNOUSERSITE: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`固定 Python 环境校验失败：${errors.trim() || `退出码 ${code}`}`)));
  });
}

let dependencyPreparation = null;
let legacyMigration = null;

function migrateLegacyRuntime() {
  if (legacyMigration) return legacyMigration;
  legacyMigration = (async () => {
    const launcherDir = getLauncherDir();
    const legacyDir = getLegacyLauncherDir();
    const sourceRuntime = path.join(legacyDir, 'runtime');
    const targetRuntime = getRuntimeDir();
    if (path.resolve(launcherDir).toLowerCase() === path.resolve(legacyDir).toLowerCase() ||
        !pathExists(sourceRuntime) || pathExists(targetRuntime)) return;
    sendProgress(0, '正在迁移旧版源码和用户数据到启动器目录…');
    await fs.promises.mkdir(launcherDir, { recursive: true });
    await copySourceFiles(sourceRuntime, targetRuntime);
    sendProgress(0, '旧版用户数据已复制，原目录保留不变。');
  })();
  legacyMigration.catch(() => { legacyMigration = null; });
  return legacyMigration;
}

function prepareDependencies() {
  if (dependencyPreparation) return dependencyPreparation;
  dependencyPreparation = (async () => {
    await migrateLegacyRuntime();
    const cacheDir = getDependencyDir();
    const bootstrap = path.join(getBootstrapDir(), 'dependency-cache');
    await fs.promises.mkdir(cacheDir, { recursive: true });
    sendProgress(0, '正在准备固定 Python 依赖，首次启动可能需要几分钟…');
    await ensureExtracted({
      archive: path.join(bootstrap, 'python-env.zip'),
      target: path.join(cacheDir, 'python-env'),
      isComplete: pythonEnvironmentComplete,
      extract: extractZip,
      validate: validatePythonEnvironment,
    });
    sendProgress(0, '正在准备本地嵌入模型…');
    await ensureExtracted({
      archive: path.join(bootstrap, 'models.zip'),
      target: path.join(cacheDir, 'models'),
      isComplete: (root) => pathExists(path.join(root, 'services', 'models', 'hub', 'models--sentence-transformers--all-MiniLM-L6-v2', 'refs', 'main')),
      extract: extractZip,
    });
    const runtimeDir = getRuntimeDir();
    const releaseState = path.join(runtimeDir, 'launcher-state', 'release.json');
    if (pathExists(releaseState) && pathExists(path.join(runtimeDir, 'main.js'))) {
      const state = readJson(releaseState);
      if (state.launcher_source_mode === true) patchSourceBackendEntryPoint(runtimeDir);
    }
    sendProgress(0, '本地依赖已准备完成。');
  })();
  dependencyPreparation.catch(() => { dependencyPreparation = null; });
  return dependencyPreparation;
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
  fs.mkdirSync(runtimeDir, { recursive: true });
  return runtimeDir;
}

function getLocalState() {
  const runtimeDir = ensureRuntimeStore();
  const packagePath = path.join(runtimeDir, 'package.json');
  const releaseStatePath = path.join(runtimeDir, 'launcher-state', 'release.json');
  const pythonRoot = path.join(getDependencyDir(), 'python-env');
  const pythonPath = path.join(pythonRoot, 'base-python', 'python.exe');
  let packageInfo = null;
  let releaseState = null;
  try { if (pathExists(packagePath)) packageInfo = readJson(packagePath); } catch (_error) {}
  try { if (pathExists(releaseStatePath)) releaseState = readJson(releaseStatePath); } catch (_error) {}

  const hasPythonEnvironment = pathExists(path.join(pythonRoot, '.launcher-ready')) && pythonEnvironmentComplete(pythonRoot);
  const sourceReady = releaseState?.launcher_source_mode === true;
  const hasSourceFiles = hasRequiredSourceFiles(runtimeDir);
  const canLaunch = !!packageInfo && sourceReady && hasSourceFiles && hasPythonEnvironment;
  const backendStatus = canLaunch
    ? '最新版源码将使用本地固定依赖环境启动。'
    : (!hasPythonEnvironment ? '固定 Python 依赖尚未准备完成。' :
      (packageInfo && !hasSourceFiles ? '已安装源码缺少默认配置，请重新下载以修复。' : '尚未安装正式程序。'));
  return {
    version: packageInfo?.version || null,
    commit: releaseState?.commit || null,
    hasDependencyCache: pathExists(getDependencyDir()),
    hasPythonEnvironment,
    canLaunch,
    backendStatus,
  };
}

async function installLatestUpdate(sendProgress) {
  await prepareDependencies();
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
    patchSourceBackendEntryPoint(sourceRoot);

    const runtimeDir = ensureRuntimeStore();
    if (pathExists(runtimeDir)) {
      // Keep the rollback copy beside the runtime, never inside it. Renaming a
      // directory into one of its own children would fail on Windows.
      backupRuntime = path.join(path.dirname(runtimeDir), 'runtime-backups', `${Date.now()}-${update.version}`);
      fs.mkdirSync(path.dirname(backupRuntime), { recursive: true });
      fs.renameSync(runtimeDir, backupRuntime);
    }
    fs.mkdirSync(runtimeDir, { recursive: true });
    await copySourceFiles(sourceRoot, runtimeDir);
    if (backupRuntime) await copyPreservedFiles(backupRuntime, runtimeDir);
    writeJson(path.join(runtimeDir, 'launcher-state', 'release.json'), {
      version: update.version,
      commit: update.commit,
      launcher_source_mode: true,
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
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
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
  ipcMain.handle('launcher:get-state', async () => {
    await prepareDependencies();
    return getLocalState();
  });
  ipcMain.handle('launcher:check-for-update', async () => {
    const latest = await getLatestUpdate();
    await prepareDependencies();
    const state = getLocalState();
    return { ...latest, upToDate: state.version === latest.version && state.commit === latest.commit && state.canLaunch };
  });
  ipcMain.handle('launcher:install-update', async () => {
    if (updating) throw new Error('更新正在进行中。');
    updating = true;
    try { return await installLatestUpdate(sendProgress); }
    finally { updating = false; }
  });
  ipcMain.handle('launcher:launch-formal-app', async () => {
    if (updating) throw new Error('请等待更新完成。');
    await prepareDependencies();
    const state = getLocalState();
    if (!state.canLaunch) throw new Error('正式程序尚未准备好，请先下载更新。');
    app.relaunch({ args: process.argv.slice(1).filter((arg) => arg !== '--run-formal').concat('--run-formal') });
    app.exit(0);
  });
  ipcMain.handle('launcher:quit', () => app.quit());
}

const runningFormalApp = process.argv.includes('--run-formal');
if (runningFormalApp) {
  const formalRuntimeDir = getRuntimeDir();
  const cacheDir = getDependencyDir();
  process.env.RUMIA_APP_ROOT = formalRuntimeDir;
  process.env.RUMIA_SOURCE_BACKEND = '1';
  process.env.PYTHON_PATH = path.join(cacheDir, 'python-env', 'base-python', 'python.exe');
  process.env.HF_HOME = path.join(cacheDir, 'models', 'services', 'models');
  process.env.RUMIA_LAUNCHER_BACKEND_LOG = path.join(getLogDir(), 'backend.log');
  fs.mkdirSync(path.dirname(process.env.RUMIA_LAUNCHER_BACKEND_LOG), { recursive: true });
  const sitePackages = path.join(cacheDir, 'python-env', 'site-packages');
  process.env.PYTHONPATH = sitePackages;
  process.env.PYTHONNOUSERSITE = '1';
  process.env.PYTHONIOENCODING = 'utf-8';
  require(path.join(formalRuntimeDir, 'main.js'));
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
      registerHandlers();
      createLauncherWindow();
    });
  }
}
